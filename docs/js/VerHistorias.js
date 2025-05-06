// js/VerHistorias.js
import { supabase } from './supabase.js';

let allStories      = [];
let currentOffset   = 0;
const initialCount  = 20;
const increment     = 5;

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

let isModalOpen     = false;
let currentStoryId  = null;

let likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');
let categoryMap  = {};  // id → nome

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
  // Carrega histórias
  const { data: historias, error: errH } = await supabase
    .from('historias')
    .select('id, titulo, descricao, data_criacao')
    .order('data_criacao', { ascending: false });
  if (errH) {
    console.error('Erro ao carregar histórias:', errH);
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
    return;
  }

  // Carrega cartões
  const { data: cartoes, error: errC } = await supabase
    .from('cartoes')
    .select(`
      historia_id,
      titulo_cartao,
      sinopse_cartao,
      autor_cartao,
      data_criacao,
      likes,
      historia_completa
    `);
  if (errC) {
    console.error('Erro ao carregar cartões:', errC);
    return;
  }
  const cartaoMap = Object.fromEntries(cartoes.map(c => [c.historia_id, c]));

  // Carrega relações história–categoria
  const { data: hcData, error: errHC } = await supabase
    .from('historia_categorias')
    .select('historia_id, categoria_id');
  if (errHC) {
    console.error('Erro ao carregar categorias de história:', errHC);
    return;
  }
  const hcMap = {};
  hcData.forEach(({ historia_id, categoria_id }) => {
    hcMap[historia_id] = hcMap[historia_id] || [];
    hcMap[historia_id].push(categoryMap[categoria_id]);
  });

  // Monta allStories
  allStories = historias.map(h => {
    const c = cartaoMap[h.id] || {};
    const sinopse = c.sinopse_cartao
      || (c.historia_completa || '').split('\n').slice(0,4).join('\n')
      || '';
    return {
      id: h.id,
      cartao: {
        tituloCartao:     c.titulo_cartao     || h.titulo    || 'Sem título',
        sinopseCartao:    sinopse,
        historiaCompleta: c.historia_completa || h.descricao || '',
        dataCartao:       (c.data_criacao || h.data_criacao).split('T')[0],
        autorCartao:      c.autor_cartao      || 'Anónimo',
        categorias:       hcMap[h.id]         || [],
        likes:            c.likes ?? 0
      }
    };
  });
}

// [4] Formatação de texto
function formatarPor4Linhas(text) {
  return text.split('\n').slice(0,4).join('<br>');
}
function formatarTextoParaLeitura(text) {
  return text.split('\n').map(l => `<p>${l}</p>`).join('');
}

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

  // Likes
  const likeBtn = div.querySelector('.like-btn');
  const likeCt  = div.querySelector('.like-count');
  let userLiked  = likedStories.includes(story.id);

  likeBtn.style.cssText = `
    background:transparent;
    border:none;
    outline:none;
    padding:0;
    cursor:pointer;
    font-size:1.4rem;
  `;

  function updateLikeUI() {
    likeBtn.textContent = userLiked ? '❤️' : '🤍';
    likeCt.textContent  = ` ${story.cartao.likes} curtida(s)`;
  }
  updateLikeUI();

  likeBtn.onclick = async () => {
    story.cartao.likes += userLiked ? -1 : 1;
    userLiked = !userLiked;
    // atualiza localStorage
    if (userLiked) likedStories.push(story.id);
    else likedStories = likedStories.filter(id => id !== story.id);
    localStorage.setItem('likedStories', JSON.stringify(likedStories));

    // persiste no Supabase e aguarda confirmação
    const { data, error } = await supabase
      .from('cartoes')
      .update({ likes: story.cartao.likes })
      .eq('historia_id', story.id)
      .select('likes')
      .single();

    if (error) {
      console.error('Erro ao salvar like no Supabase:', error);
      // reverte em caso de falha
      story.cartao.likes += userLiked ? -1 : 1;
      userLiked = !userLiked;
      likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');
      localStorage.setItem('likedStories', JSON.stringify(likedStories));
    } else {
      // sincroniza valor retornado pelo banco
      story.cartao.likes = data.likes;
    }
    updateLikeUI();
  };

  // “mais...” abre modal
  div.querySelector('.ver-mais').onclick = () => openModal(story);
  return div;
}

// [6] Modal: sinopse + botão “Ler”
function openModal(story) {
  isModalOpen     = true;
  currentStoryId  = story.id;
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

// [8] Filtrar / ordenar / paginação
function matchesSearch(story, txt) {
  txt = txt.toLowerCase();
  return story.cartao.tituloCartao.toLowerCase().includes(txt)
      || (story.cartao.autorCartao || '').toLowerCase().includes(txt);
}

function showBatch(count) {
  const filtered = allStories
    .filter(st => matchesSearch(st, searchBar.value))
    .filter(st => !categoryFilter.value || st.cartao.categorias.includes(categoryFilter.value))
    .sort((a,b) => {
      if (sortFilter.value === 'popularity') return b.cartao.likes - a.cartao.likes;
      return b.cartao.dataCartao.localeCompare(a.cartao.dataCartao);
    });

  const slice = filtered.slice(currentOffset, currentOffset + count);
  slice.forEach(story => container.appendChild(createStoryCard(story)));
  for (let i = slice.length; i < count; i++) {
    const ph = document.createElement('div');
    ph.className = 'sheet sheet-placeholder';
    ph.innerHTML = '<h3>Placeholder</h3><p>(sem história)</p>';
    container.appendChild(ph);
  }

  currentOffset += count;
  loadMoreBtn.disabled = false;
}

function initialLoad() {
  container.innerHTML = '';
  currentOffset = 0;
  showBatch(initialCount);
}

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
