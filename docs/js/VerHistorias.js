// VerHistorias.js
import { supabase } from "./supabase.js";

/************************************************************
 * [1] LOGIN/LOGOUT com Supabase
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) {
    console.error("Elemento 'userMenuArea' não encontrado no HTML.");
    return;
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) console.error("Erro ao obter a sessão:", sessionError);

  if (!session) {
    userArea.innerHTML = `<a href="Criacao.html" style="color:white;"><i class="fas fa-user"></i> Login</a>`;
    userArea.onclick = null;
    return;
  }

  const userId = session.user.id;
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  const displayName = (!profileError && profileData?.username)
    ? profileData.username
    : session.user.email;

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
 * [2] TOAST (Notificação)
 ************************************************************/
function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'my-toast';
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

/************************************************************
 * [3] VARIÁVEIS GLOBAIS
 ************************************************************/
let allStories = [];
let currentOffset = 0;
const initialCount = 20;   // **20 cartões na inicialização**
const increment = 5;

// Seletores
const container      = document.getElementById('storiesContainer');
const categoryFilter = document.getElementById('category-filter');
const sortFilter     = document.getElementById('sort-filter');
const searchBar      = document.getElementById('searchBar');
const loadMoreBtn    = document.getElementById('loadMoreBtn');

const modalOverlay  = document.getElementById('modalOverlay');
const modalClose    = document.getElementById('modalClose');
const modalTitle    = document.getElementById('modalTitle');
const modalFullText = document.getElementById('modalFullText');
const modalInfo     = document.getElementById('modalInfo');

const warningOverlay = document.getElementById('warningOverlay');
const warningYes     = document.getElementById('warningYes');
const warningNo      = document.getElementById('warningNo');

let isModalOpen    = false;
let currentStoryId = null;
let originalText   = "";

let likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');

/************************************************************
 * [4] BUSCAR TODAS AS HISTÓRIAS DO SUPABASE
 ************************************************************/
async function loadAllStories() {
  const { data: historias, error } = await supabase
    .from('historias')
    .select(`
      id,
      titulo,
      descricao,
      cartoes (
        titulo_cartao,
        sinopse_cartao,
        data_criacao,
        autor_cartao,
        likes
      ),
      historia_categorias (
        categorias (nome)
      )
    `)
    .order('cartoes.likes', { ascending: false }); // já ordena por popularidade

  if (error) {
    console.error("Erro ao carregar histórias do Supabase:", error);
    return;
  }

  // Transformar dados para o formato esperado
  allStories = historias.map(h => ({
    id:                 h.id,
    titulo:             h.titulo,
    descricao:          h.descricao,
    cartao: {
      tituloCartao:      h.cartoes?.titulo_cartao  || h.titulo || "Sem Título",
      sinopseCartao:     h.cartoes?.sinopse_cartao || (h.descricao || "").slice(0, 150),
      historiaCompleta:  h.descricao,
      dataCartao:        h.cartoes?.data_criacao || "",
      autorCartao:       h.cartoes?.autor_cartao || "",
      likes:             h.cartoes?.likes || 0
    },
    categorias: h.historia_categorias?.map(rc => rc.categorias.nome) || []
  }));
}

/************************************************************
 * [5.1] Formatador sinopse a cada 4 linhas
 ************************************************************/
function formatarPor4Linhas(text) {
  const lines = text.split('\n');
  const chunks = [];
  for (let i = 0; i < lines.length; i += 4) {
    chunks.push(lines.slice(i, i+4).join('<br>'));
  }
  return chunks.map(p => `<p style="text-align: justify;">${p}</p>`).join('');
}

/************************************************************
 * [5.2] Formatador leitura completa c/ spans
 ************************************************************/
function formatarTextoParaLeitura(text) {
  let wordIndex = 0;
  return text.split('\n').map(line => {
    return `<p style="text-align: justify;">${
      line.split(' ').map(word => {
        return `<span class="reading-word" data-index="${wordIndex++}" onclick="markReadingPosition(this)">${word}</span>`;
      }).join(' ')
    }</p>`;
  }).join('');
}

/************************************************************
 * [5.3] Marcar posição de leitura
 ************************************************************/
function markReadingPosition(el) {
  const idx = el.getAttribute('data-index');
  localStorage.setItem('readingPosition_' + currentStoryId, idx);
  showToast("Posição de leitura salva (palavra " + idx + ")");
}

/************************************************************
 * [5.4] Destacar palavra salva
 ************************************************************/
function destacarPalavra() {
  const saved = localStorage.getItem('readingPosition_' + currentStoryId);
  if (!saved) return;
  const span = modalFullText.querySelector(`[data-index="${saved}"]`);
  if (span) {
    span.style.background = 'yellow';
    span.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/************************************************************
 * [5.5] Criar cartão DOM
 ************************************************************/
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  // título
  const t = document.createElement('div');
  t.className = 'sheet-title';
  t.textContent = story.cartao.tituloCartao;
  div.appendChild(t);

  // sinopse
  const s = document.createElement('div');
  s.className = 'sheet-sinopse';
  s.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  div.appendChild(s);

  // “mais…”
  const more = document.createElement('span');
  more.className = 'ver-mais';
  more.textContent = 'mais…';
  more.style.cursor = 'pointer';
  more.onclick = () => openModal(story);
  div.appendChild(more);

  // curtidas
  const likeCont = document.createElement('div');
  likeCont.className = 'sheet-likes';
  likeCont.innerHTML = `
    <button class="like-btn">${likedStories.includes(story.id) ? '❤️' : '🤍'}</button>
    <span>${story.cartao.likes} curtidas</span>
  `;
  const btn = likeCont.querySelector('.like-btn');
  btn.onclick = () => toggleLike(story, btn, likeCont.querySelector('span'));
  div.appendChild(likeCont);

  // categorias
  const catCont = document.createElement('div');
  catCont.className = 'sheet-categorias';
  (story.categorias.length
    ? story.categorias
    : ['Sem Categoria']
  ).forEach(cn => {
    const b = document.createElement('span');
    b.className = 'badge';
    b.textContent = cn;
    catCont.appendChild(b);
  });
  div.appendChild(catCont);

  return div;
}

function openModal(story) {
  isModalOpen = true;
  currentStoryId = story.id;
  modalTitle.textContent = story.cartao.tituloCartao;
  modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  modalInfo.innerHTML = `
    <p><strong>Autor:</strong> ${story.cartao.autorCartao}</p>
    <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
  `;
  modalOverlay.style.display = 'flex';
}

/************************************************************
 * [6] Batch de cartões
 ************************************************************/
function showBatch(count) {
  const filtered = getFilteredStories();
  const slice = filtered.slice(currentOffset, currentOffset + count);
  slice.forEach(st => container.appendChild(createStoryCard(st)));
  currentOffset += slice.length;
  loadMoreBtn.disabled = currentOffset >= filtered.length;
}

/************************************************************
 * [7] Busca / filtro / ordenação
 ************************************************************/
function matchesSearch(st, txt) {
  const q = txt.trim().toLowerCase();
  return !q
    || st.cartao.tituloCartao.toLowerCase().includes(q)
    || st.cartao.autorCartao.toLowerCase().includes(q);
}

function getFilteredStories() {
  let arr = [...allStories];
  const q = searchBar.value;
  arr = arr.filter(st => matchesSearch(st, q));

  const cat = categoryFilter.value;
  if (cat) arr = arr.filter(st => st.categorias.includes(cat));

  const mode = sortFilter.value;
  if (mode === 'date') {
    arr.sort((a,b) => (b.cartao.dataCartao || '').localeCompare(a.cartao.dataCartao || ''));
  } else if (mode === 'popularity') {
    arr.sort((a,b) => b.cartao.likes - a.cartao.likes);
  }

  return arr;
}

/************************************************************
 * [8] Modal “fechar” e aviso
 ************************************************************/
modalClose?.addEventListener('click', () => {
  modalOverlay.style.display = 'none';
  isModalOpen = false;
});
modalOverlay?.addEventListener('click', e => {
  if (e.target === modalOverlay && isModalOpen) warningOverlay.style.display = 'flex';
});
warningYes?.addEventListener('click', () => {
  modalOverlay.style.display = 'none';
  warningOverlay.style.display = 'none';
  isModalOpen = false;
});
warningNo?.addEventListener('click', () => {
  warningOverlay.style.display = 'none';
});

/************************************************************
 * [9] DOMContentLoaded
 ************************************************************/
document.addEventListener('DOMContentLoaded', async () => {
  exibirUsuarioLogado();
  await loadAllStories();
  showBatch(initialCount);

  loadMoreBtn?.addEventListener('click', () => showBatch(increment));
  categoryFilter?.addEventListener('change', () => {
    container.innerHTML = '';
    currentOffset = 0;
    showBatch(initialCount);
  });
  sortFilter?.addEventListener('change', () => {
    container.innerHTML = '';
    currentOffset = 0;
    showBatch(initialCount);
  });
  searchBar?.addEventListener('input', () => {
    container.innerHTML = '';
    currentOffset = 0;
    showBatch(initialCount);
  });
});
