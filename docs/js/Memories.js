/************************************************************
 * [1] LOGIN/LOGOUT
 ************************************************************/
function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;
  userArea.innerHTML = '';
  const userData = JSON.parse(localStorage.getItem('loggedUser'));
  if (userData && userData.username) {
    userArea.innerHTML = userData.username;
    userArea.onclick = () => {
      if (confirm("Deseja fazer logout?")) {
        localStorage.removeItem('loggedUser');
        location.reload();
      }
    };
  } else {
    userArea.innerHTML = `<a href="Criacao.html" style="color:white;">
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
const initialCount = 4; // exibir 4 cartões de destaque
const increment = 4;
const container = document.getElementById('featuredStories');

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

let likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');

/************************************************************
 * [4] Carregar Histórias
 ************************************************************/
function loadAllStories() {
  // Para aplicar o limite de 2 linhas, os dados devem vir sem a propriedade "cartao"
  // (ou seja, usando "descricao"). Se não houver histórias salvas, usamos dummy data.
  const raw = JSON.parse(localStorage.getItem('historias')) || [];
  if (raw.length === 0) {
    raw.push({
      id: 1,
      titulo: "Exemplo de História",
      descricao: "Linha 1 da história\nLinha 2 da história\nLinha 3 da história\nLinha 4 da história"
    });
  }
  // Para cada história que não possuir "cartao", define a flag bloqueio2 e cria um cartão padrão a partir da "descricao"
  const transformed = raw.map(st => {
    if (!st.cartao) {
      st.bloqueio2 = true; // Flag para limitar a 2 linhas
      st.cartao = {
        tituloCartao: st.titulo || "Sem Título",
        sinopseCartao: (st.descricao || "").substring(0, 150) || "(sem sinopse)",
        historiaCompleta: st.descricao || "",
        dataCartao: "",
        autorCartao: "",
        categorias: [],
        likes: 0
      };
    }
    return st;
  });
  allStories = transformed;
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
 * [5.2] Formatador para leitura completa com marcação
 ************************************************************/
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
      let paragraph = `<p style="text-align: justify;">${buffer.join('<br>')}</p>`;
      paragrafos.push(paragraph);
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    let paragraph = `<p style="text-align: justify;">${buffer.join('<br>')}</p>`;
    paragrafos.push(paragraph);
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
 * [5.5] Criar o cartão da história
 ************************************************************/
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'featured-sheet';

  // Título
  const titleEl = document.createElement('div');
  titleEl.className = 'sheet-title';
  titleEl.textContent = story.cartao.tituloCartao || 'Sem Título';
  div.appendChild(titleEl);

  // Sinopse (exibida no cartão)
  const sinopseEl = document.createElement('div');
  sinopseEl.className = 'sheet-sinopse';
  sinopseEl.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao || '(sem sinopse)');
  div.appendChild(sinopseEl);

  // Ao clicar no cartão, abre o modal
  div.addEventListener('click', () => {
    isModalOpen = true;
    currentStoryId = story.id;
    modalTitle.textContent = story.cartao.tituloCartao || "Sem Título";
    modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao || '(sem sinopse)');
    modalInfo.innerHTML = '';

    // Botão “Ler” – carrega a história completa com palavras clicáveis
    const lerBtn = document.createElement('button');
    lerBtn.textContent = 'Ler';
    lerBtn.addEventListener('click', () => {
      modalTitle.textContent = story.titulo || "História Completa";
      originalText = story.cartao.historiaCompleta || '(sem história completa)';
      // Se a história não possuir cartão, limita a 2 linhas
      if (story.bloqueio2) {
        const lines = originalText.split('\n');
        if (lines.length > 2) {
          originalText = lines.slice(0, 2).join('\n') + '\n...';
        }
      }
      modalFullText.innerHTML = formatarTextoParaLeitura(originalText);
    });
    modalFullText.appendChild(lerBtn);

    // Botão "Continuar" – só aparece se existir uma posição salva E se existir cartão (ou seja, se não houver bloqueio)
    let continuarBtn = document.getElementById('continuarBtn');
    if (!continuarBtn) {
      continuarBtn = document.createElement('button');
      continuarBtn.id = 'continuarBtn';
      continuarBtn.textContent = 'Continuar';
      continuarBtn.addEventListener('click', () => {
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
    // Se a história não tiver cartão (flag bloqueio2), o botão "Continuar" será escondido
    if (story.bloqueio2) {
      continuarBtn.style.display = 'none';
    } else {
      const savedPosition = localStorage.getItem('readingPosition_' + story.id);
      if (savedPosition !== null) {
        continuarBtn.style.display = 'inline-block';
      } else {
        continuarBtn.style.display = 'none';
      }
    }

    modalOverlay.style.display = 'flex';
  });

  return div;
}

/************************************************************
 * [6] Cartão Placeholder (caso falte histórias)
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
    // Se não houver histórias publicadas, não exibe nenhum cartão
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
 * [10] Modal e Aviso de Clique Fora
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
document.addEventListener('DOMContentLoaded', () => {
  exibirUsuarioLogado();
  loadAllStories();
  initialLoad();

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

  // Se o botão "Continuar" já existir (no HTML), adiciona seu event listener
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
