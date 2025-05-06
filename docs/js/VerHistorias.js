// js/VerHistorias.js
import { supabase } from './supabase.js';

// Estado global\let allStories = [];
let currentOffset = 0;
const initialCount = 20;
const increment = 5;

// Referências ao DOM (definidas em DOMContentLoaded)
let container;
let categoryFilter;
let sortFilter;
let searchBar;
let loadMoreBtn;
let modalOverlay;
let modalClose;
let modalTitle;
let modalFullText;
let modalInfo;
let warningOverlay;
let warningYes;
let warningNo;
let continuarBtn;

let isModalOpen = false;
let currentStoryId = null;

// Likes persistidos em localStorage como fallback
let likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');

// Mapa de categorias: id → nome
let categoryMap = {};

// [1] Exibir usuário logado ou link de login
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    area.innerHTML = `<a href=\"Criacao.html\"><i class=\"fas fa-user\"></i> Login</a>`;
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
  area.addEventListener('click', () => {
    if (confirm('Deseja fazer logout?')) {
      supabase.auth.signOut().then(() => location.href = 'Criacao.html');
    }
  });
}

// [2] Carregar categorias
async function fetchCategories() {
  const { data, error } = await supabase.from('categorias').select('id, nome');
  if (error) {
    console.error('Erro ao carregar categorias:', error);
    return;
  }
  categoryMap = Object.fromEntries(data.map(c => [c.id, c.nome]));
}

// [3] Buscar histórias, cartões e categorias
async function fetchStoriesFromSupabase() {
  // Buscar histórias
  const { data: historias, error: errH } = await supabase
    .from('historias')
    .select('id, titulo, descricao, data_criacao')
    .order('data_criacao', { ascending: false });
  if (errH) {
    console.error('Erro ao carregar histórias:', errH);
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
    return;
  }

  // Buscar cartões
  const { data: cartoes, error: errC } = await supabase
    .from('cartoes')
    .select('historia_id, titulo_cartao, sinopse_cartao, autor_cartao, data_criacao, likes');
  if (errC) {
    console.error('Erro ao carregar cartões:', errC);
    return;
  }
  const cartaoMap = Object.fromEntries(cartoes.map(c => [c.historia_id, c]));

  // Buscar relação história–categoria
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
    hcMap[historia_id].push(categoryMap[categoria_id] || 'Sem Categoria');
  });

  // Construir allStories
  allStories = historias.map(h => {
    const c = cartaoMap[h.id] || {};
    const sinopse = c.sinopse_cartao || h.descricao || 'Sem sinopse';
    const completa = h.descricao || 'Sem história';
    return {
      id: h.id,
      cartao: {
        tituloCartao:     c.titulo_cartao    || h.titulo      || 'Sem título',
        sinopseCartao:    sinopse,
        historiaCompleta: completa,
        dataCartao:       (c.data_criacao || h.data_criacao).split('T')[0],
        autorCartao:      c.autor_cartao     || 'Anónimo',
        categorias:       hcMap[h.id]        || ['Sem Categoria'],
        likes:            c.likes ?? 0
      }
    };
  });
}

// [4] Formatar texto
function formatarPor4Linhas(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const paras = [];
  for (let i = 0; i < lines.length; i += 4) {
    paras.push(lines.slice(i, i + 4).join('<br>'));
  }
  return paras.map(p => `<p style=\"text-align: justify;\">${p}</p>`).join('');
}

function formatarTextoParaLeitura(text) {
  if (!text) return '';
  const lines = text.split('\n');
  let idx = 0;
  let buf = [];
  const paras = [];
  lines.forEach((line, i) => {
    const spans = line.split(' ').map(w => `<span data-index=\"${idx++}\" onclick=\"markReadingPosition(this)\">${w}</span>`).join(' ');
    buf.push(spans);
    if ((i + 1) % 4 === 0) {
      paras.push(`<p style=\"text-align: justify;\">${buf.join('<br>')}</p>`);
      buf = [];
    }
  });
  if (buf.length) paras.push(`<p style=\"text-align: justify;\">${buf.join('<br>')}</p>`);
  return paras.join('');
}

function markReadingPosition(el) {
  localStorage.setItem(`readingPosition_${currentStoryId}`, el.getAttribute('data-index'));
}

function destacarPalavra() {
  const saved = localStorage.getItem(`readingPosition_${currentStoryId}`);
  if (saved !== null && modalFullText) {
    const span = modalFullText.querySelector(`[data-index=\"${saved}\"]`);
    if (span) {
      span.style.background = 'yellow';
      span.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

// [5] Criar card de história
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

  // Botão 'mais...'
  const mais = document.createElement('span');
  mais.className = 'ver-mais';
  mais.textContent = 'mais...';
  mais.addEventListener('click', () => {
    isModalOpen = true;
    currentStoryId = story.id;
    modalTitle.textContent = story.cartao.tituloCartao;
    modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
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
    continuarBtn.style.display = localStorage.getItem(`readingPosition_${story.id}`) ? 'inline-block' : 'none';
    modalOverlay.style.display = 'flex';
  });
  div.appendChild(mais);

  // Likes
  const likeCont = document.createElement('div');
  likeCont.style.marginTop = '10px';
  const likeBtn = document.createElement('button');
  const likeCt = document.createElement('span');
  const updateUI = () => {
    const liked = likedStories.includes(story.id);
    likeBtn.textContent = liked ? '❤️' : '🤍';
    likeCt.textContent = ` ${story.cartao.likes} curtida(s)`;
  };
  updateUI();
  likeBtn.addEventListener('click', () => {
    const liked = likedStories.includes(story.id);
    if (liked) {
      story.cartao.likes = Math.max(story.cartao.likes - 1, 0);
      likedStories = likedStories.filter(i => i !== story.id);
    } else {
      story.cartao.likes++;
      likedStories.push(story.id);
    }
    localStorage.setItem('likedStories', JSON.stringify(likedStories));
    updateUI();
  });
  likeCont.append(likeBtn, likeCt);
  div.appendChild(likeCont);

  // Categorias
  const catCont = document.createElement('div');
  catCont.className = 'sheet-categories';
  story.cartao.categorias.forEach(c => {
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

// [6] Filtrar e ordenar
function matchesSearch(story, txt) {
  if (!txt) return true;
  const lower = txt.toLowerCase();
  return story.cartao.tituloCartao.toLowerCase().includes(lower)
    || story.cartao.autorCartao.toLowerCase().includes(lower);
}

function getFilteredStories() {
  let arr = allStories.filter(s => matchesSearch(s, searchBar.value));
  if (categoryFilter.value) arr = arr.filter(s => s.cartao.categorias.includes(categoryFilter.value));
  if (sortFilter.value === 'date') arr.sort((a,b)=>b.cartao.dataCartao.localeCompare(a.cartao.dataCartao));
  else if (sortFilter.value==='popularity') arr.sort((a,b)=>b.cartao.likes - a.cartao.likes);
  return arr;
}

// [7] Paginação
function showBatch(count) {
  const filtered = getFilteredStories();
  const slice = filtered.slice(currentOffset, currentOffset + count);
  const frag = document.createDocumentFragment();
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

function loadMore() {
  loadMoreBtn.disabled = true;
  showBatch(increment);
}

// [8] Inicialização após DOM carregar
document.addEventListener('DOMContentLoaded', async () => {
  container      = document.getElementById('storiesContainer');
  categoryFilter = document.getElementById('category-filter');
  sortFilter     = document.getElementById('sort-filter');
  searchBar      = document.getElementById('searchBar');
  loadMoreBtn    = document.getElementById('loadMoreBtn');
  modalOverlay   = document.getElementById('modalOverlay');
  modalClose     = document.getElementById('modalClose');
  modalTitle     = document.getElementById('modalTitle');
  modalFullText  = document.getElementById('modalFullText');
  modalInfo      = document.getElementById('modalInfo');
  warningOverlay = document.getElementById('warningOverlay');
  warningYes     = document.getElementById('warningYes');
  warningNo      = document.getElementById('warningNo');
  continuarBtn   = document.getElementById('continuarBtn');

  await exibirUsuarioLogado();
  await fetchCategories();
  await fetchStoriesFromSupabase();
  initialLoad();

  searchBar.addEventListener('input', initialLoad);
  categoryFilter.addEventListener('change', initialLoad);
  sortFilter.addEventListener('change', initialLoad);
  loadMoreBtn.addEventListener('click', loadMore);

  modalClose.addEventListener('click', () => { modalOverlay.style.display = 'none'; isModalOpen = false; });
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay && isModalOpen) warningOverlay.style.display = 'flex'; });
  warningYes.addEventListener('click', () => { modalOverlay.style.display = 'none'; warningOverlay.style.display = 'none'; isModalOpen = false; });
  warningNo.addEventListener('click', () => { warningOverlay.style.display = 'none'; });
  continuarBtn.addEventListener('click', () => {
    const s = allStories.find(x => x.id === currentStoryId);
    if (s) {
      modalFullText.innerHTML = formatarTextoParaLeitura(s.cartao.historiaCompleta);
      setTimeout(destacarPalavra, 100);
    }
  });
});
