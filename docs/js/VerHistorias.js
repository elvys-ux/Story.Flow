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

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // impede reload no form
  searchForm?.addEventListener('submit', e => {
    e.preventDefault();
    initialLoad();
  });

  // sessão e user area
  const { data: { session } } = await supabase.auth.getSession();
  sessionUserId = session?.user?.id || null;
  await renderUserArea();

  // curtidas
  if (sessionUserId) await fetchUserLikes();

  // categories + stories
  await fetchCategories();
  await fetchStories();

  // inicial load + remove loader
  initialLoad();
  window.finalizeLoader?.();

  // filtros e paginação
  searchBar.addEventListener('input',    initialLoad);
  categoryFilter.addEventListener('change', initialLoad);
  sortFilter.addEventListener('change',    initialLoad);
  loadMoreBtn.addEventListener('click', () => {
    loadMoreBtn.disabled = true;
    showBatch(increment);
  });

  // modal & warning
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
        autorCartao:      c.autor_cartao    || 'Anônimo',
        categorias:       hcMap[h.id]       || [],
        likes:            c.likes ?? 0
      }
    };
  });
}

// envolve cada palavra num span
function wrapWords(text = '') {
  return text
    .split(/(\s+)/)
    .map((tok,i) => /\s+/.test(tok)
      ? tok
      : `<span class="modal-word" data-index="${i}">${tok}</span>`
    )
    .join('');
}

// lê posição guardada no Supabase
async function getSavedPosition(storyId) {
  if (!sessionUserId) return null;
  const { data, error } = await supabase
    .from('reading_positions')
    .select('position')
    .eq('user_id', sessionUserId)
    .eq('historia_id', storyId)
    .single();
  return data?.position ?? null;
}

// grava/update posição no Supabase
async function savePosition(storyId, position) {
  if (!sessionUserId) return;
  await supabase
    .from('reading_positions')
    .upsert({
      user_id:     sessionUserId,
      historia_id: storyId,
      position
    }, { onConflict: ['user_id','historia_id'] });
}

async function openModal(story) {
  currentStoryId = story.id;
  modalTitle.textContent = story.cartao.tituloCartao;

  // 1) sinopse com spans
  modalFullText.innerHTML = wrapWords(story.cartao.sinopseCartao);

  // 2) botão “Ler” aparece **só na sinopse**
  const readBtn = document.createElement('button');
  readBtn.textContent = 'Ler';
  readBtn.className   = 'continuar-btn';
  readBtn.onclick     = async () => {
    // troca para texto completo
    modalFullText.innerHTML = wrapWords(story.cartao.historiaCompleta);
    readBtn.remove();

    // aplica marcador existente
    const pos = await getSavedPosition(story.id);
    if (pos !== null) {
      const span = modalFullText.querySelector(`.modal-word[data-index="${pos}"]`);
      span?.classList.add('highlight');
      span?.scrollIntoView({ behavior:'smooth', block:'center' });
    }

    // clique em cada palavra para gravar posição
    modalFullText.querySelectorAll('.modal-word').forEach(span => {
      span.addEventListener('click', async () => {
        // limpa anterior
        modalFullText.querySelector('.modal-word.highlight')
          ?.classList.remove('highlight');
        span.classList.add('highlight');
        await savePosition(story.id, +span.dataset.index);
      });
    });
  };
  modalFullText.parentNode.insertBefore(readBtn, modalInfo);

  // 3) infos
  modalInfo.innerHTML = `
    <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
    <p><strong>Autor:</strong> ${story.cartao.autorCartao}</p>
    <p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>
  `;

  warningOverlay.style.display = 'none';
  modalOverlay.style.display   = 'flex';
}

function formatSinopse(text = '') {
  return text.split('\n').join('<br>');
}

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
  sin.style.whiteSpace = 'pre-wrap';
  sin.innerHTML = formatSinopse(story.cartao.sinopseCartao);
  div.appendChild(sin);

  // “mais...”
  const more = document.createElement('span');
  more.className = 'ver-mais';
  more.textContent = 'mais...';
  more.onclick = () => openModal(story);
  div.appendChild(more);

  // Likes
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
        await supabase.from('user_likes')
          .delete().match({ user_id: sessionUserId, historia_id: story.id });
      } else {
        await supabase.from('user_likes')
          .insert({ user_id: sessionUserId, historia_id: story.id });
      }
      userLiked = !userLiked;
      userLiked ? likedStories.add(story.id) : likedStories.delete(story.id);
      updateUI();
      await supabase.from('cartoes')
        .update({ likes: story.cartao.likes })
        .eq('historia_id', story.id);
    };
    likeDiv.appendChild(btn);
    likeDiv.appendChild(count);
    div.appendChild(likeDiv);
  }

  // Categorias
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
    arr.sort((a, b) => b.cartao.likes - a.cartao.likes);
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
  if (window.innerHeight - e.clientY < 50) footer.classList.add('visible');
  else footer.classList.remove('visible');
});
