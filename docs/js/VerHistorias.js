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
let originalText   = "";

let likedStories   = JSON.parse(localStorage.getItem('likedStories') || '[]');
let categoryMap    = {};  // id → nome

// ————————————————————————————————
// [1] Exibe usuário logado / login
// ————————————————————————————————
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    area.innerHTML = `<a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
    return;
  }
  const userId = session.user.id;
  const { data: profile } = await supabase
    .from('profiles').select('username').eq('id', userId).single();
  const nome = profile?.username || session.user.email;
  area.textContent = nome;
  area.style.cursor = 'pointer';
  area.onclick = () => {
    if (confirm('Deseja fazer logout?')) {
      supabase.auth.signOut().then(() => location.href = 'Criacao.html');
    }
  };
}

// ————————————————————————————————
// [2] Carrega categorias (id → nome)
// ————————————————————————————————
async function fetchCategories() {
  const { data, error } = await supabase
    .from('categorias').select('id, nome');
  if (error) {
    console.error('Erro ao carregar categorias:', error);
    return;
  }
  categoryMap = Object.fromEntries(data.map(c => [c.id, c.nome]));
}

// ————————————————————————————————
// [3] Busca histórias + cartões + categorias
// ————————————————————————————————
async function fetchStoriesFromSupabase() {
  const { data: rows, error } = await supabase
    .from('historias')
    .select('*, cartoes!inner(*), historia_categorias(*)')
    .order('data_criacao', { ascending: false });

  if (error) {
    console.error('Erro ao buscar histórias:', error);
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
    return;
  }

  allStories = rows.map(row => {
    const cart = row.cartoes[0];
    const cats = (row.historia_categorias || [])
      .map(hc => categoryMap[hc.categoria_id])
      .filter(Boolean);
    return {
      id: row.id,
      cartao: {
        tituloCartao:     cart.titulo_cartao,
        sinopseCartao:    cart.sinopse_cartao,
        historiaCompleta: row.descricao,
        dataCartao:       cart.data_criacao.split('T')[0],
        autorCartao:      cart.autor_cartao,
        categorias:       cats,
        likes:            0
      }
    };
  });
}

// ————————————————————————————————
// [4] Helpers de formato
// ————————————————————————————————
function formatarPor4Linhas(text) {
  const lines = text.split('\n');
  const paras = [];
  for (let i = 0; i < lines.length; i += 4) {
    paras.push(lines.slice(i, i + 4).join('<br>'));
  }
  return paras.map(p => `<p style="text-align: justify;">${p}</p>`).join('');
}
function formatarTextoParaLeitura(text) {
  const lines = text.split('\n');
  let idx = 0, buf = [], paras = [];
  for (let i = 0; i < lines.length; i++) {
    const spans = lines[i].split(' ').map(w => `<span data-index="${idx++}" onclick="markReadingPosition(this)">${w}</span>`);
    buf.push(spans.join(' '));
    if ((i+1) % 4 === 0) {
      paras.push(`<p style="text-align: justify;">${buf.join('<br>')}</p>`);
      buf = [];
    }
  }
  if (buf.length) paras.push(`<p style="text-align: justify;">${buf.join('<br>')}</p>`);
  return paras.join('');
}
function markReadingPosition(el) {
  const idx = el.getAttribute('data-index');
  localStorage.setItem(`readingPosition_${currentStoryId}`, idx);
}
function destacarPalavra() {
  const saved = localStorage.getItem(`readingPosition_${currentStoryId}`);
  if (saved !== null) {
    const span = modalFullText.querySelector(`[data-index="${saved}"]`);
    if (span) {
      span.style.background = 'yellow';
      span.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
}

// ————————————————————————————————
// [5] Criação de cards e placeholders
// ————————————————————————————————
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  // título
  const h3 = document.createElement('h3');
  h3.textContent = story.cartao.tituloCartao;
  div.appendChild(h3);

  // sinopse
  const sin = document.createElement('div');
  sin.className = 'sheet-sinopse';
  sin.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  div.appendChild(sin);

  // “mais...”
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
    // botão Ler
    const btnLer = document.createElement('button');
    btnLer.textContent = 'Ler';
    btnLer.onclick = () => {
      modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
      setTimeout(destacarPalavra, 100);
    };
    modalFullText.appendChild(btnLer);
    // botão Continuar
    const pos = localStorage.getItem(`readingPosition_${story.id}`);
    continuarBtn.style.display = pos!==null?'inline-block':'none';
    modalOverlay.style.display = 'flex';
  };
  div.appendChild(mais);

  // likes
  const likeCont = document.createElement('div');
  likeCont.style.marginTop = '10px';
  const likeBtn = document.createElement('button');
  const likeCt  = document.createElement('span');
  let userLiked = likedStories.includes(story.id);
  function updateUI() {
    likeBtn.textContent = userLiked?'❤️':'🤍';
    likeCt.textContent = ` ${story.cartao.likes} curtida(s)`;
  }
  updateUI();
  likeBtn.onclick = () => {
    if (userLiked) {
      story.cartao.likes = Math.max(story.cartao.likes-1,0);
      likedStories = likedStories.filter(i=>i!==story.id);
    } else {
      story.cartao.likes++;
      likedStories.push(story.id);
    }
    localStorage.setItem('likedStories',JSON.stringify(likedStories));
    updateUI();
  };
  likeCont.append(likeBtn, likeCt);
  div.appendChild(likeCont);

  // categorias
  const catCont = document.createElement('div');
  catCont.className = 'sheet-categories';
  if (story.cartao.categorias.length) {
    story.cartao.categorias.forEach(c => {
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
  const h3 = document.createElement('h3');
  h3.textContent = 'Placeholder';
  div.appendChild(h3);
  const p = document.createElement('p');
  p.textContent = '(sem história)';
  div.appendChild(p);
  return div;
}

// ————————————————————————————————
// [6] Filtrar / ordenar / pesquisar
// ————————————————————————————————
function matchesSearch(story, txt) {
  if (!txt) return true;
  txt = txt.toLowerCase();
  return story.cartao.tituloCartao.toLowerCase().includes(txt)
      || story.cartao.autorCartao.toLowerCase().includes(txt);
}

function getFilteredStories() {
  let arr = allStories.filter(st => matchesSearch(st, searchBar.value));
  if (categoryFilter.value) {
    arr = arr.filter(st => st.cartao.categorias.includes(categoryFilter.value));
  }
  if (sortFilter.value==='date') {
    arr.sort((a,b)=>b.cartao.dataCartao.localeCompare(a.cartao.dataCartao));
  }
  return arr;
}

// ————————————————————————————————
// [7] Paginação
// ————————————————————————————————
function showBatch(count) {
  const filtered = getFilteredStories();
  const slice = filtered.slice(currentOffset, currentOffset+count);
  slice.forEach(s=>container.appendChild(createStoryCard(s)));
  // placeholders se precisar
  for(let i=slice.length;i<count;i++){
    container.appendChild(createPlaceholderCard());
  }
  currentOffset+=count;
  loadMoreBtn.disabled=false;
}

function initialLoad() {
  container.innerHTML='';
  currentOffset=0;
  showBatch(initialCount);
}

function loadMore(){
  loadMoreBtn.disabled=true;
  showBatch(increment);
}

// ————————————————————————————————
// [8] Modal & aviso
// ————————————————————————————————
modalClose.onclick = ()=>{
  modalOverlay.style.display='none';
  isModalOpen=false;
};
modalOverlay.onclick=e=>{
  if(e.target===modalOverlay && isModalOpen)
    warningOverlay.style.display='flex';
};
warningYes.onclick = ()=>{
  modalOverlay.style.display='none';
  warningOverlay.style.display='none';
  isModalOpen=false;
};
warningNo.onclick = ()=>{
  warningOverlay.style.display='none';
};
continuarBtn.onclick = ()=>{
  const st = allStories.find(s=>s.id===currentStoryId);
  if(st){
    modalFullText.innerHTML = formatarTextoParaLeitura(st.cartao.historiaCompleta);
    setTimeout(destacarPalavra,100);
  }
};

// ————————————————————————————————
// [9] Inicia tudo
// ————————————————————————————————
document.addEventListener('DOMContentLoaded',async()=>{
  await exibirUsuarioLogado();
  await fetchCategories();
  await fetchStoriesFromSupabase();
  initialLoad();
  // filtros
  searchBar.oninput       = ()=>initialLoad();
  categoryFilter.onchange = ()=>initialLoad();
  sortFilter.onchange     = ()=>initialLoad();
  loadMoreBtn.onclick     = loadMore;
});
