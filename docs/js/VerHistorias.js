// js/VerHistorias.js
import { supabase } from './supabase.js';

// Estado global
let allStories = [];
let currentOffset = 0;
const initialCount = 20;
const increment = 5;

// Referências ao DOM (inicializadas após o carregamento)
let container, categoryFilter, sortFilter, searchBar, loadMoreBtn;
let modalOverlay, modalClose, modalTitle, modalFullText, modalInfo;
let warningOverlay, warningYes, warningNo, continuarBtn;

let isModalOpen = false;
let currentStoryId = null;

// Likes locais (persistência temporária)
let likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');

// Mapa de categorias: id → nome
let categoryMap = {};

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

// [3] Busca histórias + cartões + categorias
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

  // Cartões (inclui likes)
  const { data: cartoes, error: errC } = await supabase
    .from('cartoes')
    .select('historia_id, titulo_cartao, sinopse_cartao, autor_cartao, data_criacao, likes');
  if (errC) {
    console.error('Erro ao carregar cartões:', errC);
    return;
  }
  const cartaoMap = Object.fromEntries(cartoes.map(c => [c.historia_id, c]));

  // Relações história–categoria
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
    const nomeCat = categoryMap[categoria_id] || 'Sem Categoria';
    hcMap[historia_id].push(nomeCat);
  });

  // Monta allStories
  allStories = historias.map(h => {
    const c = cartaoMap[h.id] || {};
    // Define sinopse: prioriza sinopse do cartão, senão descrição da história, senão texto padrão
    const sinopse = c.sinopse_cartao || h.descricao || 'Sem sinopse';
    // Define texto completo: descrição da história ou texto padrão
    const completa = h.descricao || 'Sem história';
    return {
      id: h.id,
      cartao: {
        tituloCartao:     c.titulo_cartao    || h.titulo         || 'Sem título',
        sinopseCartao:    sinopse,
        historiaCompleta: completa,
        dataCartao:       (c.data_criacao    || h.data_criacao).split('T')[0],
        autorCartao:      c.autor_cartao     || 'Anónimo',
        categorias:       hcMap[h.id]        || ['Sem Categoria'],
        likes:            c.likes ?? 0
      }
    };
  });
    return {
      id: h.id,
      cartao: {
        tituloCartao:     c.titulo_cartao    || h.titulo         || 'Sem título',
        sinopseCartao:    c.sinopse_cartao   || h.descricao      || '',
        historiaCompleta: h.descricao        || '',
        dataCartao:       (c.data_criacao    || h.data_criacao).split('T')[0],
        autorCartao:      c.autor_cartao     || 'Anónimo',
        categorias:       hcMap[h.id]        || ['Sem Categoria'],
        likes:            c.likes ?? 0
      }
    };
  });
}

// [4] Formatação de texto
function formatarPor4Linhas(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const paras = [];
  for (let i = 0; i < lines.length; i += 4) {
    paras.push(lines.slice(i, i + 4).join('<br>'));
  }
  return paras
    .map(p => `<p style="text-align: justify;">${p}</p>`)
    .join('');
}

function formatarTextoParaLeitura(text) {
  if (!text) return '';
  const lines = text.split('\n');
  let idx = 0, buf = [], paras = [];
  for (let i = 0; i < lines.length; i++) {
    const spans = lines[i]
      .split(' ')
      .map(w => `<span data-index="${idx++}" onclick="markReadingPosition(this)">${w}</span>`)
      .join(' ');
    buf.push(spans);
    if ((i + 1) % 4 === 0) {
      paras.push(`<p style="text-align: justify;">${buf.join('<br>')}</p>`);
      buf = [];
    }
  }
  if (buf.length) paras.push(`<p style="text-align: justify;">${buf.join('<br>')}</p>`);
  return paras.join('');
}

function markReadingPosition(el) {
  const idx = el.getAttribute('data-index');
  localStorage.setItem(`readingPosition_${currentStoryId}`, idx);
}

function destacarPalavra() {
  const saved = localStorage.getItem(`readingPosition_${currentStoryId}`);
  if (saved !== null && modalFullText) {
    const span = modalFullText.querySelector(`[data-index="${saved}"]`);
    if (span) {
      span.style.background = 'yellow';
      span.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
}

// [5] Criação de cards e placeholders
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

  const likeCont = document.createElement('div');
  likeCont.style.marginTop = '10px';
  const likeBtn = document.createElement('button');
  const likeCt = document.createElement('span');
  let userLiked = likedStories.includes(story.id);
  Object.assign(likeBtn.style, { background: 'transparent', border: 'none', outline: 'none', padding: '0', cursor: 'pointer', fontSize: '1.4rem' });
  likeBtn.onfocus = () => likeBtn.blur();
  function updateUI() {
    userLiked = likedStories.includes(story.id);
    likeBtn.textContent = userLiked ? '❤️' : '🤍';
    likeCt.textContent = ` ${story.cartao.likes} curtida(s)`;
  }
  updateUI();

  likeBtn.addEventListener('click', () => {
    if (userLiked) {
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

// [8] Inicialização após DOM carregado
document.addEventListener('DOMContentLoaded', async () => {
  // Captura elementos
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

  // Listeners de filtros e paginação
  searchBar.addEventListener('input', initialLoad);
  categoryFilter.addEventListener('change', initialLoad);
  sortFilter.addEventListener('change', initialLoad);
  loadMoreBtn.addEventListener('click', loadMore);

  // Listeners de modal e avisos
  modalClose.addEventListener('click', () => { modalOverlay.style.display = 'none'; isModalOpen = false; });
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay && isModalOpen) warningOverlay.style.display = 'flex'; });
  warningYes.addEventListener('click', () => { modalOverlay.style.display = 'none'; warningOverlay.style.display = 'none'; isModalOpen = false; });
  warningNo.addEventListener('click', () => { warningOverlay.style.display = 'none'; });
  continuarBtn.addEventListener('click', () => {
    const st = allStories.find(s => s.id === currentStoryId);
    if (st) {
      modalFullText.innerHTML = formatarTextoParaLeitura(st.cartao.historiaCompleta);
      setTimeout(destacarPalavra, 100);
    }
  });
});
