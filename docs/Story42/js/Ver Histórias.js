/************************************************************
 * VerHistorias.js — Exemplo usando apenas Supabase
 * (sem localStorage para histórias ou login).
 ************************************************************/

import { supabase } from './supabase.js';

/************************************************************
 * [1] LOGIN/LOGOUT com Supabase
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;

  userArea.innerHTML = '...carregando...';

  // Busca o usuário logado via Supabase Auth
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Erro ao obter usuário:', error.message);
    userArea.innerHTML = '<a href="Criacao.html" style="color:white;">Login</a>';
    return;
  }

  if (user) {
    // Exibe e possibilita logout
    userArea.innerHTML = user.email; // ou user.user_metadata?.name, etc.
    userArea.onclick = async () => {
      if (confirm("Deseja fazer logout?")) {
        const { error: logoutError } = await supabase.auth.signOut();
        if (logoutError) {
          alert('Erro ao fazer logout: ' + logoutError.message);
        } else {
          location.reload();
        }
      }
    };
  } else {
    // Se não tiver usuário, mostra link p/ login
    userArea.innerHTML = `
      <a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
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
const initialCount = 20; // Exibir 20 cartões
const increment = 5;     // Ao clicar "Carregar Mais", soma 5

// Seletores
const container      = document.getElementById('storiesContainer');
const categoryFilter = document.getElementById('category-filter');
const sortFilter     = document.getElementById('sort-filter');
const searchBar      = document.getElementById('searchBar');
const loadMoreBtn    = document.getElementById('loadMoreBtn');

const modalOverlay   = document.getElementById('modalOverlay');
const modalClose     = document.getElementById('modalClose');
const modalTitle     = document.getElementById('modalTitle');
const modalFullText  = document.getElementById('modalFullText');
const modalInfo      = document.getElementById('modalInfo');
const warningOverlay = document.getElementById('warningOverlay');
const warningYes     = document.getElementById('warningYes');
const warningNo      = document.getElementById('warningNo');

let isModalOpen = false;
let currentStoryId = null;
let originalText = ""; // p/ modal de leitura

/************************************************************
 * [4] Buscar Histórias do Supabase
 ************************************************************/
async function loadAllStories() {
  try {
    const { data, error } = await supabase
      .from('historia') // Ajuste se sua tabela tiver outro nome
      .select(`
        id,
        titulo,
        sinopse,
        historia_completa,
        autor,
        likes,
        categorias,
        bloqueio10,
        data_criacao
      `)
      .order('data_criacao', { ascending: false });

    if (error) {
      console.error("Erro ao buscar historias:", error);
      showToast("Erro ao carregar histórias!");
      return;
    }

    // Converte p/ formato de "cartao"
    allStories = data.map(st => ({
      id: st.id,
      titulo: st.titulo || "(Sem Título)",
      cartao: {
        tituloCartao: st.titulo || "(Sem Título)",
        sinopseCartao: st.sinopse || "",
        historiaCompleta: st.historia_completa || "",
        autorCartao: st.autor || "Anônimo",
        likes: st.likes || 0,
        categorias: st.categorias || []
      },
      bloqueio10: !!st.bloqueio10,
      dataCartao: st.data_criacao || "1900-01-01",
      descricao: st.sinopse || ""
    }));
  } catch (err) {
    console.error("Erro inesperado ao buscar historias:", err);
    showToast("Erro inesperado!");
  }
}

/************************************************************
 * [5] Formatadores (Leitura, etc.)
 ************************************************************/
// Exemplo "4-linhas"
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
  if (buffer.length > 0) paragrafos.push(buffer.join('<br>'));
  return paragrafos.map(p => `<p style="text-align: justify;">${p}</p>`).join('');
}

// Exemplo "Texto p/ Leitura" c/ spans
function formatarTextoParaLeitura(text) {
  const lines = text.split('\n');
  let paragrafos = [];
  let buffer = [];
  let wordIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    let words = lines[i].split(' ').map(word => {
      let span = `<span class="reading-word" data-index="${wordIndex}" onclick="markReadingPosition(this)">${word}</span>`;
      wordIndex++;
      return span;
    });
    buffer.push(words.join(' '));
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

// Salva posição de leitura
function markReadingPosition(element) {
  const index = element.getAttribute('data-index');
  // Se quiser associar por usuário, teria que gravar em outra tabela.
  // Aqui, apenas exibo notificação:
  showToast("Posição de leitura salva (palavra " + index + ")"); 
}

// Tentar destacar a última palavra marcada (exemplo)
function destacarPalavra() {
  // Se quisesse armazenar `index` em localStorage, aqui se recuperaria.
  // Ex.: localStorage.getItem(`readingPos_${currentStoryId}`)
  // Deixarei exemplificado:
  const savedIndex = null; // se tivesse algo salvo
  if (savedIndex) {
    const wordSpan = modalFullText.querySelector(`[data-index="${savedIndex}"]`);
    if (wordSpan) {
      wordSpan.style.background = 'yellow';
      wordSpan.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

/************************************************************
 * [6] Criar Cartão
 ************************************************************/
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  // Título
  const titleEl = document.createElement('div');
  titleEl.className = 'sheet-title';
  titleEl.textContent = story.cartao.tituloCartao;
  div.appendChild(titleEl);

  // Sinopse
  const sinopseEl = document.createElement('div');
  sinopseEl.className = 'sheet-sinopse';
  sinopseEl.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  div.appendChild(sinopseEl);

  // Ao clicar => modal
  div.addEventListener('click', () => {
    isModalOpen = true;
    currentStoryId = story.id;
    modalTitle.textContent = story.cartao.tituloCartao || "(Sem Título)";
    modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao || "(sem sinopse)");
    modalInfo.innerHTML = "";

    // Botão "Ler"
    const lerBtn = document.createElement('button');
    lerBtn.textContent = 'Ler';
    lerBtn.addEventListener('click', () => {
      modalTitle.textContent = story.titulo || "História Completa";
      originalText = story.cartao.historiaCompleta || "(sem história)";
      if (story.bloqueio10) {
        const lines = originalText.split('\n');
        if (lines.length > 2) {
          originalText = lines.slice(0, 2).join('\n') + '\n...';
        }
      }
      modalFullText.innerHTML = formatarTextoParaLeitura(originalText);
    });
    modalFullText.appendChild(lerBtn);

    // Botão "Continuar"
    let continuarBtn = document.getElementById('continuarBtn');
    if (!continuarBtn) {
      continuarBtn = document.createElement('button');
      continuarBtn.id = 'continuarBtn';
      continuarBtn.textContent = 'Continuar';
      continuarBtn.addEventListener('click', () => {
        modalTitle.textContent = story.titulo || "História Completa";
        let full = story.cartao.historiaCompleta || "(sem história)";
        if (story.bloqueio10) {
          const lines = full.split('\n');
          if (lines.length > 2) {
            full = lines.slice(0, 2).join('\n') + '\n...';
          }
        }
        modalFullText.innerHTML = formatarTextoParaLeitura(full);
        setTimeout(destacarPalavra, 100);
      });
      modalFullText.appendChild(continuarBtn);
    }
    if (story.bloqueio10) {
      continuarBtn.style.display = 'none';
    } else {
      continuarBtn.style.display = 'inline-block';
    }

    modalOverlay.style.display = 'flex';
  });

  // Botão Curtir
  const likeContainer = document.createElement('div');
  likeContainer.style.marginTop = '10px';

  const likeBtn = document.createElement('button');
  likeBtn.style.fontSize = '24px';
  likeBtn.style.border = 'none';
  likeBtn.style.background = 'none';
  likeBtn.style.cursor = 'pointer';

  const likeCount = document.createElement('span');
  likeCount.style.marginLeft = '8px';

  function updateLikeUI() {
    // Poderia ter verificação se o user já curtiu. Exemplo simples:
    likeBtn.textContent = '❤️';
    likeCount.textContent = `${story.cartao.likes} curtidas`;
  }
  updateLikeUI();

  likeBtn.addEventListener('click', async (e) => {
    e.stopPropagation(); // Para não abrir modal
    story.cartao.likes++;
    updateLikeUI();
    showToast("Obrigado pelo like!");

    // Atualiza no Supabase
    const { error } = await supabase
      .from('historia')
      .update({ likes: story.cartao.likes })
      .eq('id', story.id);

    if (error) {
      console.error("Erro ao atualizar likes:", error);
      showToast("Falha ao salvar like!");
    }
  });

  likeContainer.appendChild(likeBtn);
  likeContainer.appendChild(likeCount);
  div.appendChild(likeContainer);

  // Categorias
  const catContainer = document.createElement('div');
  catContainer.className = 'sheet-categorias';
  if (story.cartao.categorias && story.cartao.categorias.length > 0) {
    story.cartao.categorias.forEach(cat => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = cat;
      catContainer.appendChild(badge);
    });
  } else {
    const noCat = document.createElement('span');
    noCat.className = 'badge';
    noCat.textContent = 'Sem Categoria';
    catContainer.appendChild(noCat);
  }
  div.appendChild(catContainer);

  return div;
}

/************************************************************
 * [7] Placeholder
 ************************************************************/
function createPlaceholderCard() {
  const div = document.createElement('div');
  div.className = 'sheet sheet-placeholder';
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
 * [8] Busca / Filtro / Ordenar
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
    const last = splitted[splitted.length - 1];
    const firsts = splitted.slice(0, splitted.length - 1).join(' ');
    return t.includes(firsts) && a.includes(last);
  }
}

function getFilteredStories() {
  let arr = [...allStories];
  // Busca
  const searchInput = (searchBar?.value || '').toLowerCase();
  arr = arr.filter(story => matchesSearch(story, searchInput));

  // Filtro por categoria
  const cat = categoryFilter ? categoryFilter.value : '';
  if (cat) {
    arr = arr.filter(st => st.cartao.categorias && st.cartao.categorias.includes(cat));
  }

  // Ordenação
  const sortMode = sortFilter ? sortFilter.value : '';
  if (sortMode === 'date') {
    arr.sort((a, b) => {
      const da = a.dataCartao || '1900-01-01';
      const db = b.dataCartao || '1900-01-01';
      return da.localeCompare(db);
    });
  } else if (sortMode === 'popularity') {
    arr.sort((a, b) => (b.cartao.likes || 0) - (a.cartao.likes || 0));
  }

  return arr;
}

/************************************************************
 * [9] Paginação p/ exibir cartões
 ************************************************************/
function showBatch(count) {
  const filtered = getFilteredStories();
  if (filtered.length === 0) return;

  const end = currentOffset + count;
  const realSlice = filtered.slice(currentOffset, end);
  realSlice.forEach(story => {
    container.appendChild(createStoryCard(story));
  });
  currentOffset += count;

  // Se acabou e ainda sobrou "slot", exibe placeholders
  const needed = count - realSlice.length;
  if (needed > 0 && (currentOffset + needed) > filtered.length) {
    for (let i = 0; i < needed; i++) {
      container.appendChild(createPlaceholderCard());
    }
  }
  if (loadMoreBtn) loadMoreBtn.disabled = false;
}

/************************************************************
 * [10] Carregamento Inicial
 ************************************************************/
async function initialLoad() {
  // 1) Carrega usuário (já foi no exibirUsuarioLogado, mas ok)
  // 2) Busca histórias do Supabase
  await loadAllStories();
  // 3) Reseta e exibe
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
 * [11] DOMContentLoaded
 ************************************************************/
document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await initialLoad();

  // Filtros e busca
  if (categoryFilter) categoryFilter.addEventListener('change', handleFilterOrSort);
  if (sortFilter)     sortFilter.addEventListener('change', handleFilterOrSort);
  if (loadMoreBtn)    loadMoreBtn.addEventListener('click', loadMore);
  if (searchBar) {
    searchBar.addEventListener('input', () => {
      container.innerHTML = '';
      currentOffset = 0;
      showBatch(initialCount);
    });
  }

  // Modal e aviso "clique fora"
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
});
