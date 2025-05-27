// js/VerHistorias.js
import { supabase } from './supabase.js';

let sessionUserId    = null;
let allStories       = [];
let likedStories     = new Set();
let currentStoryId   = null;
let currentOffset    = 0;
const initialCount   = 20;
const increment      = 5;

// DOM elements
const container      = document.getElementById('storiesContainer');
const categoryFilter = document.getElementById('category-filter');
const sortFilter     = document.getElementById('sort-filter');
const searchForm     = document.getElementById('searchForm');
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

let categoryMap = {}; // id → nome

document.addEventListener('DOMContentLoaded', () => {
  init();
  setupMenuToggles();
});

async function init() {
  // Impede reload no form de busca
  if (searchForm) {
    searchForm.addEventListener('submit', e => {
      e.preventDefault();
      initialLoad();
    });
  }

  // Obtém sessão e exibe user area
  const { data: { session } } = await supabase.auth.getSession();
  sessionUserId = session?.user?.id || null;
  await renderUserArea();

  // Se estiver logado, carrega curtidas
  if (sessionUserId) await fetchUserLikes();

  // Carrega categorias e histórias
  await fetchCategories();
  await fetchStories();

  // Renderiza primeiros cartões
  initialLoad();

  // Tira o loader assim que tudo estiver populado
  if (window.finalizeLoader) {
    window.finalizeLoader();
  }

  // Listeners de filtro e paginação
  searchBar.addEventListener('input', initialLoad);
  categoryFilter.addEventListener('change', initialLoad);
  sortFilter.addEventListener('change', initialLoad);
  loadMoreBtn.addEventListener('click', () => {
    loadMoreBtn.disabled = true;
    showBatch(increment);
  });

  // Controles do modal e warning
  modalClose.addEventListener('click', () => modalOverlay.style.display = 'none');
  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) warningOverlay.style.display = 'flex';
  });
  warningYes.addEventListener('click', () => {
    warningOverlay.style.display = 'none';
    modalOverlay.style.display = 'none';
  });
  warningNo.addEventListener('click', () => warningOverlay.style.display = 'none');
}

function setupMenuToggles() {
  const btnHamburger = document.getElementById('btnHamburger');
  const navbar       = document.querySelector('.navbar');

  // Toggle da navbar inteira
  btnHamburger.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      navbar.classList.toggle('open');
    }
  });

  // Toggle dos submenus
  document.querySelectorAll('.navbar .dropdown > .toggle')
    .forEach(toggle => {
      toggle.addEventListener('click', e => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          toggle.parentElement.classList.toggle('open');
        }
      });
    });

  // Ao redimensionar para desktop, fecha tudo
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      navbar.classList.remove('open');
      document.querySelectorAll('.navbar .dropdown.open')
        .forEach(dd => dd.classList.remove('open'));
    }
  });
}

async function renderUserArea() {
  const area = document.getElementById('userMenuArea');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    area.innerHTML = `<a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
    return;
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', session.user.id)
    .single();
  const username = profile?.username || session.user.email;
  area.textContent = username;
  area.style.cursor = 'pointer';
  area.addEventListener('click', () => {
    if (confirm('Deseja fazer logout?')) {
      supabase.auth.signOut().then(() => location.href = 'Criacao.html');
    }
  });
}

async function fetchUserLikes() {
  const { data, error } = await supabase
    .from('user_likes')
    .select('historia_id')
    .eq('user_id', sessionUserId);
  if (!error) likedStories = new Set(data.map(r => r.historia_id));
}

async function fetchCategories() {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome');
  if (!error) categoryMap = Object.fromEntries(data.map(c => [c.id, c.nome]));
}

async function fetchStories() {
  const { data: historias, error: errH } = await supabase
    .from('historias')
    .select('id, titulo, descricao, data_criacao')
    .order('data_criacao', { ascending: false });
  if (errH) {
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
    return;
  }

  const { data: cartoes } = await supabase
    .from('cartoes')
    .select('historia_id, titulo_cartao, sinopse_cartao, autor_cartao, data_criacao, likes');
  const cardMap = Object.fromEntries(cartoes.map(c => [c.historia_id, c]));

  const { data: hcData } = await supabase
    .from('historia_categorias')
    .select('historia_id, categoria_id');
  const hcMap = {};
  hcData.forEach(({ historia_id, categoria_id }) => {
    hcMap[historia_id] = hcMap[historia_id] || [];
    hcMap[historia_id].push(categoryMap[categoria_id]);
  });

  allStories = historias.map(h => {
    const c = cardMap[h.id] || {};
    return {
      id: h.id,
      hasCartao: Boolean(c.titulo_cartao),
      cartao: {
        tituloCartao:     c.titulo_cartao   || h.titulo    || 'Sem título',
        sinopseCartao:    c.sinopse_cartao  || h.descricao || '',
        historiaCompleta: h.descricao       || '',
        dataCartao:       (c.data_criacao   || h.data_criacao).split('T')[0],
        autorCartao:      c.autor_cartao    || 'Anónimo',
        categorias:       hcMap[h.id]       || [],
        likes:            c.likes ?? 0
      }
    };
  });
}

function formatSinopse(text = '') {
  return text.split('\n').join('<br>');
}

function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  const h3 = document.createElement('h3');
  h3.textContent = story.cartao.tituloCartao;
  div.appendChild(h3);

  const sin = document.createElement('div');
  sin.className = 'sheet-sinopse';
  sin.style.whiteSpace = 'pre-wrap';
  sin.innerHTML = formatSinopse(story.cartao.sinopseCartao);
  div.appendChild(sin);

  const more = document.createElement('span');
  more.className = 'ver-mais';
  more.textContent = 'mais...';
  more.onclick = () => openModal(story);
  div.appendChild(more);

  if (story.hasCartao) {
    const likeDiv = document.createElement('div');
    likeDiv.style.marginTop = '10px';

    const btn = document.createElement('button');
    btn.style = 'background:none;border:none;cursor:pointer;font-size:1.4rem';
    const count = document.createElement('span');

    let userLiked = likedStories.has(story.id);
    const updateUI = () => {
      btn.textContent = userLiked ? '❤️' : '🤍';
      count.textContent = ` ${story.cartao.likes} curtida(s)`;
    };
    updateUI();

    btn.onclick = async () => {
      if (!sessionUserId) { alert('Faça login para curtir'); return; }
      story.cartao.likes += userLiked ? -1 : 1;
      if (userLiked) {
        await supabase.from('user_likes').delete().match({ user_id: sessionUserId, historia_id: story.id });
      } else {
        await supabase.from('user_likes').insert({ user_id: sessionUserId, historia_id: story.id });
      }
      userLiked = !userLiked;
      userLiked ? likedStories.add(story.id) : likedStories.delete(story.id);
      updateUI();
      await supabase.from('cartoes').update({ likes: story.cartao.likes }).eq('historia_id', story.id);
    };

    likeDiv.appendChild(btn);
    likeDiv.appendChild(count);
    div.appendChild(likeDiv);
  }

  const catDiv = document.createElement('div');
  catDiv.className = 'sheet-categories';
  (story.cartao.categorias.length ? story.cartao.categorias : ['Sem Categoria'])
    .forEach(cat => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = cat;
      catDiv.appendChild(badge);
    });
  div.appendChild(catDiv);

  return div;
}

function openModal(story) {
  currentStoryId = story.id;
  modalTitle.textContent = story.cartao.tituloCartao;
  modalFullText.style.whiteSpace = 'pre-wrap';
  modalFullText.innerHTML = formatSinopse(story.cartao.sinopseCartao);

  const readBtn = document.createElement('button');
  readBtn.textContent = 'Ler';
  readBtn.onclick = () => {
    modalFullText.innerHTML = formatSinopse(story.cartao.historiaCompleta);
  };
  modalFullText.parentNode.insertBefore(readBtn, modalInfo);

  modalInfo.innerHTML = `
    <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
    <p><strong>Autor:</strong> ${story.cartao.autorCartao}</p>
    <p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>
  `;

  warningOverlay.style.display = 'none';
  modalOverlay.style.display = 'flex';
}

function getFilteredStories() {
  let arr = allStories.filter(st => {
    const term = searchBar.value.trim().toLowerCase();
    return !term ||
      st.cartao.tituloCartao.toLowerCase().includes(term) ||
      st.cartao.autorCartao.toLowerCase().includes(term);
  });
  if (categoryFilter.value) {
    arr = arr.filter(st => st.cartao.categorias.includes(categoryFilter.value));
  }
  if (sortFilter.value === 'date') {
    arr.sort((a, b) => b.cartao.dataCartao.localeCompare(a.cartao.dataCartao));
  } else if (sortFilter.value === 'popularity') {
    arr.sort((a, b) => b.cartao.likes - a.cartao.likes));
  }
  return arr;
}

function showBatch(count) {
  const batch = getFilteredStories().slice(currentOffset, currentOffset + count);
  batch.forEach(story => container.appendChild(createStoryCard(story)));
  if (batch.length < count) {
    for (let i = batch.length; i < count; i++) {
      container.appendChild(createPlaceholderCard());
    }
  }
  currentOffset += count;
  loadMoreBtn.disabled = false;
}

function initialLoad() {
  container.innerHTML = '';
  currentOffset = 0;
  showBatch(initialCount);
}

function createPlaceholderCard() {
  const div = document.createElement('div');
  div.className = 'sheet sheet-placeholder';
  div.innerHTML = '<h3>Placeholder</h3><p>(sem história)</p>';
  return div;
}

// Footer interativo
document.body.addEventListener('mousemove', e => {
  const footer = document.querySelector('footer');
  if (!footer) return;
  if (window.innerHeight - e.clientY < 50) footer.classList.add('visible');
  else footer.classList.remove('visible');
});
