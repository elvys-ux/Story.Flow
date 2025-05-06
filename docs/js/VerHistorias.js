// js/VerHistorias.js
import { supabase } from './supabase.js';

let allStories       = [];
let currentOffset    = 0;
const initialCount   = 20;
const increment      = 5;

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

let likedStories   = JSON.parse(localStorage.getItem('likedStories') || '[]');
let categoryMap    = {};  // id → nome

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
  // Carrega histórias básicas (título e descrição fallback)
  const { data: historias, error: errH } = await supabase
    .from('historias')
    .select('id, titulo, descricao, data_criacao')
    .order('data_criacao', { ascending: false });
  if (errH) {
    console.error('Erro ao carregar histórias:', errH);
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
    return;
  }

  // Carrega cartões com sinopse, likes e história completa
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
    if (!hcMap[historia_id]) hcMap[historia_id] = [];
    hcMap[historia_id].push(categoryMap[categoria_id]);
  });

  // Monta allStories com fallback para descrição
  allStories = historias.map(h => {
    const c = cartaoMap[h.id] || {};
    // Se não houver sinopse, pega as 4 primeiras linhas de historia_completa
    const sinopse = c.sinopse_cartao
      || (c.historia_completa 
          ? c.historia_completa.split('\n').slice(0,4).join('\n')
          : '');
    return {
      id: h.id,
      cartao: {
        tituloCartao:     c.titulo_cartao      || h.titulo    || 'Sem título',
        sinopseCartao:    sinopse,
        historiaCompleta: c.historia_completa  || h.descricao  || '',
        dataCartao:       (c.data_criacao || h.data_criacao).split('T')[0],
        autorCartao:      c.autor_cartao       || 'Anónimo',
        categorias:       hcMap[h.id]          || [],
        likes:            c.likes ?? 0
      }
    };
  });
}

// [4] Formatação de texto
function formatarPor4Linhas(text) {
  return text
    .split('\n')
    .slice(0,4)
    .join('<br>');
}
function formatarTextoParaLeitura(text) {
  return text
    .split('\n')
    .map(line => `<p>${line}</p>`)
    .join('');
}
function markReadingPosition(el) { /* ... */ }
function destacarPalavra() { /* ... */ }

// [5] Criação de cards e placeholders
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  // Título
  const h3 = document.createElement('h3');
  h3.textContent = story.cartao.tituloCartao;
  div.appendChild(h3);

  // Sinopse
  const sin = document.createElement('div');
  sin.className = 'sheet-sinopse';
  sin.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  div.appendChild(sin);

  // “mais...”
  const mais = document.createElement('span');
  mais.className = 'ver-mais';
  mais.textContent = 'mais...';
  mais.addEventListener('click', () => {
    isModalOpen = true;
    currentStoryId = story.id;
    modalTitle.textContent  = story.cartao.tituloCartao;
    modalFullText.innerHTML = `<p>${story.cartao.historiaCompleta.replace(/\n/g,'</p><p>')}</p>`;
    modalInfo.innerHTML     = `
      <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
      <p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>`;
    const pos = localStorage.getItem(`readingPosition_${story.id}`);
    continuarBtn.style.display = pos !== null ? 'inline-block' : 'none';
    modalOverlay.style.display = 'flex';
  });
  div.appendChild(mais);

  // Likes
  const likeCont = document.createElement('div');
  likeCont.style.marginTop = '10px';
  const likeBtn = document.createElement('button');
  const likeCt  = document.createElement('span');
  let userLiked = likedStories.includes(story.id);

  likeBtn.style.background = 'transparent';
  likeBtn.style.border     = 'none';
  likeBtn.style.outline    = 'none';
  likeBtn.style.padding    = '0';
  likeBtn.style.cursor     = 'pointer';
  likeBtn.style.fontSize   = '1.4rem';
  likeBtn.onfocus          = () => likeBtn.blur();

  function updateUI() {
    likeBtn.textContent = userLiked ? '❤️' : '🤍';
    likeCt.textContent  = ` ${story.cartao.likes} curtida(s)`;
  }
  updateUI();

  likeBtn.addEventListener('click', async () => {
    story.cartao.likes += userLiked ? -1 : 1;
    userLiked = !userLiked;
    likedStories = userLiked
      ? [...likedStories, story.id]
      : likedStories.filter(i => i !== story.id);
    localStorage.setItem('likedStories', JSON.stringify(likedStories));
    updateUI();

    const { data, error } = await supabase
      .from('cartoes')
      .update({ likes: story.cartao.likes })
      .eq('historia_id', story.id)
      .select('likes')
      .single();
    if (!error) {
      story.cartao.likes = data.likes;
      updateUI();
    }
  });

  likeCont.append(likeBtn, likeCt);
  div.appendChild(likeCont);

  // Categorias
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
  txt = txt.toLowerCase();
  return story.cartao.tituloCartao.toLowerCase().includes(txt);
}
function getFilteredStories() {
  let arr = allStories.filter(st => matchesSearch(st, searchBar.value));
  if (categoryFilter.value) {
    arr = arr.filter(st => st.cartao.categorias.includes(categoryFilter.value));
  }
  if (sortFilter.value === 'popularity') {
    arr.sort((a,b)=>b.cartao.likes-a.cartao.likes);
  }
  return arr;
}

// [7] Paginação
function showBatch(count) {
  const slice = getFilteredStories().slice(currentOffset, currentOffset+count);
  slice.forEach(s=>container.appendChild(createStoryCard(s)));
  currentOffset += count;
}
function initialLoad() {
  container.innerHTML=''; currentOffset=0; showBatch(initialCount);
}
function loadMore() {
  showBatch(increment);
}

// [8] Modal & aviso
modalClose.addEventListener('click', ()=>modalOverlay.style.display='none');
warningYes.addEventListener('click', ()=>{modalOverlay.style.display='none';warningOverlay.style.display='none';});
warningNo.addEventListener('click', ()=>warningOverlay.style.display='none');

// [9] Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await fetchCategories();
  await fetchStoriesFromSupabase();
  initialLoad();
  loadMoreBtn.addEventListener('click', loadMore);
  searchBar.addEventListener('input', initialLoad);
  categoryFilter.addEventListener('change', initialLoad);
  sortFilter.addEventListener('change', initialLoad);
});
