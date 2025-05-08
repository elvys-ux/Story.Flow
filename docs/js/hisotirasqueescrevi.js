// hisotirasqueescrevi.js
import { supabase } from './supabase.js';
import { exibirUsuarioLogado } from './userDisplay.js';

// Elementos do DOM
const ulLateral        = document.getElementById('titleListUl');
const searchBar        = document.getElementById('searchBar');
const searchBtn        = document.getElementById('searchBtn');
const searchResults    = document.getElementById('searchResults');
const modal            = document.getElementById('modal-historia');
const modalTitulo      = document.getElementById('modal-titulo');
const modalConteudo    = document.getElementById('modal-conteudo');
const btnFecharModal   = document.getElementById('btn-fechar-modal');
const btnVoltar        = document.getElementById('btn-voltar');
const btnContinuar     = document.getElementById('btn-continuar');
const toggleModeBtn    = document.getElementById('toggleMode');
const conteudoEl       = document.getElementById('historia-conteudo');

// Estado da leitura
let modoCorrido   = true;
let partesHistoria= [];
let parteAtual    = 0;
let textoCompleto = '';
let currentStoryId= null;
const wrapWidth   = 80;
const lineHeightPx= 22;

// [A] Exibir utilizador
exibirUsuarioLogado();

// [B] Carregar lista lateral (todas as histórias do user)
async function carregarHistoriasDoUsuario() {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return;

  const { data: historias, error } = await supabase
    .from('historias')
    .select('id, titulo, descricao, data_criacao')
    .eq('user_id', user.id)
    .order('data_criacao', { ascending: false });

  if (error) {
    console.error('Erro ao carregar histórias do usuário:', error);
    return;
  }

  ulLateral.innerHTML = '';
  historias.forEach(h => {
    const li = document.createElement('li');
    li.textContent = h.titulo || '(Sem título)';
    li.addEventListener('click', () => abrirHistoria(h));
    ulLateral.appendChild(li);
  });
}

// [C] Pesquisa global de publicadas (com cartão)
async function pesquisarHistoriasPublicadas(term) {
  const q = term.trim().toLowerCase();
  if (!q) return [];

  const { data, error } = await supabase
    .from('historias')
    .select(`
      id,
      titulo,
      descricao,
      profiles(username),
      cartoes(id, sinopse_cartao, titulo_cartao, autor_cartao)
    `)
    .or(`titulo.ilike.%${q}%, profiles.username.ilike.%${q}%`)
    .not('cartoes.id', 'is', null)
    .order('data_criacao', { ascending: false });

  if (error) {
    console.error('Erro ao pesquisar histórias:', error);
    return [];
  }
  return data;
}

function exibirSugestoes(lista) {
  searchResults.innerHTML = '';
  if (!lista.length) {
    searchResults.innerHTML = `<div style="padding:6px;">Nenhuma história encontrada</div>`;
    searchResults.style.display = 'block';
    return;
  }
  lista.forEach(h => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.dataset.id = h.id;
    div.innerHTML = `
      <strong>${h.titulo}</strong><br>
      <em>Autor: ${h.profiles.username}</em>
    `;
    div.addEventListener('click', () => {
      abrirHistoria(h);
      searchResults.style.display = 'none';
    });
    searchResults.appendChild(div);
  });
  searchResults.style.display = 'block';
}

// [D] Abrir história no modal e preparar leitura
function abrirHistoria(h) {
  currentStoryId = h.id;
  // usa sinopse do cartão se existir, senão a descrição
  const base = h.cartoes?.[0]?.sinopse_cartao || h.descricao || '(Sem descrição)';
  textoCompleto = formatarTexto(base);
  conteudoEl.setAttribute('data-full-text', textoCompleto);
  modalTitulo.textContent   = h.titulo;
  conteudoEl.innerText      = textoCompleto;

  // reset leitura
  modoCorrido    = true;
  partesHistoria = [];
  parteAtual     = 0;
  btnVoltar.style.display    = 'none';
  btnContinuar.style.display = 'none';

  modal.style.display = 'block';
}

// [E] Formatação: insere quebras a cada 5 pontos finais
function formatarTexto(str) {
  let cnt = 0, res = '';
  for (let ch of str) {
    res += ch;
    if (ch === '.') {
      cnt++;
      if (cnt === 5) { res += '\n\n'; cnt = 0; }
    }
  }
  return res;
}

// [F] Modo de leitura corrido ↔ por partes (5 linhas)
function toggleReadingMode() {
  const full = textoCompleto;
  if (modoCorrido) {
    const lines = full.split(/\r?\n/);
    partesHistoria = [];
    for (let i = 0; i < lines.length; i += 5) {
      partesHistoria.push(lines.slice(i, i+5).join('\n'));
    }
    parteAtual = 0;
    exibirParteAtual();
    if (partesHistoria.length > 1) {
      btnVoltar.style.display    = 'inline-block';
      btnContinuar.style.display = 'inline-block';
    }
  } else {
    conteudoEl.innerText = full;
    btnVoltar.style.display    = 'none';
    btnContinuar.style.display = 'none';
  }
  modoCorrido = !modoCorrido;
}

function exibirParteAtual() {
  conteudoEl.innerHTML = `<p>${partesHistoria[parteAtual]}</p>`;
}

// [G] Navegação por parágrafo
function voltarPagina() {
  if (parteAtual > 0) {
    parteAtual--;
    exibirParteAtual();
  }
}
function continuarHistoria() {
  if (parteAtual < partesHistoria.length - 1) {
    parteAtual++;
    exibirParteAtual();
  }
}

// [H] Marcador de linha
function wrapText(str,width) {
  const out=[]; let i=0;
  while(i<str.length){ out.push(str.slice(i,i+width)); i+=width; }
  return out;
}
function highlightLine(lineNumber) {
  const full = conteudoEl.getAttribute('data-full-text') || conteudoEl.innerText;
  const lines = wrapText(full, wrapWidth);
  if (lineNumber<1||lineNumber>lines.length) return;
  lines[lineNumber-1]=`<span style="background:yellow">${lines[lineNumber-1]}</span>`;
  conteudoEl.innerHTML = lines.join('<br>');
  conteudoEl.scrollTo({ top: (lineNumber-1)*lineHeightPx, behavior:'smooth' });
}
conteudoEl.addEventListener('click', e => {
  if (!currentStoryId) return;
  const rect = conteudoEl.getBoundingClientRect();
  const clickY = e.clientY - rect.top + conteudoEl.scrollTop;
  const lineNum = Math.floor(clickY/lineHeightPx)+1;
  localStorage.setItem(`line_${currentStoryId}`, lineNum);
});
function continuarMarcador() {
  const saved = localStorage.getItem(`line_${currentStoryId}`);
  if (!saved) return alert('Nenhuma linha salva.');
  highlightLine(parseInt(saved,10));
}

// [I] Eventos e inicialização
document.addEventListener('DOMContentLoaded', () => {
  carregarHistoriasDoUsuario();

  // pesquisa
  searchBar.addEventListener('input', async () => {
    const t = searchBar.value;
    if (!t) return searchResults.style.display='none';
    exibirSugestoes(await pesquisarHistoriasPublicadas(t));
  });
  searchBtn.addEventListener('click', async () => {
    const t = searchBar.value;
    if (!t) return searchResults.style.display='none';
    exibirSugestoes(await pesquisarHistoriasPublicadas(t));
  });
  document.addEventListener('click', e => {
    if (!searchResults.contains(e.target)
     && e.target!==searchBar && e.target!==searchBtn) {
      searchResults.style.display = 'none';
    }
  });

  // leitura
  toggleModeBtn.addEventListener('click', toggleReadingMode);
  btnVoltar.addEventListener('click', voltarPagina);
  btnContinuar.addEventListener('click', continuarHistoria);
  document.getElementById('btnMarcador')?.addEventListener('click', continuarMarcador);

  // fechar modal
  btnFecharModal.addEventListener('click', () => modal.style.display='none');
});
