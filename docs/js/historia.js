import { supabase } from './supabase.js';

/*************************************************************
 * HISTORIA.JS — Versão com Supabase
 * - Remove LocalStorage
 * - Insere/atualiza/apaga dados nas tabelas Supabase
 *************************************************************/

/************************************************************
 * [1] LOGIN/LOGOUT com Supabase
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      userArea.innerHTML = `<a href=\"Criacao.html\" style=\"color:white;\"><i class=\"fas fa-user\"></i> Login</a>`;
      userArea.onclick = null;
      return;
    }
    const userId = session.user.id;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();

    const username = (!profileError && profile?.username) ? profile.username : session.user.email;
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

/************************************************************
 * [2] TOAST (Notificação)
 ************************************************************/
function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'my-toast';
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

/************************************************************
 * EVENTO DOMContentLoaded
 ************************************************************/
document.addEventListener('DOMContentLoaded', () => {
  exibirUsuarioLogado();
  mostrarHistorias();

  // Submit de história
  const storyForm = document.getElementById('storyForm');
  storyForm.addEventListener('submit', async e => {
    e.preventDefault();
    const titulo = document.getElementById('titulo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    if (!titulo || !descricao) return alert('Preencha o título e a descrição!');
    await salvarHistoria(titulo, descricao);
  });

  // Nova história
  const novaBtn = document.getElementById('novaHistoriaBtn');
  novaBtn?.addEventListener('click', () => {
    if (confirm('Tem certeza de que deseja começar uma nova história?')) {
      limparFormulario();
      removerExibicaoHistoria();
    }
  });

  // Fechar modal
  document.getElementById('closeModal')?.addEventListener('click', () => {
    document.getElementById('modalOverlay').style.display = 'none';
  });
});

/************************************************************
 * LISTA LATERAL (HOVER)
 ************************************************************/
let isTitleListVisible = false;
document.body.addEventListener('mousemove', e => {
  if (e.clientX < 50 && !isTitleListVisible) toggleTitleList(true);
});
document.body.addEventListener('mouseleave', () => {
  if (isTitleListVisible) toggleTitleList(false);
});
document.body.addEventListener('click', e => {
  const list = document.getElementById('titleListLeft');
  if (isTitleListVisible && list && !list.contains(e.target)) toggleTitleList(false);
});

function toggleTitleList(show) {
  const list = document.getElementById('titleListLeft');
  if (!list) return;
  isTitleListVisible = show;
  list.classList.toggle('visible', show);
}

/************************************************************
 * MOSTRAR HISTÓRIAS NA LISTA LATERAL
 ************************************************************/
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

/************************************************************
 * MENU DE OPÇÕES (Cartão, Editar, Excluir)
 ************************************************************/
function toggleMenuOpcoes(li, storyID) {
  const existing = li.querySelector('.menu-opcoes');
  if (existing) return existing.remove();
  const menu = document.createElement('div');
  menu.className = 'menu-opcoes';

  ['Cartão','Editar','Excluir'].forEach(action => {
    const btn = document.createElement('button');
    btn.textContent = action;
    btn.onclick = e => {
      e.stopPropagation();
      if (action === 'Cartão') mostrarCartaoForm(storyID);
      if (action === 'Editar') editarHistoria(storyID);
      if (action === 'Excluir') excluirHistoria(storyID);
      menu.remove();
    };
    menu.appendChild(btn);
  });

  li.appendChild(menu);
  menu.style.display = 'block';
}

/************************************************************
 * SALVAR / EDITAR HISTÓRIA
 ************************************************************/
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
    if (error) return alert('Erro ao atualizar história: ' + error.message);
    alert('História atualizada!');
    await exibirHistoriaNoContainer(editId);
  } else {
    const { error } = await supabase
      .from('historias')
      .insert([{ titulo, descricao, user_id: userId, data_criacao: new Date().toISOString() }]);
    if (error) return alert('Erro ao salvar história: ' + error.message);
    alert('História salva!');
    limparFormulario();
    removerExibicaoHistoria();
  }

  await mostrarHistorias();
}

/************************************************************
 * EDITAR HISTÓRIA
 ************************************************************/
async function editarHistoria(storyID) {
  const { data, error } = await supabase
    .from('historias')
    .select('*')
    .eq('id', storyID)
    .single();
  if (error || !data) return console.error('Erro ao abrir história:', error);

  document.getElementById('titulo').value = data.titulo;
  document.getElementById('descricao').value = data.descricao;
  const form = document.getElementById('storyForm');
  form.dataset.editId = data.id;
  form.querySelector('button[type="submit"]').textContent = 'Atualizar';

  await exibirHistoriaNoContainer(data.id);
}

/************************************************************
 * EXCLUIR HISTÓRIA
 ************************************************************/
async function excluirHistoria(storyID) {
  if (!confirm('Deseja excluir a história?')) return;
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session.user.id;
  const { error } = await supabase
    .from('historias')
    .delete()
    .eq('id', storyID)
    .eq('user_id', userId);
  if (error) return alert('Erro ao apagar história: ' + error.message);

  alert('História excluída.');
  limparFormulario();
  removerExibicaoHistoria();
  await mostrarHistorias();
}

/************************************************************
 * CONTROLES DE FORMULÁRIO
 ************************************************************/
function limparFormulario() {
  const form = document.getElementById('storyForm');
  form.reset();
  delete form.dataset.editId;
  form.querySelector('button[type="submit"]').textContent = 'Salvar';
}

async function exibirHistoriaNoContainer(storyID) {
  const { data, error } = await supabase
    .from('historias')
    .select('*')
    .eq('id', storyID)
    .single();
  if (error || !data) return console.error('Erro ao exibir história:', error);

  const container = document.getElementById('storyContainer');
  removerExibicaoHistoria();

  const div = document.createElement('div');
  div.className = 'exibicao-historia';
  div.style.border = '1px solid #ccc';
  div.style.marginTop = '10px';
  div.style.padding = '10px';

  const h3 = document.createElement('h3'); h3.textContent = data.titulo || '(sem título)';
  const p  = document.createElement('p'); p.textContent = data.descricao || '';
  div.append(h3, p);
  container.appendChild(div);
}

function removerExibicaoHistoria() {
  const container = document.getElementById('storyContainer');
  const old = container.querySelector('.exibicao-historia');
  old && old.remove();
}

/************************************************************
 * CARTÃO (Supabase)
 ************************************************************/
async function mostrarCartaoForm(storyID) {
  const storyArea  = document.getElementById('storyContainer');
  const cartaoArea = document.getElementById('cartaoContainer');
  storyArea.style.display  = 'none';
  cartaoArea.style.display = 'block';

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session.user.id;

  const { data: card } = await supabase
    .from('cartoes')
    .select('*')
    .eq('historia_id', storyID)
    .single();
  const { data: rels = [] } = await supabase
    .from('historia_categorias')
    .select('categoria_id')
    .eq('historia_id', storyID);

  // Preenche campos
  document.getElementById('titulo_cartao').value   = card?.titulo_cartao || '';
  document.getElementById('sinopse_cartao').value = card?.sinopse_cartao  || '';
  document.getElementById('data_criacao').value   = card?.data_criacao    ? new Date(card.data_criacao).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  document.getElementById('autor_cartao').value   = card?.autor_cartao    || '';

  const selected = rels.map(r => String(r.categoria_id));
  document.querySelectorAll('input[name="categoria"]').forEach(chk => {
    chk.checked = selected.includes(chk.value);
  });

  document.getElementById('btnPublicarCartao').onclick = () => publicarCartao(storyID, userId);
  document.getElementById('btnLerMais').onclick       = () => lerMais(storyID);
  document.getElementById('btnVoltar').onclick        = () => {
    cartaoArea.style.display  = 'none';
    storyArea.style.display   = 'block';
  };
}

async function publicarCartao(storyID, userId) {
  if (!confirm('Aviso: Ao publicar o cartão, o conteúdo fica definitivo. Continuar?')) return;

  const tituloCartao = document.getElementById('titulo_cartao').value.trim();
  const sinopse      = document.getElementById('sinopse_cartao').value.trim();
  const dataCri      = document.getElementById('data_criacao').value;
  const autor        = document.getElementById('autor_cartao').value.trim();
  const nomesCat     = Array.from(document.querySelectorAll('input[name="categoria"]:checked')).map(chk => chk.value);

  if (!tituloCartao || !sinopse || !nomesCat.length) {
    return alert('Preencha todos os campos e selecione pelo menos uma categoria!');
  }

  const { data: cats } = await supabase
    .from('categorias')
    .select('id')
    .in('nome', nomesCat);
  const catIds = cats.map(c => c.id);

  await supabase.from('cartoes').upsert({ historia_id: storyID, titulo_cartao: tituloCartao, sinopse_cartao: sinopse, autor_cartao: autor, data_criacao: dataCri });

  await supabase.from('historia_categorias').delete().eq('historia_id', storyID);
  const inserts = catIds.map(id => ({ historia_id: storyID, categoria_id: id, user_id: userId }));
  await supabase.from('historia_categorias').insert(inserts);

  alert('Cartão publicado com sucesso!');
}

/************************************************************
 * LER MAIS (modal)
 ************************************************************/
async function lerMais(storyID) {
  const modal   = document.getElementById('modalOverlay');
  const tituloE = document.getElementById('modalTitulo');
  const descE   = document.getElementById('modalDescricao');
  const tCart   = document.getElementById('modalCartaoTitulo');
  const sCart   = document.getElementById('modalCartaoSinopse');
  const dCart   = document.getElementById('modalCartaoData');
  const aCart   = document.getElementById('modalCartaoAutor');
  const cCart   = document.getElementById('modalCartaoCategorias');

  const { data: hist } = await supabase.from('historias').select('*').eq('id', storyID).single();
  tituloE.textContent = hist.titulo;
  descE.textContent   = hist.descricao;

  const { data: card } = await supabase.from('cartoes').select('*').eq('historia_id', storyID).single();
  const { data: rels } = await supabase.from('historia_categorias').select('categoria_id, categorias(nome)').eq('historia_id', storyID);

  tCart.textContent   = card?.titulo_cartao || '';
  sCart.textContent   = card?.sinopse_cartao  || '';
  dCart.textContent   = card?.data_criacao    || '';
  aCart.textContent   = card?.autor_cartao    || '';
  cCart.textContent   = rels.map(r => r.categorias.nome).join(', ');

  modal.style.display = 'flex';
}
