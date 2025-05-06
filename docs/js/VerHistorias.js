// js/VerHistorias.js
import { supabase } from './supabase.js';

let sessionUserId = null;
let allStories    = [];
let likedStories  = [];   // IDs das histórias curtidas pelo utilizador
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
let categoryMap    = {};  // id → nome

document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await fetchUserLikes();
  await fetchCategories();
  await fetchStoriesFromSupabase();
  initialLoad();

  searchBar.addEventListener('input', initialLoad);
  categoryFilter.addEventListener('change', initialLoad);
  sortFilter.addEventListener('change', initialLoad);
  loadMoreBtn.addEventListener('click', () => { loadMoreBtn.disabled = true; showBatch(increment); });

  modalClose.onclick = () => { modalOverlay.style.display = 'none'; isModalOpen = false; };
  modalOverlay.onclick = e => { if (e.target === modalOverlay && isModalOpen) warningOverlay.style.display = 'flex'; };
  warningYes.onclick = () => { modalOverlay.style.display = 'none'; warningOverlay.style.display = 'none'; isModalOpen = false; };
  warningNo.onclick  = () => { warningOverlay.style.display = 'none'; };
  continuarBtn.onclick = () => {
    const st = allStories.find(s => s.id === currentStoryId);
    if (st) {
      modalFullText.innerHTML = formatarTextoParaLeitura(st.cartao.historiaCompleta);
      setTimeout(destacarPalavra, 100);
    }
  };
});

// [1] Exibe usuário logado e guarda sessionUserId
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) {
    area.innerHTML = `<a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
    return;
  }
  sessionUserId = session.user.id;
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', sessionUserId)
    .single();
  area.textContent = profile?.username || session.user.email;
  area.style.cursor = 'pointer';
  area.onclick = () => {
    if (confirm('Deseja fazer logout?')) {
      supabase.auth.signOut().then(() => location.href = 'Criacao.html');
    }
  };
}

// [1.1] Carrega os likes do utilizador de user_likes
async function fetchUserLikes() {
  if (!sessionUserId) { likedStories = []; return; }
  const { data, error } = await supabase
    .from('user_likes')
    .select('historia_id')
    .eq('user_id', sessionUserId);
  if (error) {
    console.error('Erro ao carregar likes do utilizador:', error);
    likedStories = [];
  } else {
    likedStories = data.map(r => r.historia_id);
  }
}

// [2] Carrega categorias
async function fetchCategories() {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome');
  if (error) {
    console.error('Erro ao carregar categorias:', error);
  } else {
    categoryMap = Object.fromEntries(data.map(c => [c.id, c.nome]));
  }
}

// [3] Carrega histórias, cartões e categorias
async function fetchStoriesFromSupabase() {
  // 3.1) Histórias
  const { data: historias, error: errH } = await supabase
    .from('historias')
    .select('id, titulo, descricao, data_criacao')
    .order('data_criacao', { ascending: false });
  if (errH) {
    console.error('Erro ao carregar histórias:', errH);
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
    return;
  }

  // 3.2) Cartões (inclui likes)
  const { data: cartoes, error: errC } = await supabase
    .from('cartoes')
    .select('historia_id, titulo_cartao, sinopse_cartao, autor_cartao, data_criacao, likes');
  if (errC) {
    console.error('Erro ao carregar cartões:', errC);
    return;
  }
  const cartaoMap = Object.fromEntries(cartoes.map(c => [c.historia_id, c]));

  // 3.3) Relação história–categorias
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

  // 3.4) Montagem de allStories
  allStories = historias.map(h => {
    const c = cartaoMap[h.id] || {};
    return {
      id: h.id,
      cartao: {
        tituloCartao:     c.titulo_cartao   || h.titulo       || 'Sem título',
        sinopseCartao:    c.sinopse_cartao  || h.descricao    || 'Sem sinopse',
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
  const linhas = text.split('\n');
  return linhas.slice(0, 4)
    .map(l => `<p style="text-align:justify">${l}</p>`)
    .join('');
}
function formatarTextoParaLeitura(text) {
  if (!text) return '<p>(sem conteúdo)</p>';
  let idx = 0;
  return text.split('\n').map((lin, i) => {
    const spans = lin.split(' ')
      .map(w => `<span data-index="${idx++}" onclick="markReadingPosition(this)">${w}</span>`)
      .join(' ');
    return `<p style="text-align:justify">${spans}</p>`;
  }).join('');
}
window.markReadingPosition = function(el) {
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

// [5] Criação de cards e placeholders
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
  let userLiked  = likedStories.includes(story.id);

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

// Abre modal detalhado
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

// Alterna like no Supabase e atualiza UI
async function toggleLike(story, updateUI) {
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) { alert('Faça login para dar like.'); return; }
  const uid = session.user.id;
  const already = likedStories.includes(story.id);

  if (already) {
    await supabase
      .from('user_likes')
      .delete()
      .match({ user_id: uid, historia_id: story.id });
    likedStories = likedStories.filter(id => id !== story.id);
  } else {
    await supabase
      .from('user_likes')
      .insert({ user_id: uid, historia_id: story.id });
    likedStories.push(story.id);
  }

  // Ler nova contagem de likes (inclui primary key para evitar 406)
  const { data, error } = await supabase
    .from('cartoes')
    .select('historia_id, likes')
    .eq('historia_id', story.id)
    .single();
  if (!error && data) story.cartao.likes = data.likes;
  updateUI();
}

// [6] Filtrar / ordenar / pesquisar
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

// [7] Paginação
function showBatch(count) {
  const filtered = getFilteredStories();
  const slice    = filtered.slice(currentOffset, currentOffset + count);
  const frag     = document.createDocumentFragment();
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
