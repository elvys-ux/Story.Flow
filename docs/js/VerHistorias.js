// app.js
import { supabase } from "./supabase.js";

/************************************************************
 * [1] LOGIN/LOGOUT com Supabase
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return console.error("Elemento 'userMenuArea' não encontrado.");

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return console.error("Erro ao obter a sessão:", sessionError);

  if (!session) {
    userArea.innerHTML = `<a href="Criacao.html" style="color:white;"><i class="fas fa-user"></i> Login</a>`;
    userArea.onclick = null;
    return;
  }

  const userId = session.user.id;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  const displayName = (!profileError && profile?.username) ? profile.username : session.user.email;
  userArea.innerHTML = displayName;
  userArea.onclick = () => {
    if (confirm("Deseja fazer logout?")) {
      supabase.auth.signOut().then(({ error }) => {
        if (error) alert("Erro ao deslogar: " + error.message);
        else window.location.href = "index.html";
      });
    }
  };
}

/************************************************************
 * [2] TOAST (notificação)
 ************************************************************/
function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'my-toast'; 
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, duration);
}

/************************************************************
 * [3] Variáveis globais
 ************************************************************/
let allStories = [];
let currentOffset = 0;
const initialCount = 20;
const increment = 5;

// Seletores de interface
const container = document.getElementById('storiesContainer');
const categoryFilter = document.getElementById('category-filter');
const sortFilter     = document.getElementById('sort-filter');
const searchBar      = document.getElementById('searchBar');
const loadMoreBtn    = document.getElementById('loadMoreBtn');

// Modal e aviso
const modalOverlay  = document.getElementById('modalOverlay');
const modalClose    = document.getElementById('modalClose');
const modalTitle    = document.getElementById('modalTitle');
const modalFullText = document.getElementById('modalFullText');
const modalInfo     = document.getElementById('modalInfo');
const warningOverlay= document.getElementById('warningOverlay');
const warningYes    = document.getElementById('warningYes');
const warningNo     = document.getElementById('warningNo');

let isModalOpen   = false;
let currentStoryId= null;
let originalText  = "";

// Mantém localStorage apenas para posição de leitura
// let likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');

/************************************************************
 * [4] Carregar TODAS as histórias/cartões/categorias de Supabase
 ************************************************************/
async function loadAllStories() {
  // 1) Busca todos os cartões
  const { data: cards, error: cardsError } = await supabase
    .from('cartoes')
    .select('*');
  if (cardsError) return console.error("Erro ao buscar cartões:", cardsError);

  // 2) Busca as histórias referenciadas
  const historiaIds = cards.map(c => c.historia_id);
  const { data: historias, error: histError } = await supabase
    .from('historias')
    .select('*')
    .in('id', historiaIds);
  if (histError) return console.error("Erro ao buscar histórias:", histError);
  const mapaHist = Object.fromEntries(historias.map(h => [h.id, h]));

  // 3) Busca categorias vinculadas a cada história
  const { data: histCat, error: hcError } = await supabase
    .from('historia_categorias')
    .select('*')
    .in('historia_id', historiaIds);
  if (hcError) return console.error("Erro ao buscar história_categorias:", hcError);

  const categoriaIds = [...new Set(histCat.map(hc => hc.categoria_id))];
  const { data: categorias, error: catError } = await supabase
    .from('categorias')
    .select('*')
    .in('id', categoriaIds);
  if (catError) return console.error("Erro ao buscar categorias:", catError);
  const mapaCat = Object.fromEntries(categorias.map(c => [c.id, c.nome]));

  // 4) Monta array de histórias com cartões e categorias
  allStories = cards.map(c => {
    const hist = mapaHist[c.historia_id] || {};
    const catsIds = histCat.filter(hc => hc.historia_id === c.historia_id).map(hc => hc.categoria_id);
    return {
      id: hist.id,
      titulo: hist.titulo,
      descricao: hist.descricao,
      cartao: {
        id: c.id,
        tituloCartao: c.titulo_cartao,
        sinopseCartao: c.sinopse_cartao,
        historiaCompleta: hist.descricao,
        dataCartao: c.data_criacao,
        autorCartao: c.autor_cartao,
        categorias: catsIds.map(id => mapaCat[id]),
        likes: c.likes || 0
      },
      bloqueio10: false
    };
  });

  // 5) Preenche filtro de categorias
  const select = categoryFilter;
  if (select) {
    select.innerHTML = `<option value="">Todas</option>` +
      categorias.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
  }
}

/************************************************************
 * [5] Formatadores de texto (sem alterações)
 ************************************************************/
/* ... mantém as funções formatarPor4Linhas, formatarTextoParaLeitura,
       markReadingPosition e destacarPalavra como antes ... */

/************************************************************
 * [6] Criar cartão de história
 ************************************************************/
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';
  // título
  const titleEl = document.createElement('div');
  titleEl.className = 'sheet-title';
  titleEl.textContent = story.cartao.tituloCartao;
  div.appendChild(titleEl);
  // sinopse
  const sinopseEl = document.createElement('div');
  sinopseEl.className = 'sheet-sinopse';
  sinopseEl.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  div.appendChild(sinopseEl);
  // "mais..."
  const verMais = document.createElement('span');
  verMais.className = 'ver-mais';
  verMais.textContent = 'mais...';
  verMais.style.cursor = 'pointer';
  verMais.addEventListener('click', () => abrirModal(story));
  div.appendChild(verMais);

  // botão Curtir
  const likeContainer = document.createElement('div');
  likeContainer.style.marginTop = '10px';
  const likeBtn = document.createElement('button');
  likeBtn.style.fontSize = '24px';
  likeBtn.style.border = 'none';
  likeBtn.style.background = 'none';
  likeBtn.style.cursor = 'pointer';
  const likeCount = document.createElement('span');
  likeCount.style.marginLeft = '8px';
  let userLiked = false; // estado apenas local
  function updateLikeUI() {
    likeBtn.textContent = userLiked ? '❤️' : '🤍';
    likeCount.textContent = `${story.cartao.likes} curtidas`;
  }
  updateLikeUI();
  likeBtn.addEventListener('click', async () => {
    // ajusta contagem
    story.cartao.likes += userLiked ? -1 : 1;
    userLiked = !userLiked;
    updateLikeUI();
    // atualiza no Supabase
    const { error } = await supabase
      .from('cartoes')
      .update({ likes: story.cartao.likes })
      .eq('id', story.cartao.id);
    if (error) console.error("Erro ao atualizar curtidas:", error);
  });
  likeContainer.appendChild(likeBtn);
  likeContainer.appendChild(likeCount);
  div.appendChild(likeContainer);

  // categorias
  const catContainer = document.createElement('div');
  catContainer.className = 'sheet-categorias';
  (story.cartao.categorias.length
    ? story.cartao.categorias
    : ['Sem Categoria']
  ).forEach(cat => {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = cat;
    catContainer.appendChild(badge);
  });
  div.appendChild(catContainer);

  return div;
}

/************************************************************
 * [7] FILTRO / ORDENAR / PESQUISA (idem, com allStories)
 ************************************************************/
function matchesSearch(story, searchInput) {
  const text = searchInput.trim().toLowerCase();
  if (!text) return true;
  const tokens = text.split(/\s+/);
  const t = story.cartao.tituloCartao.toLowerCase();
  const a = story.cartao.autorCartao.toLowerCase();
  if (tokens.length === 1) return t.includes(tokens[0]) || a.includes(tokens[0]);
  const last = tokens.pop();
  return t.includes(tokens.join(' ')) && a.includes(last);
}

function getFilteredStories() {
  let arr = [...allStories];
  const txt = (searchBar?.value || '').toLowerCase();
  arr = arr.filter(s => matchesSearch(s, txt));
  const cat = categoryFilter?.value;
  if (cat) arr = arr.filter(s => s.cartao.categorias.includes(cat));
  const sortMode = sortFilter?.value;
  if (sortMode === 'date') {
    arr.sort((a,b) => b.cartao.dataCartao.localeCompare(a.cartao.dataCartao));
  } else if (sortMode === 'popularity') {
    arr.sort((a,b) => b.cartao.likes - a.cartao.likes);
  }
  return arr;
}

/************************************************************
 * [8] Exibir batch de cartões (sem alterações)
 ************************************************************/
function showBatch(count) {
  const filtered = getFilteredStories();
  if (!filtered.length) return;
  const slice = filtered.slice(currentOffset, currentOffset + count);
  slice.forEach(s => container.appendChild(createStoryCard(s)));
  // placeholders
  const faltam = count - slice.length;
  for (let i = 0; i < faltam; i++) container.appendChild(createPlaceholderCard());
  currentOffset += count;
  if (loadMoreBtn) loadMoreBtn.disabled = false;
}

/************************************************************
 * [9] Inicialização (substitui loadAllStories sync)
 ************************************************************/
async function initialLoad() {
  container.innerHTML = '';
  currentOffset = 0;
  await loadAllStories();
  showBatch(initialCount);
}

function loadMore() { showBatch(increment); }
function handleFilterOrSort() {
  container.innerHTML = '';
  currentOffset = 0;
  showBatch(initialCount);
}

/************************************************************
 * [10] Modal e aviso (sem alterações)
 ************************************************************/
function abrirModal(story) {
  isModalOpen = true;
  currentStoryId = story.id;
  modalTitle.textContent = story.cartao.tituloCartao;
  modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  modalInfo.innerHTML = '';

  const lerBtn = document.createElement('button');
  lerBtn.textContent = 'Ler';
  lerBtn.addEventListener('click', () => {
    modalTitle.textContent = story.titulo;
    originalText = story.cartao.historiaCompleta;
    modalFullText.innerHTML = formatarTextoParaLeitura(originalText);
  });
  modalFullText.appendChild(lerBtn);

  const continuarBtn = document.getElementById('continuarBtn') || (() => {
    const b = document.createElement('button');
    b.id = 'continuarBtn';
    b.textContent = 'Continuar';
    b.addEventListener('click', () => {
      modalTitle.textContent = story.titulo;
      modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
      setTimeout(destacarPalavra, 100);
    });
    modalFullText.appendChild(b);
    return b;
  })();
  continuarBtn.style.display = localStorage.getItem('readingPosition_' + story.id) ? 'inline-block' : 'none';

  modalOverlay.style.display = 'flex';
}

// listeners de fechar modal (sem mudanças)
if (modalClose)    modalClose.addEventListener('click', () => { modalOverlay.style.display = 'none'; isModalOpen = false; });
if (modalOverlay) modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay && isModalOpen) warningOverlay.style.display = 'flex';
});
if (warningYes && warningNo) {
  warningYes.onclick = () => { modalOverlay.style.display = 'none'; warningOverlay.style.display = 'none'; isModalOpen = false; };
  warningNo.onclick  = () => { warningOverlay.style.display = 'none'; };
}

/************************************************************
 * [11] DOMContentLoaded
 ************************************************************/
document.addEventListener('DOMContentLoaded', () => {
  exibirUsuarioLogado();
  initialLoad();

  categoryFilter?.addEventListener('change', handleFilterOrSort);
  sortFilter?.addEventListener('change', handleFilterOrSort);
  loadMoreBtn?.addEventListener('click', loadMore);
  searchBar?.addEventListener('input', () => {
    container.innerHTML = '';
    currentOffset = 0;
    showBatch(initialCount);
  });
});
