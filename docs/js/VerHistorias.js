// js/VerHistorias.js
import { supabase } from './supabase.js';

let allStories = [];
const container      = document.getElementById('storiesContainer');
const userMenuArea   = document.getElementById('userMenuArea');
const searchBar      = document.getElementById('searchBar');
const categoryFilter = document.getElementById('category-filter');
const sortFilter     = document.getElementById('sort-filter');

const modalOverlay   = document.getElementById('modalOverlay');
const modalClose     = document.getElementById('modalClose');
const modalTitle     = document.getElementById('modalTitle');
const modalFullText  = document.getElementById('modalFullText');
const modalInfo      = document.getElementById('modalInfo');
const continuarBtn   = document.getElementById('continuarBtn');
const warningOverlay = document.getElementById('warningOverlay');
const warningYes     = document.getElementById('warningYes');
const warningNo      = document.getElementById('warningNo');

let isModalOpen    = false;
let currentStoryId = null;
let categoryMap    = {};

// [1] Exibe login/logout
async function exibirUsuarioLogado() {
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) {
    userMenuArea.innerHTML = `
      <a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
    return;
  }
  const userId = session.user.id;
  const { data: profile } = await supabase
    .from('profiles').select('username').eq('id', userId).single();
  const nome = profile?.username || session.user.email;
  userMenuArea.textContent = nome;
  userMenuArea.onclick = () => {
    if (confirm('Deseja fazer logout?')) {
      supabase.auth.signOut().then(() => location.href = 'Criacao.html');
    }
  };
}

// [2] Carrega categorias (id→nome)
async function fetchCategories() {
  const { data, error } = await supabase
    .from('categorias').select('id, nome');
  if (!error && data) {
    categoryMap = Object.fromEntries(data.map(c => [c.id, c.nome]));
  }
}

// [3] Busca somente histórias com cartão publicado
async function fetchStoriesFromSupabase() {
  const { data: stories, error } = await supabase
    .from('historias')
    .select('*, cartoes!inner(*), historia_categorias(*)')
    .order('data_criacao', { ascending: false });

  console.log('fetchStories:', stories, error);

  if (error) {
    container.innerHTML = `<p>Erro ao carregar histórias.</p>`;
    return;
  }
  if (!stories || stories.length === 0) {
    container.innerHTML = `<p>Nenhuma história publicada.</p>`;
    return;
  }

  allStories = stories.map(st => {
    const cart = st.cartoes[0];
    const cats = st.historia_categorias
      .map(hc => categoryMap[hc.categoria_id])
      .filter(Boolean);
    return {
      id: st.id,
      cartao: {
        tituloCartao:     cart.titulo_cartao,
        sinopseCartao:    cart.sinopse_cartao,
        autorCartao:      cart.autor_cartao,
        dataCartao:       cart.data_criacao.split('T')[0],
        categorias:       cats,
        historiaCompleta: st.descricao
      }
    };
  });

  renderStories();
}

// [4] Renderiza todos os cards
function renderStories() {
  container.innerHTML = '';
  allStories.forEach(story => {
    container.appendChild(createCard(story));
  });
}

// [5] Cria um card individual
function createCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  const h3 = document.createElement('h3');
  h3.textContent = story.cartao.tituloCartao;
  div.appendChild(h3);

  const p = document.createElement('p');
  p.textContent = story.cartao.sinopseCartao;
  div.appendChild(p);

  const info = document.createElement('small');
  info.textContent = `${story.cartao.autorCartao} • ${story.cartao.dataCartao}`;
  div.appendChild(info);

  const btn = document.createElement('button');
  btn.textContent = 'Ler Mais';
  btn.onclick = () => openModal(story);
  div.appendChild(btn);

  return div;
}

// [6] Abre o modal de leitura
function openModal(story) {
  isModalOpen    = true;
  currentStoryId = story.id;
  modalTitle.textContent    = story.cartao.tituloCartao;
  modalFullText.textContent = story.cartao.historiaCompleta;
  modalInfo.textContent     = `Categorias: ${story.cartao.categorias.join(', ')}`;
  continuarBtn.style.display = 'none';
  modalOverlay.style.display = 'flex';
}

// Fecha modal e trata clique fora
modalClose.onclick = () => { modalOverlay.style.display = 'none'; isModalOpen = false; };
modalOverlay.onclick = e => {
  if (e.target === modalOverlay && isModalOpen) {
    warningOverlay.style.display = 'flex';
  }
};
warningYes.onclick = () => {
  modalOverlay.style.display   = 'none';
  warningOverlay.style.display = 'none';
  isModalOpen                  = false;
};
warningNo.onclick = () => warningOverlay.style.display = 'none';

// [7] Pesquisa em tempo real por título do cartão ou autor
searchBar.oninput = () => {
  const txt = searchBar.value.toLowerCase();
  container.innerHTML = '';
  allStories
    .filter(s =>
      s.cartao.tituloCartao.toLowerCase().includes(txt) ||
      s.cartao.autorCartao.toLowerCase().includes(txt)
    )
    .forEach(s => container.appendChild(createCard(s)));
};

// [8] Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await fetchCategories();
  await fetchStoriesFromSupabase();
});
