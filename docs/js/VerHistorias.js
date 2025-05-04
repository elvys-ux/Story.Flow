// js/VerHistorias.js
import { supabase } from './supabase.js';

let allStories = [];  // vai guardar as histórias publicadas

document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  // 1) Login / Logout
  await setupUserMenu();

  // 2) Carrega categorias para mapear id → nome
  const categoryMap = await loadCategories();

  // 3) Busca apenas as histórias que têm cartão publicado
  allStories = await loadPublishedStories(categoryMap);

  // 4) Render inicial
  renderStories(allStories);

  // 5) Anexa event handlers (busca, filtro, ordenação)
  attachEventHandlers();
}

// --------------------------------------------------
// [1] Configura área de login / logout
// --------------------------------------------------
async function setupUserMenu() {
  const area = document.getElementById('userMenuArea');
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    area.innerHTML = `<a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
    return;
  }

  const userId = session.user.id;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single();

  console.log('profile fetch:', profile, error);

  const name = profile?.username || session.user.email;
  area.textContent = name;
  area.style.cursor = 'pointer';
  area.onclick = () => {
    if (confirm('Deseja fazer logout?')) {
      supabase.auth.signOut().then(() => location.href = 'Criacao.html');
    }
  };
}

// --------------------------------------------------
// [2] Busca categorias
// --------------------------------------------------
async function loadCategories() {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome');
  if (error) {
    console.error('Erro ao carregar categorias:', error);
    return {};
  }
  return Object.fromEntries(data.map(c => [c.id, c.nome]));
}

// --------------------------------------------------
// [3] Busca somente histórias com cartão publicado
// --------------------------------------------------
async function loadPublishedStories(categoryMap) {
  const { data: rows, error } = await supabase
    .from('historias')
    .select('*, cartoes!inner(*), historia_categorias(*)')
    .order('data_criacao', { ascending: false });

  if (error) {
    console.error('Erro ao buscar histórias:', error);
    return [];
  }
  if (!rows || rows.length === 0) {
    return [];
  }

  // monta o array final
  return rows.map(row => {
    const cart = row.cartoes[0];
    const cats = (row.historia_categorias || [])
      .map(hc => categoryMap[hc.categoria_id])
      .filter(Boolean);

    return {
      id: row.id,
      tituloCartao:     cart.titulo_cartao,
      sinopseCartao:    cart.sinopse_cartao,
      autorCartao:      cart.autor_cartao,
      dataCartao:       cart.data_criacao.split('T')[0],
      categorias:       cats,
      historiaCompleta: row.descricao
    };
  });
}

// --------------------------------------------------
// [4] Renderiza lista de cards
// --------------------------------------------------
function renderStories(list) {
  const container = document.getElementById('storiesContainer');
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<p>Nenhuma história publicada encontrada.</p>';
    return;
  }

  list.forEach(story => {
    container.appendChild(createCard(story));
  });
}

// --------------------------------------------------
// [5] Cria um único card
// --------------------------------------------------
function createCard(st) {
  const div = document.createElement('div');
  div.className = 'sheet';

  // título do cartão
  const h3 = document.createElement('h3');
  h3.textContent = st.tituloCartao;
  div.appendChild(h3);

  // sinopse
  const p = document.createElement('p');
  p.textContent = st.sinopseCartao;
  div.appendChild(p);

  // autor e data
  const info = document.createElement('small');
  info.textContent = `${st.autorCartao} • ${st.dataCartao}`;
  div.appendChild(info);

  // botão “Ler Mais”
  const btn = document.createElement('button');
  btn.textContent = 'Ler Mais';
  btn.onclick = () => openModal(st);
  div.appendChild(btn);

  return div;
}

// --------------------------------------------------
// [6] Abre modal com o texto completo
// --------------------------------------------------
function openModal(st) {
  const overlay   = document.getElementById('modalOverlay');
  const titleEl   = document.getElementById('modalTitle');
  const textEl    = document.getElementById('modalFullText');
  const infoEl    = document.getElementById('modalInfo');
  const closeBtn  = document.getElementById('modalClose');

  titleEl.textContent   = st.tituloCartao;
  textEl.textContent    = st.historiaCompleta;
  infoEl.textContent    = `Categorias: ${st.categorias.join(', ')}`;

  // mostra
  overlay.style.display = 'flex';

  // fecha modal ao clicar no X
  closeBtn.onclick = () => overlay.style.display = 'none';

  // fecha modal ao clicar fora do conteúdo
  overlay.onclick = e => {
    if (e.target === overlay) overlay.style.display = 'none';
  };
}

// --------------------------------------------------
// [7] Anexa busca e filtros
// --------------------------------------------------
function attachEventHandlers() {
  document.getElementById('searchBar')
    .addEventListener('input', applyFilters);
  document.getElementById('category-filter')
    .addEventListener('change', applyFilters);
  document.getElementById('sort-filter')
    .addEventListener('change', applyFilters);
}

// --------------------------------------------------
// [8] Filtra e re-renderiza conforme entrada do usuário
// --------------------------------------------------
function applyFilters() {
  const txt  = document.getElementById('searchBar').value.trim().toLowerCase();
  const cat  = document.getElementById('category-filter').value;
  const sort = document.getElementById('sort-filter').value;

  let filtered = allStories.filter(st =>
    st.tituloCartao.toLowerCase().includes(txt) ||
    st.autorCartao.toLowerCase().includes(txt)
  );

  if (cat) {
    filtered = filtered.filter(st => st.categorias.includes(cat));
  }

  if (sort === 'date') {
    filtered.sort((a, b) => b.dataCartao.localeCompare(a.dataCartao));
  }
  // se houver popularidade, implementa aqui

  renderStories(filtered);
}
