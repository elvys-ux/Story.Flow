// js/VerHistorias.js
import { supabase } from './supabase.js';

let allStories     = [];
let currentOffset  = 0;
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

let isModalOpen   = false;
let currentStoryId= null;

// **Novas variáveis para likes por usuário**
let likedStories = [];
let likedKey     = null;   // será 'likedStories_<userId>'
let categoryMap  = {};     // id → nome

// [1] Exibe usuário logado / login e carrega likes desse usuário
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    area.innerHTML = `<a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
    // sem usuário, limpa likes em memória
    likedKey = null;
    likedStories = [];
    return;
  }

  // constrói chave única para este usuário
  const userId = session.user.id;
  likedKey = `likedStories_${userId}`;
  likedStories = JSON.parse(localStorage.getItem(likedKey) || '[]');

  // exibe nome e botão de logout
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
      // ao deslogar, pode opcionalmente remover a chave de likes
      localStorage.removeItem(likedKey);
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
  // ... (mesmo código de antes para carregar historias e cartoes)
  // ao montar allStories, nada muda
}

// [4] Formatação de texto
function formatarPor4Linhas(text) { /* ... */ }
function formatarTextoParaLeitura(text) { /* ... */ }

// [5] Criação de cartão
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';
  div.innerHTML = `
    <h3>${story.cartao.tituloCartao}</h3>
    <div class="sheet-sinopse">${formatarPor4Linhas(story.cartao.sinopseCartao)}</div>
    <span class="ver-mais">mais...</span>
    <div style="margin-top:10px;">
      <button class="like-btn"></button>
      <span class="like-count"></span>
    </div>
    <div class="sheet-categories">
      ${story.cartao.categorias.map(c => `<span class="badge">${c}</span>`).join('')}
    </div>
  `;

  // configura botão de like
  const likeBtn = div.querySelector('.like-btn');
  const likeCt  = div.querySelector('.like-count');
  let userLiked  = likedStories.includes(story.id);

  likeBtn.style.cssText = `
    background:transparent; border:none; outline:none;
    padding:0; cursor:pointer; font-size:1.4rem;
  `;

  function updateLikeUI() {
    likeBtn.textContent = userLiked ? '❤️' : '🤍';
    likeCt.textContent  = ` ${story.cartao.likes} curtida(s)`;
  }
  updateLikeUI();

  likeBtn.onclick = async () => {
    // atualiza contador local e UI
    story.cartao.likes += userLiked ? -1 : 1;
    userLiked = !userLiked;

    // atualiza array e persiste em localStorage sob a chave do usuário
    if (userLiked) likedStories.push(story.id);
    else likedStories = likedStories.filter(id => id !== story.id);

    localStorage.setItem(likedKey, JSON.stringify(likedStories));
    updateLikeUI();

    // persiste no Supabase
    await supabase
      .from('cartoes')
      .update({ likes: story.cartao.likes })
      .eq('historia_id', story.id);
  };

  // “mais...” abre modal
  div.querySelector('.ver-mais').onclick = () => openModal(story);
  return div;
}

// [6] Modal: sinopse + “Ler”
function openModal(story) {
  isModalOpen = true;
  currentStoryId = story.id;

  modalTitle.textContent = story.cartao.tituloCartao;
  modalFullText.innerHTML = `
    <div>${formatarPor4Linhas(story.cartao.sinopseCartao)}</div>
    <button id="btnLer">Ler</button>
  `;
  modalInfo.innerHTML = `
    <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
    <p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>
  `;
  document.getElementById('btnLer').onclick = () => {
    modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
  };
  modalOverlay.style.display = 'flex';
}

// [7] Fecha modal / aviso
modalClose.onclick = () => { modalOverlay.style.display = 'none'; isModalOpen = false; };
modalOverlay.onclick = e => {
  if (e.target === modalOverlay && isModalOpen) warningOverlay.style.display = 'flex';
};
warningYes.onclick = () => {
  modalOverlay.style.display = 'none';
  warningOverlay.style.display = 'none';
  isModalOpen = false;
};
warningNo.onclick = () => warningOverlay.style.display = 'none';

// [8] Filtros, ordenação e paginação
function matchesSearch(story, txt) { /* ... */ }
function showBatch(count) { /* ... */ }
function initialLoad() { /* ... */ }

// [9] Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await fetchCategories();
  await fetchStoriesFromSupabase();
  initialLoad();

  searchBar.oninput       = initialLoad;
  categoryFilter.onchange = initialLoad;
  sortFilter.onchange     = initialLoad;
  loadMoreBtn.onclick     = () => { loadMoreBtn.disabled = true; showBatch(increment); };
});
