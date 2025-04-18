// HISTORIA.JS - Integração com Supabase
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://<sua-instancia>.supabase.co';
const SUPABASE_KEY = '<sua-anon-key>';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let isTitleListVisible = false;

document.addEventListener('DOMContentLoaded', async () => {
  // Inicialização de usuário e histórias
  await exibirUsuarioLogado();
  await mostrarHistorias();

  // Submit do formulário de história
  const form = document.getElementById('storyForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const titulo = document.getElementById('titulo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    if (!titulo || !descricao) {
      alert('Preencha o título e a descrição!');
      return;
    }
    try {
      await salvarHistoria(titulo, descricao);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar história: ' + err.message);
    }
  });

  // Botão Nova História
  const novaBtn = document.getElementById('novaHistoriaBtn');
  if (novaBtn) {
    novaBtn.addEventListener('click', () => {
      if (confirm('Tem certeza de que deseja começar uma nova história?')) {
        limparFormulario();
        removerExibicaoHistoria();
      }
    });
  }

  // Hover lateral para mostrar lista de títulos
  document.body.addEventListener('mousemove', e => {
    if (e.clientX < 50 && !isTitleListVisible) toggleTitleList(true);
  });
  document.body.addEventListener('mouseleave', () => {
    if (isTitleListVisible) toggleTitleList(false);
  });
  document.body.addEventListener('click', e => {
    const list = document.getElementById('titleListLeft');
    if (isTitleListVisible && list && !list.contains(e.target)) {
      toggleTitleList(false);
    }
  });

  // Eventos de categorias no Cartão (mostrar/ocultar subcategorias)
  document.querySelectorAll('input[name="categoria"]').forEach(chk => {
    chk.addEventListener('change', () => {
      const subDiv = document.getElementById('sub' + chk.value.replace(/\s+/g, ''));
      if (subDiv) {
        subDiv.style.display = chk.checked ? 'block' : 'none';
        if (!chk.checked) subDiv.querySelectorAll('input').forEach(i => i.checked = false);
      }
    });
  });

  // Fechar modal Ler Mais
  const modal = document.getElementById('modalOverlay');
  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.id === 'btnFecharModal') {
      modal.style.display = 'none';
    }
  });
});

// Função para mostrar/ocultar lista de títulos
function toggleTitleList(show) {
  const list = document.getElementById('titleListLeft');
  if (!list) return;
  list.classList.toggle('visible', show);
  isTitleListVisible = show;
}

// Exibe o nome do usuário logado ou link de login
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  userArea.innerHTML = '';
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    userArea.textContent = profile.username;
    userArea.onclick = async () => {
      if (confirm('Deseja fazer logout?')) {
        await supabase.auth.signOut();
        location.reload();
      }
    };
  } else {
    userArea.innerHTML = `
      <a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
    userArea.onclick = null;
  }
}

// Carrega e exibe todas as histórias na lista lateral
async function mostrarHistorias() {
  const { data: historias } = await supabase
    .from('historias')
    .select('id, titulo')
    .order('data_criacao', { ascending: false });

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

// Exibe o menu de ações (Cartão, Editar, Excluir) para cada item
function toggleMenuOpcoes(li, storyID) {
  const existing = li.querySelector('.menu-opcoes');
  if (existing) return existing.remove();
  const menu = document.createElement('div');
  menu.classList.add('menu-opcoes');
  const actions = [
    { text: 'Cartão', fn: mostrarCartaoForm },
    { text: 'Editar', fn: editarHistoria },
    { text: 'Excluir', fn: excluirHistoria }
  ];
  actions.forEach(({ text, fn }) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.onclick = e => { e.stopPropagation(); fn(storyID); menu.remove(); };
    menu.appendChild(btn);
  });
  li.appendChild(menu);
}

// Salva nova história ou atualiza existente
async function salvarHistoria(titulo, descricao) {
  const form = document.getElementById('storyForm');
  const editID = form.dataset.editId;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { alert('Faça login para salvar histórias.'); return; }

  if (!editID) {
    // Inserção
    const { data: [newStory] } = await supabase
      .from('historias')
      .insert([{ titulo, descricao, user_id: user.id, data_criacao: new Date().toISOString() }])
      .select('id');
    await vincularCategorias(newStory.id);
    alert('História salva com sucesso (nova)!');
    limparFormulario();
    removerExibicaoHistoria();
  } else {
    // Atualização
    await supabase.from('historias').update({ titulo, descricao }).eq('id', editID);
    await supabase.from('historia_categorias').delete().eq('historia_id', editID);
    await vincularCategorias(editID);
    alert('História atualizada com sucesso!');
    exibirHistoriaNoContainer(editID);
  }
  await mostrarHistorias();
}

// Exclui história e seus relacionamentos
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

// Associa categorias selecionadas à história
async function vincularCategorias(historiaId) {
  const checados = Array.from(document.querySelectorAll('input[name="categoria"]:checked'))
    .map(i => i.value);
  if (!checados.length) return;
  await supabase.from('historia_categorias').insert(
    checados.map(c => ({ historia_id: historiaId, categoria_id: c }))
  );
}

// Limpa formulário de criação/edição de história
function limparFormulario() {
  document.getElementById('titulo').value = '';
  document.getElementById('descricao').value = '';
  const f = document.getElementById('storyForm');
  f.dataset.editId = '';
  document.querySelector('.btn[type="submit"]').textContent = 'Salvar';
}

// Remove exibição atual da história no container
function removerExibicaoHistoria() {
  const c = document.getElementById('storyContainer');
  const o = c.querySelector('.exibicao-historia');
  if (o) o.remove();
}

// Preenche formulário para edição e exibe container
async function editarHistoria(id) {
  const { data } = await supabase.from('historias').select('*').eq('id', id).single();
  document.getElementById('titulo').value = data.titulo;
  document.getElementById('descricao').value = data.descricao;
  const f = document.getElementById('storyForm');
  f.dataset.editId = data.id;
  document.querySelector('.btn[type="submit"]').textContent = 'Atualizar';
  exibirHistoriaNoContainer(id);
  // Carrega categorias já associadas
  const { data: cats } = await supabase.from('historia_categorias')
    .select('categoria_id').eq('historia_id', id);
  document.querySelectorAll('input[name="categoria"]').forEach(chk => chk.checked = false);
  cats.forEach(c => {
    const chk = document.querySelector(`input[value="${c.categoria_id}"]`);
    if (chk) chk.checked = true;
  });
}

// Exibe história no container abaixo do formulário
async function exibirHistoriaNoContainer(id) {
  const { data: s } = await supabase.from('historias').select('titulo, descricao').eq('id', id).single();
  removerExibicaoHistoria();
  const c = document.getElementById('storyContainer');
  const d = document.createElement('div');
  d.classList.add('exibicao-historia');
  d.style.border = '1px solid #ccc';
  d.style.marginTop = '10px';
  d.style.padding = '10px';
  d.innerHTML = `<h3>${s.titulo}</h3><p>${s.descricao}</p>`;
  c.appendChild(d);
}

// Abre formulário de Cartão para a história selecionada
async function mostrarCartaoForm(id) {
  document.getElementById('storyContainer').style.display = 'none';
  document.getElementById('cartaoContainer').style.display = 'block';
  // Carrega dados da história e cartão
  const { data: hist } = await supabase.from('historias')
    .select('*, cartoes(*)').eq('id', id).single();
  const cart = hist.cartoes?.[0] || {};

  // Preenche campos do Cartão
  document.getElementById('cartaoTitulo').value = cart.titulo_cartao || '';
  document.getElementById('cartaoSinopse').value = cart.sinopse_cartao || '';
  document.getElementById('cartaoData').value = cart.data_criacao
    ? cart.data_criacao.split('T')[0]
    : new Date().toISOString().split('T')[0];
  document.getElementById('cartaoAutor').value = cart.autor_cartao || '';

  // Carrega e marca categorias associadas
  const { data: cats } = await supabase.from('historia_categorias')
    .select('categoria_id').eq('historia_id', id);
  document.querySelectorAll('input[name="categoria"]').forEach(chk => chk.checked = false);
  cats.forEach(c => {
    const chk = document.querySelector(`input[value="${c.categoria_id}"]`);
    if (chk) chk.checked = true;
  });

  // Atualiza botões
  document.getElementById('btnPublicarCartao').onclick = () => publicarCartao(id);
  document.getElementById('btnLerMais').onclick = () => lerMais(id);
  document.getElementById('btnVoltar').onclick = () => {
    document.getElementById('cartaoContainer').style.display = 'none';
    document.getElementById('storyContainer').style.display = 'block';
  };
}

// Publica ou atualiza Cartão na tabela 'cartoes'
async function publicarCartao(id) {
  if (!confirm(
    'Aviso: Ao publicar o cartão, o conteúdo fica definitivo.\nEdições futuras não serão refletidas no cartão.\n\nContinuar?'
  )) {
    alert('Publicação cancelada.');
    return;
  }
  const t = document.getElementById('cartaoTitulo').value.trim();
  const s = document.getElementById('cartaoSinopse').value.trim();
  const d = document.getElementById('cartaoData').value.trim();
  const a = document.getElementById('cartaoAutor').value.trim();
  if (!t || !s) { alert('Preencha título e sinopse do Cartão!'); return; }
  const { data: ex } = await supabase.from('cartoes').select('id').eq('historia_id', id).single();
  const payload = { historia_id: id, titulo_cartao: t, sinopse_cartao: s, autor_cartao: a, data_criacao: d };
  if (ex) await supabase.from('cartoes').update(payload).eq('id', ex.id);
  else await supabase.from('cartoes').insert([payload]);
  alert('Cartão publicado com sucesso!');
}

// Exibe modal com detalhes completos da história e do cartão
async function lerMais(id) {
  const m = document.getElementById('modalOverlay');
  m.style.display = 'flex';
  const { data: s } = await supabase.from('historias').select('titulo, descricao').eq('id', id).single();
  const { data: c } = await supabase.from('cartoes').select('*').eq('historia_id', id).single();
  document.getElementById('modalTitulo').textContent = s.titulo;
  document.getElementById('modalDescricao').textContent = s.descricao;
  if (c) {
    document.getElementById('modalCartaoTitulo').textContent = c.titulo_cartao;
    document.getElementById('modalCartaoSinopse').textContent = c.sinopse_cartao;
    document.getElementById('modalCartaoData').textContent = c.data_criacao;
    document.getElementById('modalCartaoAutor').textContent = c.autor_cartao;
    const { data: cats2 } = await supabase.from('historia_categorias')
      .select('categoria_id').eq('historia_id', id);
    document.getElementById('modalCartaoCategorias').textContent = cats2.map(x => x.categoria_id).join(', ');
  }
}
