import { supabase } from './supabase.js';
/*************************************************************
 * HISTORIA.JS
 * - A história permanece no container após “Atualizar”.
 * - Só aparece ao clicar em “Editar”. Se é “nova” não exibe nada.
 *************************************************************/
/************************************************************
 * [1] LOGIN/LOGOUT com Supabase
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;
  try {
    // Obtém a sessão atual do Supabase.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("Erro ao obter a sessão:", sessionError);
      userArea.innerHTML = `<a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
      return;
    }
    // Se não houver sessão ativa, exibe o link para login.
    if (!session) {
      userArea.innerHTML = `<a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
      userArea.onclick = null;
      return;
    }
    const userId = session.user.id;
    // Consulta a tabela "profiles" para obter o campo "username".
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();

    let username = "";
    if (profileError || !profile || !profile.username) {
      // Se não encontrar o username, utiliza o email do usuário.
      username = session.user.email;
      console.warn("Não foi possível recuperar o username; utilizando email:", username);
    } else {
      username = profile.username;
    }
    
    // Exibe o username na área destinada.
    userArea.innerHTML = username;
    // Ao clicar no nome do usuário, oferece a opção para logout.
    userArea.onclick = () => {
      if (confirm("Deseja fazer logout?")) {
        supabase.auth.signOut().then(({ error }) => {
          if (error) {
            alert("Erro ao deslogar: " + error.message);
          } else {
      window.location.href = "Criacao.html"; // Redireciona para a página inicial
    }
        });
      }
    };
  } catch (ex) {
    console.error("Exceção em exibirUsuarioLogado:", ex);
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
const searchResults  = document.getElementById('searchResults');
const loadMoreBtn    = document.getElementById('loadMoreBtn');
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
 * [5] FORMATADORES
 ************************************************************/
function formatarPor4Linhas(text) {
  const lines = text.split('\n'), paras = [], buf = [];
  lines.forEach(line => {
    buf.push(line);
    if (buf.length === 4) {
      paras.push(buf.join('<br>'));
      buf.length = 0;
    }
  });
  if (buf.length) paras.push(buf.join('<br>'));
  return paras.map(p => `<p style="text-align: justify;">${p}</p>`).join('');
}

function formatarTextoParaLeitura(text) {
  const lines = text.split('\n'), paras = [];
  let buf = [], wordIndex = 0;
  lines.forEach(line => {
    const spans = line.split(' ').map(word => {
      const span = `<span class="reading-word" data-index="${wordIndex}" onclick="markReadingPosition(this)">${word}</span>`;
      wordIndex++;
      return span;
    });
    buf.push(spans.join(' '));
    if (buf.length === 4) {
      paras.push(`<p style="text-align: justify;">${buf.join('<br>')}</p>`);
      buf.length = 0;
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
  filtered.slice(currentOffset, currentOffset + count)
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
  continuarBtn.style.display = localStorage.getItem('readingPosition_' + story.id) !== null
    ? 'inline-block'
    : 'none';

  // Botão Ler
  const lerBtn = document.createElement('button');
  lerBtn.textContent = 'Ler';
  lerBtn.onclick = () => {
    modalTitle.textContent  = story.titulo;
    modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
    continuarBtn.style.display = localStorage.getItem('readingPosition_' + story.id) !== null
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
 * [8] PESQUISA
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
loadMoreBtn.onclick    = () => showBatch(increment);
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

document.addEventListener('DOMContentLoaded', () => {
  exibirUsuarioLogado();
  loadAllStories();
  currentOffset = 0;
  showBatch(initialCount);
});
