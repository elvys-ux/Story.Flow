// js/historia.js
import { supabase } from './supabase.js';

let openMenu = null,
    menuTimeout = null,
    isTitleListVisible = false,
    currentCardId = null,
    sessionUserId = null;  // ID do utilizador autenticado

document.addEventListener('DOMContentLoaded', async () => {
  // [1] Autenticação
  await exibirUsuarioLogado();
  // [2] Carregar só as histórias desse utilizador
  await mostrarHistorias();

  // [3] Submissão do formulário de criação/edição de história
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

  // [4] Botão “Nova História”
  document.getElementById('novaHistoriaBtn')
    .addEventListener('click', () => {
      if (!confirm('Começar nova história?')) return;
      limparFormulario();
      removerExibicaoHistoria();
    });

  // [5] Fechar modal “Ler Mais”
  document.getElementById('closeModal')
    .addEventListener('click', () => {
      document.getElementById('modalOverlay').style.display = 'none';
    });
  document.getElementById('modalOverlay')
    .addEventListener('click', e => {
      if (e.target.id === 'modalOverlay')
        document.getElementById('modalOverlay').style.display = 'none';
    });

  // [6] Hover na borda esquerda abre lista lateral
  document.body.addEventListener('mousemove', e => {
    if (e.clientX < 50) toggleTitleList(true);
  });
  document.body.addEventListener('mouseleave', () => toggleTitleList(false));

  // [7] Cliques fora fecham menu e lista lateral
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

  // [8] Estado inicial: oculta cartão e modal
  document.getElementById('cartaoContainer').style.display = 'none';
  document.getElementById('modalOverlay').style.display   = 'none';

  // [9] Botões do cartão
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
      document.getElementById('storyContainer').style.display = 'block';
      currentCardId = null;
    });
});

// [1] Exibe usuário logado e guarda sessionUserId
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  area.innerHTML = '';
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    area.innerHTML = `
      <a href="Criacao.html" style="color:white">
        <i class="fas fa-user"></i> Login
      </a>`;
    return;
  }
  sessionUserId = session.user.id;
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', sessionUserId)
    .single();
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
    console.error('Erro ao carregar histórias:', error);
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

// [Menu de contexto]
function showMenu(li, id) {
  hideMenu();
  const menu = document.createElement('div');
  menu.classList.add('menu-opcoes');
  Object.assign(menu.style, {
    display:     'block',
    position:    'fixed',
    background:  '#222',
    borderRadius:'5px',
    padding:     '5px 0',
    minWidth:    '140px',
    boxShadow:   '0 2px 6px rgba(0,0,0,0.6)',
    zIndex:      '2000'
  });
  const r = li.getBoundingClientRect();
  menu.style.top       = `${r.top + r.height/2}px`;
  menu.style.left      = `${r.right + 8}px`;
  menu.style.transform = 'translateY(-50%)';

  const actions = [
    { txt:'Cartão', ico:'fas fa-credit-card', fn:()=> mostrarCartaoForm(id) },
    { txt:'Editar', ico:'fas fa-edit',        fn:()=> editarHistoria(id) },
    { txt:'Excluir',ico:'fas fa-trash',       fn:()=> excluirHistoria(id) }
  ];
  actions.forEach((a,i) => {
    const btn = document.createElement('button');
    btn.innerHTML = `<i class="${a.ico}" style="margin-right:8px;color:#ffcc00"></i>${a.txt}`;
    Object.assign(btn.style, {
      display:      'flex',
      alignItems:   'center',
      width:        '100%',
      padding:      '8px 12px',
      background:   'none',
      border:       'none',
      borderBottom: i < actions.length-1 ? '1px solid #444' : 'none',
      color:        '#fff',
      cursor:       'pointer',
      fontSize:     '14px',
      textAlign:    'left'
    });
    btn.onmouseover = ()=> btn.style.background = '#444';
    btn.onmouseout  = ()=> btn.style.background = 'transparent';
    btn.onclick     = e => { e.stopPropagation(); hideMenu(); a.fn(); };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  openMenu = { menu, li };
  menuTimeout = setTimeout(hideMenu, 3000);
}

function hideMenu() {
  if (menuTimeout) {
    clearTimeout(menuTimeout);
    menuTimeout = null;
  }
  if (!openMenu) return;
  openMenu.menu.remove();
  openMenu = null;
}

// [4] Criar ou atualizar história
async function salvarHistoria(titulo, descricao) {
  if (!sessionUserId) {
    alert('Faça login para salvar.');
    return;
  }
  const form   = document.getElementById('storyForm');
  const editId = form.dataset.editId;

  if (editId) {
    const { error } = await supabase
      .from('historias')
      .update({ titulo, descricao })
      .eq('id', editId)
      .eq('user_id', sessionUserId);
    if (error) {
      console.error('Erro ao atualizar história:', error);
      alert('Não foi possível atualizar.');
      return;
    }
    alert('História atualizada!');
    exibirHistoriaNoContainer(editId);
  } else {
    const { error } = await supabase
      .from('historias')
      .insert([{ titulo, descricao, user_id: sessionUserId }]);
    if (error) {
      console.error('Erro ao salvar história:', error);
      alert('Não foi possível salvar.');
      return;
    }
    alert('História salva!');
    removerExibicaoHistoria();
  }

  await mostrarHistorias();
}

// [5] Pré-preenche formulário para edição
async function editarHistoria(id) {
  if (!sessionUserId) return;
  const { data: h, error } = await supabase
    .from('historias')
    .select('titulo, descricao')
    .eq('id', id)
    .eq('user_id', sessionUserId)
    .single();
  if (error) {
    console.error('Erro ao buscar para edição:', error);
    return;
  }
  document.getElementById('titulo').value    = h.titulo;
  document.getElementById('descricao').value = h.descricao;
  const form = document.getElementById('storyForm');
  form.dataset.editId = id;
  form.querySelector('button[type="submit"]').textContent = 'Atualizar';
}

// [6] Excluir história
async function excluirHistoria(id) {
  if (!confirm('Deseja excluir a história?')) return;
  if (!sessionUserId) return;
  const { error } = await supabase
    .from('historias')
    .delete()
    .eq('id', id)
    .eq('user_id', sessionUserId);
  if (error) {
    console.error('Erro ao excluir história:', error);
    alert('Não foi possível excluir.');
    return;
  }
  alert('História excluída!');  
  limparFormulario();
  removerExibicaoHistoria();
  await mostrarHistorias();
}

// [7] Limpar e remover exibição
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

// [8] Exibir título e descrição na área principal
async function exibirHistoriaNoContainer(id) {
  if (!sessionUserId) return;
  const { data: h, error } = await supabase
    .from('historias')
    .select('titulo, descricao')
    .eq('id', id)
    .eq('user_id', sessionUserId)
    .single();
  if (error) {
    console.error('Erro ao exibir história:', error);
    return;
  }
  removerExibicaoHistoria();
  const cont = document.getElementById('storyContainer');
  const div = document.createElement('div');
  div.classList.add('exibicao-historia');
  div.innerHTML = `<h3>${h.titulo}</h3><p>${h.descricao}</p>`;
  cont.appendChild(div);
}

// [9] Formulário de Cartão + modal “Ler Mais”
async function mostrarCartaoForm(id) {
  currentCardId = id;
  await carregarCategoriasCartao();
  document.getElementById('storyContainer').style.display   = 'none';
  document.getElementById('cartaoContainer').style.display = 'block';

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

  const { data: savedCats } = await supabase
    .from('historia_categorias')
    .select('categoria_id')
    .eq('historia_id', id);
  document.querySelectorAll('.categorias input').forEach(chk => chk.checked = false);
  (savedCats||[]).forEach(s => {
    const chk = document.querySelector(`.categorias input[value="${s.categoria_id}"]`);
    if (chk) chk.checked = true;
  });
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

  // Upsert do cartão
  await supabase.from('cartoes').upsert({
    historia_id:     id,
    titulo_cartao:   titulo,
    sinopse_cartao:  sinopse,
    autor_cartao:    autor,
    data_criacao:    dataC
  });

  // Associa categorias
  await supabase.from('historia_categorias').delete().eq('historia_id', id);
  await supabase.from('historia_categorias')
    .insert(cats.map(catId => ({
      historia_id:   id,
      categoria_id:  catId,
      user_id:       sessionUserId
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
      (cats2||[]).map(x => categoryMap[x.categoria_id]).join(', ');
  }
}
