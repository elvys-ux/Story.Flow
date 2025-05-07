// js/VerHistorias.js
import { supabase } from './supabase.js';

let sessionUserId    = null;
let allStories       = [];
let likedStories     = new Set();
let readingPositions = {};    // { historia_id: position }
let currentOffset    = 0;
let currentStoryId   = null;
const initialCount   = 20;
const increment      = 5;

// DOM
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
const continuarBtn   = document.getElementById('continuarBtn');

let isModalOpen = false;
let categoryMap = {}; // id → nome

document.addEventListener('DOMContentLoaded', init);

/**
 * Insere duas quebras de linha após cada ponto final.
 */
function formataComQuebra(texto) {
  if (!texto) return '';
  return texto
    .split('.')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => `${s}.`)
    .join('<br><br>');
}

/**
 * Converte o texto completo em spans clicáveis, cada palavra com data-index.
 */
function formatarTextoParaLeitura(texto) {
  if (!texto) return '';
  let idx = 0;
  return texto.split('\n').map(line => {
    const spans = line.split(' ').map(word => {
      return `<span data-index="${idx}" onclick="markReadingPosition(this)">${word}</span>`;
    }).join(' ');
    idx++;
    return `<p style="text-align:justify">${spans}</p>`;
  }).join('');
}

// Expõe a função global para que os spans chamem onclick="markReadingPosition(this)"
window.markReadingPosition = async el => {
  const pos = parseInt(el.dataset.index, 10);
  if (!sessionUserId || currentStoryId === null) return;
  readingPositions[currentStoryId] = pos;
  const { error } = await supabase
    .from('reading_positions')
    .upsert(
      { user_id: sessionUserId, historia_id: currentStoryId, position: pos },
      { onConflict: ['user_id','historia_id'] }
    );
  if (error) console.error('Erro ao salvar posição:', error);
  // destaca o span clicado e rola até ele
  el.style.background = 'yellow';
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  // mostra o botão Continuar
  continuarBtn.style.display = 'block';
};

async function init() {
  // evita reload ao submeter pesquisa
  if (searchForm) {
    searchForm.addEventListener('submit', e => {
      e.preventDefault();
      initialLoad();
    });
  }

  // detecta sessão
  const { data:{ session } } = await supabase.auth.getSession();
  sessionUserId = session?.user?.id ?? null;
  if (sessionUserId) {
    await fetchUserLikes();
    await fetchReadingPositions();
  }

  // carrega usuário, categorias e histórias
  await exibirUsuarioLogado();
  await fetchCategories();
  await fetchStoriesFromSupabase();

  // renderização inicial
  initialLoad();

  // filtros e paginação
  searchBar.addEventListener('input', initialLoad);
  categoryFilter.addEventListener('change', initialLoad);
  sortFilter.addEventListener('change', initialLoad);
  loadMoreBtn.addEventListener('click', () => {
    loadMoreBtn.disabled = true;
    showBatch(increment);
  });

  // handlers de modal
  modalClose.onclick   = () => { modalOverlay.style.display = 'none'; isModalOpen = false; };
  modalOverlay.onclick = e => { if (e.target === modalOverlay && isModalOpen) warningOverlay.style.display = 'flex'; };
  warningYes.onclick   = () => { modalOverlay.style.display = 'none'; warningOverlay.style.display = 'none'; isModalOpen = false; };
  warningNo.onclick    = () => { warningOverlay.style.display = 'none'; };
  continuarBtn.onclick = continuarLeitura;
}

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

async function fetchUserLikes() {
  const { data, error } = await supabase
    .from('user_likes')
    .select('historia_id')
    .eq('user_id', sessionUserId);
  likedStories = error
    ? new Set()
    : new Set(data.map(r => r.historia_id));
}

async function fetchReadingPositions() {
  const { data, error } = await supabase
    .from('reading_positions')
    .select('historia_id, position')
    .eq('user_id', sessionUserId);
  readingPositions = error
    ? {}
    : Object.fromEntries(data.map(r => [r.historia_id, r.position]));
}

async function fetchCategories() {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome');
  if (!error) {
    categoryMap = Object.fromEntries(data.map(c => [c.id, c.nome]));
  }
}

async function fetchStoriesFromSupabase() {
  const { data: historias, error: errH } = await supabase
    .from('historias')
    .select('id, titulo, descricao, data_criacao')
    .order('data_criacao', { ascending: false });
  if (errH) {
    console.error(errH);
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
    return;
  }

  const { data: cartoes } = await supabase
    .from('cartoes')
    .select('historia_id, titulo_cartao, sinopse_cartao, autor_cartao, data_criacao, likes');
  const cartaoMap = Object.fromEntries(cartoes.map(c => [c.historia_id, c]));

  const { data: hcData } = await supabase
    .from('historia_categorias')
    .select('historia_id, categoria_id');
  const hcMap = {};
  hcData.forEach(({ historia_id, categoria_id }) => {
    hcMap[historia_id] = hcMap[historia_id] || [];
    hcMap[historia_id].push(categoryMap[categoria_id]);
  });

  allStories = historias.map(h => {
    const c = cartaoMap[h.id] || {};
    return {
      id:        h.id,
      hasCartao: Boolean(c.titulo_cartao),
      cartao: {
        tituloCartao:     c.titulo_cartao   || h.titulo    || 'Sem título',
        sinopseCartao:    c.sinopse_cartao  || h.descricao || '',
        historiaCompleta: h.descricao       || '',
        dataCartao:       (c.data_criacao || h.data_criacao).split('T')[0],
        autorCartao:      c.autor_cartao    || 'Anónimo',
        categorias:       hcMap[h.id]       || [],
        likes:            c.likes ?? 0
      }
    };
  });
}

function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  const h3 = document.createElement('h3');
  h3.textContent = story.cartao.tituloCartao;
  div.appendChild(h3);

  const sin = document.createElement('div');
  sin.className = 'sheet-sinopse';
  sin.innerHTML = formataComQuebra(story.cartao.sinopseCartao);
  div.appendChild(sin);

  const mais = document.createElement('span');
  mais.className = 'ver-mais';
  mais.textContent = 'mais...';
  mais.onclick = () => abrirModal(story);
  div.appendChild(mais);

  if (story.hasCartao) {
    const likeCont = document.createElement('div');
    likeCont.style.marginTop = '10px';
    const likeBtn = document.createElement('button');
    const likeCt  = document.createElement('span');
    let userLiked = likedStories.has(story.id);

    const updateUI = () => {
      likeBtn.textContent = userLiked ? '❤️' : '🤍';
      likeCt.textContent  = ` ${story.cartao.likes} curtida(s)`;
    };
    updateUI();

    likeBtn.style.cssText = `
      background:transparent; border:none; outline:none;
      padding:0; cursor:pointer; font-size:1.4rem;
    `;

    likeBtn.onclick = async () => {
      if (!sessionUserId) { alert('Faça login para dar like.'); return; }
      if (userLiked) {
        story.cartao.likes--;
        await supabase.from('user_likes').delete().match({ user_id: sessionUserId, historia_id: story.id });
      } else {
        story.cartao.likes++;
        await supabase.from('user_likes').insert({ user_id: sessionUserId, historia_id: story.id });
      }
      userLiked = !userLiked;
      likedStories[userLiked ? 'add' : 'delete'](story.id);
      updateUI();
      await supabase.from('cartoes').update({ likes: story.cartao.likes }).eq('historia_id', story.id);
    };

    likeCont.appendChild(likeBtn);
    likeCont.appendChild(likeCt);
    div.appendChild(likeCont);
  }

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

function abrirModal(story) {
  isModalOpen    = true;
  currentStoryId = story.id;
  modalTitle.textContent  = story.cartao.tituloCartao;
  modalFullText.innerHTML = formataComQuebra(story.cartao.sinopseCartao);
  modalInfo.innerHTML     = `
    <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
    <p><strong>Autor:</strong> ${story.cartao.autor_cartao}</p>
    <p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>
  `;

  const btnLer = document.createElement('button');
  btnLer.textContent = 'Ler';
  btnLer.onclick = () => {
    modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
    continuarBtn.style.display = 'block';
  };
  modalFullText.appendChild(btnLer);

  continuarBtn.style.display = readingPositions[story.id] != null
    ? 'block'
    : 'none';

  modalOverlay.style.display = 'flex';
}

function continuarLeitura() {
  if (currentStoryId === null) return;
  modalFullText.innerHTML = formatarTextoParaLeitura(
    allStories.find(s => s.id === currentStoryId).cartao.historiaCompleta
  );
  const pos = readingPositions[currentStoryId];
  if (pos != null) {
    const span = modalFullText.querySelector(`[data-index="${pos}"]`);
    if (span) {
      span.style.background = 'yellow';
      span.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
}

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

function showBatch(count) {
  const slice = getFilteredStories().slice(currentOffset, currentOffset + count);
  const frag  = document.createDocumentFragment();
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

function createPlaceholderCard() {
  const div = document.createElement('div');
  div.className = 'sheet sheet-placeholder';
  div.innerHTML = '<h3>Placeholder</h3><p>(sem história)</p>';
  return div;
}
