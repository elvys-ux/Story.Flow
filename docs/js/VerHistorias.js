// js/VerHistorias.js
import { supabase } from './supabase.js';

let sessionUserId = null;
let allStories    = [];
let likedStories  = [];   // IDs das histórias curtidas pelo utilizador atual
let currentOffset = 0;
const initialCount = 20;
const increment    = 5;

// Elementos do DOM
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
let categoryMap    = {};   // id → nome

document.addEventListener('DOMContentLoaded', async () => {
  // 1) Checa sessão e guarda user_id
  const { data:{ session } } = await supabase.auth.getSession();
  if (session) sessionUserId = session.user.id;

  // 2) Inicializa likedStories a partir do localStorage
  initializeLikedStories();

  // 3) Carrega dados
  await exibirUsuarioLogado();
  await fetchCategories();
  await fetchStoriesFromSupabase();
  initialLoad();

  // 4) Eventos de filtro e paginação
  searchBar.addEventListener('input', initialLoad);
  categoryFilter.addEventListener('change', initialLoad);
  sortFilter.addEventListener('change', initialLoad);
  loadMoreBtn.addEventListener('click', () => { loadMoreBtn.disabled = true; showBatch(increment); });

  // 5) Eventos do modal
  modalClose.onclick    = () => { modalOverlay.style.display = 'none'; isModalOpen = false; };
  modalOverlay.onclick  = e => { if (e.target === modalOverlay && isModalOpen) warningOverlay.style.display = 'flex'; };
  warningYes.onclick    = () => { modalOverlay.style.display = 'none'; warningOverlay.style.display = 'none'; isModalOpen = false; };
  warningNo.onclick     = () => { warningOverlay.style.display = 'none'; };
  continuarBtn.onclick  = () => {
    const st = allStories.find(s => s.id === currentStoryId);
    if (st) {
      modalFullText.innerHTML = formatarTextoParaLeitura(st.cartao.historiaCompleta);
      setTimeout(destacarPalavra, 100);
    }
  };
});

// Lê do localStorage a lista de likes do user atual
function initializeLikedStories() {
  if (!sessionUserId) {
    likedStories = [];
  } else {
    const key = `likedStories_${sessionUserId}`;
    likedStories = JSON.parse(localStorage.getItem(key) || '[]');
  }
}

// [1] Exibe usuário logado / login
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) {
    area.innerHTML = `<a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
    return;
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', session.user.id)
    .single();
  area.textContent = profile?.username || session.user.email;
  area.style.cursor = 'pointer';
  area.onclick = () => {
    if (confirm('Deseja fazer logout?')) {
      supabase.auth.signOut().then(() => location.href = 'Criacao.html');
    }
  };
}

// [2] Carrega categorias (id → nome)
async function fetchCategories() {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome');
  if (error) {
    console.error('Erro ao carregar categorias:', error);
    return;
  }
  categoryMap = Object.fromEntries(data.map(c => [c.id, c.nome]));
}

// [3] Carrega histórias + cartões + categorias
async function fetchStoriesFromSupabase() {
  // Histórias
  const { data: historias, error: errH } = await supabase
    .from('historias')
    .select('id, titulo, descricao, data_criacao')
    .order('data_criacao', { ascending: false });
  if (errH) {
    console.error('Erro ao carregar histórias:', errH);
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
    return;
  }

  // Cartões (com likes)
  const { data: cartoes, error: errC } = await supabase
    .from('cartoes')
    .select('historia_id, titulo_cartao, sinopse_cartao, autor_cartao, data_criacao, likes');
  if (errC) {
    console.error('Erro ao carregar cartões:', errC);
    return;
  }
  const cartaoMap = Object.fromEntries(cartoes.map(c => [c.historia_id, c]));

  // História–Categorias
  const { data: hcData, error: errHC } = await supabase
    .from('historia_categorias')
    .select('historia_id, categoria_id');
  if (errHC) {
    console.error('Erro ao carregar categorias de história:', errHC);
    return;
  }
  const hcMap = {};
  hcData.forEach(({ historia_id, categoria_id }) => {
    if (!hcMap[historia_id]) hcMap[historia_id] = [];
    hcMap[historia_id].push(categoryMap[categoria_id]);
  });

  // Monta allStories
  allStories = historias.map(h => {
    const c = cartaoMap[h.id] || {};
    return {
      id: h.id,
      cartao: {
        tituloCartao:     c.titulo_cartao   || h.titulo    || 'Sem título',
        sinopseCartao:    c.sinopse_cartao  || h.descricao || 'Sem sinopse',
        historiaCompleta: h.descricao       || 'Sem história',
        dataCartao:       (c.data_criacao || h.data_criacao).split('T')[0],
        autorCartao:      c.autor_cartao    || 'Anónimo',
        categorias:       hcMap[h.id]       || [],
        likes:            c.likes ?? 0
      }
    };
  });
}

// [4] Formatação de texto
function formatarPor4Linhas(text) {
  if (!text) return '<p>(sem sinopse)</p>';
  return text.split('\n').slice(0,4)
    .map(l => `<p style="text-align:justify">${l}</p>`).join('');
}
function formatarTextoParaLeitura(text) {
  if (!text) return '<p>(sem conteúdo)</p>';
  let idx = 0;
  return text.split('\n').map(l => {
    const spans = l.split(' ')
      .map(w => `<span data-index="${idx++}" onclick="markReadingPosition(this)">${w}</span>`)
      .join(' ');
    return `<p style="text-align:justify">${spans}</p>`;
  }).join('');
}
window.markReadingPosition = el => {
  localStorage.setItem(`readingPosition_${currentStoryId}`, el.dataset.index);
};
function destacarPalavra() {
  const pos = localStorage.getItem(`readingPosition_${currentStoryId}`);
  if (pos !== null) {
    const span = modalFullText.querySelector(`[data-index="${pos}"]`);
    if (span) {
      span.style.background = 'yellow';
      span.scrollIntoView({ block:'center', behavior:'smooth' });
    }
  }
}

// [5] Geração de cartões
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  // Título
  const h3 = document.createElement('h3');
  h3.textContent = story.cartao.tituloCartao;
  div.appendChild(h3);

  // Sinopse
  const sin = document.createElement('div');
  sin.className = 'sheet-sinopse';
  sin.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  div.appendChild(sin);

  // “mais...”
  const mais = document.createElement('span');
  mais.className = 'ver-mais';
  mais.textContent = 'mais...';
  mais.onclick = () => abrirModal(story);
  div.appendChild(mais);

  // Likes
  const likeCont = document.createElement('div');
  likeCont.style.marginTop = '10px';
  const likeBtn = document.createElement('button');
  const likeCt  = document.createElement('span');

  let userLiked = likedStories.includes(story.id);
  function updateUI() {
    likeBtn.textContent = userLiked ? '❤️' : '🤍';
    likeCt.textContent  = ` ${story.cartao.likes} curtida(s)`;
  }
  updateUI();

  Object.assign(likeBtn.style, {
    background:'transparent',
    border:'none',
    outline:'none',
    padding:'0',
    cursor:'pointer',
    fontSize:'1.4rem'
  });
  likeBtn.onclick = () => toggleLike(story, updateUI);

  likeCont.append(likeBtn, likeCt);
  div.appendChild(likeCont);

  // Categorias
  const catCont = document.createElement('div');
  catCont.className = 'sheet-categories';
  (story.cartao.categorias.length ? story.cartao.categorias : ['Sem Categoria'])
    .forEach(c => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = c;
      catCont.appendChild(badge);
    });
  div.appendChild(catCont);

  return div;
}

function createPlaceholderCard() {
  const div = document.createElement('div');
  div.className = 'sheet sheet-placeholder';
  div.innerHTML = '<h3>Placeholder</h3><p>(sem história)</p>';
  return div;
}

// Abre modal de leitura
function abrirModal(story) {
  isModalOpen    = true;
  currentStoryId = story.id;
  modalTitle.textContent  = story.cartao.tituloCartao;
  modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  modalInfo.innerHTML     = `
    <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
    <p><strong>Autor:</strong> ${story.cartao.autorCartao}</p>
    <p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>`;
  const btnLer = document.createElement('button');
  btnLer.textContent = 'Ler';
  btnLer.onclick = () => {
    modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
    setTimeout(destacarPalavra, 100);
  };
  modalFullText.appendChild(btnLer);
  continuarBtn.style.display = localStorage.getItem(`readingPosition_${story.id}`) ? 'inline-block' : 'none';
  modalOverlay.style.display = 'flex';
}

// [6] Alterna like e persiste no cartão
async function toggleLike(story, updateUI) {
  if (!sessionUserId) {
    alert('Faça login para dar like.');
    return;
  }

  const key = `likedStories_${sessionUserId}`;
  let userLiked = likedStories.includes(story.id);

  // Atualiza contagem local
  story.cartao.likes += userLiked ? -1 : 1;

  // Atualiza lista local
  if (userLiked) {
    likedStories = likedStories.filter(id => id !== story.id);
  } else {
    likedStories.push(story.id);
  }
  localStorage.setItem(key, JSON.stringify(likedStories));

  // Atualiza no Supabase
  const { error } = await supabase
    .from('cartoes')
    .update({ likes: story.cartao.likes })
    .eq('historia_id', story.id);
  if (error) console.error('Erro ao salvar like em cartoes:', error);

  updateUI();
}

// [7] Filtrar / ordenar / pesquisar
function matchesSearch(story, txt) {
  if (!txt) return true;
  txt = txt.toLowerCase();
  return story.cartao.tituloCartao.toLowerCase().includes(txt)
      || story.cartao.autorCartao.toLowerCase().includes(txt);
}
function getFilteredStories() {
  let arr = allStories.filter(st => matchesSearch(st, searchBar.value));
  if (categoryFilter.value) {
    arr = arr.filter(st => st.cartao.categorias.includes(categoryFilter.value));
  }
  if (sortFilter.value === 'date') {
    arr.sort((a,b) => b.cartao.dataCartao.localeCompare(a.cartao.dataCartao));
  } else if (sortFilter.value === 'popularity') {
    arr.sort((a,b) => b.cartao.likes - a.cartao.likes);
  }
  return arr;
}

// [8] Paginação
function showBatch(count) {
  const slice = getFilteredStories().slice(currentOffset, currentOffset + count);
  const frag  = document.createDocumentFragment();
  slice.forEach(s => frag.appendChild(createStoryCard(s)));
  for (let i = slice.length; i < count; i++) frag.appendChild(createPlaceholderCard());
  container.appendChild(frag);
  currentOffset += count;
  loadMoreBtn.disabled = false;
}
function initialLoad() {
  container.innerHTML = '';
  currentOffset = 0;
  showBatch(initialCount);
}
