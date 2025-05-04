// js/VerHistorias.js
import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  console.log('Iniciando VerHistorias.js');
  await exibirUsuarioLogado();
  const categoryMap = await fetchCategories();
  const stories    = await fetchPublishedStories(categoryMap);
  if (stories.length === 0) {
    document.getElementById('storiesContainer').innerHTML =
      '<p>Nenhuma história publicada encontrada.</p>';
    return;
  }
  window.allStories = stories; // para debug no console
  renderStories(stories);
  document
    .getElementById('searchBar')
    .addEventListener('input', e => handleSearch(e, stories));
  console.log('Init concluído');
}

// [1] LOGIN/LOGOUT
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    userArea.innerHTML = `
      <a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
    return;
  }
  const userId = session.user.id;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single();
  console.log('Perfil:', profile, 'Erro:', error);
  const nome = profile?.username || session.user.email;
  userArea.textContent = nome;
  userArea.style.cursor = 'pointer';
  userArea.onclick = () => {
    if (confirm('Deseja fazer logout?')) {
      supabase.auth.signOut().then(() => location.href = 'Criacao.html');
    }
  };
}

// [2] BUSCA CATEGORIAS
async function fetchCategories() {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome');
  console.log('Categorias:', data, 'Erro:', error);
  if (error || !data) return {};
  return Object.fromEntries(data.map(c => [c.id, c.nome]));
}

// [3] BUSCA HISTÓRIAS COM CARTÃO PUBLICADO
async function fetchPublishedStories(categoryMap) {
  const { data: stories, error } = await supabase
    .from('historias')
    .select('*, cartoes!inner(*), historia_categorias(*)')
    .order('data_criacao', { ascending: false });
  console.log('Stories raw:', stories, 'Erro:', error);
  if (error || !stories) return [];
  return stories.map(st => {
    const cart = st.cartoes[0];
    const cats = (st.historia_categorias || [])
      .map(hc => categoryMap[hc.categoria_id])
      .filter(Boolean);
    return {
      id: st.id,
      tituloCartao:  cart.titulo_cartao,
      sinopseCartao: cart.sinopse_cartao,
      autorCartao:   cart.autor_cartao,
      dataCartao:    cart.data_criacao.split('T')[0],
      categorias:    cats,
      historiaCompleta: st.descricao
    };
  });
}

// [4] RENDERIZAÇÃO INICIAL
function renderStories(stories) {
  const c = document.getElementById('storiesContainer');
  c.innerHTML = '';
  stories.forEach(st => c.appendChild(createCard(st)));
}

// [5] CRIA CADA CARD
function createCard(st) {
  const div = document.createElement('div');
  div.className = 'sheet';

  const h3 = document.createElement('h3');
  h3.textContent = st.tituloCartao;
  div.appendChild(h3);

  const p = document.createElement('p');
  p.textContent = st.sinopseCartao;
  div.appendChild(p);

  const info = document.createElement('small');
  info.textContent = `${st.autorCartao} • ${st.dataCartao}`;
  div.appendChild(info);

  const btn = document.createElement('button');
  btn.textContent = 'Ler Mais';
  btn.onclick = () => openModal(st);
  div.appendChild(btn);

  return div;
}

// [6] MODAL
function openModal(st) {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = st.tituloCartao;
  document.getElementById('modalFullText').textContent = st.historiaCompleta;
  document.getElementById('modalInfo').textContent =
    `Categorias: ${st.categorias.join(', ')}`;
  overlay.style.display = 'flex';

  document.getElementById('modalClose').onclick = () => {
    overlay.style.display = 'none';
  };
  overlay.onclick = e => {
    if (e.target === overlay) overlay.style.display = 'none';
  };
}

// [7] PESQUISA
function handleSearch(e, stories) {
  const txt = e.target.value.trim().toLowerCase();
  const filtered = stories.filter(st =>
    st.tituloCartao.toLowerCase().includes(txt) ||
    st.autorCartao.toLowerCase().includes(txt)
  );
  renderStories(filtered);
}
