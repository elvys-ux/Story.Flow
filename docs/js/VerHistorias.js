// js/VerHistorias.js
import { supabase } from './supabase.js';

// Estado da aplicação
let sessionUserId    = null;
let allStories       = [];
let likedStories     = new Set();
let currentStoryId   = null;
let currentOffset    = 0;
const initialCount   = 20;
const increment      = 5;

// Elementos do DOM
typedef const container      = document.getElementById('storiesContainer');
const categoryFilter = document.getElementById('category-filter');
const sortFilter     = document.getElementById('sort-filter');
const searchForm     = document.getElementById('searchForm');
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

let categoryMap = {}; // mapeamento id → nome da categoria

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Impedir reload no submit
  if (searchForm) {
    searchForm.addEventListener('submit', e => { e.preventDefault(); initialLoad(); });
  }

  // Obter sessão
  const { data: { session } } = await supabase.auth.getSession();
  sessionUserId = session?.user?.id ?? null;
  if (sessionUserId) {
    await fetchUserLikes();
  }

  await exibirUsuarioLogado();
  await fetchCategories();
  await fetchStoriesFromSupabase();
  initialLoad();

  // Filtros e paginação
  searchBar.addEventListener('input', initialLoad);
  categoryFilter.addEventListener('change', initialLoad);
  sortFilter.addEventListener('change', initialLoad);
  loadMoreBtn.addEventListener('click', () => {
    loadMoreBtn.disabled = true;
    showBatch(increment);
  });

  // Modal e warning
  modalClose.onclick   = () => modalOverlay.style.display = 'none';
  modalOverlay.onclick = e => { if (e.target === modalOverlay) warningOverlay.style.display = 'flex'; };
  warningYes.onclick   = () => { modalOverlay.style.display = 'none'; warningOverlay.style.display = 'none'; };
  warningNo.onclick    = () => warningOverlay.style.display = 'none';
}

async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    area.innerHTML = `<a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
    return;
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', session.user.id)
    .single();
  area.textContent = profile?.username || session.user.email;
  area.style.cursor = 'pointer';
  area.onclick = () => {
    if (confirm('Deseja fazer logout?')) {
      supabase.auth.signOut().then(() => location.href = 'Criacao.html');
    }
  };
}

async function fetchUserLikes() {
  const { data, error } = await supabase
    .from('user_likes')
    .select('historia_id')
    .eq('user_id', sessionUserId);
  if (!error) likedStories = new Set(data.map(r => r.historia_id));
}

async function fetchCategories() {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome');
  if (!error) categoryMap = Object.fromEntries(data.map(c => [c.id, c.nome]));
}

async function fetchStoriesFromSupabase() {
  const { data: historias, error: errH } = await supabase
    .from('historias')
    .select('id, titulo, descricao, data_criacao')
    .order('data_criacao', { ascending: false });
  if (errH) {
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
    return;
  }

  const { data: cartoes } = await supabase
    .from('cartoes')
    .select('historia_id, titulo_cartao, sinopse_cartao, autor_cartao, data_criacao, likes');
  const cartaoMap = Object.fromEntries(cartoes.map(c => [c.historia_id, c]));

  const { data: hcData } = await supabase
    .from('historia_categorias')
    .select('historia_id, categoria_id');
  const hcMap = {};
  hcData.forEach(({ historia_id, categoria_id }) => {
    if (!hcMap[historia_id]) hcMap[historia_id] = [];
    hcMap[historia_id].push(categoryMap[categoria_id]);
  });

  allStories = historias.map(h => {
    const c = cartaoMap[h.id] || {};
    return {
      id:        h.id,
      hasCartao: Boolean(c.titulo_cartao),
      cartao: {
        tituloCartao:     c.titulo_cartao   || h.titulo    || 'Sem título',
        sinopseCartao:    c.sinopse_cartao  || h.descricao || '',
        historiaCompleta: h.descricao       || '',
        dataCartao:       (c.data_criacao || h.data_criacao).split('T')[0],
        autorCartao:      c.autor_cartao    || 'Anónimo',
        categorias:       hcMap[h.id]       || [],
        likes:            c.likes ?? 0
      }
    };
  });
}

/**
 * formataComQuebra: insere <br> nas quebras de linha
 * e <br><br> após pontos finais
 */
function formataComQuebra(texto = '') {
  const comLinhas = texto.replace(/\n/g, '<br>');
  return comLinhas.replace(/\.(?!$)/g, '.<br><br>');
}

/**
 * formatarTextoParaLeitura: gera spans clicáveis e parágrafos
 */
function formatarTextoParaLeitura(texto = '') {
  let idx = 0;
  return texto.split('\n').map(line => {
    const spans = line.split(' ').map(word => {
      const html = `<span data-index="${idx}" onclick="markReadingPosition(this)">${word}</span>`;
      idx++;
      return html;
    }).join(' ');
    return `<p style="text-align:justify">${spans}</p>`;
  }).join('');
}

// Marca posição de leitura
window.markReadingPosition = function(el) {
  const pos = el.dataset.index;
  localStorage.setItem(`readingPosition_${currentStoryId}`, pos);
  modalFullText.querySelectorAll('span').forEach(s => s.style.background = '');
  el.style.background = 'yellow';
};

// Cria cartão de história
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  const h3 = document.createElement('h3');
  h3.textContent = story.cartao.tituloCartao;
  div.appendChild(h3);

  const sin = document.createElement('div');
  sin.className = 'sheet-sinopse';
  sin.innerHTML = formataComQuebra(story.cartao.sinopseCartao);
  div.appendChild(sin);

  const mais = document.createElement('span');
  mais.className = 'ver-mais';
  mais.textContent = 'mais...';
  mais.onclick = () => abrirModal(story);
  div.appendChild(mais);

  if (story.hasCartao) {
    const likeCont = document.createElement('div');
    likeCont.style.marginTop = '10px';
    const btn = document.createElement('button');
    const count = document.createElement('span');
    btn.style.cssText = 'background:transparent;border:none;cursor:pointer;font-size:1.4rem';

    let userLiked = likedStories.has(story.id);
    function updateLikeUI() {
      btn.textContent = userLiked ? '❤️' : '🤍';
      count.textContent = ` ${story.cartao.likes} curtida(s)`;
    }
    updateLikeUI();

    btn.onclick = async () => {
      if (!sessionUserId) { alert('Faça login para dar like.'); return; }
      if (userLiked) {
        story.cartao.likes--;
        await supabase.from('user_likes').delete().match({ user_id: sessionUserId, historia_id: story.id });
      } else {
        story.cartao.likes++;
        await supabase.from('user_likes').insert({ user_id: sessionUserId, historia_id: story.id });
      }
      userLiked = !userLiked;
      userLiked ? likedStories.add(story.id) : likedStories.delete(story.id);
      updateLikeUI();
      await supabase.from('cartoes').update({ likes: story.cartao.likes }).eq('historia_id', story.id);
    };

    likeCont.appendChild(btn);
    likeCont.appendChild(count);
    div.appendChild(likeCont);
  }

  const catCont = document.createElement('div');
  catCont.className = 'sheet-categories';
  (story.cartao.categorias.length ? story.cartao.categorias : ['Sem Categoria'])
    .forEach(c => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = c;
      catCont.appendChild(badge);
    });
  div.appendChild(catCont);

  return div;
}

// Abre modal de leitura
function abrirModal(story) {
  currentStoryId = story.id;
  modalTitle.textContent = story.cartao.tituloCartao;
  modalFullText.innerHTML = formataComQuebra(story.cartao.sinopseCartao);

  const lerBtn = document.createElement('button');
  lerBtn.textContent = 'Ler';
  lerBtn.onclick = () => {
    modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
    const saved = localStorage.getItem(`readingPosition_${story.id}`);
    if (saved) {
      const el = modalFullText.querySelector(`span[data-index="${saved}"]`);
      if (el) el.style.background = 'yellow';
    }
  };
  modalFullText.appendChild(lerBtn);

  modalInfo.innerHTML = `
    <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
    <p><strong>Autor:</strong> ${story.cartao.autorCartao}</p>
    <p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>
  `;

  warningOverlay.style.display = 'none';
  modalOverlay.style.display = 'flex';
}

// Filtra histórias por busca, categoria e ordenação
function getFilteredStories() {
  let arr = allStories.filter(st => {
    const t = searchBar.value.toLowerCase();
    return !t
      || st.cartao.tituloCartao.toLowerCase().includes(t)
      || st.cartao.autorCartao.toLowerCase().includes(t);
  });
  if (categoryFilter.value) arr = arr.filter(st => st.cartao.categorias.includes(categoryFilter.value));
  if (sortFilter.value === 'date') arr.sort((a,b) => b.cartao.dataCartao.localeCompare(a.cartao.dataCartao));
  else if (sortFilter.value === 'popularity') arr.sort((a,b) => b.cartao.likes - a.cartao.likes);
  return arr;
}

// Exibe um lote de cartões
function showBatch(count) {
  const slice = getFilteredStories().slice(currentOffset, currentOffset + count);
  slice.forEach(s => container.appendChild(createStoryCard(s)));
  if (slice.length < count) {
    for (let i = slice.length; i < count; i++) container.appendChild(createPlaceholderCard());
  }
  currentOffset += count;
  loadMoreBtn.disabled = false;
}

// Carregamento inicial
function initialLoad() {
  container.innerHTML = '';
  currentOffset = 0;
  showBatch(initialCount);
}

// Placeholder para falta de histórias
function createPlaceholderCard() {
  const div = document.createElement('div');
  div.className = 'sheet sheet-placeholder';
  div.innerHTML = '<h3>Placeholder</h3><p>(sem história)</p>';
  return div;
}

// Mostrar footer ao passar o rato
document.body.addEventListener('mousemove', e => {
  const footer = document.querySelector('footer');
  if (!footer) return;
  if (window.innerHeight - e.clientY < 50) footer.classList.add('visible');
  else footer.classList.remove('visible');
});
