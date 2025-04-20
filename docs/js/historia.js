// HISTORIA.JS - Integração com Supabase
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://<sua-instancia>.supabase.co';
const SUPABASE_KEY = '<sua-anon-key>';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let isTitleListVisible = false;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await exibirUsuarioLogado();
    await mostrarHistorias();
  } catch (err) {
    console.error('Erro na inicialização:', err);
  }

  const form = document.getElementById('storyForm');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      await handleSubmit();
    });
  } else {
    console.error('Elemento storyForm não encontrado');
  }

  const novaBtn = document.getElementById('novaHistoriaBtn');
  if (novaBtn) {
    novaBtn.addEventListener('click', () => {
      if (confirm('Tem certeza de que deseja começar uma nova história?')) {
        limparFormulario();
        removerExibicaoHistoria();
      }
    });
  }

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

  document.querySelectorAll('input[name="categoria"]').forEach(chk => {
    chk.addEventListener('change', () => {
      const subDiv = document.getElementById('sub' + chk.value.replace(/\s+/g, ''));
      if (subDiv) {
        subDiv.style.display = chk.checked ? 'block' : 'none';
        if (!chk.checked) subDiv.querySelectorAll('input').forEach(i => i.checked = false);
      }
    });
  });

  const modal = document.getElementById('modalOverlay');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal || e.target.id === 'btnFecharModal') {
        modal.style.display = 'none';
      }
    });
  }
});

async function handleSubmit() {
  const tituloEl = document.getElementById('titulo');
  const descricaoEl = document.getElementById('descricao');
  if (!tituloEl || !descricaoEl) {
    alert('Campos de título ou descrição não encontrados.');
    return;
  }
  const titulo = tituloEl.value.trim();
  const descricao = descricaoEl.value.trim();
  if (!titulo || !descricao) {
    alert('Preencha o título e a descrição!');
    return;
  }

  const cartao = {
    titulo_cartao: document.getElementById('cartaoTitulo')?.value.trim() || '',
    sinopse_cartao: document.getElementById('cartaoSinopse')?.value.trim() || '',
    autor_cartao: document.getElementById('cartaoAutor')?.value.trim() || '',
    data_criacao: document.getElementById('cartaoData')?.value.trim() || new Date().toISOString().split('T')[0]
  };

  try {
    await salvarHistoria(titulo, descricao, cartao);
  } catch (err) {
    console.error('Erro ao salvar:', err);
    alert('Erro ao salvar: ' + err.message);
  }
}

function toggleTitleList(show) {
  const list = document.getElementById('titleListLeft');
  if (!list) return;
  list.classList.toggle('visible', show);
  isTitleListVisible = show;
}

async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;
  userArea.innerHTML = '';
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const user = data.user;
  if (user) {
    const { data: profile, error: errProf } = await supabase
      .from('profiles').select('username').eq('id', user.id).single();
    if (errProf) throw errProf;
    userArea.textContent = profile.username;
    userArea.onclick = async () => {
      if (confirm('Deseja fazer logout?')) await supabase.auth.signOut().then(() => location.reload());
    };
  } else {
    userArea.innerHTML = `<a href=\"Criacao.html\" style=\"color:white;\"><i class=\"fas fa-user\"></i> Login</a>`;
  }
}

async function mostrarHistorias() {
  const ul = document.getElementById('titleListUl');
  if (!ul) return;
  const { data: historias, error } = await supabase
    .from('historias').select('id, titulo').order('data_criacao', { ascending: false });
  if (error) throw error;
  ul.innerHTML = '';
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
  [{ text: 'Cartão', fn: mostrarCartaoForm }, { text: 'Editar', fn: editarHistoria }, { text: 'Excluir', fn: excluirHistoria }]
    .forEach(({ text, fn }) => {
      const btn = document.createElement('button'); btn.textContent = text;
      btn.onclick = e => { e.stopPropagation(); fn(storyID); menu.remove(); };
      menu.appendChild(btn);
    });
  li.appendChild(menu);
}

async function salvarHistoria(titulo, descricao, cartao) {
  const form = document.getElementById('storyForm');
  const editID = form?.dataset.editId;
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const user = authData.user;
  if (!user) throw new Error('Usuário não autenticado');

  const categorias = Array.from(document.querySelectorAll('input[name="categoria"]:checked'))
    .map(i => Number(i.value));

  if (!editID) {
    const { data: newStories, error: insertErr } = await supabase
      .from('historias').insert([{ titulo, descricao, user_id: user.id, data_criacao: new Date().toISOString() }])
      .select('id');
    if (insertErr) throw insertErr;
    const newId = newStories[0].id;
    if (categorias.length) {
      const { error: catErr } = await supabase.from('historia_categorias')
        .insert(categorias.map(catId => ({ historia_id: newId, categoria_id: catId })));
      if (catErr) throw catErr;
    }
    if (cartao.titulo_cartao && cartao.sinopse_cartao) {
      const { error: cardErr } = await supabase.from('cartoes')
        .insert([{ historia_id: newId, ...cartao }]);
      if (cardErr) throw cardErr;
    }
  } else {
    const id = Number(editID);
    const { error: updErr } = await supabase.from('historias')
      .update({ titulo, descricao }).eq('id', id);
    if (updErr) throw updErr;
    const { error: delCatErr } = await supabase.from('historia_categorias')
      .delete().eq('historia_id', id);
    if (delCatErr) throw delCatErr;
    if (categorias.length) {
      const { error: insCatErr } = await supabase.from('historia_categorias')
        .insert(categorias.map(catId => ({ historia_id: id, categoria_id: catId })));
      if (insCatErr) throw insCatErr;
    }
    const { data: existingCart, error: selCardErr } = await supabase.from('cartoes')
      .select('id').eq('historia_id', id).single();
    if (selCardErr) throw selCardErr;
    if (existingCart) {
      const { error: updCardErr } = await supabase.from('cartoes')
        .update({ historia_id: id, ...cartao }).eq('id', existingCart.id);
      if (updCardErr) throw updCardErr;
    } else if (cartao.titulo_cartao && cartao.sinopse_cartao) {
      const { error: insCardErr } = await supabase.from('cartoes')
        .insert([{ historia_id: id, ...cartao }]);
      if (insCardErr) throw insCardErr;
    }
  }
  alert('Operação concluída com sucesso!');
  limparFormulario(); removerExibicaoHistoria(); await mostrarHistorias();
}

async function excluirHistoria(id) {
  if (!confirm('Deseja excluir a história?')) return;
  const errs = [];
  const del1 = await supabase.from('historia_categorias').delete().eq('historia_id', id);
  if (del1.error) errs.push(del1.error);
  const del2 = await supabase.from('cartoes').delete().eq('historia_id', id);
  if (del2.error) errs.push(del2.error);
  const del3 = await supabase.from('historias').delete().eq('id', id);
  if (del3.error) errs.push(del3.error);
  if (errs.length) console.error('Erros ao excluir:', errs);
  alert('História excluída.');
  limparFormulario(); removerExibicaoHistoria(); await mostrarHistorias();
}

function limparFormulario() {
  ['titulo','descricao','cartaoTitulo','cartaoSinopse','cartaoAutor','cartaoData']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = id === 'cartaoData' ? new Date().toISOString().split('T')[0] : '';
    });
  const f = document.getElementById('storyForm'); if (f) f.dataset.editId = '';
  const btn = document.querySelector('.btn[type="submit"]');
  if (btn) btn.textContent = 'Salvar';
}

async function editarHistoria(id) {
  const { data, error } = await supabase.from('historias').select('*').eq('id', id).single();
  if (error) return console.error(error);
  ['titulo','descricao'].forEach(field => {
    const el = document.getElementById(field);
    if (el) el.value = data[field];
  });
  const f = document.getElementById('storyForm'); if (f) f.dataset.editId = data.id;
  const btn = document.querySelector('.btn[type="submit"]'); if (btn) btn.textContent = 'Atualizar';
  exibirHistoriaNoContainer(id);
  const { data: cats, error: catErr } = await supabase.from('historia_categorias')
    .select('categoria_id').eq('historia_id', id);
  if (catErr) return console.error(catErr);
  document.querySelectorAll('input[name="categoria"]').forEach(chk => chk.checked = false);
  cats.forEach(c => {
    const chk = document.querySelector(`input[value="${c.categoria_id}"]`);
    if (chk) chk.checked = true;
  });
}

async function exibirHistoriaNoContainer(id) {
  const c = document.getElementById('storyContainer'); if (!c) return;
  const existing = c.querySelector('.exibicao-historia'); if (existing) existing.remove();
  const { data, error } = await supabase.from('historias').select('titulo, descricao').eq('id', id).single();
  if (error) return console.error(error);
  const d = document.createElement('div'); d.classList.add('exibicao-historia');
  d.style.border = '1px solid #ccc'; d.style.marginTop = '10px'; d.style.padding = '10px';
  d.innerHTML = `<h3>${data.titulo}</h3><p>${data.descricao}</p>`;
  c.appendChild(d);
}

async function mostrarCartaoForm(id) {
  const storyC = document.getElementById('storyContainer');
  const cardC = document.getElementById('cartaoContainer');
  if (storyC) storyC.style.display = 'none';
  if (cardC) cardC.style.display = 'block';
  const { data: hist, error: histErr } = await supabase.from('historias')
    .select('*, cartoes(*)').eq('id', id).single();
  if (histErr) return console.error(histErr);
  const cart = hist.cartoes?.[0] || {};
  ['cartaoTitulo','cartaoSinopse','cartaoAutor'].forEach(field => {
    const el = document.getElementById(field);
    if (el) el.value = cart[field] || '';
  });
  const dataEl = document.getElementById('cartaoData');
  if (dataEl) dataEl.value = cart.data_criacao ? cart.data_criacao.split('T')[0] : new Date().toISOString().split('T')[0];
  const { data: cats, error: catErr } = await supabase.from('historia_categorias')
    .select('categoria_id').eq('historia_id', id);
  if (catErr) return console.error(catErr);
  document.querySelectorAll('input[name="categoria"]').forEach(chk => chk.checked = false);
  cats.forEach(c => {
    const chk = document.querySelector(`input[value="${c.categoria_id}"]`);
    if (chk) chk.checked = true;
  });
  const btnPub = document.getElementById('btnPublicarCartao'); if (btnPub) btnPub.onclick = () => publicarCartao(id);
  const btnLer = document.getElementById('btnLerMais'); if (btnLer) btnLer.onclick = () => lerMais(id);
  const btnVol = document.getElementById('btnVoltar'); if (btnVol) btnVol.onclick = () => {
    if (cardC) cardC.style.display = 'none';
    if (storyC) storyC.style.display = 'block';
  };
}

async function publicarCartao(id) {
  if (!confirm(
    'Aviso: Ao publicar o cartão, o conteúdo fica definitivo.\nEdições futuras não serão refletidas no cartão.\n\nContinuar?'
  )) return;
  const t = document.getElementById('cartaoTitulo')?.value.trim();
  const s = document.getElementById('cartaoSinopse')?.value.trim();
  const d = document.getElementById('cartaoData')?.value.trim();
  const a = document.getElementById('cartaoAutor')?.value.trim();
  if (!t || !s) { alert('Preencha título e sinopse do Cartão!'); return; }
  const { data: existing, error: selErr } = await supabase.from('cartoes').select('id').eq('historia_id', id).single();
  if (selErr) console.error(selErr);
  const payload = { historia_id: id, titulo_cartao: t, sinopse_cartao: s, autor_cartao: a, data_criacao: d };
  const action = existing
    ? supabase.from('cartoes').update(payload).eq('id', existing.id)
    : supabase.from('cartoes').insert([payload]);
  const { error: actErr } = await action;
  if (actErr) return console.error(actErr);
  alert('Cartão publicado com sucesso!');
}

async function lerMais(id) {
  const m = document.getElementById('modalOverlay'); if (m) m.style.display = 'flex';
  const { data: s, error: errS } = await supabase.from('historias').select('titulo, descricao').eq('id', id).single();
  if (errS) return console.error(errS);
  document.getElementById('modalTitulo').textContent = s.titulo;
  document.getElementById('modalDescricao').textContent = s.descricao;
  const { data: c, error: errC } = await supabase.from('cartoes').select('*').eq('historia_id', id).single();
  if (errC) console.error(errC);
  if (c) {
    document.getElementById('modalCartaoTitulo').textContent = c.titulo_cartao;
    document.getElementById('modalCartaoSinopse').textContent = c.sinopse_cartao;
    document.getElementById('modalCartaoData').textContent = c.data_criacao;
    document.getElementById('modalCartaoAutor').textContent = c.autor_cartao;
    const { data: cats2, error: errCat2 } = await supabase.from('historia_categorias')
      .select('categoria_id').eq('historia_id', id);
    if (errCat2) console.error(errCat2);
    document.getElementById('modalCartaoCategorias').textContent = cats2?.map(x => x.categoria_id).join(', ');
  }
}
