// js/VerHistorias.js
import { supabase } from './supabase.js';

let allStories = [];
let currentOffset = 0;
const initialCount = 20;
const increment = 5;

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
const continuarBtn   = document.getElementById('continuarBtn');

let isModalOpen    = false;
let currentStoryId = null;
let originalText   = "";

let likedStories   = JSON.parse(localStorage.getItem('likedStories') || '[]');
let categoryMap    = {};  // mapeia id → nome

/************************************************************
 * [1] Exibe usuário logado ou link de login
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) {
    userArea.innerHTML = `<a href="Criacao.html" style="color:white">
      <i class="fas fa-user"></i> Login
    </a>`;
    return;
  }
  const userId = session.user.id;
  const { data: profile } = await supabase
    .from('profiles').select('username').eq('id', userId).single();
  const nome = profile?.username || session.user.email;
  userArea.innerHTML = nome;
  userArea.onclick = () => {
    if (confirm("Deseja fazer logout?")) {
      supabase.auth.signOut().then(({ error }) => {
        if (!error) window.location.href = "Criacao.html";
      });
    }
  };
}

/************************************************************
 * [2] Busca categorias (id → nome)
 ************************************************************/
async function fetchCategories() {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome');
  if (!error && data) {
    categoryMap = Object.fromEntries(data.map(c => [c.id, c.nome]));
  }
}

/************************************************************
 * [3] Busca histórias + cartões no Supabase
 ************************************************************/
async function fetchStoriesFromSupabase() {
  // Busca todos os cartões, com a história e as categorias associadas
  const { data, error } = await supabase
    .from('cartoes')
    .select(`
      historia_id,
      titulo_cartao,
      sinopse_cartao,
      data_criacao,
      autor_cartao,
      historias ( id, titulo, descricao ),
      historia_categorias ( categoria_id )
    `);
  if (error) {
    console.error("Erro ao buscar cartões:", error);
    return;
  }

  // Monta allStories
  allStories = data.map(rec => {
    const story = rec.historias;
    const cats   = rec.historia_categorias.map(c=>categoryMap[c.categoria_id] || ""); 
    return {
      id: story.id,
      titulo: story.titulo,
      descricao: story.descricao,
      cartao: {
        tituloCartao:     rec.titulo_cartao,
        sinopseCartao:    rec.sinopse_cartao,
        historiaCompleta: story.descricao,
        dataCartao:       rec.data_criacao?.split('T')[0] || '',
        autorCartao:      rec.autor_cartao,
        categorias:       cats,
        likes:            0
      }
    };
  });
}

/************************************************************
 * [4] Formatadores e utilitários (mesmos que antes)
 ************************************************************/
function formatarPor4Linhas(text) {
  const lines = text.split('\n');
  let paragrafos = [], buffer = [];
  lines.forEach((ln,i) => {
    buffer.push(ln);
    if (buffer.length === 4) {
      paragrafos.push(buffer.join('<br>'));
      buffer = [];
    }
  });
  if (buffer.length) paragrafos.push(buffer.join('<br>'));
  return paragrafos.map(p => `<p style="text-align: justify;">${p}</p>`).join('');
}

function formatarTextoParaLeitura(text) {
  const lines = text.split('\n');
  let paragraphs = [], buffer = [], idx = 0;
  lines.forEach(ln => {
    const words = ln.split(' ').map(w => {
      const span = `<span class="reading-word" data-index="${idx}" onclick="markReadingPosition(this)">${w}</span>`;
      idx++;
      return span;
    });
    buffer.push(words.join(' '));
    if (buffer.length === 4) {
      paragraphs.push(`<p style="text-align: justify;">${buffer.join('<br>')}</p>`);
      buffer = [];
    }
  });
  if (buffer.length) paragraphs.push(`<p style="text-align: justify;">${buffer.join('<br>')}</p>`);
  return paragraphs.join('');
}

function markReadingPosition(el) {
  const index = el.getAttribute('data-index');
  localStorage.setItem('readingPosition_' + currentStoryId, index);
  showToast("Posição de leitura salva (palavra " + index + ")");
}

function destacarPalavra() {
  const saved = localStorage.getItem('readingPosition_' + currentStoryId);
  if (saved !== null) {
    const span = modalFullText.querySelector(`[data-index="${saved}"]`);
    if (span) {
      span.style.background = 'yellow';
      span.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

/************************************************************
 * [5] Cria o card de cada história
 ************************************************************/
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  // Título do cartão
  const titleEl = document.createElement('div');
  titleEl.className = 'sheet-title';
  titleEl.textContent = story.cartao.tituloCartao;
  div.appendChild(titleEl);

  // Sinopse
  const sinopseEl = document.createElement('div');
  sinopseEl.className = 'sheet-sinopse';
  sinopseEl.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  div.appendChild(sinopseEl);

  // “mais...”
  const verMais = document.createElement('span');
  verMais.className = 'ver-mais';
  verMais.textContent = 'mais...';
  verMais.style.cursor = 'pointer';
  verMais.onclick = () => {
    isModalOpen = true;
    currentStoryId = story.id;
    modalTitle.textContent = story.cartao.tituloCartao;
    modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
    modalInfo.innerHTML = `
      <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
      <p><strong>Autor:</strong> ${story.cartao.autorCartao}</p>
      <p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>
    `;
    // Botão Ler
    const lerBtn = document.createElement('button');
    lerBtn.textContent = 'Ler';
    lerBtn.onclick = () => {
      originalText = story.cartao.historiaCompleta;
      modalFullText.innerHTML = formatarTextoParaLeitura(originalText);
    };
    modalFullText.appendChild(lerBtn);

    // Botão Continuar
    const pos = localStorage.getItem('readingPosition_' + story.id);
    continuarBtn.style.display = pos !== null ? 'inline-block' : 'none';

    modalOverlay.style.display = 'flex';
  };
  div.appendChild(verMais);

  // Likes (mantém localStorage)
  const likeCont = document.createElement('div');
  likeCont.style.marginTop = '10px';
  const likeBtn = document.createElement('button');
  const likeCount = document.createElement('span');
  let userLiked = likedStories.includes(story.id);
  function updateLikeUI() {
    likeBtn.textContent = userLiked ? '❤️' : '🤍';
    likeCount.textContent = ` ${story.cartao.likes} curtida(s)`;
  }
  updateLikeUI();
  likeBtn.onclick = () => {
    if (userLiked) {
      story.cartao.likes = Math.max(story.cartao.likes - 1, 0);
      likedStories = likedStories.filter(i=>i!==story.id);
    } else {
      story.cartao.likes++;
      likedStories.push(story.id);
    }
    localStorage.setItem('likedStories', JSON.stringify(likedStories));
    updateLikeUI();
  };
  likeCont.appendChild(likeBtn);
  likeCont.appendChild(likeCount);
  div.appendChild(likeCont);

  // Categorias
  const catCont = document.createElement('div');
  catCont.className = 'sheet-categories';
  if (story.cartao.categorias.length) {
    story.cartao.categorias.forEach(c => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = c;
      catCont.appendChild(badge);
    });
  } else {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'Sem Categoria';
    catCont.appendChild(badge);
  }
  div.appendChild(catCont);

  return div;
}

/************************************************************
 * [6] Filtragem, ordenação e pesquisa
 ************************************************************/
function matchesSearch(story, text) {
  text = text.trim().toLowerCase();
  if (!text) return true;
  return story.cartao.tituloCartao.toLowerCase().includes(text)
      || story.cartao.autorCartao.toLowerCase().includes(text);
}

function getFilteredStories() {
  let arr = [...allStories];
  // Pesquisa
  const txt = (searchBar.value||'').toLowerCase();
  arr = arr.filter(s => matchesSearch(s, txt));
  // Categoria
  const cat = categoryFilter.value;
  if (cat) arr = arr.filter(s => s.cartao.categorias.includes(cat));
  // Ordenação
  if (sortFilter.value === 'date') {
    arr.sort((a,b) => (a.cartao.dataCartao||'').localeCompare(b.cartao.dataCartao||''));
  } else if (sortFilter.value === 'popularity') {
    arr.sort((a,b) => (b.cartao.likes||0) - (a.cartao.likes||0));
  }
  return arr;
}

/************************************************************
 * [7] Paginação “Carregar Mais”
 ************************************************************/
function showBatch(count) {
  const filtered = getFilteredStories();
  const slice = filtered.slice(currentOffset, currentOffset + count);
  slice.forEach(story => container.appendChild(createStoryCard(story)));
  currentOffset += count;
  loadMoreBtn.disabled = false;
}

function initialLoad() {
  container.innerHTML = '';
  currentOffset = 0;
  showBatch(initialCount);
}

function loadMore() {
  loadMoreBtn.disabled = true;
  showBatch(increment);
}

function handleFilterOrSort() {
  container.innerHTML = '';
  currentOffset = 0;
  showBatch(initialCount);
}

/************************************************************
 * [8] Configurações de Modal
 ************************************************************/
if (modalClose) {
  modalClose.onclick = () => { modalOverlay.style.display = 'none'; isModalOpen = false; };
}
modalOverlay.onclick = e => {
  if (e.target === modalOverlay && isModalOpen) {
    warningOverlay.style.display = 'flex';
  }
};
warningYes.onclick = () => {
  modalOverlay.style.display = 'none';
  warningOverlay.style.display = 'none';
  isModalOpen = false;
};
warningNo.onclick = () => { warningOverlay.style.display = 'none'; };
if (continuarBtn) {
  continuarBtn.onclick = () => {
    const story = allStories.find(s => s.id === currentStoryId);
    if (story) {
      modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
      setTimeout(destacarPalavra, 100);
    }
  };
}

/************************************************************
 * [9] Inicialização
 ************************************************************/
document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await fetchCategories();
  await fetchStoriesFromSupabase();
  initialLoad();

  if (searchBar)      searchBar.oninput      = handleFilterOrSort;
  if (categoryFilter) categoryFilter.onchange= handleFilterOrSort;
  if (sortFilter)     sortFilter.onchange    = handleFilterOrSort;
  if (loadMoreBtn)    loadMoreBtn.onclick    = loadMore;
});
