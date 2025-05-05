import { supabase } from './supabase.js';

let allStories    = [];
let currentOffset = 0;
const initialCount = 20;
const increment    = 5;

const container      = document.getElementById('storiesContainer');
const categoryFilter = document.getElementById('category-filter');
const sortFilter     = document.getElementById('sort-filter')eu oreBtn');

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

let likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');
let categoryMap  = {};  // id → nome

// Utils for paragraph-based reading
function formatarPor4Linhas(text) {
  const lines = text.split('\n');
  const paras = [];
  for (let i = 0; i < lines.length; i += 4) {
    paras.push(`<p style=\"text-align: justify;\">${lines.slice(i, i + 4).join('<br>')}</p>`);
  }
  return paras.join('');
}

function formatarTextoParaLeitura(text) {
  const lines = text.split('\n');
  const paras = [];
  let pIdx = 0;
  for (let i = 0; i < lines.length; i += 4) {
    const chunk = lines.slice(i, i + 4).join('<br>');
    paras.push(`<p style=\"text-align: justify; cursor: pointer;\" data-index=\"${pIdx}\">${chunk}</p>`);
    pIdx++;
  }
  return paras.join('');
}

function markReadingPositionParagraph(idx) {
  localStorage.setItem(`readingPosition_${currentStoryId}`, idx);
}

function destacarParagrafo() {
  const saved = localStorage.getItem(`readingPosition_${currentStoryId}`);
  if (saved !== null) {
    const p = modalFullText.querySelector(`p[data-index=\"${saved}\"]`);
    if (p) {
      p.style.background = 'yellow';
      p.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
}

// [1] Exibe usuário logado / login
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
    document.querySelector('.filter-bar')
      .insertAdjacentHTML('afterend',
        '<p class=\"error\">Não foi possível carregar as categorias.</p>');
    return;
  }
  categoryMap = Object.fromEntries(data.map(c => [c.id, c.nome]));
}

// [3] Busca histórias + cartões + categorias + likes
async function fetchStoriesFromSupabase() {
  // Histórias
  const { data: historias, error: errH } = await supabase
    .from('historias')
    .select('id, titulo, descricao, user_id, data_criacao')
    .order('data_criacao', { ascending: false });
  if (errH) {
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
    return;
  }
  // Cartões
  const { data: cartoes, error: errC } = await supabase
    .from('cartoes')
    .select('historia_id, titulo_cartao, sinopse_cartao, autor_cartao, data_criacao');
  if (errC) {
    console.error(errC);
    return;
  }
  const cartaoMap = Object.fromEntries(cartoes.map(c => [c.historia_id, c]));
  // Categorias de história
  const { data: hcData, error: errHC } = await supabase
    .from('historia_categorias')
    .select('historia_id, categoria_id');
  if (errHC) {
    console.error(errHC);
    return;
  }
  const hcMap = {};
  hcData.forEach(({ historia_id, categoria_id }) => {
    if (!hcMap[historia_id]) hcMap[historia_id] = [];
    hcMap[historia_id].push(categoryMap[categoria_id]);
  });
  // Likes agregados
  const { data: likesAgg } = await supabase
    .from('likes')
    .select('historia_id, count(*)')
    .group('historia_id');
  const likesMap = Object.fromEntries(likesAgg.map(l => [l.historia_id, l.count]));

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
        likes:            likesMap[h.id]    || 0
      }
    };
  });
}

// [4] Criação de cards
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
    modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
    modalInfo.innerHTML = `\n      <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>\n      <p><strong>Autor:</strong> ${story.cartao.autorCartao}</p>\n      <p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>`;
    const btnLer = document.createElement('button');
    btnLer.textContent = 'Ler';
    btnLer.addEventListener('click', () => {
      modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
      modalFullText.querySelectorAll('p[data-index]').forEach(p => {
        p.addEventListener('click', () => markReadingPositionParagraph(p.dataset.index));
      });
      setTimeout(destacarParagrafo, 100);
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
  const likeCt  = document.createElement('span');
  let userLiked = likedStories.includes(story.id);
  function updateUI() {
    likeBtn.textContent = userLiked ? '❤️' : '🤍';
    likeCt.textContent = ` ${story.cartao.likes} curtida(s)`;
  }
  updateUI();
  likeBtn.addEventListener('click', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;
    if (userLiked) {
      await supabase.from('likes').delete().match({ historia_id: story.id, user_id: userId });
      story.cartao.likes--;
      likedStories = likedStories.filter(i => i !== story.id);
    } else {
      await supabase.from('likes').insert({ historia_id: story.id, user_id: userId });
      story.cartao.likes++;
      likedStories.push(story.id);
    }
    localStorage.setItem('likedStories', JSON.stringify(likedStories));
    userLiked = !userLiked;
    updateUI();
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

// [5] Filtrar / ordenar / pesquisar
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

// [6] Paginação sem placeholders
function showBatch(count) {
  const filtered = getFilteredStories();
  const slice = filtered.slice(currentOffset, currentOffset + count);
  slice.forEach(s => container.appendChild(createStoryCard(s)));
  currentOffset += slice.length;
  if (currentOffset >= filtered.length) {
    loadMoreBtn.style.display = 'none';
  } else {
    loadMoreBtn.disabled = false;
  }
}

function initialLoad() {
  container.innerHTML = '';
  currentOffset = 0;
  loadMoreBtn.style.display = getFilteredStories().length > initialCount ? 'inline-block' : 'none';
  showBatch(initialCount);
}

function loadMore() {
  loadMoreBtn.disabled = true;
  showBatch(increment);
}

// [7] Modal & aviso
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
    modalFullText.querySelectorAll('p[data-index]').forEach(p => {
      p.addEventListener('click', () => markReadingPositionParagraph(p.dataset.index));
    });
    setTimeout(destacarParagrafo, 100);
  }
});

// [8] Inicialização
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
