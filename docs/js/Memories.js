import { supabase } from './supabase.js';

/************************************************************
 * [1] LOGIN/LOGOUT com Supabase
 ************************************************************/
export async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;
  userArea.innerHTML = '';
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    if (!session) {
      userArea.innerHTML = `
        <a href="Criacao.html" style="color:white;">
          <i class="fas fa-user"></i> Login
        </a>`;
      userArea.onclick = null;
      return;
    }

    const userId = session.user.id;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();

    let username = session.user.email;
    if (!profileError && profile && profile.username) {
      username = profile.username;
    }

    userArea.textContent = username;
    userArea.onclick = () => {
      if (confirm('Deseja fazer logout?')) {
        supabase.auth.signOut().then(({ error }) => {
          if (error) {
            alert('Erro ao deslogar: ' + error.message);
          } else {
            window.location.href = 'Criacao.html';
          }
        });
      }
    };
  } catch (err) {
    console.error('Erro em exibirUsuarioLogado:', err);
    userArea.innerHTML = `
      <a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
    userArea.onclick = null;
  }
}

/************************************************************
 * [2] TOAST (Notificação)
 ************************************************************/
function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'my-toast';
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, duration);
}

/************************************************************
 * [3] VARIÁVEIS GLOBAIS
 ************************************************************/
let allStories = [];
let currentOffset = 0;
const initialCount = 4;
const increment = 4;

const container      = document.getElementById('featuredStories');
const searchBar      = document.getElementById('searchBar');
const searchBtn      = document.getElementById('searchBtn');
const searchResults  = document.getElementById('searchResults');
const modalOverlay   = document.getElementById('modalOverlay');
const modalClose     = document.getElementById('modalClose');
const modalTitle     = document.getElementById('modalTitle');
const modalFullText  = document.getElementById('modalFullText');
const continuarBtn   = document.getElementById('continuarBtn');
const warningOverlay = document.getElementById('warningOverlay');
const warningYes     = document.getElementById('warningYes');
const warningNo      = document.getElementById('warningNo');

let isModalOpen    = false;
let currentStoryId = null;

/************************************************************
 * [4] CARREGAR HISTÓRIAS
 ************************************************************/
function loadAllStories() {
  const raw = JSON.parse(localStorage.getItem('historias')) || [];
  allStories = raw.map(st => {
    if (!st.cartao) {
      st.cartao = {
        tituloCartao:     st.titulo || 'Sem Título',
        sinopseCartao:    (st.descricao || '').substring(0,150) || '(sem sinopse)',
        historiaCompleta: st.descricao || '',
        autorCartao:      st.autor || '',
        categorias:       [],
        likes:            0
      };
    }
    return st;
  });
}

/************************************************************
 * [5] FORMATADORES E MARCAÇÃO
 ************************************************************/
function formatarPor4Linhas(text) {
  const lines = text.split('\n');
  const paras = [];
  let buf = [];
  lines.forEach(line => {
    buf.push(line);
    if (buf.length === 4) {
      paras.push(buf.join('<br>'));
      buf = [];
    }
  });
  if (buf.length) paras.push(buf.join('<br>'));
  return paras.map(p => `<p style="text-align: justify;">${p}</p>`).join('');
}

function formatarTextoParaLeitura(text) {
  const lines = text.split('\n');
  const paras = [];
  let buf = [];
  let wordIndex = 0;
  lines.forEach(line => {
    const spans = line.split(' ').map(word => {
      const span = `<span class="reading-word" data-index="${wordIndex}" onclick="markReadingPosition(this)">${word}</span>`;
      wordIndex++;
      return span;
    });
    buf.push(spans.join(' '));
    if (buf.length === 4) {
      paras.push(`<p style="text-align: justify;">${buf.join('<br>')}</p>`);
      buf = [];
    }
  });
  if (buf.length) paras.push(`<p style="text-align: justify;">${buf.join('<br>')}</p>`);
  return paras.join('');
}

function markReadingPosition(el) {
  const idx = el.getAttribute('data-index');
  localStorage.setItem('readingPosition_' + currentStoryId, idx);
  showToast(`Posição de leitura salva (palavra ${idx})`);
}

function destacarPalavra() {
  const saved = localStorage.getItem('readingPosition_' + currentStoryId);
  if (saved !== null) {
    const span = modalFullText.querySelector(`[data-index="${saved}"]`);
    if (span) {
      span.style.background = 'yellow';
      span.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

/************************************************************
 * [6] CRIAR E EXIBIR CARTÕES
 ************************************************************/
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'featured-sheet';
  div.innerHTML = `
    <div class="sheet-title">${story.cartao.tituloCartao}</div>
    <div class="sheet-sinopse">${formatarPor4Linhas(story.cartao.sinopseCartao)}</div>
  `;
  div.onclick = () => abrirModal(story);
  return div;
}

function showBatch(count) {
  container.innerHTML = '';
  const term     = searchBar.value.trim().toLowerCase();
  const filtered = allStories.filter(s => matchesSearch(s, term));
  filtered
    .slice(currentOffset, currentOffset + count)
    .forEach(s => container.appendChild(createStoryCard(s)));
  currentOffset += count;
}

/************************************************************
 * [7] ABRIR MODAL
 ************************************************************/
function abrirModal(story) {
  isModalOpen    = true;
  currentStoryId = story.id;

  modalTitle.textContent  = story.cartao.tituloCartao;
  modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  continuarBtn.style.display = localStorage.getItem('readingPosition_' + story.id)
    ? 'inline-block'
    : 'none';

  // Botão Ler
  const lerBtn = document.createElement('button');
  lerBtn.textContent = 'Ler';
  lerBtn.onclick = () => {
    modalTitle.textContent  = story.titulo;
    modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
    continuarBtn.style.display = localStorage.getItem('readingPosition_' + story.id)
      ? 'inline-block'
      : 'none';
  };
  modalFullText.appendChild(lerBtn);

  // Botão Continuar
  continuarBtn.onclick = () => {
    modalTitle.textContent  = story.titulo;
    modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
    setTimeout(destacarPalavra, 0);
  };

  modalOverlay.style.display = 'flex';
}

/************************************************************
 * [8] PESQUISA E SUGESTÕES
 ************************************************************/
function matchesSearch(story, term) {
  if (!term) return true;
  return story.cartao.tituloCartao.toLowerCase().includes(term)
      || (story.cartao.autorCartao || '').toLowerCase().includes(term);
}

function exibirSugestoes(list) {
  if (!list.length) {
    searchResults.innerHTML = `<div style="padding:6px;">Nenhuma história encontrada</div>`;
  } else {
    searchResults.innerHTML = list.map(s => `
      <div class="suggestion-item" data-id="${s.id}" style="padding:6px;border-bottom:1px solid #ccc;cursor:pointer">
        <strong>${s.cartao.tituloCartao}</strong><br>
        <em>Autor: ${s.cartao.autorCartao || 'Desconhecido'}</em>
      </div>`).join('');
  }
  searchResults.style.display = 'block';
  searchResults.querySelectorAll('.suggestion-item').forEach(el => {
    el.onclick = () => {
      const st = allStories.find(x => x.id == el.dataset.id);
      searchResults.style.display = 'none';
      abrirModal(st);
    };
  });
}

/************************************************************
 * [9] EVENTOS E INICIALIZAÇÃO
 ************************************************************/
modalClose.onclick     = () => { modalOverlay.style.display = 'none'; isModalOpen = false; };
modalOverlay.onclick   = e => { if (e.target === modalOverlay && isModalOpen) warningOverlay.style.display = 'flex'; };
warningYes.onclick     = () => { modalOverlay.style.display = 'none'; warningOverlay.style.display = 'none'; isModalOpen = false; };
warningNo.onclick      = () => { warningOverlay.style.display = 'none'; };
searchBar.oninput      = () => {
  const v = searchBar.value.trim().toLowerCase();
  if (!v) {
    searchResults.style.display = 'none';
    currentOffset = 0;
    showBatch(initialCount);
  } else {
    exibirSugestoes(allStories.filter(s => matchesSearch(s, v)));
  }
};
searchBtn.onclick = () => {
  const v = searchBar.value.trim().toLowerCase();
  if (v) {
    exibirSugestoes(allStories.filter(s => matchesSearch(s, v)));
  }
};

document.addEventListener('DOMContentLoaded', () => {
  exibirUsuarioLogado();
  loadAllStories();
  currentOffset = 0;
  showBatch(initialCount);
});
