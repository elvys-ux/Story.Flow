import { supabase } from './supabase.js';

// Controle de visibilidade da lista lateral
let isTitleListVisible = false;

document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await carregarCategorias();
  await mostrarHistorias();

  // Submissão do formulário de história
  const form = document.getElementById('storyForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const titulo = document.getElementById('titulo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    if (!titulo || !descricao) {
      alert('Preencha o título e a descrição!');
      return;
    }
    await salvarHistoria(titulo, descricao);
  });

  // Botão Nova História
  document.getElementById('novaHistoriaBtn')?.addEventListener('click', () => {
    if (confirm('Tem certeza de que deseja começar uma nova história?')) {
      limparFormulario();
      removerExibicaoHistoria();
    }
  });

  // Fechar modal
  document.getElementById('closeModal')?.addEventListener('click', () => {
    document.getElementById('modalOverlay').style.display = 'none';
  });
  document.getElementById('modalOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'modalOverlay') {
      document.getElementById('modalOverlay').style.display = 'none';
    }
  });

  // Exibir/ocultar lista lateral ao passar o mouse
  document.body.addEventListener('mousemove', e => { if (e.clientX < 50) toggleTitleList(true); });
  document.body.addEventListener('mouseleave', () => toggleTitleList(false));
  document.addEventListener('click', e => {
    const list = document.getElementById('titleListLeft');
    if (isTitleListVisible && list && !list.contains(e.target)) {
      toggleTitleList(false);
    }
  });

  // Visibilidade inicial dos containers
  document.getElementById('cartaoContainer').style.display = 'none';
  document.getElementById('modalOverlay').style.display = 'none';
});

// Carrega categorias e insere nos formulários de história e cartão
async function carregarCategorias() {
  const { data: categorias, error } = await supabase.from('categorias').select('id, nome');
  if (error) {
    console.error('Erro ao carregar categorias:', error);
    return;
  }

  const selectors = ['#categorias', '.categorias'];
  selectors.forEach(sel => {
    const container = document.querySelector(sel);
    if (!container) return;
    container.innerHTML = '';

    categorias.forEach(cat => {
      const wrapper = document.createElement('div');
      wrapper.classList.add('categoria-wrapper');

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.name = 'categoria';
      chk.value = cat.id;
      chk.id = `categoria_${cat.id}`;
      chk.classList.add('categoria');

      const lbl = document.createElement('label');
      lbl.htmlFor = chk.id;
      lbl.textContent = cat.nome;

      wrapper.append(chk, lbl);
      container.appendChild(wrapper);
    });
  });
}

// Alterna visibilidade da lista lateral
function toggleTitleList(show) {
  const list = document.getElementById('titleListLeft');
  if (!list) return;
  list.classList.toggle('visible', show);
  isTitleListVisible = show;
}

// Exibe títulos de histórias cadastradas
async function mostrarHistorias() {
  const { data: historias, error } = await supabase
    .from('historias')
    .select('id, titulo')
    .order('data_criacao', { ascending: false });
  if (error) {
    console.error('Erro ao buscar histórias:', error);
    return;
  }

  const ul = document.getElementById('titleListUl');
  ul.innerHTML = '';

  historias.forEach(h => {
    const li = document.createElement('li');
    li.textContent = h.titulo || '(sem título)';
    li.dataset.id = h.id;
    li.addEventListener('click', e => {
      e.stopPropagation();
      toggleMenuOpcoes(li, h.id);
    });
    ul.appendChild(li);
  });
}

// Menu de opções ao clicar no título
function toggleMenuOpcoes(li, id) {
  const existing = li.querySelector('.menu-opcoes');
  if (existing) {
    existing.remove();
    return;
  }

  const menu = document.createElement('div');
  menu.classList.add('menu-opcoes');

  ['Cartão', 'Editar', 'Excluir'].forEach(text => {
    const btn = document.createElement('button');
    btn.textContent = text;
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

// Salva ou atualiza história
async function salvarHistoria(titulo, descricao) {
  const form = document.getElementById('storyForm');
  const editId = form.dataset.editId;

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    alert('Faça login para salvar.');
    return;
  }

  const selecionadas = Array.from(
    document.querySelectorAll('input[name="categoria"]:checked')
  ).map(c => Number(c.value));

  if (editId) {
    const { error: upErr } = await supabase.from('historias')
      .update({ titulo, descricao })
      .eq('id', editId);
    if (upErr) {
      alert('Erro ao atualizar história.');
      return;
    }

    // Atualiza categorias
    await supabase.from('historia_categorias').delete().eq('historia_id', editId);
    if (selecionadas.length) {
      const assoc = selecionadas.map(catId => ({ historia_id: Number(editId), categoria_id: catId, user_id: user.id }));
      await supabase.from('historia_categorias').insert(assoc);
    }

    alert('História atualizada com sucesso!');
    exibirHistoriaNoContainer(editId);
  } else {
    const { data: [newH], error: insErr } = await supabase.from('historias')
      .insert([{ titulo, descricao, user_id: user.id }])
      .select('id');
    if (insErr) {
      alert('Erro ao salvar história.');
      return;
    }

    const newId = newH.id;
    if (selecionadas.length) {
      const assoc = selecionadas.map(catId => ({ historia_id: newId, categoria_id: catId, user_id: user.id }));
      await supabase.from('historia_categorias').insert(assoc);
    }

    alert('História salva com sucesso!');
    removerExibicaoHistoria();
  }

  limparFormulario();
  await mostrarHistorias();
}

// Remove exibição de história no container
function removerExibicaoHistoria() {
  const container = document.getElementById('storyContainer');
  container.querySelectorAll('.exibicao-historia').forEach(el => el.remove());
}

// Carrega dados da história para edição
async function editarHistoria(id) {
  const { data: h, error } = await supabase.from('historias')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    console.error('Erro ao carregar história:', error);
    return;
  }

  document.getElementById('titulo').value = h.titulo;
  document.getElementById('descricao').value = h.descricao;
  const form = document.getElementById('storyForm');
  form.dataset.editId = h.id;
  form.querySelector('button[type="submit"]').textContent = 'Atualizar';
  exibirHistoriaNoContainer(id);
}

// Exclui história e dados relacionados
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

// Limpa campos do formulário de história
function limparFormulario() {
  document.getElementById('titulo').value = '';
  document.getElementById('descricao').value = '';
  const form = document.getElementById('storyForm');
  delete form.dataset.editId;
  form.querySelector('button[type="submit"]').textContent = 'Salvar';
}

// Exibe prévia da história no container
async function exibirHistoriaNoContainer(id) {
  const { data: h, error } = await supabase.from('historias')
    .select('titulo, descricao')
    .eq('id', id)
    .single();
  if (error) {
    console.error('Erro ao exibir história:', error);
    return;
  }

  const container = document.getElementById('storyContainer');
  container.querySelectorAll('.exibicao-historia').forEach(el => el.remove());

  const div = document.createElement('div');
  div.classList.add('exibicao-historia');
  div.style.border = '1px solid #ccc';
  div.style.marginTop = '10px';
  div.style.padding = '10px';
  div.innerHTML = `<h3>${h.titulo}</h3><p>${h.descricao}</p>`;

  container.appendChild(div);
}

// Exibe usuário logado ou link de login
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  area.innerHTML = '';

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Erro ao obter usuário:', error);
    return;
  }

  if (user) {
    const { data: profile, error: pErr } = await supabase.from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    if (pErr) console.error(pErr);

    area.textContent = profile.username;
    area.onclick = async () => {
      if (confirm('Deseja fazer logout?')) {
        await supabase.auth.signOut();
        location.reload();
      }
    };
  } else {
    area.innerHTML = `<a href="Criacao.html" style="color:white;"><i class="fas fa-user"></i> Login</a>`;
  }
}

// Exibe formulário de cartão e dados existentes
async function mostrarCartaoForm(id) {
  document.getElementById('storyContainer').style.display = 'none';
  document.getElementById('cartaoContainer').style.display = 'block';

  const { data: h, error } = await supabase.from('historias')
    .select('*, cartoes(*)')
    .eq('id', id)
    .single();
  if (error) {
    console.error('Erro ao carregar cartão:', error);
    return;
  }

  const cart = h.cartoes?.[0] || {};
  document.getElementById('titulo_cartao').value = cart.titulo_cartao || '';
  document.getElementById('sinopse_cartao').value = cart.sinopse_cartao || '';
  document.getElementById('data_criacao').value = cart.data_criacao
    ? cart.data_criacao.split('T')[0]
    : new Date().toISOString().split('T')[0];
  document.getElementById('autor_cartao').value = cart.autor_cartao || '';

  const { data: cats, error: cErr } = await supabase.from('historia_categorias')
    .select('categoria_id')
    .eq('historia_id', id);
  if (!cErr) {
    document.querySelectorAll('input[name="categoria"]').forEach(chk => chk.checked = false);
    cats.forEach(c => {
      const chk = document.querySelector(`input[value="${c.categoria_id}"]`);
      if (chk) chk.checked = true;
    });
  }

  document.getElementById('btnPublicarCartao').onclick = () => publicarCartao(id);
  document.getElementById('btnLerMais').onclick = () => lerMais(id);
  document.getElementById('btnVoltar').onclick = () => {
    document.getElementById('cartaoContainer').style.display = 'none';
    document.getElementById('storyContainer').style.display = 'block';
  };
}

// Publica ou atualiza cartão, com upsert
async function publicarCartao(id) {
  if (!confirm('Aviso: Ao publicar o cartão, o conteúdo fica definitivo. Continuar?')) return;

  const titulo = document.getElementById('titulo_cartao').value.trim();
  const sinopse = document.getElementById('sinopse_cartao').value.trim();
  const dataCriacao = document.getElementById('data_criacao').value.trim();
  const autor = document.getElementById('autor_cartao').value.trim();
  const selecionadas = Array.from(
    document.querySelectorAll('input[name="categoria"]:checked')
  ).map(c => Number(c.value));

  if (!titulo || !sinopse || selecionadas.length === 0) {
    alert('Preencha título, sinopse e selecione ao menos uma categoria.');
    return;
  }

  await supabase.from('cartoes').upsert({
    historia_id: id,
    titulo_cartao: titulo,
    sinopse_cartao: sinopse,
    autor_cartao: autor,
    data_criacao: dataCriacao
  });

  // Atualiza categorias do cartão (mesma tabela de categorias de história)
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('historia_categorias').delete().eq('historia_id', id);
  const assoc = selecionadas.map(catId => ({ historia_id: id, categoria_id: catId, user_id: user.id }));
  await supabase.from('historia_categorias').insert(assoc);

  alert('Cartão publicado com sucesso!');
}

// Abre modal com detalhes completos
async function lerMais(id) {
  document.getElementById('modalOverlay').style.display = 'flex';
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
    document.getElementById('modalCartaoCategorias').textContent = cats
      .map(x => x.categoria_id).join(', ');
  }
}
