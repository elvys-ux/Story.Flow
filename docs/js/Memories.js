import { supabase } from './supabase.js';

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
const container = document.getElementById('featuredStories');

const modalOverlay   = document.getElementById('modalOverlay');
const modalClose     = document.getElementById('modalClose');
const modalTitle     = document.getElementById('modalTitle');
const modalFullText  = document.getElementById('modalFullText');
const modalInfo      = document.getElementById('modalInfo');
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
        tituloCartao:     st.titulo || "Sem Título",
        sinopseCartao:    (st.descricao || "").substring(0,150) || "(sem sinopse)",
        historiaCompleta: st.descricao || "",
        dataCartao:       "",
        autorCartao:      "",
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
  showToast("Posição de leitura salva (palavra " + idx + ")");
}

function destacarPalavra() {
  const saved = localStorage.getItem('readingPosition_' + currentStoryId);
  if (saved !== null) {
    const span = modalFullText.querySelector(`[data-index="${saved}"]`);
    if (span) {
      span.style.background = 'yellow';
      span.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

/************************************************************
 * [6] CRIAR CARTÕES
 ************************************************************/
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'featured-sheet';
  const titleEl = document.createElement('div');
  titleEl.className = 'sheet-title';
  titleEl.textContent = story.cartao.tituloCartao;
  const sinopseEl = document.createElement('div');
  sinopseEl.className = 'sheet-sinopse';
  sinopseEl.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  div.append(titleEl, sinopseEl);
  div.onclick = () => abrirModal(story);
  return div;
}

/************************************************************
 * [7] ABRIR MODAL COM “Ler” E “Continuar”
 ************************************************************/
function abrirModal(story) {
  isModalOpen    = true;
  currentStoryId = story.id;

  modalTitle.textContent  = story.cartao.tituloCartao;
  modalInfo.innerHTML     = '';
  modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);

  // Botão “Ler”
  const lerBtn = document.createElement('button');
  lerBtn.textContent = 'Ler';
  lerBtn.onclick = () => {
    // Exibe o texto completo
    modalTitle.textContent  = story.titulo;
    modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
    // Mantém o botão "Continuar" após recarregar o texto
    renderContinuarBtn(story);
  };
  modalFullText.appendChild(lerBtn);

  // Botão “Continuar”
  renderContinuarBtn(story);

  modalOverlay.style.display = 'flex';
}

// Função que (re)renderiza o botão “Continuar”
function renderContinuarBtn(story) {
  // Remove versão anterior
  const old = modalFullText.querySelector('#continuarBtn');
  if (old) old.remove();

  const contBtn = document.createElement('button');
  contBtn.id = 'continuarBtn';
  contBtn.textContent = 'Continuar';
  contBtn.onclick = () => {
    modalTitle.textContent  = story.titulo;
    modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
    // Destaca a palavra salva
    setTimeout(destacarPalavra, 0);
    // Após recarregar, garante que o "Continuar" permaneça
    renderContinuarBtn(story);
  };
  const hasSaved = localStorage.getItem('readingPosition_' + story.id) !== null;
  contBtn.style.display = hasSaved ? 'inline-block' : 'none';
  modalFullText.appendChild(contBtn);
}

/************************************************************
 * [8] PESQUISA E SUGESTÕES
 ************************************************************/
function matchesSearch(story, text) {
  text = text.trim().toLowerCase();
  if (!text) return true;
  return (story.cartao.tituloCartao||'').toLowerCase().includes(text)
      || (story.cartao.autorCartao ||'').toLowerCase().includes(text);
}

function exibirSugestoes(list) {
  const res = document.getElementById('searchResults');
  if (!list.length) {
    res.innerHTML = `<div style="padding:6px;">Nenhuma história encontrada</div>`;
    res.style.display = 'block';
    return;
  }
  res.innerHTML = list.map(s => `
    <div class="suggestion-item" data-id="${s.id}" style="padding:6px;cursor:pointer;border-bottom:1px solid #ccc">
      <strong>${s.cartao.tituloCartao}</strong><br>
      <em>Autor: ${s.cartao.autorCartao||'Desconhecido'}</em>
    </div>`).join('');
  res.style.display = 'block';
  res.querySelectorAll('.suggestion-item').forEach(el => {
    el.onclick = () => {
      const st = allStories.find(x => x.id == el.dataset.id);
      res.style.display = 'none';
      abrirModal(st);
    };
  });
}

/************************************************************
 * [9] PAGINAÇÃO, INICIALIZAÇÃO E “Load More”
 ************************************************************/
function showBatch(count) {
  const sb = document.getElementById('searchBar').value;
  const filtered = allStories.filter(s => matchesSearch(s, sb));
  container.innerHTML = '';
  filtered.slice(currentOffset, currentOffset + count)
          .forEach(s => container.appendChild(createStoryCard(s)));
  currentOffset += count;
}

function initialLoad() {
  currentOffset = 0;
  showBatch(initialCount);
}

function loadMore() {
  showBatch(increment);
}

/************************************************************
 * [10] FECHAR MODAL E AVISO DE CLIQUE FORA
 ************************************************************/
if (modalClose) modalClose.onclick = () => { modalOverlay.style.display = 'none'; isModalOpen = false; };
if (modalOverlay) modalOverlay.onclick = e => {
  if (e.target === modalOverlay && isModalOpen) warningOverlay.style.display = 'flex';
};
if (warningYes && warningNo) {
  warningYes.onclick = () => { modalOverlay.style.display = 'none'; warningOverlay.style.display = 'none'; isModalOpen = false; };
  warningNo.onclick  = () => { warningOverlay.style.display = 'none'; };
}

/************************************************************
 * [11] DOMContentLoaded – SETUP INICIAL E PESQUISA
 ************************************************************/
document.addEventListener('DOMContentLoaded', () => {
  exibirUsuarioLogado();
  loadAllStories();
  initialLoad();

  const sb      = document.getElementById('searchBar');
  const res     = document.getElementById('searchResults');
  const moreBtn = document.getElementById('loadMoreBtn');

  if (moreBtn) moreBtn.onclick = loadMore;
  if (sb) sb.oninput = () => {
    const v = sb.value.trim();
    if (!v) {
      res.style.display = 'none';
      initialLoad();
    } else {
      exibirSugestoes(allStories.filter(s => matchesSearch(s, v)));
    }
  };
});
