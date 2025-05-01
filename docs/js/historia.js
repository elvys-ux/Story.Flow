// js/historia.js
import { supabase } from './supabase.js';

let currentMenu = null;
let menuTimer   = null;
let listVisible = false;

document.addEventListener('DOMContentLoaded', () => {
  initialize();
});

async function initialize() {
  await displayUser();
  await renderStories();

  // Form História
  document.getElementById('storyForm')
    .addEventListener('submit', async e => {
      e.preventDefault();
      await handleStorySave();
    });

  // Nova História
  document.getElementById('novaHistoriaBtn')
    .addEventListener('click', () => {
      if (confirm('Começar nova história?')) {
        resetStoryForm();
        clearDisplayedStory();
      }
    });

  // Fechar modal “Ler Mais”
  document.getElementById('closeModal')
    .addEventListener('click', () => {
      document.getElementById('modalOverlay').style.display = 'none';
    });
  document.getElementById('modalOverlay')
    .addEventListener('click', e => {
      if (e.target.id === 'modalOverlay')
        document.getElementById('modalOverlay').style.display = 'none';
    });

  // Hover para lista lateral
  document.body.addEventListener('mousemove', e => {
    if (e.clientX < 50) toggleList(true);
    else if (listVisible && e.clientX > 260) toggleList(false);
  });

  // Clique genérico: fecha menu de ações
  document.addEventListener('click', e => {
    if (currentMenu && !currentMenu.contains(e.target)) {
      closeMenu();
    }
  });

  // Esconde containers
  document.getElementById('cartaoContainer').style.display = 'none';
  document.getElementById('modalOverlay').style.display   = 'none';
}

// Exibe Login ou nome de usuário
async function displayUser() {
  const area = document.getElementById('userMenuArea');
  area.innerHTML = '';
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) {
    area.innerHTML = `<a href="Criacao.html" style="color:white">
                        <i class="fas fa-user"></i> Login
                      </a>`;
    return;
  }
  const { data:profile } = await supabase
    .from('profiles').select('username').eq('id', user.id).single();
  const name = profile?.username || user.email;
  area.innerHTML = `
    <span id="user-name" style="cursor:pointer">${name}</span>
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

// Toggle lista lateral
function toggleList(show) {
  const list = document.getElementById('titleListLeft');
  if (!list) return;
  list.classList.toggle('visible', show);
  listVisible = show;
}

// Busca e renderiza todas as histórias
async function renderStories() {
  const { data:stories, error } = await supabase
    .from('historias')
    .select('id, titulo')
    .order('data_criacao', { ascending:false });
  if (error) return console.error(error);

  const ul = document.getElementById('titleListUl');
  ul.innerHTML = '';
  stories.forEach(h => {
    const li = document.createElement('li');
    li.textContent    = h.titulo || '(sem título)';
    li.dataset.id     = h.id;
    li.style.position = 'relative';
    li.addEventListener('click', e => {
      e.stopPropagation();
      openMenu(li, h.id);
    });
    ul.appendChild(li);
  });
}

// Cria menu flutuante ao lado do <li>
function openMenu(li, id) {
  closeMenu();

  const menu = document.createElement('div');
  menu.classList.add('menu-opcoes');
  Object.assign(menu.style, {
    position:    'fixed',
    background:  '#222',
    borderRadius:'5px',
    padding:     '5px 0',
    minWidth:    '140px',
    boxShadow:   '0 2px 6px rgba(0,0,0,0.6)',
    zIndex:      '2000'
  });
  // posiciona
  const r = li.getBoundingClientRect();
  menu.style.top       = `${r.top + r.height/2}px`;
  menu.style.left      = `${r.right + 8}px`;
  menu.style.transform = 'translateY(-50%)';

  // botões
  [
    { txt:'Cartão', ico:'fas fa-credit-card', fn:()=>showCardForm(id) },
    { txt:'Editar', ico:'fas fa-edit',       fn:()=>editStory(id) },
    { txt:'Excluir',ico:'fas fa-trash',      fn:()=>deleteStory(id) }
  ].forEach((a,i,arr) => {
    const btn = document.createElement('button');
    btn.innerHTML = `<i class="${a.ico}" style="margin-right:8px;color:#ffcc00"></i>${a.txt}`;
    Object.assign(btn.style, {
      display:      'flex',
      alignItems:   'center',
      width:        '100%',
      padding:      '8px 12px',
      background:   'none',
      border:       'none',
      borderBottom: i< arr.length-1 ? '1px solid #444' : 'none',
      color:        '#fff',
      cursor:       'pointer',
      fontSize:     '14px',
      textAlign:    'left'
    });
    btn.addEventListener('mouseover', ()=> btn.style.background = '#444');
    btn.addEventListener('mouseout',  ()=> btn.style.background = 'transparent');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      closeMenu();
      a.fn();
    });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  currentMenu = menu;
  menuTimer = setTimeout(closeMenu, 3000);
}

// Fecha menu de ações
function closeMenu() {
  if (menuTimer) { clearTimeout(menuTimer); menuTimer = null; }
  if (!currentMenu) return;
  currentMenu.remove();
  currentMenu = null;
}

// --------------------------------------------------
// CRUD de Histórias (apenas título+descrição)
// --------------------------------------------------
async function handleStorySave() {
  const titulo    = document.getElementById('titulo').value.trim();
  const descricao = document.getElementById('descricao').value.trim();
  const form      = document.getElementById('storyForm');
  const editId    = form.dataset.editId;
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return alert('Faça login para salvar.');

  if (editId) {
    await supabase.from('historias')
      .update({ titulo, descricao })
      .eq('id', editId);
    alert('História atualizada!');
  } else {
    const { data, error } = await supabase.from('historias')
      .insert([{ titulo, descricao, user_id:user.id }])
      .select('id');
    if (error) return alert('Erro ao salvar história.');
    alert('História salva!');
  }
  resetStoryForm();
  clearDisplayedStory();
  await renderStories();
}

async function editStory(id) {
  const { data } = await supabase.from('historias')
    .select('*').eq('id', id).single();
  document.getElementById('titulo').value    = data.titulo;
  document.getElementById('descricao').value = data.descricao;
  const form = document.getElementById('storyForm');
  form.dataset.editId = id;
  form.querySelector('button[type="submit"]').textContent = 'Atualizar';
  displayStory(id);
}

async function deleteStory(id) {
  if (!confirm('Excluir história?')) return;
  await supabase.from('historias').delete().eq('id',id);
  alert('História excluída!');
  resetStoryForm();
  clearDisplayedStory();
  await renderStories();
}

function resetStoryForm() {
  document.getElementById('titulo').value    = '';
  document.getElementById('descricao').value = '';
  const form = document.getElementById('storyForm');
  delete form.dataset.editId;
  form.querySelector('button[type="submit"]').textContent = 'Salvar';
}
function displayStory(id) { /* opcional: mostrar abaixo do form */ }
function clearDisplayedStory() { /* opcional: limpar visualização */ }

// --------------------------------------------------
// [5] Mostrar formulário de Cartão + Ler Mais
// --------------------------------------------------
async function showCardForm(id) {
  // carrega categorias SÓ para o cartão
  await loadCardCategories();

  document.getElementById('storyContainer').style.display  = 'none';
  document.getElementById('cartaoContainer').style.display= 'block';

  // preenche dados existentes
  const { data } = await supabase.from('historias')
    .select('*, cartoes(*)').eq('id', id).single();
  const cart = data.cartoes?.[0] || {};

  document.getElementById('titulo_cartao').value   = cart.titulo_cartao || '';
  document.getElementById('sinopse_cartao').value  = cart.sinopse_cartao || '';
  document.getElementById('data_criacao').value   = cart.data_criacao
    ? cart.data_criacao.split('T')[0]
    : new Date().toISOString().slice(0,10);
  document.getElementById('autor_cartao').value    = cart.autor_cartao || '';

  // marca categorias já associadas
  const { data:cats } = await supabase.from('historia_categorias')
    .select('categoria_id').eq('historia_id', id);
  document.querySelectorAll('.categorias input[type="checkbox"]')
    .forEach(chk => chk.checked = false);
  cats.forEach(ca => {
    const chk = document.querySelector(`.categorias input[value="${ca.categoria_id}"]`);
    if (chk) chk.checked = true;
  });

  // botões do cartão
  document.getElementById('btnPublicarCartao')
    .onclick = () => publishCard(id);
  document.getElementById('btnLerMais')
    .onclick = () => showReadMoreModal(id);
  document.getElementById('btnVoltar')
    .onclick = () => {
      document.getElementById('cartaoContainer').style.display = 'none';
      document.getElementById('storyContainer').style.display = 'block';
    };
}

// carrega apenas no container `.categorias`
async function loadCardCategories() {
  const { data:cats, error } = await supabase
    .from('categorias').select('id,nome');
  if (error) return console.error('Erro cats:',error);

  const cont = document.querySelector('.categorias');
  cont.innerHTML = '';
  cats.forEach(cat => {
    const wrapper = document.createElement('label');
    wrapper.style.marginRight = '10px';
    wrapper.innerHTML = `
      <input type="checkbox" name="categoria" value="${cat.id}" />
      ${cat.nome}
    `;
    cont.appendChild(wrapper);
  });
}

async function publishCard(id) {
  if (!confirm('Publicar cartão?')) return;
  const titulo  = document.getElementById('titulo_cartao').value.trim();
  const sinopse = document.getElementById('sinopse_cartao').value.trim();
  const dataC   = document.getElementById('data_criacao').value;
  const autor   = document.getElementById('autor_cartao').value.trim();
  const cats    = Array.from(
    document.querySelectorAll('.categorias input:checked')
  ).map(i=>+i.value);

  if (!titulo||!sinopse||cats.length===0) {
    return alert('Preencha todos os campos e selecione ao menos uma categoria.');
  }

  await supabase.from('cartoes').upsert({
    historia_id:    id,
    titulo_cartao:  titulo,
    sinopse_cartao: sinopse,
    autor_cartao:   autor,
    data_criacao:   dataC
  });

  // atualizar relacionamentos
  const { data:{user} } = await supabase.auth.getUser();
  await supabase.from('historia_categorias').delete().eq('historia_id',id);
  await supabase.from('historia_categorias')
    .insert(cats.map(c=>({
      historia_id:id,
      categoria_id:c,
      user_id:user.id
    })));

  alert('Cartão publicado!');
}

async function showReadMoreModal(id) {
  document.getElementById('modalOverlay').style.display = 'flex';
  const { data } = await supabase.from('historias')
    .select('titulo,descricao').eq('id',id).single();
  document.getElementById('modalTitulo').textContent    = data.titulo;
  document.getElementById('modalDescricao').textContent = data.descricao;

  const { data:card } = await supabase.from('cartoes')
    .select('*').eq('historia_id',id).single();
  if (card) {
    document.getElementById('modalCartaoTitulo').textContent   = card.titulo_cartao;
    document.getElementById('modalCartaoSinopse').textContent  = card.sinopse_cartao;
    document.getElementById('modalCartaoData').textContent     = card.data_criacao;
    document.getElementById('modalCartaoAutor').textContent    = card.autor_cartao;
    const { data:cats2 } = await supabase.from('historia_categorias')
      .select('categoria_id').eq('historia_id', id);
    document.getElementById('modalCartaoCategorias').textContent =
      cats2.map(x=>x.categoria_id).join(', ');
  }
}
