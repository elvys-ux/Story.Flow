// js/hisotirasqueescrevi.js
import { supabase } from "./supabase.js";

let modoCorrido    = true;
let partesHistoria = [];
let parteAtual     = 0;
let currentStoryId = null;
let textoCompleto  = "";
let sessionUserId  = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // 1) obter sessão e userId
  const { data:{ session } } = await supabase.auth.getSession();
  sessionUserId = session?.user?.id ?? null;

  // 2) exibir login e lista
  await exibirUsuarioLogado();
  mostrarHistorias();

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
    .from('profiles').select('username').eq('id', sessionUserId).single();
  area.textContent = profile?.username || session.user.email;
  area.onclick = () => {
    if (confirm('Deseja sair?')) {
      supabase.auth.signOut().then(()=> location.href='Criacao.html');
    }
  };
}

function mostrarHistorias() {
  const ul = document.getElementById('titleListUl');
  ul.innerHTML = "";

  // carrega tudo, filtra pelo usuário
  const todas = JSON.parse(localStorage.getItem('historias')||'[]')
                  .filter(h => h.userId === sessionUserId);

  todas.forEach((h, idx) => {
    const li = document.createElement('li');
    li.textContent = h.cartao?.tituloCartao || h.titulo;
    // botões
    const btns = document.createElement('span');
    btns.className = 'buttons';

    const ler = document.createElement('button');
    ler.textContent = 'Ler';
    ler.onclick = ()=> abrirHistoria(idx);

    const del = document.createElement('button');
    del.textContent = 'Excluir';
    del.onclick = ()=> excluirHistoria(idx);

    btns.append(ler, del);
    li.appendChild(btns);
    ul.appendChild(li);
  });
}

function excluirHistoria(idx) {
  if (!confirm('Excluir esta história?')) return;
  let arr = JSON.parse(localStorage.getItem('historias')||'[]');
  arr = arr.filter((_,i)=> i!==idx);
  localStorage.setItem('historias', JSON.stringify(arr));
  mostrarHistorias();
}

function configurarFormSalvar() {
  const form = document.getElementById('formPrincipal');
  form.addEventListener('submit', e=>{
    e.preventDefault();
    const titulo   = form.titulo.value.trim();
    const descricao= form.descricao.value.trim();
    const autor    = form.autor.value.trim();
    if (!titulo||!descricao) {
      alert('Preencha título e descrição!');
      return;
    }
    salvarHistoria({ titulo, descricao, autor });
    form.reset();
    mostrarHistorias();
  });
}

function salvarHistoria({ titulo, descricao, autor }) {
  const arr = JSON.parse(localStorage.getItem('historias')||'[]');
  const nova = {
    id: Date.now().toString(),
    userId: sessionUserId,
    titulo,
    descricao,
    autor,
    cartao: {
      tituloCartao:     titulo,
      autorCartao:      autor||"Anônimo",
      sinopseCartao:    descricao.slice(0,100),
      historiaCompleta: descricao,
      likes: 0,
      categorias: []
    }
  };
  arr.push(nova);
  localStorage.setItem('historias', JSON.stringify(arr));
}

function abrirHistoria(idx) {
  const arr = JSON.parse(localStorage.getItem('historias')||'[]')
                .filter(h=>h.userId===sessionUserId);
  const h = arr[idx];
  if (!h) return;
  currentStoryId = h.id;
  textoCompleto  = h.cartao.historiaCompleta;
  document.getElementById('historia-titulo').textContent = h.cartao.tituloCartao;
  mostrarModoCorrido();
}

function configurarLeitura() {
  document.getElementById('btn-voltar').onclick    = voltarPagina;
  document.getElementById('btn-continuar').onclick = continuarPagina;
  document.addEventListener('keydown', e=>{
    if (e.key==='ArrowLeft') voltarPagina();
    if (e.key==='ArrowRight') continuarPagina();
  });
}

function toggleReadingMode() {
  modoCorrido = !modoCorrido;
  if (modoCorrido) mostrarModoCorrido();
  else paginaPorLinhas(5);
}

function mostrarModoCorrido() {
  const c = document.getElementById('historia-conteudo');
  c.innerText = textoCompleto;
  document.getElementById('btn-voltar').style.display = 'none';
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
  document.getElementById('historia-conteudo').innerText = partesHistoria[parteAtual];
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
  sb.addEventListener('input', ()=> {
    const q = sb.value.toLowerCase();
    const todas = JSON.parse(localStorage.getItem('historias')||'[]')
                    .filter(h=>h.userId===sessionUserId);
    const filt = todas.filter(h=>{
      const t = (h.cartao.tituloCartao||"").toLowerCase();
      const a = (h.cartao.autorCartao||"").toLowerCase();
      return t.includes(q)||a.includes(q);
    });
    exibirSugestoes(filt);
  });
}

function exibirSugestoes(lista) {
  const sr = document.getElementById('searchResults');
  sr.innerHTML = '';
  if (!lista.length) {
    sr.innerHTML = `<div style="padding:6px;">Nenhuma história</div>`;
  } else {
    lista.forEach(h=>{
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.textContent = h.cartao.tituloCartao;
      div.onclick = ()=>{
        const todas = JSON.parse(localStorage.getItem('historias')||'[]')
                        .filter(x=>x.userId===sessionUserId);
        const idx = todas.findIndex(x=>x.id===h.id);
        abrirHistoria(idx);
        sr.style.display='none';
      };
      sr.appendChild(div);
    });
  }
  sr.style.display = 'block';
}
