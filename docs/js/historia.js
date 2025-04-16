import { supabase } from './supabase.js';

/*************************************************************
 * HISTORIA.JS — Versão com Supabase
 * - Remove LocalStorage
 * - Insere/atualiza/apaga dados nas tabelas Supabase
 *************************************************************/

/************************************************************
 * [1] LOGIN/LOGOUT com Supabase (mantido)
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      userArea.innerHTML = `<a href="Criacao.html" style="color:white;"><i class="fas fa-user"></i> Login</a>`;
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

/************************************************************
 * [2] TOAST (Notificação)
 ************************************************************/
function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'my-toast';
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, duration);
}

/************************************************************
 * EVENTO DOMContentLoaded
 ************************************************************/
document.addEventListener('DOMContentLoaded', function() {
  exibirUsuarioLogado();
  mostrarHistorias();

  const storyForm = document.getElementById('storyForm');
  storyForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const titulo = document.getElementById('titulo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    if (!titulo || !descricao) {
      alert('Preencha o título e a descrição!');
      return;
    }
    await salvarHistoria(titulo, descricao);
  });

  const novaHistoriaBtn = document.getElementById('novaHistoriaBtn');
  if (novaHistoriaBtn) novaHistoriaBtn.addEventListener('click', function() {
    if (confirm('Tem certeza de que deseja começar uma nova história?')) {
      limparFormulario();
      removerExibicaoHistoria();
    }
  });
});

/************************************************************
 * MOSTRAR HISTÓRIAS NA LISTA LATERAL
 ************************************************************/
async function mostrarHistorias() {
  const ul = document.getElementById('titleListUl');
  if (!ul) return;
  ul.innerHTML = '';

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return;

  const { data: historias, error } = await supabase
    .from('historias')
    .select('id, titulo')
    .eq('user_id', userId)
    .order('data_criacao', { ascending: false });
  if (error) {
    console.error('Erro ao carregar histórias:', error);
    return;
  }

  historias.forEach(h => {
    const li = document.createElement('li');
    li.textContent = h.titulo || '(sem título)';
    li.dataset.id = h.id;
    li.addEventListener('click', e => { e.stopPropagation(); toggleMenuOpcoes(li, h.id); });
    ul.appendChild(li);
  });
}

function toggleMenuOpcoes(li, storyID) {
  const existing = li.querySelector('.menu-opcoes');
  if (existing) return existing.remove();
  const menu = document.createElement('div'); menu.classList.add('menu-opcoes');

  const btnCartao = document.createElement('button'); btnCartao.textContent = 'Cartão';
  btnCartao.onclick = e => { e.stopPropagation(); mostrarCartaoForm(storyID); menu.remove(); };

  const btnEdit = document.createElement('button'); btnEdit.textContent = 'Editar';
  btnEdit.onclick = e => { e.stopPropagation(); editarHistoria(storyID); menu.remove(); };

  const btnDel = document.createElement('button'); btnDel.textContent = 'Excluir';
  btnDel.onclick = e => { e.stopPropagation(); excluirHistoria(storyID); menu.remove(); };

  [btnCartao, btnEdit, btnDel].forEach(b => menu.appendChild(b));
  li.appendChild(menu);
  menu.style.display = 'block';
}

/************************************************************
 * SALVAR / EDITAR HISTÓRIA
 ************************************************************/
async function salvarHistoria(titulo, descricao) {
  const form = document.getElementById('storyForm');
  const editID = form.dataset.editId;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session.user.id;

  if (editID) {
    const { error } = await supabase
      .from('historias')
      .update({ titulo, descricao })
      .eq('id', editID)
      .eq('user_id', userId);
    if (error) return alert('Erro ao atualizar história: ' + error.message);
    alert('História atualizada!');
    await exibirHistoriaNoContainer(editID);
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
 * EDITAR HISTÓRIA (preenche formulário + exibe no container)
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
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session.user.id;

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

function limparFormulario() {
  const form = document.getElementById('storyForm');
  form.reset();
  form.dataset.editId = '';
  form.querySelector('button[type="submit"]').textContent = 'Salvar';
}

/************************************************************
 * EXIBIR HISTÓRIA NO CONTAINER
 ************************************************************/
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
  div.classList.add('exibicao-historia');
  div.style.border = '1px solid #ccc';
  div.style.marginTop = '10px';
  div.style.padding = '10px';

  const h3 = document.createElement('h3');
  h3.textContent = data.titulo || '(sem título)';
  const p = document.createElement('p');
  p.textContent = data.descricao || '';

  div.append(h3, p);
  container.appendChild(div);
}

function removerExibicaoHistoria() {
  const container = document.getElementById('storyContainer');
  const old = container.querySelector('.exibicao-historia');
  if (old) old.remove();
}

/************************************************************
 * CARTÃO (Supabase)
 ************************************************************/
async function mostrarCartaoForm(storyID) {
  const storyArea = document.getElementById('storyContainer');
  const cartaoArea = document.getElementById('cartaoContainer');
  storyArea.style.display = 'none';
  cartaoArea.style.display = 'block';

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session.user.id;

  // Carrega cartão
  const { data: card, error: cardErr } = await supabase
    .from('cartoes')
    .select('*')
    .eq('historia_id', storyID)
    .single();
  // Carrega categorias existentes
  const { data: rels, error: relErr } = await supabase
    .from('historia_categorias')
    .select('categoria_id')
    .eq('historia_id', storyID);

  // Preenchimento
  document.getElementById('cartaoTitulo').value = card?.titulo_cartao || '';
  document.getElementById('cartaoSinopse').value = card?.sinopse_cartao || '';
  document.getElementById('cartaoData').value = card?.data_criacao
    ? new Date(card.data_criacao).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  document.getElementById('cartaoAutor').value = card?.autor_cartao || '';

  const selected = rels?.map(r => String(r.categoria_id)) || [];
  document.querySelectorAll('input[name="categoria"]').forEach(chk => {
    chk.checked = selected.includes(chk.value);
    const subDiv = document.getElementById('sub' + chk.value);
    if (chk.checked && subDiv) subDiv.style.display = 'block';
    else if (subDiv) subDiv.style.display = 'none';
  });

  document.getElementById('btnPublicarCartao').onclick = () => publicarCartao(storyID, userId);
  document.getElementById('btnLerMais').onclick = () => lerMais(storyID);
  document.getElementById('btnVoltar').onclick = () => {
    cartaoArea.style.display = 'none';
    storyArea.style.display = 'block';
  };
}

async function publicarCartao(storyID, userId) {
  if (!confirm('Aviso: Ao publicar o cartão, o conteúdo fica definitivo. Continuar?'))
    return;

  const tituloCartao = document.getElementById('cartaoTitulo').value.trim();
  const sinopse = document.getElementById('cartaoSinopse').value.trim();
  const dataCri = document.getElementById('cartaoData').value;
  const autor = document.getElementById('cartaoAutor').value.trim();
  const categorias = Array.from(document.querySelectorAll('input[name="categoria"]:checked'))
    .map(chk => chk.value);

  if (!tituloCartao || !sinopse || categorias.length === 0) {
    alert('Preencha todos os campos e selecione pelo menos uma categoria!');
    return;
  }

  // Upsert cartão
  const { error: upErr } = await supabase
    .from('cartoes')
    .upsert({ historia_id: storyID, titulo_cartao: tituloCartao, sinopse_cartao: sinopse, autor_cartao: autor, data_criacao: dataCri });
  if (upErr) return alert('Erro ao publicar cartão: ' + upErr.message);

  // Atualizar relação de categorias
  await supabase
    .from('historia_categorias')
    .delete()
    .eq('historia_id', storyID);
  const inserts = categorias.map(cid => ({ historia_id: storyID, categoria_id: cid, user_id: userId }));
  const { error: catErr } = await supabase
    .from('historia_categorias')
    .insert(inserts);
  if (catErr) return alert('Erro ao salvar categorias: ' + catErr.message);

  alert('Cartão publicado com sucesso!');
}

/************************************************************
 * LER MAIS (modal)
 ************************************************************/
async function lerMais(storyID) {
  const modal = document.getElementById('modalOverlay');
  const tituloEl = document.getElementById('modalTitulo');
  const descEl = document.getElementById('modalDescricao');
  const tCartao = document.getElementById('modalCartaoTitulo');
  const sCartao = document.getElementById('modalCartaoSinopse');
  const dCartao = document.getElementById('modalCartaoData');
  const aCartao = document.getElementById('modalCartaoAutor');
  const cCartao = document.getElementById('modalCartaoCategorias');

  // Busca história
  const { data: hist } = await supabase
    .from('historias').select('*').eq('id', storyID).single();
  tituloEl.textContent = hist.titulo;
  descEl.textContent = hist.descricao;

  // Busca cartão e categorias
  const { data: card } = await supabase
    .from('cartoes').select('*').eq('historia_id', storyID).single();
  const { data: rels } = await supabase
    .from('historia_categorias')
    .select('categoria_id, categorias(nome)')
    .eq('historia_id', storyID);

  tCartao.textContent = card?.titulo_cartao || '';
  sCartao.textContent = card?.sinopse_cartao || '';
  dCartao.textContent = card?.data_criacao || '';
  aCartao.textContent = card?.autor_cartao || '';
  const names = rels?.map(r => r.categorias.nome) || [];
  cCartao.textContent = names.join(', ');

  modal.style.display = 'flex';
}

