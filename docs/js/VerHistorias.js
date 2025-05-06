// js/VerHistorias.js
import { supabase } from './supabase.js';

let allStories       = [];
let currentOffset    = 0;
const initialCount   = 20;
const increment      = 5;

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

let likedStories   = JSON.parse(localStorage.getItem('likedStories') || '[]');
let categoryMap    = {};  // id → nome

// [1] Exibe usuário logado / login
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    area.innerHTML = `<a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
    return;
  }
  const userId = session.user.id;
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

// [3] Busca histórias + cartões + categorias (com likes em cartoes)
async function fetchStoriesFromSupabase() {
  // Carrega histórias (sem likes)
  const { data: historias, error: errH } = await supabase
    .from('historias')
    .select('id, titulo, descricao, user_id, data_criacao')
    .order('data_criacao', { ascending: false });
  if (errH) {
    console.error('Erro ao carregar histórias:', errH);
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
    return;
  }

  // Carrega cartões incluindo o campo likes
  const { data: cartoes, error: errC } = await supabase
    .from('cartoes')
    .select('historia_id, titulo_cartao, sinopse_cartao, autor_cartao, data_criacao, likes');
  if (errC) {
    console.error('Erro ao carregar cartões:', errC);
    return;
  }
  const cartaoMap = Object.fromEntries(
    cartoes.map(c => [c.historia_id, c])
  );

  // Carrega relações história–categoria
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

  // Monta allStories usando c.likes como fonte de verdade
  allStories = historias.map(h => {
    const c = cartaoMap[h.id] || {};
    return {
      id: h.id,
      cartao: {
        tituloCartao:     c.titulo_cartao   || h.titulo    || 'Sem título',
        sinopseCartao:    c.sinopse_cartao  || '',
        historiaCompleta: h.descricao       || '',
        dataCartao:       (c.data_criacao || h.data_criacao).split('T')[0],
        autorCartao:      c.autor_cartao    || 'Anónimo',
        categorias:       hcMap[h.id]       || [],
        likes:            c.likes ?? 0
      }
    };
  });
}

// [4] Formatação de texto
function formatarPor4Linhas(text) { /* ... */ }
function formatarTextoParaLeitura(text) { /* ... */ }
function markReadingPosition(el) { /* ... */ }
function destacarPalavra() { /* ... */ }

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
  mais.addEventListener('click', () => {
    isModalOpen = true;
    currentStoryId = story.id;
    modalTitle.textContent   = story.cartao.tituloCartao;
    modalFullText.innerHTML  = formatarPor4Linhas(story.cartao.sinopseCartao);
    modalInfo.innerHTML      = `
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
    continuarBtn.style.display = pos !== null ? 'inline-block' : 'none';
    modalOverlay.style.display = 'flex';
  });
  div.appendChild(mais);

  // Likes
  const likeCont = document.createElement('div');
  likeCont.style.marginTop = '10px';
  const likeBtn = document.createElement('button');
  const likeCt  = document.createElement('span');
  let userLiked = likedStories.includes(story.id);

  // Remove bordas e outline, e aumenta o tamanho do ícone
  likeBtn.style.background = 'transparent';
  likeBtn.style.border     = 'none';
  likeBtn.style.outline    = 'none';
  likeBtn.style.padding    = '0';
  likeBtn.style.cursor     = 'pointer';
  likeBtn.style.fontSize   = '1.4rem';
  likeBtn.onfocus          = () => likeBtn.blur();

  function updateUI() {
    likeBtn.textContent = userLiked ? '❤️' : '🤍';
    likeCt.textContent   = ` ${story.cartao.likes} curtida(s)`;
  }
  updateUI();

  likeBtn.addEventListener('click', async () => {
    if (userLiked) {
      story.cartao.likes = Math.max(story.cartao.likes - 1, 0);
      likedStories = likedStories.filter(i => i !== story.id);
    } else {
      story.cartao.likes++;
      likedStories.push(story.id);
    }
    userLiked = !userLiked;
    localStorage.setItem('likedStories', JSON.stringify(likedStories));
    updateUI();

    const { data, error } = await supabase
      .from('cartoes')
      .update({ likes: story.cartao.likes })
      .eq('historia_id', story.id)
      .select('likes')
      .single();

    if (error) {
      console.error('Erro ao salvar like em cartoes:', error);
    } else {
      story.cartao.likes = data.likes;
      updateUI();
    }
  });

  likeCont.append(likeBtn, likeCt);
  div.appendChild(likeCont);

  // Categorias
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

function loadMore() {
  loadMoreBtn.disabled = true;
  showBatch(increment);
}

// [8] Modal & aviso
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
  modalOverlay.style.display   = 'none';
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

// [9] Inicialização
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
