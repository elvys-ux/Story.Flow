// js/historia.js
import { supabase } from './supabase.js';

let openMenu = null,
    menuTimeout = null,
    isTitleListVisible = false,
    currentCardId = null;

// Armazena o ID do utilizador autenticado
let sessionUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await mostrarHistorias();

  document.getElementById('storyForm')
    .addEventListener('submit', async e => {
      e.preventDefault();
      const titulo    = document.getElementById('titulo').value.trim();
      const descricao = document.getElementById('descricao').value.trim();
      if (!titulo || !descricao) {
        alert('Preencha o título e a descrição!');
        return;
      }
      await salvarHistoria(titulo, descricao);
    });

  document.getElementById('novaHistoriaBtn')
    .addEventListener('click', () => {
      if (!confirm('Começar nova história?')) return;
      limparFormulario();
      removerExibicaoHistoria();
    });

  document.getElementById('closeModal')
    .addEventListener('click', () => {
      document.getElementById('modalOverlay').style.display = 'none';
    });
  document.getElementById('modalOverlay')
    .addEventListener('click', e => {
      if (e.target.id === 'modalOverlay')
        document.getElementById('modalOverlay').style.display = 'none';
    });

  document.body.addEventListener('mousemove', e => {
    if (e.clientX < 50) toggleTitleList(true);
  });
  document.body.addEventListener('mouseleave', () => toggleTitleList(false));

  document.addEventListener('click', e => {
    if (openMenu &&
        !openMenu.menu.contains(e.target) &&
        !openMenu.li.contains(e.target)) {
      hideMenu();
    }
    const list = document.getElementById('titleListLeft');
    if (isTitleListVisible && list && !list.contains(e.target)) {
      toggleTitleList(false);
    }
  });

  document.getElementById('cartaoContainer').style.display = 'none';
  document.getElementById('modalOverlay').style.display   = 'none';

  document.getElementById('btnPublicarCartao')
    .addEventListener('click', () => {
      if (currentCardId !== null) publicarCartao(currentCardId);
    });
  document.getElementById('btnLerMais')
    .addEventListener('click', () => {
      if (currentCardId !== null) lerMais(currentCardId);
    });
  document.getElementById('btnVoltar')
    .addEventListener('click', () => {
      document.getElementById('cartaoContainer').style.display = 'none';
      document.getElementById('storyContainer').style.display  = 'block';
      currentCardId = null;
    });
});

// [1] Exibe usuário logado ou link de login
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  area.innerHTML = '';
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) {
    area.innerHTML = `
      <a href="Criacao.html" style="color:white">
        <i class="fas fa-user"></i> Login
      </a>`;
    return;
  }
  sessionUserId = session.user.id;
  const { data: profile } = await supabase
    .from('profiles').select('username').eq('id', sessionUserId).single();
  const nome = profile?.username || session.user.email;
  area.innerHTML = `
    <span id="user-name" style="cursor:pointer">${nome}</span>
    <div id="logout-menu" style="display:none; margin-top:5px">
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

// [2] Mostra/oculta lista lateral de títulos
function toggleTitleList(show) {
  const list = document.getElementById('titleListLeft');
  if (!list) return;
  list.classList.toggle('visible', show);
  isTitleListVisible = show;
}

// [3] Carrega apenas as histórias do utilizador autenticado
async function mostrarHistorias() {
  if (!sessionUserId) return;
  const { data: stories, error } = await supabase
    .from('historias')
    .select('id, titulo')
    .eq('user_id', sessionUserId)
    .order('data_criacao', { ascending: false });
  if (error) {
    console.error(error);
    return;
  }
  const ul = document.getElementById('titleListUl');
  ul.innerHTML = '';
  stories.forEach(h => {
    const li = document.createElement('li');
    li.textContent    = h.titulo || '(sem título)';
    li.dataset.id     = h.id;
    li.style.position = 'relative';
    li.onclick = e => {
      e.stopPropagation();
      showMenu(li, h.id);
    };
    ul.appendChild(li);
  });
}

// restante código ([4] a [6]) permanece inalterado...


// [4] Criar / atualizar / listar histórias
async function salvarHistoria(titulo, descricao) {
  const form   = document.getElementById('storyForm');
  const editId = form.dataset.editId;
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) {
    alert('Faça login para salvar.');
    return;
  }

  if (editId) {
    await supabase.from('historias')
      .update({ titulo, descricao })
      .eq('id', editId);
    alert('História atualizada!');
    exibirHistoriaNoContainer(editId);
  } else {
    const { error } = await supabase.from('historias')
      .insert([{ titulo, descricao, user_id: user.id }]);
    if (error) {
      alert('Erro ao salvar história.');
      console.error(error);
      return;
    }
    alert('História salva!');
    removerExibicaoHistoria();
  }

 
  await mostrarHistorias();
}

async function editarHistoria(id) {
  const { data: h } = await supabase.from('historias')
    .select('*').eq('id', id).single();
  document.getElementById('titulo').value    = h.titulo;
  document.getElementById('descricao').value = h.descricao;
  const form = document.getElementById('storyForm');
  form.dataset.editId = id;
  form.querySelector('button[type="submit"]').textContent = 'Atualizar';
  exibirHistoriaNoContainer(id);
}

async function excluirHistoria(id) {
  if (!confirm('Deseja excluir a história?')) return;
  await supabase.from('historias').delete().eq('id', id);
  alert('História excluída!');
  limparFormulario();
  removerExibicaoHistoria();
  await mostrarHistorias();
}

function removerExibicaoHistoria() {
  document.querySelectorAll('.exibicao-historia').forEach(el => el.remove());
}

function limparFormulario() {
  document.getElementById('titulo').value    = '';
  document.getElementById('descricao').value= '';
  const form = document.getElementById('storyForm');
  delete form.dataset.editId;
  form.querySelector('button[type="submit"]').textContent = 'Salvar';
}

async function exibirHistoriaNoContainer(id) {
  const { data: h } = await supabase.from('historias')
    .select('titulo, descricao').eq('id', id).single();
  removerExibicaoHistoria();
  const cont = document.getElementById('storyContainer');
  const div = document.createElement('div');
  div.classList.add('exibicao-historia');
  div.innerHTML = `<h3>${h.titulo}</h3><p>${h.descricao}</p>`;
  cont.appendChild(div);
}

// [5] Formulário de Cartão + modal “Ler Mais”
async function mostrarCartaoForm(id) {
  currentCardId = id;
  await carregarCategoriasCartao();

  document.getElementById('storyContainer').style.display   = 'none';
  document.getElementById('cartaoContainer').style.display = 'block';

  // Busca diretamente na tabela de cartões
  const { data: cart, error } = await supabase
    .from('cartoes')
    .select('*')
    .eq('historia_id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao carregar cartão:', error);
    return;
  }

  const cartao = cart || {};
  document.getElementById('titulo_cartao').value  = cartao.titulo_cartao  || '';
  document.getElementById('sinopse_cartao').value = cartao.sinopse_cartao || '';
  document.getElementById('data_criacao').value  = cartao.data_criacao
    ? cartao.data_criacao.split('T')[0]
    : new Date().toISOString().split('T')[0];
  document.getElementById('autor_cartao').value   = cartao.autor_cartao   || '';

  // Marcar as categorias associadas
  const { data: savedCats } = await supabase
    .from('historia_categorias')
    .select('categoria_id')
    .eq('historia_id', id);

  document.querySelectorAll('.categorias input').forEach(chk => chk.checked = false);
  if (savedCats) {
    savedCats.forEach(s => {
      const chk = document.querySelector(`.categorias input[value="${s.categoria_id}"]`);
      if (chk) chk.checked = true;
    });
  }
}

async function carregarCategoriasCartao() {
  const { data: cats, error } = await supabase
    .from('categorias')
    .select('id, nome');
  if (error) {
    console.error('Erro ao carregar categorias do cartão:', error);
    return;
  }
  const ctn = document.querySelector('.categorias');
  ctn.innerHTML = '';
  cats.forEach(cat => {
    const w = document.createElement('div');
    w.classList.add('categoria-wrapper');
    const chk = document.createElement('input');
    chk.type  = 'checkbox';
    chk.name  = 'categoria';
    chk.value = cat.id;
    chk.id    = `cart_cat_${cat.id}`;
    const lbl = document.createElement('label');
    lbl.htmlFor    = chk.id;
    lbl.textContent = cat.nome;
    w.append(chk, lbl);
    ctn.appendChild(w);
  });
}

async function publicarCartao(id) {
  if (!confirm('Publicar cartão? Conteúdo definitivo.')) return;

  const titulo  = document.getElementById('titulo_cartao').value.trim();
  const sinopse = document.getElementById('sinopse_cartao').value.trim();
  const dataC   = document.getElementById('data_criacao').value;
  const autor   = document.getElementById('autor_cartao').value.trim();
  const cats    = Array.from(
    document.querySelectorAll('.categorias input:checked')
  ).map(c => +c.value);

  if (!titulo || !sinopse || cats.length === 0) {
    alert('Preencha título, sinopse e selecione pelo menos 1 categoria.');
    return;
  }

  await supabase.from('cartoes').upsert({
    historia_id:     id,
    titulo_cartao:   titulo,
    sinopse_cartao:  sinopse,
    autor_cartao:    autor,
    data_criacao:    dataC
  });

  const { data:{ user } } = await supabase.auth.getUser();
  await supabase.from('historia_categorias').delete().eq('historia_id', id);
  await supabase.from('historia_categorias')
    .insert(cats.map(catId => ({
      historia_id:   id,
      categoria_id:  catId,
      user_id:       user.id
    })));

  alert('Cartão publicado com sucesso!');
}

async function lerMais(id) {
  document.getElementById('modalOverlay').style.display = 'flex';
  const { data: h } = await supabase.from('historias')
    .select('titulo, descricao')
    .eq('id', id)
    .single();
  document.getElementById('modalTitulo').textContent    = h.titulo;
  document.getElementById('modalDescricao').textContent = h.descricao;

  const { data: c } = await supabase.from('cartoes')
    .select('*')
    .eq('historia_id', id)
    .single();
  if (c) {
    document.getElementById('modalCartaoTitulo').textContent  = c.titulo_cartao;
    document.getElementById('modalCartaoSinopse').textContent = c.sinopse_cartao;
    document.getElementById('modalCartaoData').textContent   = c.data_criacao;
    document.getElementById('modalCartaoAutor').textContent  = c.autor_cartao;

    const { data: cats2 } = await supabase.from('historia_categorias')
      .select('categoria_id')
      .eq('historia_id', id);
    document.getElementById('modalCartaoCategorias').textContent =
      cats2.map(x => x.categoria_id).join(', ');
  }
}
