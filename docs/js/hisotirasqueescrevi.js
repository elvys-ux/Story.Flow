import { supabase } from "./supabase.js";

let modoCorrido    = true;
let partesHistoria = [];
let parteAtual     = 0;
let currentStoryId = null;
let textoCompleto  = "";
let sessionUserId  = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // 1) sessão Supabase
  const { data:{ session } } = await supabase.auth.getSession();
  sessionUserId = session?.user?.id ?? null;

  // 2) exibir usuário e lista
  await exibirUsuarioLogado();
  await mostrarHistorias();

  // 3) configurar form, busca, leitura e toggle
  configurarFormSalvar();
  configurarBusca();
  configurarLeitura();
  configurarToggleModo();
}

async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  if (!sessionUserId) {
    area.innerHTML = `<a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
    return;
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', sessionUserId)
    .single();
  area.textContent = profile?.username || session.user.email;
  area.onclick = () => {
    if (confirm('Deseja sair?')) {
      supabase.auth.signOut().then(()=> location.href='Criacao.html');
    }
  };
}

async function mostrarHistorias() {
  const ul = document.getElementById('titleListUl');
  ul.innerHTML = "";
  // busca só as suas histórias
  const { data: stories, error } = await supabase
    .from('historias')
    .select('id, titulo, descricao')
    .eq('user_id', sessionUserId)
    .order('data_criacao', { ascending:false });

  if (error) return console.error(error);

  stories.forEach((h, idx) => {
    const li = document.createElement('li');
    li.textContent = h.titulo || '(Sem título)';

    const btns = document.createElement('span');
    btns.className = 'buttons';

    const ler = document.createElement('button');
    ler.textContent = 'Ler';
    ler.onclick = () => abrirHistoria(h);

    const del = document.createElement('button');
    del.textContent = 'Excluir';
    del.onclick = () => excluirHistoria(h.id);

    btns.append(ler, del);
    li.appendChild(btns);
    ul.appendChild(li);
  });
}

async function excluirHistoria(id) {
  if (!confirm('Excluir esta história?')) return;
  const { error } = await supabase
    .from('historias')
    .delete()
    .eq('id', id);
  if (error) return console.error(error);
  mostrarHistorias();
}

function configurarFormSalvar() {
  const form = document.getElementById('formPrincipal');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const titulo    = form.titulo.value.trim();
    const descricao = form.descricao.value.trim();
    const autor     = form.autor.value.trim() || null;
    if (!titulo || !descricao) {
      alert('Preencha título e descrição!');
      return;
    }
    const { error } = await supabase
      .from('historias')
      .insert([{ titulo, descricao, user_id: sessionUserId }]);
    if (error) return console.error(error);
    form.reset();
    mostrarHistorias();
  });
}

function abrirHistoria(h) {
  currentStoryId = h.id;
  textoCompleto  = h.descricao;
  document.getElementById('historia-titulo').textContent = h.titulo;
  mostrarModoCorrido();
}

function configurarLeitura() {
  document.getElementById('btn-voltar').onclick    = voltarPagina;
  document.getElementById('btn-continuar').onclick = continuarPagina;
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') voltarPagina();
    if (e.key === 'ArrowRight') continuarPagina();
  });
}

function toggleReadingMode() {
  modoCorrido = !modoCorrido;
  modoCorrido ? mostrarModoCorrido() : paginaPorLinhas(5);
}

function mostrarModoCorrido() {
  const cont = document.getElementById('historia-conteudo');
  cont.innerText = textoCompleto;
  document.getElementById('btn-voltar').style.display    = 'none';
  document.getElementById('btn-continuar').style.display = 'none';
}

function paginaPorLinhas(n) {
  const lines = textoCompleto.split('\n');
  partesHistoria = [];
  for (let i=0; i<lines.length; i+=n) {
    partesHistoria.push(lines.slice(i,i+n).join('\n'));
  }
  parteAtual = 0;
  exibirParte();
  document.getElementById('btn-voltar').style.display    = 'inline-block';
  document.getElementById('btn-continuar').style.display = 'inline-block';
}

function exibirParte() {
  document.getElementById('historia-conteudo').innerText =
    partesHistoria[parteAtual];
}

function voltarPagina() {
  if (parteAtual>0) { parteAtual--; exibirParte(); }
}

function continuarPagina() {
  if (parteAtual<partesHistoria.length-1) { parteAtual++; exibirParte(); }
}

function configurarToggleModo() {
  document.getElementById('toggleMode').onclick = toggleReadingMode;
}

function configurarBusca() {
  const sb = document.getElementById('searchBar');
  const sr = document.getElementById('searchResults');
  sb.addEventListener('input', async () => {
    const q = sb.value.trim().toLowerCase();
    if (!q) { sr.style.display='none'; return; }
    const { data: matches } = await supabase
      .from('historias')
      .select('id, titulo')
      .eq('user_id', sessionUserId)
      .ilike('titulo', `%${q}%`);
    sr.innerHTML = '';
    matches.forEach(h => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.textContent = h.titulo;
      div.onclick = () => {
        abrirHistoria(h);
        sr.style.display='none';
      };
      sr.appendChild(div);
    });
    sr.style.display = matches.length ? 'block' : 'none';
  });
}

configurarLeitura();
configurarToggleModo();
configurarBusca();
