// historiasqueescrevi.js
import { supabase } from './supabase.js';

// =====================
// [A] EXIBIR USUÁRIO LOGADO (preserva em userDisplay.js)
// =====================
import { exibirUsuarioLogado } from './userDisplay.js';

// =====================
// [B] LISTAGEM LATERAL (todas as histórias do usuário)
// =====================
async function carregarHistoriasDoUsuario() {
  // obtém sessão e user
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return;

  // busca histórias cujo user_id = id do user
  const { data: historias, error } = await supabase
    .from('historias')
    .select('id, titulo, descricao, data_criacao')
    .eq('user_id', user.id)
    .order('data_criacao', { ascending: false });

  if (error) {
    console.error('Erro ao carregar histórias do usuário:', error);
    return;
  }

  const ul = document.getElementById('titleListUl');
  ul.innerHTML = '';

  historias.forEach(h => {
    const li = document.createElement('li');
    li.textContent = h.titulo || '(Sem título)';
    li.addEventListener('click', () => abrirModalComHistoria(h));
    ul.appendChild(li);
  });
}

// =====================
// [C] PESQUISA GLOBAL (só publicadas—com cartão)
// =====================
async function pesquisarHistoriasPublicadas(termo) {
  const q = termo.trim().toLowerCase();
  if (!q) return [];

  const { data, error } = await supabase
    .from('historias')
    .select(`
      id,
      titulo,
      descricao,
      data_criacao,
      profiles (
        username
      ),
      cartoes (
        id,
        titulo_cartao,
        sinopse_cartao,
        autor_cartao
      )
    `)
    .or(`titulo.ilike.%${q}%, profiles.username.ilike.%${q}%`)
    .not('cartoes.id', 'is', null)
    .order('data_criacao', { ascending: false });

  if (error) {
    console.error('Erro ao pesquisar histórias:', error);
    return [];
  }
  return data;
}

function exibirSugestoesPublicadas(lista) {
  const container = document.getElementById('searchResults');
  container.innerHTML = '';
  if (lista.length === 0) {
    container.innerHTML = `<div style="padding:6px;">Nenhuma história encontrada</div>`;
    container.style.display = 'block';
    return;
  }

  lista.forEach(h => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.dataset.id = h.id;
    div.innerHTML = `
      <strong>${h.titulo}</strong><br>
      <em>Autor: ${h.profiles.username}</em>
    `;
    div.addEventListener('click', () => {
      abrirModalComHistoria(h);
      container.style.display = 'none';
    });
    container.appendChild(div);
  });
  container.style.display = 'block';
}

// =====================
// [D] FUNÇÃO DE ABERTURA DE MODAL
// =====================
function abrirModalComHistoria(h) {
  const modal = document.getElementById('modal-historia');
  const titulo = document.getElementById('modal-titulo');
  const conteudo = document.getElementById('modal-conteudo');

  titulo.textContent = h.titulo;
  // usa cartoes.sinopse_cartao ou descricao completa
  conteudo.textContent = h.cartoes?.[0]?.sinopse_cartao || h.descricao || '';
  modal.style.display = 'block';
}

// =====================
// [E] EVENTOS
// =====================
document.addEventListener('DOMContentLoaded', () => {
  exibirUsuarioLogado();            // de userDisplay.js
  carregarHistoriasDoUsuario();     // lista lateral

  const searchBar = document.getElementById('searchBar');
  const searchBtn = document.getElementById('searchBtn');
  const searchResults = document.getElementById('searchResults');

  // Pesquisa ao digitar
  searchBar.addEventListener('input', async () => {
    const termo = searchBar.value;
    if (!termo) {
      searchResults.style.display = 'none';
      return;
    }
    const lista = await pesquisarHistoriasPublicadas(termo);
    exibirSugestoesPublicadas(lista);
  });

  // Pesquisa ao clicar no botão
  searchBtn.addEventListener('click', async () => {
    const termo = searchBar.value;
    if (!termo) {
      searchResults.style.display = 'none';
      return;
    }
    const lista = await pesquisarHistoriasPublicadas(termo);
    exibirSugestoesPublicadas(lista);
  });

  // Fechar sugestões ao clicar fora
  document.addEventListener('click', e => {
    if (!searchResults.contains(e.target) && e.target !== searchBar && e.target !== searchBtn) {
      searchResults.style.display = 'none';
    }
  });
});
