// js/hisotirasqueescrevi.js
import { supabase } from "./supabase.js";

let modoCorrido        = true;
let partesHistoria     = [];
let parteAtual         = 0;
let currentStoryId     = null;
let textoCompleto      = "";

document.addEventListener('DOMContentLoaded', () => {
  exibirUsuarioLogado();
  mostrarHistorias();
  configurarFormSalvar();
  configurarBusca();
  configurarLeitura();
  configurarToggleModo();
});

/** [A] LOGIN/LOGOUT **/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) {
    userArea.innerHTML = `<a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
    return;
  }
  const { data: profile } = await supabase
    .from('profiles').select('username').eq('id', session.user.id).single();
  const nome = profile?.username || session.user.email;
  userArea.textContent = nome;
  userArea.style.cursor = 'pointer';
  userArea.onclick = () => {
    if (confirm('Deseja fazer logout?')) {
      supabase.auth.signOut().then(() => location.href = 'Criacao.html');
    }
  };
}

/** [B] MOSTRAR NA LISTA LATERAL **/
function mostrarHistorias() {
  const ul = document.getElementById('titleListUl');
  ul.innerHTML = "";
  const historias = JSON.parse(localStorage.getItem('historias') || '[]');
  historias.forEach((h, idx) => {
    // garantir campos mínimos
    if (!h.cartao) {
      h.cartao = {
        tituloCartao:     h.titulo || "(Sem Título)",
        autorCartao:      h.autor  || "Anônimo",
        sinopseCartao:    (h.descricao||"").slice(0,100),
        historiaCompleta: h.descricao || "",
        likes: 0,
        categorias: []
      };
    }
    const li = document.createElement('li');
    li.textContent = h.cartao.tituloCartao;
    li.style.position = 'relative';

    // botões de ação
    const btns = document.createElement('span');
    btns.className = 'buttons';

    const ler = document.createElement('button');
    ler.textContent = 'Ler';
    ler.onclick = () => abrirHistoria(idx);

    const del = document.createElement('button');
    del.textContent = 'Excluir';
    del.onclick = () => excluirHistoria(idx);

    btns.append(ler, del);
    li.appendChild(btns);
    ul.appendChild(li);
  });
}

/** [C] EXCLUIR **/
function excluirHistoria(idx) {
  if (!confirm('Excluir esta história?')) return;
  const arr = JSON.parse(localStorage.getItem('historias') || '[]');
  arr.splice(idx,1);
  localStorage.setItem('historias', JSON.stringify(arr));
  mostrarHistorias();
}

/** [D] FORMULÁRIO DE SALVAR **/
function configurarFormSalvar() {
  const form = document.getElementById('formPrincipal');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const titulo   = form.titulo.value.trim();
    const descricao= form.descricao.value.trim();
    const autor    = form.autor.value.trim();
    if (!titulo || !descricao) {
      alert('Preencha título e descrição!');
      return;
    }
    salvarHistoria({ titulo, descricao, autor });
    limparFormulario();
    mostrarHistorias();
  });
}
function salvarHistoria({ titulo, descricao, autor }) {
  const arr = JSON.parse(localStorage.getItem('historias') || '[]');
  const nova = {
    id: Date.now().toString(),
    titulo,
    descricao,
    autor,
    cartao: {
      tituloCartao:     titulo,
      autorCartao:      autor || "Anônimo",
      sinopseCartao:    descricao.slice(0,100),
      historiaCompleta: descricao,
      likes: 0,
      categorias: []
    }
  };
  arr.push(nova);
  localStorage.setItem('historias', JSON.stringify(arr));
}
function limparFormulario() {
  document.getElementById('titulo').value = '';
  document.getElementById('autor').value  = '';
  document.getElementById('descricao').value = '';
}

/** [E] ABRIR HISTÓRIA **/
function abrirHistoria(idx) {
  const arr = JSON.parse(localStorage.getItem('historias') || '[]');
  const h   = arr[idx];
  if (!h) return alert('História não encontrada!');
  currentStoryId = h.id;
  textoCompleto  = h.cartao.historiaCompleta;
  document.getElementById('historia-titulo').textContent = h.cartao.tituloCartao;
  mostrarModoCorrido();
}

/** [F] MODO DE LEITURA **/
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
  if (modoCorrido) mostrarModoCorrido();
  else paginaPorLinhas(5);
}
function mostrarModoCorrido() {
  const cont = document.getElementById('historia-conteudo');
  cont.innerText = textoCompleto;
  document.getElementById('btn-voltar').style.display = 'none';
  document.getElementById('btn-continuar').style.display = 'none';
}
function paginaPorLinhas(linhasPorPagina) {
  const cont = document.getElementById('historia-conteudo');
  const linhas = textoCompleto.split('\n');
  partesHistoria = [];
  for (let i=0; i<linhas.length; i+=linhasPorPagina) {
    partesHistoria.push(linhas.slice(i,i+linhasPorPagina).join('\n'));
  }
  parteAtual = 0;
  exibirParte();
  document.getElementById('btn-voltar').style.display = 'inline-block';
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

/** [G] TOGGLE MODO **/
function configurarToggleModo() {
  document.getElementById('toggleMode').onclick = toggleReadingMode;
}

/** [H] PESQUISA INLINE **/
function configurarBusca() {
  const sb = document.getElementById('searchBar');
  const sr = document.getElementById('searchResults');
  sb.addEventListener('input', ()=> {
    const q = sb.value.toLowerCase();
    const arr = JSON.parse(localStorage.getItem('historias') || '[]')
      .filter(h => {
        const t = h.cartao?.tituloCartao?.toLowerCase() || '';
        const a = h.cartao?.autorCartao?.toLowerCase()  || '';
        return t.includes(q) || a.includes(q);
      });
    exibirSugestoes(arr);
  });
}
function exibirSugestoes(lista) {
  const sr = document.getElementById('searchResults');
  sr.innerHTML = '';
  if (lista.length===0) {
    sr.innerHTML = `<div style="padding:6px;">Nenhuma história</div>`;
  } else {
    lista.forEach(h=>{
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.style = 'padding:6px;border-bottom:1px solid #ccc;cursor:pointer';
      div.innerHTML = `<strong>${h.cartao.tituloCartao}</strong><br><em>${h.cartao.autorCartao}</em>`;
      div.onclick = ()=>{
        const todas = JSON.parse(localStorage.getItem('historias')||'[]');
        const idx = todas.findIndex(x=>x.id===h.id);
        abrirHistoria(idx);
        sr.style.display='none';
      };
      sr.appendChild(div);
    });
  }
  sr.style.display = 'block';
}
