// js/VerHistorias.js
import { supabase } from './supabase.js';

let allStories = [];
let currentOffset = 0;
const initialCount = 20;
const increment = 5;

const container = document.getElementById('storiesContainer');
const categoryFilter = document.getElementById('category-filter');
const sortFilter = document.getElementById('sort-filter');
const searchBar = document.getElementById('searchBar');
const loadMoreBtn = document.getElementById('loadMoreBtn');

const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const modalFullText = document.getElementById('modalFullText');
const modalInfo = document.getElementById('modalInfo');
const warningOverlay = document.getElementById('warningOverlay');
const warningYes = document.getElementById('warningYes');
const warningNo = document.getElementById('warningNo');
const continuarBtn = document.getElementById('continuarBtn');

let isModalOpen = false;
let currentStoryId = null;

let session = null;
let userId = null;
let userLikedStories = [];
let categoryMap = {};

// [1] Exibe usuário logado / login e carrega likes do utilizador
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  const { data: { session: sess } } = await supabase.auth.getSession();
  session = sess;
  if (!session) {
    area.innerHTML = `<a href=\"Criacao.html\"><i class=\"fas fa-user\"></i> Login</a>`;
    return;
  }
  userId = session.user.id;
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single();
  const nome = profile?.username || session.user.email;
  area.textContent = nome;
  area.style.cursor = 'pointer';
  area.onclick = () => {
    if (confirm('Deseja fazer logout?')) {
      supabase.auth.signOut().then(() => location.href = 'Criacao.html');
    }
  };

  // Carrega os likes do utilizador autenticado
  const { data: likesData, error: likesErr } = await supabase
    .from('user_likes')
    .select('historia_id')
    .eq('user_id', userId);
  if (likesErr) console.error('Erro ao carregar likes do utilizador:', likesErr);
  else userLikedStories = likesData.map(l => l.historia_id);
}

// [2] Carrega categorias
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

// [3] Busca histórias e cartoes
async function fetchStoriesFromSupabase() {
  const { data: historias, error: errH } = await supabase
    .from('historias')
    .select('id, titulo, descricao, user_id, data_criacao')
    .order('data_criacao', { ascending: false });
  if (errH) {
    console.error('Erro ao carregar histórias:', errH);
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
    return;
  }

  const { data: cartoes, error: errC } = await supabase
    .from('cartoes')
    .select('historia_id, titulo_cartao, sinopse_cartao, autor_cartao, data_criacao, likes');
  if (errC) {
    console.error('Erro ao carregar cartões:', errC);
    return;
  }
  const cartaoMap = Object.fromEntries(cartoes.map(c => [c.historia_id, c]));

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

  allStories = historias.map(h => {
    const c = cartaoMap[h.id] || {};
    return {
      id: h.id,
      cartao: {
        tituloCartao: c.titulo_cartao || h.titulo || 'Sem título',
        sinopseCartao: c.sinopse_cartao || '',
        historiaCompleta: h.descricao || '',
        dataCartao: (c.data_criacao || h.data_criacao).split('T')[0],
        autorCartao: c.autor_cartao || 'Anónimo',
        categorias: hcMap[h.id] || [],
        likes: c.likes ?? 0
      }
    };
  });
}

// [4] Formatação de texto
function formatarPor4Linhas(text) { /* ... */ }
function formatarTextoParaLeitura(text) { /* ... */ }
function markReadingPosition(el) { /* ... */ }
function destacarPalavra() { /* ... */ }

// [5] Função para togglar like
async function toggleLike(story) {
  if (!session) {
    alert('Faça login para dar like.');
    return;
  }
  const liked = userLikedStories.includes(story.id);
  if (liked) {
    const { error } = await supabase
      .from('user_likes')
      .delete()
      .match({ user_id: userId, historia_id: story.id });
    if (error) {
      console.error('Erro ao remover like:', error);
      return;
    }
    userLikedStories = userLikedStories.filter(id => id !== story.id);
  } else {
    const { error } = await supabase
      .from('user_likes')
      .insert({ user_id: userId, historia_id: story.id });
    if (error) {
      console.error('Erro ao adicionar like:', error);
      return;
    }
    userLikedStories.push(story.id);
  }
  const { data, error: errCt } = await supabase
    .from('cartoes')
    .select('likes')
    .eq('historia_id', story.id)
    .single();
  if (!errCt && data) {
    story.cartao.likes = data.likes;
  }
  return !liked;
}

// [6] Criação de cards e placeholders
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  const h3 = document.createElement('h3');
  h3.textContent = story.cartao.tituloCartao;
  div.appendChild(h3);

  const sin = document.createElement('div');
  sin.className = 'sheet-sinopse';
  sin.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  div.appendChild(sin);

  const mais = document.createElement('span');
  mais.className = 'ver-mais';
  mais.textContent = 'mais...';
  mais.addEventListener('click', () => {
    isModalOpen = true;
    currentStoryId = story.id;
    modalTitle.textContent = story.cartao.tituloCartao;
    modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopse_cartao);
    modalInfo.innerHTML = `
      <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
      <p><strong>Autor:</strong> ${story.cartao.autorCartao}</p>
      <p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>`;
    const btnLer = document.createElement('button');
    btnLer.textContent = 'Ler';
    btnLer.addEventListener('click', () => {
      modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
      setTimeout(destacarPalavra, 100);
    });
    modalFullText.appendChild(btnLer);
    const pos = localStorage.getItem(`readingPosition_${story.id}`);
    continuarBtn.style.display = pos ? 'inline-block' : 'none';
    modalOverlay.style.display = 'flex';
  });
  div.appendChild(mais);

  const likeCont = document.createElement('div');
  likeCont.style.marginTop = '10px';
  const likeBtn = document.createElement('button');
  const likeCt = document.createElement('span');

  Object.assign(likeBtn.style, {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    padding: '0',
    cursor: 'pointer',
    fontSize: '1.4rem'
  });
  likeBtn.onfocus = () => likeBtn.blur();

  function updateUI() {
    const userLiked = userLikedStories.includes(story.id);
    likeBtn.textContent = userLiked ? '❤️' : '🤍';
    likeCt.textContent = ` ${story.cartao.likes} curtida(s)`;
  }
  updateUI();

  likeBtn.addEventListener('click', async () => {
    const changed = await toggleLike(story);
    if (changed !== undefined) updateUI();
  });

  likeCont.append(likeBtn, likeCt);
  div.appendChild(likeCont);

  const catCont = document.createElement('div');
  catCont.className = 'sheet-categories';
  const cats = story.cartao.categorias.length ? story.cartao.categorias : ['Sem Categoria'];
  cats.forEach(c => {
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
  const h3 = document.createElement('h3');
  h3.textContent = 'Placeholder';
  div.appendChild(h3);
  const p = document.createElement('p');
  p.textContent = '(sem história)';
  div.appendChild(p);
  return div;
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
    arr.sort((a, b) => b.cartao.dataCartao.localeCompare(a.cartao.dataCartao));
  } else if (sortFilter.value === 'popularity') {
    arr.sort((a, b) => b.cartao.likes - a.cartao.likes);
  }
  return arr;
}

// [8] Paginação
function showBatch(count) {
  const filtered = getFilteredStories();
  const slice = filtered.slice(currentOffset, currentOffset + count);
  const frag = document.createDocumentFragment();

  slice.forEach(s => frag.appendChild(createStoryCard(s)));
  for (let i = slice.length; i < count; i++) {
    frag.appendChild(createPlaceholderCard());
  }

  container.appendChild(frag);
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

// [9] Modal & aviso
modalClose.addEventListener('click', () => {
  modalOverlay.style.display = 'none';
  isModalOpen = false;
});
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay && isModalOpen) {
    warningOverlay.style.display = 'flex';
  }
});
warningYes.addEventListener('click', () => {
  modalOverlay.style.display = 'none';
  warningOverlay.style.display = 'none';
  isModalOpen = false;
});
warningNo.addEventListener('click', () => {
  warningOverlay.style.display = 'none';
});
continuarBtn.addEventListener('click', () => {
  const st = allStories.find(s => s.id === currentStoryId);
  if (st) {
    modalFullText.innerHTML = formatarTextoParaLeitura(st.cartao.historiaCompleta);
    setTimeout(destacarPalavra, 100);
  }
});

// [10] Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await fetchCategories();
  await fetchStoriesFromSupabase();
  initialLoad();

  searchBar.addEventListener('input', initialLoad);
  categoryFilter.addEventListener('change', initialLoad);
  sortFilter.addEventListener('change', initialLoad);
  loadMoreBtn.addEventListener('click', loadMore);
});
