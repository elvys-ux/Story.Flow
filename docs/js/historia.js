/*************************************************************
 * HISTORIA.JS
 * - Integração com Supabase para salvar histórias, categorias e cartões
 * - Campos alinhados ao HTML e ao banco (snake_case)
 * - Carrega categorias dinamicamente na criação de cartão
 *************************************************************/

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://<sua-instancia>.supabase.co';
const SUPABASE_KEY = '<sua-anon-key>';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Estado da lista lateral
let isTitleListVisible = false;

/*************************************************************
 * INICIALIZAÇÃO
 *************************************************************/
document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await carregarCategorias();
  await mostrarHistorias();

  // Form história
  const form = document.getElementById('storyForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const titulo = document.getElementById('titulo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    if (!titulo || !descricao) {
      return alert('Preencha o título e a descrição!');
    }
    await salvarHistoria(titulo, descricao);
  });

  // Botões
  document.getElementById('novaHistoriaBtn')?.addEventListener('click', () => {
    if (confirm('Tem certeza de que deseja começar uma nova história?')) {
      limparFormulario();
      removerExibicaoHistoria();
    }
  });
  document.getElementById('closeModal')?.addEventListener('click', () => {
    document.getElementById('modalOverlay').style.display = 'none';
  });
  document.getElementById('modalOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'modalOverlay') {
      document.getElementById('modalOverlay').style.display = 'none';
    }
  });

  // Hover lateral
  document.body.addEventListener('mousemove', e => { if (e.clientX < 50) toggleTitleList(true); });
  document.body.addEventListener('mouseleave', () => toggleTitleList(false));
  document.addEventListener('click', e => {
    const list = document.getElementById('titleListLeft');
    if (isTitleListVisible && list && !list.contains(e.target)) toggleTitleList(false);
  });
});

/*************************************************************
 * CATEGORIAS
 *************************************************************/
async function carregarCategorias() {
  const { data: categorias, error } = await supabase.from('categorias').select('id, nome');
  if (error) { console.error(error); return; }
  const container = document.getElementById('categorias');
  container.innerHTML = '';
  categorias.forEach(cat => {
    const wrapper = document.createElement('div'); wrapper.classList.add('categoria-wrapper');
    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.name = 'categoria'; chk.value = cat.id;
    chk.id = 'categoria_' + cat.id; chk.classList.add('categoria');
    const lbl = document.createElement('label');
    lbl.htmlFor = chk.id; lbl.textContent = cat.nome;
    wrapper.append(chk, lbl);
    container.appendChild(wrapper);
  });
}

/*************************************************************
 * LISTA LATERAL
 *************************************************************/
function toggleTitleList(show) {
  const list = document.getElementById('titleListLeft');
  if (!list) return;
  list.classList.toggle('visible', show);
  isTitleListVisible = show;
}

async function mostrarHistorias() {
  const { data: historias, error } = await supabase
    .from('historias')
    .select('id, titulo')
    .order('data_criacao', { ascending: false });
  if (error) { console.error(error); return; }
  const ul = document.getElementById('titleListUl');
  ul.innerHTML = '';
  historias.forEach(h => {
    const li = document.createElement('li');
    li.textContent = h.titulo || '(sem título)';
    li.dataset.id = h.id;
    li.addEventListener('click', e => { e.stopPropagation(); toggleMenuOpcoes(li, h.id); });
    ul.appendChild(li);
  });
}

function toggleMenuOpcoes(li, id) {
  const existing = li.querySelector('.menu-opcoes');
  if (existing) return existing.remove();
  const menu = document.createElement('div'); menu.classList.add('menu-opcoes');
  ['Cartão','Editar','Excluir'].forEach(text => {
    const btn = document.createElement('button'); btn.textContent = text;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (text === 'Cartão') mostrarCartaoForm(id);
      if (text === 'Editar') editarHistoria(id);
      if (text === 'Excluir') excluirHistoria(id);
      menu.remove();
    });
    menu.appendChild(btn);
  });
  li.appendChild(menu);
}

/*************************************************************
 * CRUD HISTÓRIAS
 *************************************************************/
async function salvarHistoria(titulo, descricao) {
  const form = document.getElementById('storyForm');
  const editId = form.dataset.editId;
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return alert('Faça login para salvar.');

  const categorias = Array.from(document.querySelectorAll('input[name="categoria"]:checked'))
    .map(c => Number(c.value));

  if (editId) {
    // Atualização história
    let { error } = await supabase.from('historias')
      .update({ titulo, descricao })
      .eq('id', editId);
    if (error) { console.error(error); return; }
    // Refresh categorias
    await supabase.from('historia_categorias').delete().eq('historia_id', editId);
    if (categorias.length) {
      ({ error } = await supabase.from('historia_categorias')
        .insert(categorias.map(catId => ({ historia_id: editId, categoria_id: catId }))));
      if (error) console.error(error);
    }
    alert('História atualizada com sucesso!');
    exibirHistoriaNoContainer(editId);
  } else {
    // Inserção história
    const { data: [newH], error } = await supabase.from('historias')
      .insert([{ titulo, descricao, user_id: user.id, data_criacao: new Date().toISOString() }])
      .select('id');
    if (error) { console.error(error); return; }
    const newId = newH.id;
    if (categorias.length) {
      const { error: catErr } = await supabase.from('historia_categorias')
        .insert(categorias.map(catId => ({ historia_id: newId, categoria_id: catId })));
      if (catErr) console.error(catErr);
    }
    alert('História salva com sucesso!');
    removerExibicaoHistoria();
  }

  limparFormulario();
  await mostrarHistorias();
}

async function editarHistoria(id) {
  const { data: h, error } = await supabase.from('historias').select('*').eq('id', id).single();
  if (error) { console.error(error); return; }
  document.getElementById('titulo').value = h.titulo;
  document.getElementById('descricao').value = h.descricao;
  document.getElementById('storyForm').dataset.editId = h.id;
  document.querySelector('#storyForm button[type=submit]').textContent = 'Atualizar';
  exibirHistoriaNoContainer(id);
}

async function excluirHistoria(id) {
  if (!confirm('Deseja excluir a história?')) return;
  await supabase.from('historia_categorias').delete().eq('historia_id', id);
  await supabase.from('cartoes').delete().eq('historia_id', id);
  await supabase.from('historias').delete().eq('id', id);
  alert('História excluída.');
  limparFormulario();
  removerExibicaoHistoria();
  await mostrarHistorias();
}

function limparFormulario() {
  document.getElementById('titulo').value = '';
  document.getElementById('descricao').value = '';
  const form = document.getElementById('storyForm'); delete form.dataset.editId;
  document.querySelector('#storyForm button[type=submit]').textContent = 'Salvar';
}

async function exibirHistoriaNoContainer(id) {
  const { data: h, error } = await supabase.from('historias').select('titulo, descricao').eq('id', id).single();
  if (error) { console.error(error); return; }
  const container = document.getElementById('storyContainer');
  container.querySelectorAll('.exibicao-historia').forEach(e => e.remove());
  const div = document.createElement('div'); div.classList.add('exibicao-historia');
  div.style.border = '1px solid #ccc'; div.style.marginTop = '10px'; div.style.padding = '10px';
  div.innerHTML = `<h3>${h.titulo}</h3><p>${h.descricao}</p>`;
  container.appendChild(div);
}

/*************************************************************
 * USUÁRIO
 *************************************************************/
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea'); area.innerHTML = '';
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
    area.textContent = profile.username;
    area.onclick = async () => { if (confirm('Deseja fazer logout?')) await supabase.auth.signOut().then(() => location.reload()); };
  } else {
    area.innerHTML = `<a href="Criacao.html" style="color:white;"><i class="fas fa-user"></i> Login</a>`;
  }
}

/*************************************************************
 * CARTÃO
 *************************************************************/
async function mostrarCartaoForm(id) {
  document.getElementById('storyContainer').style.display = 'none';
  document.getElementById('cartaoContainer').style.display = 'block';
  const { data: h, error } = await supabase.from('historias').select('*, cartoes(*)').eq('id', id).single();
  if (error) { console.error(error); return; }
  const cart = h.cartoes?.[0] || {};

  document.getElementById('titulo_cartao').value = cart.titulo_cartao || '';
  document.getElementById('sinopse_cartao').value = cart.sinopse_cartao || '';
  document.getElementById('data_criacao').value = cart.data_criacao ? cart.data_criacao.split('T')[0] : new Date().toISOString().split('T')[0];
  document.getElementById('autor_cartao').value = cart.autor_cartao || '';

  const { data: cats } = await supabase.from('historia_categorias').select('categoria_id').eq('historia_id', id);
  document.querySelectorAll('input[name="categoria"]').forEach(chk => chk.checked = false);
  cats.forEach(c => {
    const chk = document.querySelector(`input[value="${c.categoria_id}"]`);
    if (chk) chk.checked = true;
  });

  document.getElementById('btnPublicarCartao').onclick = () => publicarCartao(id);
  document.getElementById('btnLerMais').onclick = () => lerMais(id);
  document.getElementById('btnVoltar').onclick = () => {
    document.getElementById('cartaoContainer').style.display = 'none';
    document.getElementById('storyContainer').style.display = 'block';
  };
}

async function publicarCartao(id) {
  if (!confirm('Aviso: Ao publicar o cartão, o conteúdo fica definitivo. Continuar?')) return;
  const titulo = document.getElementById('titulo_cartao').value.trim();
  const sinopse = document.getElementById('sinopse_cartao').value.trim();
  const dataCriacao = document.getElementById('data_criacao').value.trim();
  const autor = document.getElementById('autor_cartao').value.trim();
  const categorias = Array.from(document.querySelectorAll('input[name="categoria"]:checked')).map(c => Number(c.value));
  if (!titulo || !sinopse || categorias.length === 0) {
    return alert('Preencha título, sinopse e selecione ao menos uma categoria.');
  }

  // Upsert cartão
  const { data: existing } = await supabase.from('cartoes').select('id').eq('historia_id', id).single();
  const payload = { historia_id: id, titulo_cartao: titulo, sinopse_cartao: sinopse, autor_cartao: autor, data_criacao: dataCriacao };
  if (existing) await supabase.from('cartoes').update(payload).eq('id', existing.id);
  else await supabase.from('cartoes').insert([payload]);

  // Atualiza categorias no cartão
  await supabase.from('historia_categorias').delete().eq('historia_id', id);
  await supabase.from('historia_categorias').insert(
    categorias.map(catId => ({ historia_id: id, categoria_id: catId }))
  );

  alert('Cartão publicado com sucesso!');
}

async function lerMais(id) {
  const overlay = document.getElementById('modalOverlay'); overlay.style.display = 'flex';
  const { data: h } = await supabase.from('historias').select('titulo, descricao').eq('id', id).single();
  document.getElementById('modalTitulo').textContent = h.titulo;
  document.getElementById('modalDescricao').textContent = h.descricao;
  const { data: c } = await supabase.from('cartoes').select('*').eq('historia_id', id).single();
  if (c) {
    document.getElementById('modalCartaoTitulo').textContent = c.titulo_cartao;
    document.getElementById('modalCartaoSinopse').textContent = c.sinopse_cartao;
    document.getElementById('modalCartaoData').textContent = c.data_criacao;
    document.getElementById('modalCartaoAutor').textContent = c.autor_cartao;
    const { data: cats } = await supabase.from('historia_categorias')
      .select('categoria_id').eq('historia_id', id);
    document.getElementById('modalCartaoCategorias').textContent = cats.map(x => x.categoria_id).join(', ');
  }
}
