// js/VerHistorias.js
import { supabase } from './supabase.js';

let allStories = [];
let currentOffset = 0;
const initialCount = 20;
const increment = 5;

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
let originalText   = "";

let likedStories   = JSON.parse(localStorage.getItem('likedStories') || '[]');
let categoryMap    = {};  // mapeia categoria_id → nome

/************************************************************
 * [1] Exibir usuário logado ou link de login
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) {
    userArea.innerHTML = `
      <a href="Criacao.html" style="color:white">
        <i class="fas fa-user"></i> Login
      </a>`;
    return;
  }
  const userId = session.user.id;
  const { data: profile } = await supabase
    .from('profiles').select('username').eq('id', userId).single();
  const nome = profile?.username || session.user.email;
  userArea.innerHTML = nome;
  userArea.onclick = () => {
    if (confirm("Deseja fazer logout?")) {
      supabase.auth.signOut().then(({ error }) => {
        if (!error) window.location.href = "Criacao.html";
      });
    }
  };
}

/************************************************************
 * [2] Carregar categorias para o map
 ************************************************************/
async function fetchCategories() {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome');
  if (!error && data) {
    categoryMap = Object.fromEntries(data.map(c => [c.id, c.nome]));
  }
}

/************************************************************
 * [3] Busca somente histórias com cartão publicado
 ************************************************************/
async function fetchStoriesFromSupabase() {
  // inner join em cartoes: só retorna historias que têm pelo menos 1 cartoes
  const { data: stories, error } = await supabase
    .from('historias')
    .select('*, cartoes!inner(*), historia_categorias(*)')
    .order('data_criacao', { ascending: false });

  console.log('fetchStories (publicadas):', { stories, error });

  if (error) {
    container.innerHTML = `<p>Erro ao carregar histórias.</p>`;
    return;
  }
  if (!stories || stories.length === 0) {
    // se não houver nenhuma publicada, limpa a lista
    allStories = [];
    return;
  }

  // monta apenas as publicadas
  allStories = stories.map(story => {
    const cart = story.cartoes[0];  // sempre existe, por causa do inner join
    const cats = (story.historia_categorias || [])
      .map(hc => categoryMap[hc.categoria_id] || '')
      .filter(n => n);

    return {
      id: story.id,
      titulo: story.titulo,
      descricao: story.descricao,
      cartao: {
        tituloCartao:     cart.titulo_cartao,
        sinopseCartao:    cart.sinopse_cartao,
        historiaCompleta: story.descricao,
        dataCartao:       cart.data_criacao?.split('T')[0] || '',
        autorCartao:      cart.autor_cartao,
        categorias:       cats,
        likes:            0
      }
    };
  });
}
}

/************************************************************
 * [4] Formatadores e leitura
 ************************************************************/
function formatarPor4Linhas(text) {
  const lines = text.split('\n');
  let parag = [], buf = [];
  lines.forEach(l => {
    buf.push(l);
    if (buf.length === 4) {
      parag.push(buf.join('<br>'));
      buf = [];
    }
  });
  if (buf.length) parag.push(buf.join('<br>'));
  return parag.map(p => `<p style="text-align: justify;">${p}</p>`).join('');
}

function formatarTextoParaLeitura(text) {
  const lines = text.split('\n');
  let paras = [], buf = [], idx = 0;
  lines.forEach(l => {
    const spans = l.split(' ').map(w => {
      const s = `<span class="reading-word" data-index="${idx}" onclick="markReadingPosition(this)">${w}</span>`;
      idx++;
      return s;
    });
    buf.push(spans.join(' '));
    if (buf.length === 4) {
      paras.push(`<p style="text-align: justify;">${buf.join('<br>')}</p>`);
      buf = [];
    }
  });
  if (buf.length) paras.push(`<p style="text-align: justify;">${buf.join('<br>')}</p>`);
  return paras.join('');
}

function markReadingPosition(el) {
  const i = el.getAttribute('data-index');
  localStorage.setItem('readingPosition_' + currentStoryId, i);
}

function destacarPalavra() {
  const saved = localStorage.getItem('readingPosition_' + currentStoryId);
  if (saved !== null) {
    const span = modalFullText.querySelector(`[data-index="${saved}"]`);
    if (span) {
      span.style.background = 'yellow';
      span.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

/************************************************************
 * [5] Criação de cards e placeholder
 ************************************************************/
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  const t = document.createElement('div');
  t.className = 'sheet-title';
  t.textContent = story.cartao.tituloCartao || '(sem título)';
  div.appendChild(t);

  const s = document.createElement('div');
  s.className = 'sheet-sinopse';
  s.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao || '(sem sinopse)');
  div.appendChild(s);

  const mais = document.createElement('span');
  mais.className = 'ver-mais';
  mais.textContent = 'mais...';
  mais.style.cursor = 'pointer';
  mais.onclick = () => openModalForStory(story);
  div.appendChild(mais);

  // Likes
  const likeCont = document.createElement('div');
  likeCont.style.marginTop = '10px';
  const likeBtn  = document.createElement('button');
  const likeCt   = document.createElement('span');
  let userLiked  = likedStories.includes(story.id);
  function updateLikeUI() {
    likeBtn.textContent = userLiked ? '❤️' : '🤍';
    likeCt.textContent = ` ${story.cartao.likes} curtida(s)`;
  }
  updateLikeUI();
  likeBtn.onclick = () => {
    if (userLiked) {
      story.cartao.likes = Math.max(story.cartao.likes - 1, 0);
      likedStories = likedStories.filter(i => i !== story.id);
    } else {
      story.cartao.likes++;
      likedStories.push(story.id);
    }
    localStorage.setItem('likedStories', JSON.stringify(likedStories));
    updateLikeUI();
  };
  likeCont.appendChild(likeBtn);
  likeCont.appendChild(likeCt);
  div.appendChild(likeCont);

  // Categorias
  const catCont = document.createElement('div');
  catCont.className = 'sheet-categories';
  const cats = story.cartao.categorias;
  if (cats.length) {
    cats.forEach(c => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = c;
      catCont.appendChild(badge);
    });
  } else {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'Sem Categoria';
    catCont.appendChild(badge);
  }
  div.appendChild(catCont);

  return div;
}

function createPlaceholderCard() {
  const div = document.createElement('div');
  div.className = 'sheet sheet-placeholder';
  const t = document.createElement('div');
  t.className = 'sheet-title';
  t.textContent = 'Placeholder';
  div.appendChild(t);
  const s = document.createElement('div');
  s.className = 'sheet-sinopse';
  s.textContent = '(sem história)';
  div.appendChild(s);
  return div;
}

/************************************************************
 * [5.1] Abre modal
 ************************************************************/
function openModalForStory(story) {
  isModalOpen    = true;
  currentStoryId = story.id;
  modalTitle.textContent = story.cartao.tituloCartao;
  modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  modalInfo.innerHTML = `
    <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
    <p><strong>Autor:</strong> ${story.cartao.autorCartao}</p>
    <p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>
  `;
  const lerBtn = document.createElement('button');
  lerBtn.textContent = 'Ler';
  lerBtn.onclick = () => {
    originalText = story.cartao.historiaCompleta;
    modalFullText.innerHTML = formatarTextoParaLeitura(originalText);
  };
  modalFullText.appendChild(lerBtn);

  const pos = localStorage.getItem('readingPosition_' + story.id);
  continuarBtn.style.display = pos !== null ? 'inline-block' : 'none';

  modalOverlay.style.display = 'flex';
}

/************************************************************
 * [6] Filtrar / ordenar / pesquisar
 ************************************************************/
function matchesSearch(story, txt) {
  txt = txt.trim().toLowerCase();
  if (!txt) return true;
  return story.cartao.tituloCartao.toLowerCase().includes(txt)
      || story.cartao.autorCartao.toLowerCase().includes(txt);
}

function getFilteredStories() {
  let arr = [...allStories];
  arr = arr.filter(s => matchesSearch(s, searchBar.value));
  if (categoryFilter.value) {
    arr = arr.filter(s => s.cartao.categorias.includes(categoryFilter.value));
  }
  if (sortFilter.value === 'date') {
    arr.sort((a,b) => (a.cartao.dataCartao||'').localeCompare(b.cartao.dataCartao||''));
  } else if (sortFilter.value === 'popularity') {
    arr.sort((a,b) => (b.cartao.likes||0) - (a.cartao.likes||0));
  }
  return arr;
}

/************************************************************
 * [7] Paginação + placeholders
 ************************************************************/
function showBatch(cnt) {
  const filtered = getFilteredStories();
  const slice = filtered.slice(currentOffset, currentOffset + cnt);
  slice.forEach(st => container.appendChild(createStoryCard(st)));

  // placeholders para preencher o grid
  const needed = cnt - slice.length;
  for (let i = 0; i < needed; i++) {
    container.appendChild(createPlaceholderCard());
  }

  currentOffset += cnt;
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

function handleFilterOrSort() {
  container.innerHTML = '';
  currentOffset = 0;
  showBatch(initialCount);
}

/************************************************************
 * [8] Modal e aviso
 ************************************************************/
modalClose.onclick = () => {
  modalOverlay.style.display = 'none';
  isModalOpen = false;
};
modalOverlay.onclick = e => {
  if (e.target === modalOverlay && isModalOpen) {
    warningOverlay.style.display = 'flex';
  }
};
warningYes.onclick = () => {
  modalOverlay.style.display = 'none';
  warningOverlay.style.display = 'none';
  isModalOpen = false;
};
warningNo.onclick = () => {
  warningOverlay.style.display = 'none';
};
continuarBtn.onclick = () => {
  const st = allStories.find(s => s.id === currentStoryId);
  if (st) {
    modalFullText.innerHTML = formatarTextoParaLeitura(st.cartao.historiaCompleta);
    setTimeout(destacarPalavra, 100);
  }
};

/************************************************************
 * [9] Inicialização
 ************************************************************/
document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await fetchCategories();
  await fetchStoriesFromSupabase();
  initialLoad();

  searchBar.oninput       = handleFilterOrSort;
  categoryFilter.onchange = handleFilterOrSort;
  sortFilter.onchange     = handleFilterOrSort;
  loadMoreBtn.onclick     = loadMore;
});
