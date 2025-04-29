import { supabase } from './supabase.js';

// controle de hover na lista lateral
let isTitleListVisible = false;

document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await carregarCategorias();
  await mostrarHistorias();

  // Submissão do formulário de criação/edição de história
  document.getElementById('storyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const titulo    = document.getElementById('titulo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    if (!titulo || !descricao) {
      return alert('Preencha o título e a descrição!');
    }
    await salvarHistoria(titulo, descricao);
  });

  // Botão "Nova História"
  document.getElementById('novaHistoriaBtn').addEventListener('click', () => {
    if (confirm('Tem certeza de que deseja começar uma nova história?')) {
      limparFormulario();
      removerExibicaoHistoria();
    }
  });

  // Fechar modal de "Ler Mais"
  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('modalOverlay').style.display = 'none';
  });
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target.id === 'modalOverlay') {
      document.getElementById('modalOverlay').style.display = 'none';
    }
  });

  // Hover para exibir lista lateral
  document.body.addEventListener('mousemove', e => {
    if (e.clientX < 50) toggleTitleList(true);
  });
  document.body.addEventListener('mouseleave', () => toggleTitleList(false));

  // Clique fora da lista fecha lista e quaisquer menus abertos
  document.addEventListener('click', e => {
    const list = document.getElementById('titleListLeft');
    if (isTitleListVisible && list && !list.contains(e.target)) {
      toggleTitleList(false);
    }
  });

  // Estado inicial: esconder containers
  document.getElementById('cartaoContainer').style.display = 'none';
  document.getElementById('modalOverlay').style.display    = 'none';
});

// --------------------------------------------------
// 1) Exibe usuário logado ou link de login
// --------------------------------------------------
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  area.innerHTML = '';
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) {
    area.innerHTML = `<a href="Criacao.html" style="color:white;">
                        <i class="fas fa-user"></i> Login
                      </a>`;
    return;
  }
  const { data:profile } = await supabase
    .from('profiles').select('username').eq('id', user.id).single();
  const displayName = profile?.username || user.email;
  area.innerHTML = `
    <span id="user-name" style="cursor:pointer;">${displayName}</span>
    <div id="logout-menu" style="display:none; margin-top:5px;">
      <button id="logout-btn">Deslogar</button>
    </div>`;
  document.getElementById('user-name').onclick = () => {
    const m = document.getElementById('logout-menu');
    m.style.display = m.style.display === 'none' ? 'block' : 'none';
  };
  document.getElementById('logout-btn').onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = 'Criacao.html';
  };
}

// --------------------------------------------------
// 2) Carregar categorias do Supabase
// --------------------------------------------------
async function carregarCategorias() {
  const { data:cats, error } = await supabase.from('categorias').select('id,nome');
  if (error) return console.error(error);
  ['#categorias','.categorias'].forEach(sel => {
    const cont = document.querySelector(sel);
    if (!cont) return;
    cont.innerHTML = '';
    cats.forEach(cat => {
      const wrapper = document.createElement('div');
      wrapper.className = 'categoria-wrapper';
      wrapper.innerHTML = `
        <input type="checkbox" name="categoria" id="cat_${cat.id}" value="${cat.id}">
        <label for="cat_${cat.id}">${cat.nome}</label>`;
      cont.appendChild(wrapper);
    });
  });
}

// --------------------------------------------------
// 3) Mostrar/Ocultar lista lateral
// --------------------------------------------------
function toggleTitleList(show) {
  const list = document.getElementById('titleListLeft');
  if (!list) return;
  list.classList.toggle('visible', show);
  isTitleListVisible = show;
  if (!show) {
    // fecha qualquer menu de opções aberto
    document.querySelectorAll('.title-list li.menu-open').forEach(li => {
      li.classList.remove('menu-open');
      const m = li.querySelector('.menu-opcoes');
      if (m) m.remove();
    });
  }
}

// --------------------------------------------------
// 4) Mostrar histórias na lista lateral
// --------------------------------------------------
async function mostrarHistorias() {
  const { data:hist, error } = await supabase
    .from('historias')
    .select('id,titulo')
    .order('data_criacao', { ascending: false });
  if (error) return console.error(error);
  const ul = document.getElementById('titleListUl');
  ul.innerHTML = '';
  hist.forEach(h => {
    const li = document.createElement('li');
    li.textContent = h.titulo || '(sem título)';
    li.dataset.id  = h.id;
    li.addEventListener('click', e => {
      e.stopPropagation();
      toggleMenuOpcoes(li, h.id);
    });
    ul.appendChild(li);
  });
}

// --------------------------------------------------
// 5) Abrir/fechar menu de opções (Cartão, Editar, Excluir)
// --------------------------------------------------
function toggleMenuOpcoes(li, id) {
  // fecha outros menus
  document.querySelectorAll('.title-list li.menu-open').forEach(other => {
    other.classList.remove('menu-open');
    const m = other.querySelector('.menu-opcoes');
    if (m) m.remove();
  });

  // se já estava aberto, só fecha
  if (li.classList.contains('menu-open')) {
    li.classList.remove('menu-open');
    return;
  }

  // abre este
  li.classList.add('menu-open');
  const menu = document.createElement('div');
  menu.className = 'menu-opcoes';

  const actions = [
    { txt: 'Cartão', icon: 'fas fa-credit-card', fn: () => mostrarCartaoForm(id) },
    { txt: 'Editar', icon: 'fas fa-edit',       fn: () => editarHistoria(id)  },
    { txt: 'Excluir',icon: 'fas fa-trash',      fn: () => excluirHistoria(id) }
  ];

  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.innerHTML = `<i class="${a.icon}"></i>${a.txt}`;
    btn.onclick = e => {
      e.stopPropagation();
      menu.remove();
      li.classList.remove('menu-open');
      a.fn();
    };
    menu.appendChild(btn);
  });

  li.appendChild(menu);
}

// --------------------------------------------------
// 6) CRUD de Histórias
// --------------------------------------------------
async function salvarHistoria(titulo, descricao) {
  const form   = document.getElementById('storyForm');
  const editId = form.dataset.editId;
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return alert('Faça login para salvar.');

  // categorias selecionadas
  const cats = Array.from(
    document.querySelectorAll('input[name="categoria"]:checked')
  ).map(c => Number(c.value));

  if (editId) {
    // atualizar
    await supabase.from('historias').update({ titulo, descricao }).eq('id', editId);
    await supabase.from('historia_categorias').delete().eq('historia_id', editId);
    if (cats.length) {
      await supabase.from('historia_categorias').insert(
        cats.map(cid => ({ historia_id: Number(editId), categoria_id: cid, user_id: user.id }))
      );
    }
    alert('História atualizada!');
    exibirHistoriaNoContainer(editId);
  } else {
    // criar nova
    const { data, error } = await supabase.from('historias')
      .insert([{ titulo, descricao, user_id: user.id }])
      .select('id');
    if (error) return alert('Erro ao salvar história.');
    const newId = data[0].id;
    if (cats.length) {
      await supabase.from('historia_categorias').insert(
        cats.map(cid => ({ historia_id: newId, categoria_id: cid, user_id: user.id }))
      );
    }
    alert('História salva!');
    removerExibicaoHistoria();
  }

  limparFormulario();
  await mostrarHistorias();
}

async function editarHistoria(id) {
  const { data:h } = await supabase.from('historias').select('*').eq('id', id).single();
  document.getElementById('titulo').value    = h.titulo;
  document.getElementById('descricao').value = h.descricao;
  const form = document.getElementById('storyForm');
  form.dataset.editId = id;
  form.querySelector('button[type="submit"]').textContent = 'Atualizar';
  exibirHistoriaNoContainer(id);
}

async function excluirHistoria(id) {
  if (!confirm('Deseja excluir?')) return;
  await supabase.from('historia_categorias').delete().eq('historia_id', id);
  await supabase.from('cartoes').delete().eq('historia_id', id);
  await supabase.from('historias').delete().eq('id', id);
  alert('Excluída com sucesso!');
  limparFormulario();
  removerExibicaoHistoria();
  await mostrarHistorias();
}

function removerExibicaoHistoria() {
  document.querySelectorAll('.exibicao-historia').forEach(el => el.remove());
}

function limparFormulario() {
  document.getElementById('titulo').value    = '';
  document.getElementById('descricao').value = '';
  const form = document.getElementById('storyForm');
  delete form.dataset.editId;
  form.querySelector('button[type="submit"]').textContent = 'Salvar';
}

async function exibirHistoriaNoContainer(id) {
  const { data:h } = await supabase.from('historias')
    .select('titulo, descricao')
    .eq('id', id)
    .single();
  removerExibicaoHistoria();
  const cont = document.getElementById('storyContainer');
  const div  = document.createElement('div');
  div.className = 'exibicao-historia';
  div.innerHTML = `<h3>${h.titulo}</h3><p>${h.descricao}</p>`;
  cont.appendChild(div);
}

// --------------------------------------------------
// 7) Formulário de Cartão e Modal “Ler Mais”
// --------------------------------------------------
async function mostrarCartaoForm(id) {
  document.getElementById('storyContainer').style.display  = 'none';
  document.getElementById('cartaoContainer').style.display= 'block';

  const { data:h } = await supabase.from('historias')
    .select('*, cartoes(*)')
    .eq('id', id)
    .single();

  const cart = h.cartoes?.[0] || {};
  document.getElementById('titulo_cartao').value   = cart.titulo_cartao  || '';
  document.getElementById('sinopse_cartao').value  = cart.sinopse_cartao || '';
  document.getElementById('data_criacao').value    = cart.data_criacao
    ? cart.data_criacao.split('T')[0]
    : new Date().toISOString().split('T')[0];
  document.getElementById('autor_cartao').value    = cart.autor_cartao    || '';

  const { data:cats } = await supabase.from('historia_categorias')
    .select('categoria_id').eq('historia_id', id);
  document.querySelectorAll('input[name="categoria"]').forEach(chk => chk.checked = false);
  cats.forEach(ca => {
    const chk = document.querySelector(`input[value="${ca.categoria_id}"]`);
    if (chk) chk.checked = true;
  });

  document.getElementById('btnPublicarCartao').onclick = () => publicarCartao(id);
  document.getElementById('btnLerMais').onclick        = () => lerMais(id);
  document.getElementById('btnVoltar').onclick        = () => {
    document.getElementById('cartaoContainer').style.display = 'none';
    document.getElementById('storyContainer').style.display = 'block';
  };
}

async function publicarCartao(id) {
  if (!confirm('Publicar cartão definitiva-mente?')) return;
  const titulo    = document.getElementById('titulo_cartao').value.trim();
  const sinopse   = document.getElementById('sinopse_cartao').value.trim();
  const dataCriac = document.getElementById('data_criacao').value.trim();
  const autor     = document.getElementById('autor_cartao').value.trim();
  const cats      = Array.from(
    document.querySelectorAll('input[name="categoria"]:checked')
  ).map(c => +c.value);

  if (!titulo || !sinopse || cats.length === 0) {
    return alert('Preencha título, sinopse e selecione ao menos 1 categoria');
  }

  await supabase.from('cartoes').upsert({
    historia_id: id,
    titulo_cartao: titulo,
    sinopse_cartao: sinopse,
    autor_cartao: autor,
    data_criacao: dataCriac
  });

  const { data:{ user } } = await supabase.auth.getUser();
  await supabase.from('historia_categorias').delete().eq('historia_id', id);
  await supabase.from('historia_categorias').insert(
    cats.map(cid => ({ historia_id: id, categoria_id: cid, user_id: user.id }))
  );

  alert('Cartão publicado com sucesso!');
}

async function lerMais(id) {
  document.getElementById('modalOverlay').style.display = 'flex';
  const { data:h } = await supabase.from('historias')
    .select('titulo, descricao').eq('id', id).single();
  document.getElementById('modalTitulo').textContent       = h.titulo;
  document.getElementById('modalDescricao').textContent    = h.descricao;

  const { data:c } = await supabase.from('cartoes')
    .select('*').eq('historia_id', id).single();
  if (c) {
    document.getElementById('modalCartaoTitulo').textContent     = c.titulo_cartao;
    document.getElementById('modalCartaoSinopse').textContent    = c.sinopse_cartao;
    document.getElementById('modalCartaoData').textContent       = c.data_criacao;
    document.getElementById('modalCartaoAutor').textContent      = c.autor_cartao;
    const { data:cats2 } = await supabase.from('historia_categorias')
      .select('categoria_id').eq('historia_id', id);
    document.getElementById('modalCartaoCategorias').textContent = 
      cats2.map(x => x.categoria_id).join(', ');
  }
}
