import { supabase } from "./supabase.js";

/************************************************************
 * VerHistorias.js — Integração completa com Supabase
 ************************************************************/

/************************************************************
 * [1] LOGIN/LOGOUT com Supabase
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    userArea.innerHTML = `<a href="Criacao.html" style="color:white;"><i class="fas fa-user"></i> Login</a>`;
    userArea.onclick = null;
    return;
  }

  const userId = session.user.id;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single();

  const displayName = (!profileError && profile?.username)
    ? profile.username
    : session.user.email;

  userArea.innerHTML = displayName;
  userArea.onclick = () => {
    if (confirm('Deseja fazer logout?')) {
      supabase.auth.signOut().then(({ error }) => {
        if (error) alert('Erro ao deslogar: ' + error.message);
        else window.location.href = 'index.html';
      });
    }
  };
}

/************************************************************
 * [2] TOAST (Notificação)
 ************************************************************/
function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'my-toast';
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, duration);
}

/************************************************************
 * [3] Carregar categorias no filtro
 ************************************************************/
async function loadCategoryFilter() {
  const select = document.getElementById('category-filter');
  if (!select) return;

  select.innerHTML = '<option value="">-- Categoria --</option>';
  const { data: cats, error } = await supabase
    .from('categorias')
    .select('nome')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao carregar categorias:', error);
    return;
  }

  cats.forEach(({ nome }) => {
    const opt = document.createElement('option');
    opt.value = nome;
    opt.textContent = nome;
    select.appendChild(opt);
  });
}

/************************************************************
 * [4] Variáveis globais e seletores
 ************************************************************/
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
// Continuar está dentro do modal
const continuarBtn   = document.getElementById('continuarBtn');
const modalInfo      = document.getElementById('modalInfo');
const warningOverlay = document.getElementById('warningOverlay');
const warningYes     = document.getElementById('warningYes');
const warningNo      = document.getElementById('warningNo');

let isModalOpen = false;
let currentStoryId = null;
let originalText = '';
let likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');

/************************************************************
 * [5] Carregar histórias com join em cartões e categorias
 ************************************************************/
async function loadAllStories() {
  const { data, error } = await supabase
    .from('historias')
    .select(
      `
      id,
      titulo,
      descricao,
      data_criacao,
      cartoes (titulo_cartao, sinopse_cartao, autor_cartao, data_criacao, likes),
      historia_categorias (categorias(nome))
      `
    )
    .order('data_criacao', { ascending: false });

  if (error) {
    console.error('Erro ao buscar histórias:', error);
    return [];
  }

  return data.map(st => ({
    id: st.id,
    titulo: st.titulo,
    descricao: st.descricao,
    dataCriacao: st.data_criacao,
    cartao: {
      tituloCartao: st.cartoes?.titulo_cartao || st.titulo,
      sinopseCartao: st.cartoes?.sinopse_cartao || st.descricao.substring(0,150),
      autorCartao: st.cartoes?.autor_cartao || '',
      dataCartao: st.cartoes?.data_criacao,
      likes: st.cartoes?.likes || 0,
      historiaCompleta: st.descricao
    },
    categorias: st.historia_categorias.map(r => r.categorias.nome)
  }));
}

/************************************************************
 * [6] Formatadores de texto
 ************************************************************/
function formatarPor4Linhas(text) {
  const lines = text.split('\n'); let parts = [], buf = [];
  lines.forEach(line => {
    buf.push(line);
    if (buf.length === 4) { parts.push(buf.join('<br>')); buf = []; }
  });
  if (buf.length) parts.push(buf.join('<br>'));  
  return parts.map(p => `<p style=\"text-align: justify;\">${p}</p>`).join('');
}

function formatarTextoParaLeitura(text) {
  const lines = text.split('\n'); let parts = [], buf = [], idx = 0;
  lines.forEach(line => {
    const spans = line.split(' ').map(w => `<span data-index=\"${idx++}\" onclick=\"markReadingPosition(this)\">${w}</span>`).join(' ');
    buf.push(spans);
    if (buf.length === 4) { parts.push(buf.join('<br>')); buf = []; }
  });
  if (buf.length) parts.push(buf.join('<br>'));
  return parts.map(p => `<p style=\"text-align: justify;\">${p}</p>`).join('');
}

function markReadingPosition(el) {
  const pos = el.dataset.index;
  localStorage.setItem(`reading_${currentStoryId}`, pos);
  showToast(`Posição salva: ${pos}`);
}

function destacarPalavra() {
  const saved = localStorage.getItem(`reading_${currentStoryId}`);
  if (!saved) return;
  const span = modalFullText.querySelector(`[data-index=\"${saved}\"]`);
  if (span) { span.style.background = 'yellow'; span.scrollIntoView({ behavior:'smooth', block:'center' }); }
}

/************************************************************
 * [7] Criar cartão de história
 ************************************************************/
async function createStoryCard(st) {
  const div = document.createElement('div'); div.className = 'sheet';
  const titleDiv = document.createElement('div'); titleDiv.className = 'sheet-title';
  titleDiv.textContent = st.cartao.tituloCartao;
  div.appendChild(titleDiv);

  const sinDiv = document.createElement('div'); sinDiv.className = 'sheet-sinopse';
  sinDiv.innerHTML = formatarPor4Linhas(st.cartao.sinopseCartao);
  div.appendChild(sinDiv);

  const more = document.createElement('span'); more.className = 'ver-mais'; more.textContent = 'mais...';
  more.style.cursor = 'pointer'; more.onclick = () => openModal(st);
  div.appendChild(more);

  const likeBtn = document.createElement('button'); const likeCount = document.createElement('span');
  function updLike() {
    likeBtn.textContent = likedStories.includes(st.id) ? '❤️' : '🤍';
    likeCount.textContent = `${st.cartao.likes}`;
  }
  updLike();
  likeBtn.onclick = async () => {
    const liked = likedStories.includes(st.id);
    const newLikes = liked ? st.cartao.likes - 1 : st.cartao.likes + 1;
    const { error } = await supabase.from('cartoes').update({ likes: newLikes }).eq('historia_id', st.id);
    if (!error) {
      st.cartao.likes = newLikes;
      if (liked) likedStories = likedStories.filter(i => i !== st.id);
      else likedStories.push(st.id);
      localStorage.setItem('likedStories', JSON.stringify(likedStories));
      updLike();
    }
  };
  div.appendChild(likeBtn); div.appendChild(likeCount);

  const cc = document.createElement('div'); cc.className = 'sheet-categorias';
  const cats = st.categorias.length ? st.categorias : ['Sem Categoria'];
  cats.forEach(name => {
    const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = name;
    cc.appendChild(badge);
  });
  div.appendChild(cc);

  return div;
}

/************************************************************
 * [8] Filtros e ordenação
 ************************************************************/
function matchesSearch(st, txt) {
  if (!txt) return true;
  const t = st.cartao.tituloCartao.toLowerCase(); const a = st.cartao.autorCartao.toLowerCase();
  const tok = txt.split(/\s+/);
  if (tok.length === 1) return t.includes(tok[0]) || a.includes(tok[0]);
  const last = tok.pop(), first = tok.join(' ');
  return t.includes(first) && a.includes(last);
}

function getFilteredStories() {
  let arr = [...allStories];
  const txt = searchBar.value.trim().toLowerCase(); arr = arr.filter(s => matchesSearch(s, txt));
  const cat = categoryFilter.value; if (cat) arr = arr.filter(s => s.categorias.includes(cat));
  const mode = sortFilter.value;
  if (mode === 'date') arr.sort((a, b) => b.dataCriacao.localeCompare(a.dataCriacao));
  if (mode === 'popularity') arr.sort((a, b) => b.cartao.likes - a.cartao.likes);
  return arr;
}

/************************************************************
 * [9] Paginação e renderização
 ************************************************************/
async function showBatch(count) {
  const arr = getFilteredStories(); if (!arr.length) return;
  const slice = arr.slice(currentOffset, currentOffset + count);
  for (const st of slice) container.appendChild(await createStoryCard(st));
  currentOffset += slice.length;
  if (loadMoreBtn) loadMoreBtn.disabled = false;
}

function initialLoad() { container.innerHTML = ''; currentOffset = 0; showBatch(initialCount); }
function loadMore() { showBatch(increment); }
function handleFilterOrSort() { container.innerHTML = ''; currentOffset = 0; showBatch(initialCount); }

/************************************************************
 * [10] Modal e aviso
 ************************************************************/
function openModal(st) {
  isModalOpen = true;
  currentStoryId = st.id;
  modalTitle.textContent = st.cartao.tituloCartao;
  modalFullText.innerHTML = formatarPor4Linhas(st.cartao.sinopseCartao);
  modalInfo.innerHTML = `<small>${st.cartao.autorCartao} em ${st.cartao.dataCartao || ''}</small>`;
  continuarBtn.style.display = 'block';
  modalOverlay.style.display = 'flex';
}
modalClose?.addEventListener('click', () => { modalOverlay.style.display = 'none'; isModalOpen = false; });
modalOverlay?.addEventListener('click', e => { if (e.target === modalOverlay && isModalOpen) warningOverlay.style.display = 'flex'; });
warningYes?.addEventListener('click', () => { modalOverlay.style.display = 'none'; warningOverlay.style.display = 'none'; isModalOpen = false; });
warningNo?.addEventListener('click', () => { warningOverlay.style.display = 'none'; });
continuarBtn?.addEventListener('click', () => { const st = allStories.find(s => s.id === currentStoryId); if (st) { modalFullText.innerHTML = formatarTextoParaLeitura(st.cartao.historiaCompleta); setTimeout(destacarPalavra, 100); } });

/************************************************************
 * [11] Evento DOMContentLoaded
 ************************************************************/
document.addEventListener('DOMContentLoaded', async () => {
  exibirUsuarioLogado();                // login/logout
  await loadCategoryFilter();           // carrega categorias no select
  allStories = await loadAllStories();  // busca e mapeia dados
  initialLoad();                        // renderiza primeiros cards

  // filtros e paginação
  if (categoryFilter) categoryFilter.addEventListener('change', handleFilterOrSort);
  if (sortFilter)     sortFilter.addEventListener('change', handleFilterOrSort);
  if (loadMoreBtn)    loadMoreBtn.addEventListener('click', loadMore);
  if (searchBar)      searchBar.addEventListener('input', () => { container.innerHTML = ''; currentOffset = 0; showBatch(initialCount); });
});
