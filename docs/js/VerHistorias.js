import { supabase } from './supabase.js';

let allStories    = [];
let currentOffset = 0;
const initialCount = 20;
const increment    = 5;

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

let likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');
let categoryMap  = {};

async function exibirUsuarioLogado() {
  try {
    const { data: { session }, error: err } = await supabase.auth.getSession();
    if (err) throw err;
    const area = document.getElementById('userMenuArea');
    if (!session) {
      area.innerHTML = `<a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
      return;
    }
    const userId = session.user.id;
    const { data: profile, error: errP } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    if (errP) throw errP;
    area.textContent = profile.username || session.user.email;
    area.style.cursor = 'pointer';
    area.onclick = () => {
      if (confirm('Deseja fazer logout?')) {
        supabase.auth.signOut().then(() => location.href = 'Criacao.html');
      }
    };
  } catch (e) {
    console.error('Erro em exibirUsuarioLogado:', e);
  }
}

async function fetchCategories() {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('*');
    if (error) throw error;
    console.log('Categorias:', data);
    categoryMap = Object.fromEntries(data.map(c => [c.id, c.nome]));
  } catch (e) {
    console.error('Erro em fetchCategories:', e);
  }
}

async function fetchStoriesFromSupabase() {
  try {
    // 1) Histórias (inclui likes)
    const { data: historias, error: errH } = await supabase
      .from('historias')
      .select('*')
      .order('data_criacao', { ascending: false });
    if (errH) throw errH;
    console.log('Histórias raw:', historias);

    // 2) Cartões
    const { data: cartoes, error: errC } = await supabase
      .from('cartoes')
      .select('*');
    if (errC) throw errC;
    console.log('Cartões raw:', cartoes);
    const cartaoMap = Object.fromEntries(cartoes.map(c => [c.historia_id, c]));

    // 3) Relações história–categoria
    const { data: hcData, error: errHC } = await supabase
      .from('historia_categorias')
      .select('*');
    if (errHC) throw errHC;
    console.log('História-Categoria raw:', hcData);
    const hcMap = {};
    hcData.forEach(({ historia_id, categoria_id }) => {
      hcMap[historia_id] = hcMap[historia_id] || [];
      hcMap[historia_id].push(categoryMap[categoria_id]);
    });

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
          likes:            h.likes           || 0
        }
      };
    });

    console.log('allStories montadas:', allStories);
  } catch (e) {
    console.error('Erro em fetchStoriesFromSupabase:', e);
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
  }
}

function formatarPor4Linhas(text) {
  const lines = text.split('\n');
  const paras = [];
  for (let i = 0; i < lines.length; i += 4) {
    paras.push(lines.slice(i, i + 4).join('<br>'));
  }
  return paras.map(p => `<p style="text-align: justify;">${p}</p>`).join('');
}
function formatarTextoParaLeitura(text) {
  const lines = text.split('\n'), paras = [], spansAll = [];
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    lines[i].split(' ').forEach(w => {
      spansAll.push(`<span data-index="${idx++}" onclick="markReadingPosition(this)">${w}</span>`);
    });
    if ((i+1)%4===0 || i===lines.length-1) {
      paras.push(`<p style="text-align: justify;">${spansAll.join(' ')}</p>`);
      spansAll.length = 0;
    }
  }
  return paras.join('');
}
function markReadingPosition(el) {
  localStorage.setItem(`readingPosition_${currentStoryId}`, el.dataset.index);
}
function destacarPalavra() {
  const saved = localStorage.getItem(`readingPosition_${currentStoryId}`);
  if (saved) {
    const span = modalFullText.querySelector(`[data-index="${saved}"]`);
    if (span) {
      span.style.background = 'yellow';
      span.scrollIntoView({ behavior:'smooth', block:'center' });
    }
  }
}

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
  mais.onclick = () => {
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
    btnLer.onclick = () => {
      modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
      setTimeout(destacarPalavra, 100);
    };
    modalFullText.appendChild(btnLer);
    continuarBtn.style.display =
      localStorage.getItem(`readingPosition_${story.id}`) ? 'inline-block' : 'none';
    modalOverlay.style.display = 'flex';
  };
  div.appendChild(mais);

  // Likes
  const likeCont = document.createElement('div');
  likeCont.style.marginTop = '8px';
  const likeBtn = document.createElement('button');
  likeBtn.classList.add('like-btn');
  const likeCt = document.createElement('span');
  let userLiked = likedStories.includes(story.id);

  function updateUI() {
    likeBtn.textContent = userLiked ? '❤️' : '🤍';
    likeCt.textContent = ` ${story.cartao.likes}`;
  }
  updateUI();

  likeBtn.onclick = async () => {
    // toggle
    if (userLiked) {
      story.cartao.likes = Math.max(story.cartao.likes - 1, 0);
      likedStories = likedStories.filter(i => i !== story.id);
    } else {
      story.cartao.likes++;
      likedStories.push(story.id);
    }
    userLiked = !userLiked;

    // update Supabase
    const { error } = await supabase
      .from('historias')
      .update({ likes: story.cartao.likes })
      .eq('id', story.id);
    if (error) console.error('Erro ao atualizar likes:', error);

    localStorage.setItem('likedStories', JSON.stringify(likedStories));
    updateUI();
  };

  likeCont.append(likeBtn, likeCt);
  div.appendChild(likeCont);

  const catCont = document.createElement('div');
  catCont.className = 'sheet-categories';
  (story.cartao.categorias.length
    ? story.cartao.categorias
    : ['Sem Categoria']
  ).forEach(c => {
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

function matchesSearch(story, txt) {
  if (!txt) return true;
  txt = txt.toLowerCase();
  return (
    story.cartao.tituloCartao.toLowerCase().includes(txt) ||
    story.cartao.autorCartao.toLowerCase().includes(txt)
  );
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

// Modal & aviso
modalClose.onclick = () => {
  modalOverlay.style.display = 'none'; isModalOpen = false;
};
modalOverlay.onclick = e => {
  if (e.target === modalOverlay && isModalOpen) warningOverlay.style.display = 'flex';
};
warningYes.onclick = () => {
  modalOverlay.style.display = 'none'; warningOverlay.style.display = 'none'; isModalOpen = false;
};
warningNo.onclick = () => warningOverlay.style.display = 'none';
continuarBtn.onclick = () => {
  const st = allStories.find(s => s.id === currentStoryId);
  if (st) {
    modalFullText.innerHTML = formatarTextoParaLeitura(st.cartao.historiaCompleta);
    setTimeout(destacarPalavra, 100);
  }
};

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await fetchCategories();
  await fetchStoriesFromSupabase();
  initialLoad();
  searchBar.oninput       = initialLoad;
  categoryFilter.onchange = initialLoad;
  sortFilter.onchange     = initialLoad;
  loadMoreBtn.onclick     = loadMore;
});
