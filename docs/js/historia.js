// js/historia.js
import { supabase } from './supabase.js';

let openMenu = null;
let menuTimeout = null;
let isTitleListVisible = false;

document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await carregarCategorias();
  await mostrarHistorias();

  // [Form História]
  document.getElementById('storyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const titulo    = document.getElementById('titulo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    if (!titulo || !descricao) return alert('Preencha título e descrição!');
    await salvarHistoria(titulo, descricao);
  });

  // [Nova História]
  document.getElementById('novaHistoriaBtn').addEventListener('click', () => {
    if (confirm('Começar nova história?')) {
      limparFormulario();
      removerExibicaoHistoria();
    }
  });

  // [Modal Ler Mais]
  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('modalOverlay').style.display = 'none';
  });
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target.id === 'modalOverlay') {
      document.getElementById('modalOverlay').style.display = 'none';
    }
  });

  // [Lista Lateral Hover]
  document.body.addEventListener('mousemove', e => {
    if (e.clientX < 50) toggleTitleList(true);
  });
  document.body.addEventListener('mouseleave', () => toggleTitleList(false));

  // [Clique Geral fecha menu e lista]
  document.addEventListener('click', e => {
    if (openMenu && !openMenu.menu.contains(e.target) && !openMenu.li.contains(e.target)) {
      hideMenu();
    }
    const list = document.getElementById('titleListLeft');
    if (isTitleListVisible && list && !list.contains(e.target)) {
      toggleTitleList(false);
    }
  });

  // [Inicializa containers]
  document.getElementById('cartaoContainer').style.display = 'none';
  document.getElementById('modalOverlay').style.display   = 'none';
});

// --------------------------------------------------
// [1] Exibir Usuário Logado
// --------------------------------------------------
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  area.innerHTML = '';
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    area.innerHTML = `<a href="Criacao.html" style="color:white"><i class="fas fa-user"></i> Login</a>`;
    return;
  }
  const { data: profile } = await supabase
    .from('profiles').select('username').eq('id', user.id).single();
  const nome = profile?.username || user.email;
  area.innerHTML = `
    <span id="user-name" style="cursor:pointer;color:white">${nome}</span>
    <div id="logout-menu" style="display:none;margin-top:5px;">
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
// [2] Carregar Categorias (História e Cartão)
// --------------------------------------------------
async function carregarCategorias() {
  const { data: cats, error } = await supabase.from('categorias').select('id,nome');
  if (error) { console.error(error); return; }
  ['#categorias','.categorias'].forEach(sel => {
    const container = document.querySelector(sel);
    if (!container) return;
    container.innerHTML = '';
    cats.forEach(cat => {
      const w = document.createElement('div');
      w.classList.add('categoria-wrapper');
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.name = 'categoria';
      chk.value = cat.id;
      chk.id = `categoria_${cat.id}`;
      const lbl = document.createElement('label');
      lbl.htmlFor = chk.id;
      lbl.textContent = cat.nome;
      w.append(chk, lbl);
      container.appendChild(w);
    });
  });
}

// --------------------------------------------------
// [3] Toggle Lista Lateral
// --------------------------------------------------
function toggleTitleList(show) {
  const list = document.getElementById('titleListLeft');
  if (!list) return;
  list.classList.toggle('visible', show);
  isTitleListVisible = show;
}

// --------------------------------------------------
// [4] Mostrar Histórias + Menu de Ações
// --------------------------------------------------
async function mostrarHistorias() {
  const { data: historias, error } = await supabase
    .from('historias').select('id,titulo')
    .order('data_criacao',{ ascending:false });
  if (error) { console.error(error); return; }
  const ul = document.getElementById('titleListUl');
  ul.innerHTML = '';
  historias.forEach(h => {
    const li = document.createElement('li');
    li.textContent = h.titulo || '(sem título)';
    li.dataset.id = h.id;
    li.style.position = 'relative';
    li.onclick = e => { e.stopPropagation(); showMenu(li, h.id); };
    ul.appendChild(li);
  });
}
function showMenu(li, id) {
  hideMenu();
  const menu = document.createElement('div');
  menu.classList.add('menu-opcoes');
  Object.assign(menu.style, {
    display: 'block',
    position: 'fixed',
    background: '#222',
    borderRadius: '5px',
    padding: '5px 0',
    minWidth: '140px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
    zIndex: '2000'
  });
  const r = li.getBoundingClientRect();
  menu.style.top       = `${r.top + r.height/2}px`;
  menu.style.left      = `${r.right + 8}px`;
  menu.style.transform = 'translateY(-50%)';

  const acoes = [
    { txt:'Cartão', ico:'fas fa-credit-card', fn:()=>mostrarCartaoForm(id) },
    { txt:'Editar', ico:'fas fa-edit',       fn:()=>editarHistoria(id) },
    { txt:'Excluir',ico:'fas fa-trash',      fn:()=>excluirHistoria(id) }
  ];
  acoes.forEach((a,i) => {
    const btn = document.createElement('button');
    btn.innerHTML = `<i class="${a.ico}" style="margin-right:8px;color:#ffcc00"></i>${a.txt}`;
    Object.assign(btn.style, {
      display:'flex', alignItems:'center',
      width:'100%', padding:'8px 12px',
      background:'none', border:'none',
      borderBottom: i<ações.length-1?'1px solid #444':'none',
      color:'#fff', cursor:'pointer', fontSize:'14px', textAlign:'left'
    });
    btn.onmouseover = () => btn.style.background = '#444';
    btn.onmouseout  = () => btn.style.background = 'transparent';
    btn.onclick     = e => { e.stopPropagation(); hideMenu(); a.fn(); };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  openMenu = { menu, li };
  menuTimeout = setTimeout(hideMenu, 3000);
}
function hideMenu() {
  if (menuTimeout) { clearTimeout(menuTimeout); menuTimeout = null; }
  if (!openMenu) return;
  openMenu.menu.remove();
  openMenu = null;
}

// --------------------------------------------------
// [5] CRUD de Histórias
// --------------------------------------------------
async function salvarHistoria(titulo, descricao) {
  const form = document.getElementById('storyForm');
  const editId = form.dataset.editId;
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) return alert('Faça login para salvar.');

  const cats = Array.from(
    document.querySelectorAll('input[name="categoria"]:checked')
  ).map(c => Number(c.value));

  if (editId) {
    await supabase.from('historias').update({ titulo, descricao }).eq('id', editId);
    await supabase.from('historia_categorias').delete().eq('historia_id', editId);
    if (cats.length) {
      await supabase.from('historia_categorias').insert(
        cats.map(cat => ({ historia_id: Number(editId), categoria_id: cat, user_id: user.id }))
      );
    }
    alert('História atualizada!');
    exibirHistoriaNoContainer(editId);
  } else {
    const { data, error } = await supabase.from('historias')
      .insert([{ titulo, descricao, user_id: user.id }])
      .select('id');
    if (error) return alert('Erro ao salvar história.');
    const newId = data[0].id;
    if (cats.length) {
      await supabase.from('historia_categorias').insert(
        cats.map(cat => ({ historia_id: newId, categoria_id: cat, user_id: user.id }))
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
  document.getElementById('titulo').value     = h.titulo;
  document.getElementById('descricao').value  = h.descricao;
  const form = document.getElementById('storyForm');
  form.dataset.editId = id;
  form.querySelector('button[type="submit"]').textContent = 'Atualizar';
  exibirHistoriaNoContainer(id);
}
async function excluirHistoria(id) {
  if (!confirm('Excluir essa história?')) return;
  await supabase.from('historia_categorias').delete().eq('historia_id', id);
  await supabase.from('cartoes').delete().eq('historia_id', id);
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
  document.getElementById('descricao').value = '';
  const form = document.getElementById('storyForm');
  delete form.dataset.editId;
  form.querySelector('button[type="submit"]').textContent = 'Salvar';
}
async function exibirHistoriaNoContainer(id) {
  const { data:h } = await supabase.from('historias')
    .select('titulo,descricao').eq('id', id).single();
  removerExibicaoHistoria();
  const cont = document.getElementById('storyContainer');
  const div  = document.createElement('div');
  div.classList.add('exibicao-historia');
  div.style.border    = '1px solid #ccc';
  div.style.padding   = '10px';
  div.style.marginTop = '10px';
  div.innerHTML       = `<h3>${h.titulo}</h3><p>${h.descricao}</p>`;
  cont.appendChild(div);
}

// --------------------------------------------------
// [6] Form Cartão e Modal “Ler Mais”
// --------------------------------------------------
async function mostrarCartaoForm(id) {
  document.getElementById('storyContainer').style.display   = 'none';
  document.getElementById('cartaoContainer').style.display = 'block';
  const { data:h } = await supabase.from('historias').select('*,cartoes(*)').eq('id', id).single();
  const cart = h.cartoes?.[0] || {};
  document.getElementById('titulo_cartao').value  = cart.titulo_cartao  || '';
  document.getElementById('sinopse_cartao').value = cart.sinopse_cartao || '';
  document.getElementById('data_criacao').value   = cart.data_criacao
    ? cart.data_criacao.split('T')[0]
    : new Date().toISOString().split('T')[0];
  document.getElementById('autor_cartao').value   = cart.autor_cartao     || '';

  // repopula categorias
  const { data:cats } = await supabase
    .from('historia_categorias')
    .select('categoria_id')
    .eq('historia_id', id);
  document.querySelectorAll('.categorias input[name="categoria"]')
    .forEach(chk => chk.checked = false);
  cats.forEach(ca => {
    const chk = document.querySelector(`.categorias input[value="${ca.categoria_id}"]`);
    if (chk) chk.checked = true;
  });

  document.getElementById('btnPublicarCartao').onclick = () => publicarCartao(id);
  document.getElementById('btnLerMais').onclick        = () => lerMais(id);
  document.getElementById('btnVoltar').onclick        = () => {
    document.getElementById('cartaoContainer').style.display = 'none';
    document.getElementById('storyContainer').style.display  = 'block';
  };
}

async function publicarCartao(id) {
  if (!confirm('Publicar cartão? Conteúdo fica definitivo.')) return;
  const titulo = document.getElementById('titulo_cartao').value.trim();
  const sinopse= document.getElementById('sinopse_cartao').value.trim();
  const dataCri= document.getElementById('data_criacao').value;
  const autor  = document.getElementById('autor_cartao').value.trim();
  const catsSel= Array.from(
    document.querySelectorAll('.categorias input[name="categoria"]:checked')
  ).map(c => +c.value);

  if (!titulo||!sinopse||catsSel.length===0) {
    return alert('Título, sinopse e ao menos 1 categoria são obrigatórios.');
  }

  await supabase.from('cartoes').upsert({
    historia_id:    id,
    titulo_cartao:  titulo,
    sinopse_cartao: sinopse,
    autor_cartao:   autor,
    data_criacao:   dataCri
  });

  const { data:{user} } = await supabase.auth.getUser();
  await supabase.from('historia_categorias').delete().eq('historia_id', id);
  if (catsSel.length) {
    await supabase.from('historia_categorias').insert(
      catsSel.map(cat => ({ historia_id: id, categoria_id: cat, user_id: user.id }))
    );
  }

  alert('Cartão publicado com sucesso!');
}

async function lerMais(id) {
  document.getElementById('modalOverlay').style.display = 'flex';
  const { data:h } = await supabase.from('historias')
    .select('titulo,descricao').eq('id', id).single();
  document.getElementById('modalTitulo').textContent    = h.titulo;
  document.getElementById('modalDescricao').textContent = h.descricao;

  const { data:c } = await supabase.from('cartoes')
    .select('*').eq('historia_id', id).single();
  if (c) {
    document.getElementById('modalCartaoTitulo').textContent   = c.titulo_cartao;
    document.getElementById('modalCartaoSinopse').textContent  = c.sinopse_cartao;
    document.getElementById('modalCartaoData').textContent     = c.data_criacao;
    document.getElementById('modalCartaoAutor').textContent    = c.autor_cartao;
    const { data:cats2 } = await supabase.from('historia_categorias')
      .select('categoria_id').eq('historia_id', id);
    document.getElementById('modalCartaoCategorias').textContent =
      cats2.map(x => x.categoria_id).join(', ');
  }
}
