// js/Memories.js
import { supabase } from './supabase.js';

/************************************************************
 * [1] LOGIN/LOGOUT
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;
  userArea.innerHTML = '';

  // Se você usa Supabase Auth:
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    userArea.textContent = user.email || 'Usuário';
    userArea.onclick = async () => {
      if (confirm("Deseja fazer logout?")) {
        await supabase.auth.signOut();
        location.reload();
      }
    };
  } else {
    // Se não há usuário, mostra link de Login
    userArea.innerHTML = `<a href="Criacao.html" style="color:white;"><i class="fas fa-user"></i> Login</a>`;
    userArea.onclick = null;
  }
}

/************************************************************
 * [2] TOAST (Notificação)
 ************************************************************/
function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'my-toast';
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, duration);
}

/************************************************************
 * [3] VARIÁVEIS GLOBAIS
 ************************************************************/
let allStories = [];
let currentOffset = 0;
const initialCount = 4; // exibir 4 cartões de destaque
const increment = 4;
const container = document.getElementById('featuredStories');

// Modal
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const modalFullText = document.getElementById('modalFullText');
const modalInfo = document.getElementById('modalInfo');
const warningOverlay = document.getElementById('warningOverlay');
const warningYes = document.getElementById('warningYes');
const warningNo = document.getElementById('warningNo');

let isModalOpen = false;
let currentStoryId = null;
let originalText = "";

// Se quiser controlar curtidas localmente:
let likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');

/************************************************************
 * [4] Carregar Histórias (do Supabase)
 ************************************************************/
async function loadAllStories() {
  // Busca 100 histórias (ou quantas quiser) para exibir
  // ex.: da tabela "destaque"
  const { data: rows, error } = await supabase
    .from('destaque')
    .select('*')
    .order('data_criacao', { ascending: false })
    .limit(100);

  if (error) {
    console.error("Erro ao carregar histórias:", error.message);
    return;
  }

  if (!rows || rows.length === 0) {
    // Caso não haja linhas, definimos uma "dummy"
    rows.push({
      id: 'dummy123',
      titulo: "Exemplo de História",
      sinopse: "Linha 1 da história\nLinha 2 da história\nLinha 3...\n",
      autor: "",
      bloqueio2: true,  // se define que deve truncar a 2 linhas
      historia_completa: "Texto completo aqui.",
      curtidas: 0
    });
  }
  // Transformamos em "cartao" com a mesma estrutura que seu código usa
  allStories = rows.map((st) => {
    // Monta a estrutura "cartao"
    const cartao = {
      tituloCartao: st.titulo || "Sem Título",
      sinopseCartao: (st.sinopse || "").substring(0, 150),
      historiaCompleta: st.historia_completa || "",
      dataCartao: st.data_criacao || "",
      autorCartao: st.autor || "",
      categorias: [], // se quiser
      likes: st.curtidas || 0
    };
    // se st.bloqueio2 for true, iremos truncar
    return {
      id: st.id,
      bloqueio2: !!st.bloqueio2,
      titulo: st.titulo,
      descricao: st.sinopse,  // ou outra
      cartao
    };
  });
}

/************************************************************
 * [5.1] Formatador para sinopse (4 linhas por parágrafo)
 ************************************************************/
function formatarPor4Linhas(text) {
  const lines = text.split('\n');
  let paragrafos = [];
  let buffer = [];
  for (let i = 0; i < lines.length; i++) {
    buffer.push(lines[i]);
    if (buffer.length === 4) {
      paragrafos.push(buffer.join('<br>'));
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    paragrafos.push(buffer.join('<br>'));
  }
  return paragrafos.map(p => `<p style="text-align: justify;">${p}</p>`).join('');
}

/************************************************************
 * [5.2] Formatador para leitura com marcação
 ************************************************************/
function formatarTextoParaLeitura(text) {
  const lines = text.split('\n');
  let paragrafos = [];
  let buffer = [];
  let wordIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const words = lines[i].split(' ').map(word => {
      return `<span class="reading-word" data-index="${wordIndex}" onclick="markReadingPosition(this)">${word}</span>`;
    });
    wordIndex += words.length;
    buffer.push(words.join(' '));
    // A cada 4 "linhas", criamos um <p>
    if (buffer.length === 4) {
      paragrafos.push(`<p style="text-align: justify;">${buffer.join('<br>')}</p>`);
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    paragrafos.push(`<p style="text-align: justify;">${buffer.join('<br>')}</p>`);
  }
  return paragrafos.join('');
}

/************************************************************
 * [5.3] Marcar posição de leitura
 ************************************************************/
function markReadingPosition(element) {
  const index = element.getAttribute('data-index');
  localStorage.setItem('readingPosition_' + currentStoryId, index);
  showToast("Posição de leitura salva (palavra " + index + ")");
}

/************************************************************
 * [5.4] Destacar a palavra marcada
 ************************************************************/
function destacarPalavra() {
  const savedIndex = localStorage.getItem('readingPosition_' + currentStoryId);
  if (savedIndex !== null) {
    const wordSpan = modalFullText.querySelector(`[data-index="${savedIndex}"]`);
    if (wordSpan) {
      wordSpan.style.background = 'yellow';
      wordSpan.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

/************************************************************
 * [5.5] Criar o cartão
 ************************************************************/
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'featured-sheet';

  // Título
  const titleEl = document.createElement('div');
  titleEl.className = 'sheet-title';
  titleEl.textContent = story.cartao.tituloCartao || 'Sem Título';
  div.appendChild(titleEl);

  // Sinopse no cartão
  const sinopseEl = document.createElement('div');
  sinopseEl.className = 'sheet-sinopse';
  sinopseEl.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao || '(sem sinopse)');
  div.appendChild(sinopseEl);

  // Clique => modal
  div.addEventListener('click', () => {
    isModalOpen = true;
    currentStoryId = story.id;
    modalTitle.textContent = story.cartao.tituloCartao || "Sem Título";
    // exibe apenas a sinopse no início
    modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao || '(sem sinopse)');
    modalInfo.innerHTML = '';

    // Botão “Ler”
    const lerBtn = document.createElement('button');
    lerBtn.textContent = 'Ler';
    lerBtn.addEventListener('click', () => {
      modalTitle.textContent = story.titulo || "História Completa";
      originalText = story.cartao.historiaCompleta || '(sem história completa)';
      // Se "bloqueio2" for true => limita a 2 linhas
      if (story.bloqueio2) {
        const lines = originalText.split('\n');
        if (lines.length > 2) {
          originalText = lines.slice(0, 2).join('\n') + '\n...';
        }
      }
      modalFullText.innerHTML = formatarTextoParaLeitura(originalText);
    });
    modalFullText.appendChild(lerBtn);

    // Botão "Continuar" => só aparece se houver position salva e !bloqueio2
    let continuarBtn = document.getElementById('continuarBtn');
    if (!continuarBtn) {
      continuarBtn = document.createElement('button');
      continuarBtn.id = 'continuarBtn';
      continuarBtn.textContent = 'Continuar';
      continuarBtn.addEventListener('click', () => {
        // Recarrega a história completa e destaca
        const storyAtual = allStories.find(s => s.id == currentStoryId);
        if (storyAtual) {
          modalTitle.textContent = storyAtual.titulo || "História Completa";
          originalText = storyAtual.cartao.historiaCompleta || '(sem história completa)';
          if (storyAtual.bloqueio2) {
            const lines = originalText.split('\n');
            if (lines.length > 2) {
              originalText = lines.slice(0, 2).join('\n') + '\n...';
            }
          }
          modalFullText.innerHTML = formatarTextoParaLeitura(originalText);
          setTimeout(destacarPalavra, 100);
        }
      });
      modalFullText.appendChild(continuarBtn);
    }
    if (story.bloqueio2) {
      continuarBtn.style.display = 'none';
    } else {
      const savedPosition = localStorage.getItem('readingPosition_' + story.id);
      continuarBtn.style.display = savedPosition ? 'inline-block' : 'none';
    }

    modalOverlay.style.display = 'flex';
  });

  return div;
}

/************************************************************
 * [6] Placeholder
 ************************************************************/
function createPlaceholderCard() {
  const div = document.createElement('div');
  div.className = 'featured-sheet';
  const titleEl = document.createElement('div');
  titleEl.className = 'sheet-title';
  titleEl.textContent = 'Placeholder';
  div.appendChild(titleEl);
  const sinopseEl = document.createElement('div');
  sinopseEl.className = 'sheet-sinopse';
  sinopseEl.textContent = '(sem história)';
  div.appendChild(sinopseEl);
  return div;
}

/************************************************************
 * [7] Filtro, Ordenar, Pesquisa
 ************************************************************/
function matchesSearch(story, searchInput) {
  const text = searchInput.trim().toLowerCase();
  if (!text) return true;
  const splitted = text.split(/\s+/);
  const t = (story.cartao.tituloCartao || '').toLowerCase();
  const a = (story.cartao.autorCartao || '').toLowerCase();
  if (splitted.length === 1) {
    return t.includes(splitted[0]) || a.includes(splitted[0]);
  } else {
    const lastToken = splitted[splitted.length - 1];
    const firstTokens = splitted.slice(0, splitted.length - 1).join(' ');
    return t.includes(firstTokens) && a.includes(lastToken);
  }
}

function getFilteredStories() {
  let arr = [...allStories];
  const searchInput = (document.getElementById('searchBar')?.value || '').toLowerCase();
  arr = arr.filter(story => matchesSearch(story, searchInput));
  const cat = document.getElementById('category-filter') ? document.getElementById('category-filter').value : '';
  if (cat) {
    arr = arr.filter(h => h.cartao.categorias && h.cartao.categorias.includes(cat));
  }
  const sortFilter = document.getElementById('sort-filter') ? document.getElementById('sort-filter').value : '';
  if (sortFilter === 'date') {
    arr.sort((a, b) => {
      const dataA = a.cartao.dataCartao || '1900-01-01';
      const dataB = b.cartao.dataCartao || '1900-01-01';
      return dataA.localeCompare(dataB);
    });
  } else if (sortFilter === 'popularity') {
    arr.sort((a, b) => {
      const popA = a.cartao.likes || 0;
      const popB = b.cartao.likes || 0;
      return popB - popA;
    });
  }
  return arr;
}

/************************************************************
 * [8] Exibir os Cartões (Batch)
 ************************************************************/
function showBatch(count) {
  const filtered = getFilteredStories();
  if (filtered.length === 0) {
    return;
  }
  const end = currentOffset + count;
  const realSlice = filtered.slice(currentOffset, end);
  realSlice.forEach(story => {
    container.appendChild(createStoryCard(story));
  });
  currentOffset += count;
}

/************************************************************
 * [9] Inicialização
 ************************************************************/
function initialLoad() {
  container.innerHTML = '';
  currentOffset = 0;
  showBatch(initialCount);
}
function loadMore() {
  showBatch(increment);
}
function handleFilterOrSort() {
  container.innerHTML = '';
  currentOffset = 0;
  showBatch(initialCount);
}

/************************************************************
 * [10] Modal e Aviso (Clique Fora)
 ************************************************************/
if (modalClose) {
  modalClose.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
    isModalOpen = false;
  });
}
if (modalOverlay) {
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay && isModalOpen) {
      warningOverlay.style.display = 'flex';
    }
  });
}
if (warningYes && warningNo) {
  warningYes.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
    warningOverlay.style.display = 'none';
    isModalOpen = false;
  });
  warningNo.addEventListener('click', () => {
    warningOverlay.style.display = 'none';
  });
}

/************************************************************
 * [11] Evento DOMContentLoaded
 ************************************************************/
document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  // Em vez de loadAllStories() local, agora iremos 
  // buscar do Supabase ou do local?
  await loadAllStories();  // supabase
  
  initialLoad(); // exibe
  const searchBar = document.getElementById('searchBar');
  const categoryFilter = document.getElementById('category-filter');
  const sortFilter = document.getElementById('sort-filter');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  if (categoryFilter) {
    categoryFilter.addEventListener('change', handleFilterOrSort);
  }
  if (sortFilter) {
    sortFilter.addEventListener('change', handleFilterOrSort);
  }
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMore);
  }
  if (searchBar) {
    searchBar.addEventListener('input', () => {
      container.innerHTML = '';
      currentOffset = 0;
      showBatch(initialCount);
    });
  }

  // Se já existe #continuarBtn
  const continuarBtn = document.getElementById('continuarBtn');
  if (continuarBtn) {
    continuarBtn.addEventListener('click', () => {
      const story = allStories.find(s => s.id == currentStoryId);
      if (story) {
        modalTitle.textContent = story.titulo || "História Completa";
        originalText = story.cartao.historiaCompleta || '(sem história completa)';
        if (story.bloqueio2) {
          const lines = originalText.split('\n');
          if (lines.length > 2) {
            originalText = lines.slice(0, 2).join('\n') + '\n...';
          }
        }
        modalFullText.innerHTML = formatarTextoParaLeitura(originalText);
        setTimeout(destacarPalavra, 100);
      }
    });
  }
});
