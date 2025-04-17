// userDisplay.js
import { supabase } from "./supabase.js";

async function exibirUsuarioLogado() {
  const userArea = document.getElementById("userMenuArea");
  if (!userArea) {
    console.error("Elemento 'userMenuArea' não encontrado no HTML.");
    return;
  }

  // Obtém a sessão atual do Supabase
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  console.log("Sessão retornada:", session, "Erro na sessão:", sessionError);

  // Se não houver sessão, exibe um link para login
  if (!session) {
    userArea.innerHTML = `
      <a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
    return;
  }

  // Se houver sessão, usa o ID do usuário para consultar a tabela 'profiles'
  const userId = session.user.id;
  console.log("Usuário autenticado. ID:", userId);

  // Consulta o campo 'username' na tabela 'profiles'
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  console.log("Dados do perfil:", profileData, "Erro no perfil:", profileError);

  // Define o nome a exibir
  let displayName = "";
  if (profileError || !profileData || !profileData.username) {
    displayName = session.user.email;
    console.warn("Não foi possível recuperar o nome de usuário. Usando e-mail:", displayName);
  } else {
    displayName = profileData.username;
  }

  // Atualiza a interface – exibe o nome do usuário e um menu para logout
  userArea.innerHTML = `
    <span id="user-name" style="cursor: pointer;">${displayName}</span>
    <div id="logout-menu" style="display: none; margin-top: 5px;">
      <button id="logout-btn">Deslogar</button>
    </div>
  `;

  // Ao clicar no nome do usuário, alterna a visibilidade do menu de logout
  const userNameEl = document.getElementById("user-name");
  const logoutMenu = document.getElementById("logout-menu");
  userNameEl.addEventListener("click", () => {
    logoutMenu.style.display = (logoutMenu.style.display === "none" ? "block" : "none");
  });

  // Configura o botão de logout para redirecionar para a página inicial após sair
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("Erro ao deslogar: " + error.message);
    } else {
      window.location.href = "Criacao.html"; // Redireciona para a página inicial
    }
  });
}

// Chama a função assim que o DOM for carregado
document.addEventListener("DOMContentLoaded", exibirUsuarioLogado);

/************************************************************
 * [3] VARIÁVEIS GLOBAIS
 ************************************************************/
let allStories = [];
let currentOffset = 0;
const initialCount = 4;
const increment = 4;

const container      = document.getElementById('featuredStories');
const loadMoreBtn    = document.getElementById('loadMoreBtn');
const searchBar      = document.getElementById('searchBar');
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
 * [6] CRIAR CARTÕES E MOSTRAR NO DOM
 ************************************************************/
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  // Título
  const titleEl = document.createElement('div');
  titleEl.className = 'sheet-title';
  titleEl.textContent = story.cartao.tituloCartao || 'Sem Título';
  div.appendChild(titleEl);

  // Sinopse: utiliza a função formatarPor4Linhas
  const sinopseEl = document.createElement('div');
  sinopseEl.className = 'sheet-sinopse';
  sinopseEl.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao || '(sem sinopse)');
  div.appendChild(sinopseEl);

  // “mais...” – abre o modal com os detalhes da história
  const verMais = document.createElement('span');
  verMais.className = 'ver-mais';
  verMais.textContent = 'mais...';
  verMais.style.cursor = 'pointer';
  verMais.addEventListener('click', () => {
    isModalOpen = true;
    currentStoryId = story.id;
    modalTitle.textContent = story.cartao.tituloCartao || "Sem Título";
    // Exibe a sinopse formatada inicialmente
    modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao || '(sem sinopse)');
    modalInfo.innerHTML = '';

    // Botão “Ler” – carrega a história completa com palavras clicáveis
    const lerBtn = document.createElement('button');
    lerBtn.textContent = 'Ler';
    lerBtn.addEventListener('click', () => {
      modalTitle.textContent = story.titulo || "História Completa";
      originalText = story.cartao.historiaCompleta || '(sem história completa)';
      modalFullText.innerHTML = formatarTextoParaLeitura(originalText);
    });
    modalFullText.appendChild(lerBtn);

    // Verifica se há posição salva; usa o botão "Continuar" já presente no HTML
    const savedPosition = localStorage.getItem('readingPosition_' + story.id);
    const continuarBtn = document.getElementById('continuarBtn');
    if (savedPosition !== null) {
      continuarBtn.style.display = 'inline-block'; // Exibe o botão
    } else {
      continuarBtn.style.display = 'none'; // Oculta se não houver posição salva
    }

    // Informações adicionais: data, autor, categorias, likes
    let infoHtml = '';
    infoHtml += `<p><strong>Data:</strong> ${story.cartao.dataCartao || '??'}</p>`;
    infoHtml += `<p><strong>Autor:</strong> ${story.cartao.autorCartao || 'Desconhecido'}</p>`;
    if (story.cartao.categorias && story.cartao.categorias.length > 0) {
      infoHtml += `<p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>`;
    }
    infoHtml += `<p><strong>Likes:</strong> ${story.cartao.likes || 0}</p>`;
    modalInfo.innerHTML = infoHtml;

    modalOverlay.style.display = 'flex';
  });
  div.appendChild(verMais);

  // Botão Curtir
  const likeContainer = document.createElement('div');
  likeContainer.style.marginTop = '10px';
  const likeBtn = document.createElement('button');
  likeBtn.style.fontSize = '24px';
  likeBtn.style.border = 'none';
  likeBtn.style.background = 'none';
  likeBtn.style.cursor = 'pointer';
  const likeCount = document.createElement('span');
  likeCount.style.marginLeft = '8px';
  if (typeof story.cartao.likes !== 'number') {
    story.cartao.likes = 0;
  }
  let userLiked = likedStories.includes(story.id);
  function updateLikeUI() {
    likeBtn.textContent = userLiked ? '❤️' : '🤍';
    likeCount.textContent = `${story.cartao.likes} curtidas`;
  }
  updateLikeUI();
  likeBtn.addEventListener('click', () => {
    if (userLiked) {
      story.cartao.likes = Math.max(story.cartao.likes - 1, 0);
      userLiked = false;
      likedStories = likedStories.filter(id => id !== story.id);
    } else {
      story.cartao.likes++;
      userLiked = true;
      likedStories.push(story.id);
    }
    localStorage.setItem('likedStories', JSON.stringify(likedStories));
    const all = JSON.parse(localStorage.getItem('historias')) || [];
    const foundIndex = all.findIndex(h => h.id === story.id);
    if (foundIndex >= 0) {
      all[foundIndex] = story;
      localStorage.setItem('historias', JSON.stringify(all));
    }
    updateLikeUI();
  });
  likeContainer.appendChild(likeBtn);
  likeContainer.appendChild(likeCount);
  div.appendChild(likeContainer);

  // Categorias
  const catContainer = document.createElement('div');
  catContainer.className = 'sheet-categories';
  if (story.cartao.categorias && story.cartao.categorias.length) {
    story.cartao.categorias.forEach(cat => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = cat;
      catContainer.appendChild(badge);
    });
  } else {
    const noCat = document.createElement('span');
    noCat.className = 'badge';
    noCat.textContent = 'Sem Categoria';
    catContainer.appendChild(noCat);
  }
  div.appendChild(catContainer);

  return div;
    }
/************************************************************
 * [7] ABRIR MODAL COM “Ler” E “Continuar”
 ************************************************************/
function abrirModal(story) {
  isModalOpen    = true;
  currentStoryId = story.id;

  modalTitle.textContent  = story.cartao.tituloCartao;
  modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  continuarBtn.style.display = 
    localStorage.getItem('readingPosition_' + story.id) !== null
      ? 'inline-block'
      : 'none';

  // Ler
  const lerBtn = document.createElement('button');
  lerBtn.textContent = 'Ler';
  lerBtn.onclick = () => {
    modalTitle.textContent  = story.titulo;
    modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
    // após recarregar, mantemos o botão Continuar
    continuarBtn.style.display = 
      localStorage.getItem('readingPosition_' + story.id) !== null
        ? 'inline-block'
        : 'none';
  };
  // limpa qualquer botão anterior e anexa
  modalFullText.appendChild(lerBtn);

  // Continuar (botão estático)
  continuarBtn.onclick = () => {
    modalTitle.textContent  = story.titulo;
    modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
    setTimeout(destacarPalavra, 0);
    // permanece visível
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
      </div>
    `).join('');
  }
  searchResults.style.display = 'block';
  searchResults.querySelectorAll('.suggestion-item')
    .forEach(el => el.onclick = () => {
      const s = allStories.find(x => x.id == el.dataset.id);
      searchResults.style.display = 'none';
      abrirModal(s);
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
