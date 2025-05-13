// js/VerHistorias.js
import { supabase } from './supabase.js';

// Estado global
let sessionUserId = null;
let allStories = [];
let likedStories = new Set();
let currentStoryId = null;
let currentOffset = 0;
const initialCount = 20;
const increment = 5;

// Elementos do DOM
const container = document.getElementById('storiesContainer');
const categoryFilter = document.getElementById('category-filter');
const sortFilter = document.getElementById('sort-filter');
const searchForm = document.getElementById('searchForm');
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

let categoryMap = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Previne reload do formulário de busca
  if (searchForm) {
    searchForm.addEventListener('submit', e => { e.preventDefault(); initialLoad(); });
  }

  // Obtém sessão e exibe login/usuário
  const { data: { session } } = await supabase.auth.getSession();
  sessionUserId = session?.user?.id || null;
  await exibirUsuarioLogado();

  // Se estiver logado, carrega curtidas
  if (sessionUserId) {
    await fetchUserLikes();
  }

  // Carrega categorias e histórias
  await fetchCategories();
  await fetchStoriesFromSupabase();

  // Exibe primeiro lote de cartões
  initialLoad();

  // Eventos de filtro e paginação
  searchBar.addEventListener('input', initialLoad);
  categoryFilter.addEventListener('change', initialLoad);
  sortFilter.addEventListener('change', initialLoad);
  loadMoreBtn.addEventListener('click', () => {
    loadMoreBtn.disabled = true;
    showBatch(increment);
  });

  // Controles do modal
  modalClose.addEventListener('click', () => modalOverlay.style.display = 'none');
  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) warningOverlay.style.display = 'flex';
  });
  warningYes.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
    warningOverlay.style.display = 'none';
  });
  warningNo.addEventListener('click', () => warningOverlay.style.display = 'none');
}

// Exibe link de login ou nome de usuário
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    area.innerHTML = `<a href=\"Criacao.html\"><i class=\"fas fa-user\"></i> Login</a>`;
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

// Carrega IDs de histórias curtidas
async function fetchUserLikes() {
  const { data, error } = await supabase
    .from('user_likes')
    .select('historia_id')
    .eq('user_id', sessionUserId);
  if (!error) likedStories = new Set(data.map(r => r.historia_id));
}

// Carrega categorias
async function fetchCategories() {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome');
  if (!error) categoryMap = Object.fromEntries(data.map(c => [c.id, c.nome]));
}

// Carrega histórias e cartões
async function fetchStoriesFromSupabase() {
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

  const { data: hc } = await supabase
    .from('historia_categorias')
    .select('historia_id, categoria_id');
  const hcMap = {};
  hc.forEach(({ historia_id, categoria_id }) => {
    hcMap[historia_id] = hcMap[historia_id] || [];
    hcMap[historia_id].push(categoryMap[categoria_id]);
  });

  allStories = historias.map(h => {
    const c = cardMap[h.id] || {};
    return {
      id: h.id,
      hasCartao: Boolean(c.titulo_cartao),
      cartao: {
        tituloCartao: c.titulo_cartao || h.titulo || 'Sem título',
        sinopseCartao: c.sinopse_cartao || h.descricao || '',
        historiaCompleta: h.descricao || '',
        dataCartao: (c.data_criacao || h.data_criacao).split('T')[0],
        autorCartao: c.autor_cartao || 'Anónimo',
        categorias: hcMap[h.id] || [],
        likes: c.likes ?? 0
      }
    };
  });
}

// Converte quebras de linha em <br>
function formataTextoParaMostrar(texto = '') {
  return texto.replace(/\r?\n/g, '<br>');
}

// Separa parágrafos e mantém quebras internas
function formatarTextoParaLeitura(texto = '') {
  return texto
    .split(/\r?\n\r?\n/)      // quebra em parágrafos
    .map(par => par.replace(/\r?\n/g, '<br>')) // quebras internas
    .map(par => `<p style="white-space:pre-wrap;text-align:justify">${par}</p>`)
    .join('');
}

// Marca posição de leitura
window.markReadingPosition = el => {
  localStorage.setItem(`readingPosition_${currentStoryId}`, el.dataset.index);
  modalFullText.querySelectorAll('span').forEach(s => s.style.background = '');
  el.style.background = 'yellow';
};

// Cria cartão de história
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  const title = document.createElement('h3');
  title.textContent = story.cartao.tituloCartao;
  div.appendChild(title);

  const sinopse = document.createElement('div');
  sinopse.className = 'sheet-sinopse';
  sinopse.innerHTML = formataTextoParaMostrar(story.cartao.sinopseCartao);
  div.appendChild(sinopse);

  const mais = document.createElement('span');
  mais.className = 'ver-mais';
  mais.textContent = 'mais...';
  mais.onclick = () => abrirModal(story);
  div.appendChild(mais);

  if (story.hasCartao) {
    const likeBox = document.createElement('div');
    likeBox.style.marginTop = '10px';
    const btn = document.createElement('button');
    btn.style = 'background:none;border:none;cursor:pointer;font-size:1.4rem';
    const count = document.createElement('span');
    let userLiked = likedStories.has(story.id);
    const updateLikeUI = () => {
      btn.textContent = userLiked ? '❤️' : '🤍';
      count.textContent = ` ${story.cartao.likes} curtida(s)`;
    };
    updateLikeUI();
    btn.onclick = async () => {
      if (!sessionUserId) { alert('Faça login para curtir'); return; }
      userLiked ? story.cartao.likes-- : story.cartao.likes++;
      userLiked
        ? await supabase.from('user_likes').delete().match({ user_id: sessionUserId, historia_id: story.id })
        : await supabase.from('user_likes').insert({ user_id: sessionUserId, historia_id: story.id });
      userLiked = !userLiked;
      userLiked ? likedStories.add(story.id) : likedStories.delete(story.id);
      updateLikeUI();
      await supabase.from('cartoes').update({ likes: story.cartao.likes }).eq('historia_id', story.id);
    };
    likeBox.append(btn, count);
    div.appendChild(likeBox);
  }

  const catBox = document.createElement('div');
  catBox.className = 'sheet-categories';
  (story.cartao.categorias.length ? story.cartao.categorias : ['Sem Categoria'])
    .forEach(cat => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = cat;
      catBox.appendChild(badge);
    });
  div.appendChild(catBox);

  return div;
}

// Abre modal de leitura
function abrirModal(story) {
  currentStoryId = story.id;
  modalTitle.textContent = story.cartao.tituloCartao;
  modalFullText.innerHTML = formataTextoParaMostrar(story.cartao.sinopseCartao);

  const lerBtn = document.createElement('button');
  lerBtn.textContent = 'Ler';
  lerBtn.onclick = () => {
    modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
    const saved = localStorage.getItem(`readingPosition_${story.id}`);
    if (saved) {
      const el = modalFullText.querySelector(`span[data-index=\"${saved}\"]`);
      if (el) el.style.background = 'yellow';
    }
  };
  modalFullText.appendChild(lerBtn);

  modalInfo.innerHTML = `
    <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
    <p><strong>Autor:</strong> ${story.cartao.autorCartao}</p>
    <p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>
  `;

  warningOverlay.style.display = 'none';
  modalOverlay.style.display = 'flex';
}

// Filtra e ordena histórias
function getFilteredStories() {
  let arr = allStories.filter(st => {
    const t = searchBar.value.trim().toLowerCase();
    return !t ||
      st.cartao.tituloCartao.toLowerCase().includes(t) ||
      st.cartao.autorCartao.toLowerCase().includes(t);
  });
  if (categoryFilter.value) arr = arr.filter(st => st.cartao.categorias.includes(categoryFilter.value));
  if (sortFilter.value === 'date') arr.sort((a,b) => b.cartao.dataCartao.localeCompare(a.cartao.dataCartao));
  else if (sortFilter.value === 'popularity') arr.sort((a,b) => b.cartao.likes - a.cartao.likes);
  return arr;
}

// Exibe batch de cartões
function showBatch(count) {
  const slice = getFilteredStories().slice(currentOffset, currentOffset + count);
  slice.forEach(story => container.appendChild(createStoryCard(story)));
  if (slice.length < count) {
    for (let i = slice.length; i < count; i++) container.appendChild(createPlaceholderCard());
  }
  currentOffset += count;
  loadMoreBtn.disabled = false;
}

// Carregamento inicial
function initialLoad() {
  container.innerHTML = '';
  currentOffset = 0;
  showBatch(initialCount);
}

// Placeholder de cartões vazios
function createPlaceholderCard() {
  const div = document.createElement('div');
  div.className = 'sheet sheet-placeholder';
  div.innerHTML = '<h3>Placeholder</h3><p>(sem história)</p>';
  return div;
}

// Exibe footer ao passar o mouse
document.body.addEventListener('mousemove', e => {
  const footer = document.querySelector('footer');
  if (!footer) return;
  if (window.innerHeight - e.clientY < 50) footer.classList.add('visible'); else footer.classList.remove('visible');
});
