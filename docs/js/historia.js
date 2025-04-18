import { supabase } from './supabase.js';

/*************************************************************
 * HISTORIA.JS — Versão com Supabase (Completo e Funcional)
 * - Gerencia histórias e cartões via Supabase
 * - Login/logout, listagem, CRUD, modal de leitura e cartões
 *************************************************************/

// Contexto global para o Cartão
let storyIDAtual = null;
let userIDAtual  = null;

// [1] LOGIN/LOGOUT com Supabase
enum async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      userArea.innerHTML = `<a href='Criacao.html' style='color:white;'><i class='fas fa-user'></i> Login</a>`;
      userArea.onclick = null;
      return;
    }
    const userId = session.user.id;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    const username = (!profileError && profile?.username)
      ? profile.username
      : session.user.email;
    userArea.innerHTML = username;
    userArea.onclick = () => {
      if (confirm('Deseja fazer logout?')) {
        supabase.auth.signOut().then(({ error }) => {
          if (error) alert('Erro ao deslogar: ' + error.message);
          else window.location.href = 'Criacao.html';
        });
      }
    };
  } catch (ex) {
    console.error('Exceção em exibirUsuarioLogado:', ex);
  }
}

// [2] TOAST (Notificação)
function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'my-toast';
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// [3] CARREGAR CATEGORIAS (id e nome)
async function loadCategorias() {
  const container = document.querySelector('.categorias');
  if (!container) return;
  let cats;
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome')
    .order('nome', { ascending: true });
  if (error || !data?.length) {
    console.warn('Fallback estático para categorias.');
    cats = [
      { id: 1, nome: 'Fantasia' },
      { id: 2, nome: 'Terror' },
      { id: 3, nome: 'Comédia' },
      { id: 4, nome: 'Ficção Científica' },
      { id: 5, nome: 'Drama' }
    ];
  } else {
    cats = data;
  }
  container.innerHTML = '';
  cats.forEach(cat => {
    const label = document.createElement('label');
    label.style.marginRight = '10px';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'categoria';
    input.value = String(cat.id);
    label.appendChild(input);
    label.append(` ${cat.nome}`);
    container.appendChild(label);
  });
}

// [4] INICIALIZAÇÃO e binding de botões
document.addEventListener('DOMContentLoaded', () => {
  exibirUsuarioLogado();
  loadCategorias();
  mostrarHistorias();

  // Form História
  document.getElementById('storyForm')
    .addEventListener('submit', async e => {
      e.preventDefault();
      const titulo = document.getElementById('titulo').value.trim();
      const descricao = document.getElementById('descricao').value.trim();
      if (!titulo || !descricao) return alert('Preencha o título e a descrição!');
      await salvarHistoria(titulo, descricao);
    });

  // Nova História
  document.getElementById('novaHistoriaBtn')
    ?.addEventListener('click', () => {
      if (confirm('Tem certeza de que deseja começar nova história?')) {
        limparFormulario();
        removerExibicaoHistoria();
      }
    });

  // Fechar Modal
  document.getElementById('closeModal')
    ?.addEventListener('click', () => {
      document.getElementById('modalOverlay').style.display = 'none';
    });

  // Botões do Cartão
  const btnPub = document.getElementById('btnPublicarCartao');
  const btnLer = document.getElementById('btnLerMais');
  const btnVolt = document.getElementById('btnVoltar');
  if (btnPub) btnPub.addEventListener('click', () => {
    if (!storyIDAtual || !userIDAtual) return console.error('IDs do cartão não definidos');
    publicarCartao(storyIDAtual, userIDAtual);
  });
  if (btnLer) btnLer.addEventListener('click', () => {
    if (!storyIDAtual) return console.error('ID da história não definido');
    lerMais(storyIDAtual);
  });
  if (btnVolt) btnVolt.addEventListener('click', () => {
    document.getElementById('cartaoContainer').style.display = 'none';
    document.getElementById('storyContainer').style.display  = 'block';
  });
});

// [5] LISTA LATERAL (HOVER)
let isTitleListVisible = false;
document.body.addEventListener('mousemove', e => {
  if (e.clientX < 50 && !isTitleListVisible) toggleTitleList(true);
});
document.body.addEventListener('mouseleave', () => {
  if (isTitleListVisible) toggleTitleList(false);
});
function toggleTitleList(show) {
  const list = document.getElementById('titleListLeft');
  if (!list) return;
  isTitleListVisible = show;
  list.classList.toggle('visible', show);
}

// [6] MOSTRAR HISTÓRIAS
async function mostrarHistorias() {
  const ul = document.getElementById('titleListUl');
  if (!ul) return;
  ul.innerHTML = '';
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user.id;
  if (!userId) return;
  const { data: historias, error } = await supabase
    .from('historias')
    .select('id, titulo')
    .eq('user_id', userId)
    .order('data_criacao', { ascending: false });
  if (error) return console.error('Erro ao carregar histórias:', error);
  historias.forEach(h => {
    const li = document.createElement('li');
    li.textContent = h.titulo || '(sem título)';
    li.dataset.id = h.id;
    li.addEventListener('click', e => { e.stopPropagation(); toggleMenuOpcoes(li, h.id); });
    ul.appendChild(li);
  });
}

// [7] MENU (Cartão, Editar, Excluir)
function toggleMenuOpcoes(li, storyID) {
  const existing = li.querySelector('.menu-opcoes');
  if (existing) return existing.remove();
  const menu = document.createElement('div');
  menu.className = 'menu-opcoes';
  ['Cartão', 'Editar', 'Excluir'].forEach(action => {
    const btn = document.createElement('button');
    btn.textContent = action;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (action === 'Cartão') mostrarCartaoForm(storyID);
      if (action === 'Editar') editarHistoria(storyID);
      if (action === 'Excluir') excluirHistoria(storyID);
      menu.remove();
    });
    menu.appendChild(btn);
  });
  li.appendChild(menu);
  menu.style.display = 'block';
}

// [8] SALVAR / EDITAR HISTÓRIA
async function salvarHistoria(titulo, descricao) {
  const form = document.getElementById('storyForm');
  const editId = form.dataset.editId;
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session.user.id;
  if (editId) {
    const { error } = await supabase
      .from('historias')
      .update({ titulo, descricao })
      .eq('id', editId)
      .eq('user_id', userId);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    await exibirHistoriaNoContainer(editId);
  } else {
    const { error } = await supabase
      .from('historias')
      .insert([{ titulo, descricao, user_id: userId, data_criacao: new Date().toISOString() }]);
    if (error) return alert('Erro ao salvar: ' + error.message);
  }
  limparFormulario();
  mostrarHistorias();
}

// [9] EDITAR HISTÓRIA
async function editarHistoria(storyID) {
  const { data, error } = await supabase
    .from('historias')
    .select('*')
    .eq('id', storyID)
    .single();
  if (error || !data) return console.error('Erro ao carregar:', error);
  document.getElementById('titulo').value = data.titulo;
  document.getElementById('descricao').value = data.descricao;
  const form = document.getElementById('storyForm');
  form.dataset.editId = storyID;
  form.querySelector('button[type="submit"]').textContent = 'Atualizar';
  exibirHistoriaNoContainer(storyID);
}

// [10] EXCLUIR HISTÓRIA
async function excluirHistoria(storyID) {
  if (!confirm('Confirmar exclusão?')) return;
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session.user.id;
  const { error } = await supabase
    .from('historias')
    .delete()
    .eq('id', storyID)
    .eq('user_id', userId);
  if (error) return alert('Erro ao excluir: ' + error.message);
  limparFormulario();
  mostrarHistorias();
}

// [11] CONTROLES DE FORMULÁRIO
function limparFormulario() {
  const form = document.getElementById('storyForm');
  form.reset();
  delete form.dataset.editId;
  form.querySelector('button[type="submit"]').textContent = 'Salvar';
}

// Exibir história no container
async function exibirHistoriaNoContainer(storyID) {
  const { data, error } = await supabase
    .from('historias')
    .select('*')
    .eq('id', storyID)
    .single();
  if (error || !data) return;
  removerExibicaoHistoria();
  const container = document.getElementById('storyContainer');
  const div = document.createElement('div');
  div.className = 'exibicao-historia';
  div.innerHTML = `<h3>${data.titulo}</h3><p>${data.descricao}</p>`;
  container.appendChild(div);
}

function removerExibicaoHistoria() {
  const old = document.querySelector('.exibicao-historia');
  if (old) old.remove();
}

// [12] CARTÃO: carregar e exibir formulário
async function mostrarCartaoForm(storyID) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return;
  storyIDAtual = storyID;
  userIDAtual = session.user.id;
  document.getElementById('storyContainer').style.display = 'none';
  document.getElementById('cartaoContainer').style.display = 'block';
  const { data: card } = await supabase
    .from('cartoes')
    .select('*')
    .eq('historia_id', storyID)
    .single();
  const { data: rels } = await supabase
    .from('historia_categorias')
    .select('categoria_id')
    .eq('historia_id', storyID);
  document.getElementById('titulo_cartao').value  = card?.titulo_cartao  || '';
  document.getElementById('sinopse_cartao').value = card?.sinopse_cartao || '';
  document.getElementById('data_criacao').value   = card?.data_criacao
    ? new Date(card.data_criacao).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  document.getElementById('autor_cartao').value   = card?.autor_cartao   || '';
  const selected = rels.map(r => String(r.categoria_id));
  document.querySelectorAll('input[name="categoria"]').forEach(chk => {
    chk.checked = selected.includes(chk.value);
  });
}

// [13] PUBLICAR CARTÃO
async function publicarCartao(storyID, userId) {
  if (!confirm('Aviso: conteúdo definitivo. Continuar?')) return;
  const tituloCartao = document.getElementById('titulo_cartao').value.trim();
  const sinopse     = document.getElementById('sinopse_cartao').value.trim();
  const dataCri     = document.getElementById('data_criacao').value;
  const autor       = document.getElementById('autor_cartao').value.trim();
  const catIds      = Array.from(
    document.querySelectorAll('input[name="categoria"]:checked')
  ).map(chk => Number(chk.value));
  if (!tituloCartao || !sinopse || !catIds.length)
    return alert('Preencha todos os campos e selecione pelo menos uma categoria!');
  const { error: upErr } = await supabase
    .from('cartoes')
    .upsert({ historia_id: storyID, titulo_cartao: tituloCartao, sinopse_cartao: sinopse, autor_cartao: autor, data_criacao: dataCri });
  if (upErr) return alert('Erro ao salvar cartão: ' + upErr.message);
  const { error: delErr } = await supabase
    .from('historia_categorias')
    .delete()
    .eq('historia_id', storyID);
  if (delErr) return alert('Erro ao limpar categorias antigas: ' + delErr.message);
  const inserts = catIds.map(id => ({ historia_id: storyID, categoria_id: id, user_id: userId }));
  const { error: insErr } = await supabase
    .from('historia_categorias')
    .insert(inserts);
  if (insErr) return alert('Erro ao salvar categorias: ' + insErr.message);
  showToast('Cartão e categorias publicados com sucesso!', 3000);
}

// [14] LER MAIS (modal)
async function lerMais(storyID) {
  const modal   = document.getElementById('modalOverlay');
  const tituloE = document.getElementById('modalTitulo');
  const descE   = document.getElementById('modalDescricao');
  const tCart   = document.getElementById('modalCartaoTitulo');
  const sCart   = document.getElementById('modalCartaoSinopse');
  const dCart   = document.getElementById('modalCartaoData');
  const aCart   = document.getElementById('modalCartaoAutor');
  const cCart   = document.getElementById('modalCartaoCategorias');
  const { data: hist } = await supabase
    .from('historias')
    .select('*')
    .eq('id', storyID)
    .single();
  tituloE.textContent = hist.titulo;
  descE.textContent   = hist.descricao;
  const { data: card } = await supabase
    .from('cartoes')
    .select('*')
    .eq('historia_id', storyID)
    .single();
  const { data: rels } = await supabase
    .from('historia_categorias')
    .select('categoria_id, categorias(nome)')
    .eq('historia_id', storyID);
  tCart.textContent = card?.titulo_cartao || '';
  sCart.textContent = card?.sinopse_cartao  || '';
  dCart.textContent = card?.data_criacao    || '';
  aCart.textContent = card?.autor_cartao    || '';
  cCart.textContent = rels.map(r => r.categorias.nome).join(', ');
  modal.style.display = 'flex';
}
