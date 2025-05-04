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

// … [mantém as funções exibirUsuarioLogado, fetchCategories e helpers de formatação] …

// ————————————————————————————————
// [3] Busca histórias + cartões + categorias + autor do perfil
// ————————————————————————————————
async function fetchStoriesFromSupabase() {
  const { data: rows, error } = await supabase
    .from('historias')
    .select(`
      *,
      cartoes(*),
      historia_categorias(categoria_id),
      profiles!inner(username)
    `)
    .order('data_criacao', { ascending: false });

  if (error) {
    console.error('Erro ao buscar histórias:', error);
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
    return;
  }

  allStories = rows.map(row => {
    // monta lista de categorias pelo mapa
    const cats = (row.historia_categorias || [])
      .map(hc => categoryMap[hc.categoria_id])
      .filter(Boolean);

    // escolhe o cartão (assumindo 1:1)
    const cart = row.cartoes[0] || {};

    return {
      id: row.id,
      cartao: {
        tituloCartao:     cart.titulo_cartao || row.titulo,
        sinopseCartao:    cart.sinopse_cartao || '',
        historiaCompleta: row.descricao,
        dataCartao:       row.data_criacao.split('T')[0],
        autorCartao:      row.profiles.username,
        categorias:       cats,
        likes:            0
      }
    };
  });
}

// ————————————————————————————————
// [6] Filtrar / ordenar / pesquisar (inclui popularidade)
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

  if (sortFilter.value === 'date') {
    arr.sort((a, b) => b.cartao.dataCartao.localeCompare(a.cartao.dataCartao));
  } else if (sortFilter.value === 'popularity') {
    arr.sort((a, b) => b.cartao.likes - a.cartao.likes);
  }

  return arr;
}

// ————————————————————————————————
// [7] Paginação (mantém sempre placeholders)
// ————————————————————————————————
function showBatch(count) {
  const filtered = getFilteredStories();
  const slice = filtered.slice(currentOffset, currentOffset + count);

  // usa fragmento para performance
  const frag = document.createDocumentFragment();
  slice.forEach(s => frag.appendChild(createStoryCard(s)));

  // placeholders até preencher o lote
  for (let i = slice.length; i < count; i++) {
    frag.appendChild(createPlaceholderCard());
  }

  container.appendChild(frag);
  currentOffset += count;
  loadMoreBtn.disabled = false;
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
