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
 * [3] VARIÁVEIS GLOBAIS
 ************************************************************/
let allStories = [];
let currentOffset = 0;
const initialCount = 20;
const increment = 5;

// Seletores de interface (certifique-se de que os elementos existem no DOM)
const container = document.getElementById('storiesContainer');
const categoryFilter = document.getElementById('category-filter');
const sortFilter = document.getElementById('sort-filter');
const searchBar = document.getElementById('searchBar');
const loadMoreBtn = document.getElementById('loadMoreBtn');

// Modal e aviso
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const modalFullText = document.getElementById('modalFullText');
const modalInfo = document.getElementById('modalInfo');
const warningOverlay = document.getElementById('warningOverlay');
const warningYes = document.getElementById('warningYes');
const warningNo = document.getElementById('warningNo');

// Controle do modal e leitura
let isModalOpen = false;
let currentStoryId = null;
let originalText = "";

// Curtidas
let likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');

/************************************************************
 * [4] Carregar Histórias
 ************************************************************/
function loadAllStories() {
  // Obtém as histórias do localStorage; se não houver, utiliza dummy data para teste.
  const raw = JSON.parse(localStorage.getItem('historias')) || [];
  if (raw.length === 0) {
    raw.push({
      id: 1,
      titulo: "Exemplo de História",
      cartao: {
        tituloCartao: "Exemplo de História",
        sinopseCartao: "Esta é uma sinopse de exemplo para testar os cartões.",
        historiaCompleta: "Esta é a história completa de exemplo. Divida-a em várias linhas para testar a formatação.\nSegunda linha.\nTerceira linha.\nQuarta linha.\nQuinta linha.",
        dataCartao: "2023-01-01",
        autorCartao: "Autor Exemplo",
        categorias: ["Exemplo"],
        likes: 0
      }
    });
  }
  // Garante que cada objeto tenha a propriedade "cartao"
  const transformed = raw.map(st => {
    if (!st.cartao) {
      st.cartao = {
        tituloCartao: st.titulo || "Sem Título",
        sinopseCartao: (st.descricao || "").substring(0, 150) || "(sem sinopse)",
        historiaCompleta: st.descricao || "",
        dataCartao: "",
        autorCartao: "",
        categorias: [],
        likes: 0
      };
    }
    return st;
  });
  allStories = transformed;
}

/************************************************************
 * [5.1] Formatador para sinopse: agrupa a cada 4 linhas em parágrafos justificados
 ************************************************************/
function formatarPor4Linhas(text) {
  const lines = text.split('\n');
  let paragrafos = [];
  let buffer = [];
  for (let i = 0; i < lines.length; i++) {
    buffer.push(lines[i]);
    if (buffer.length === 4) {
      paragrafos.push(buffer.join('<br>'));
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    paragrafos.push(buffer.join('<br>'));
  }
  return paragrafos.map(p => `<p style="text-align: justify;">${p}</p>`).join('');
}

/************************************************************
 * [5.2] Formatador para leitura completa com marcação:
 * Envolve cada palavra em um <span> com atributo data-index e evento onclick
 ************************************************************/
function formatarTextoParaLeitura(text) {
  const lines = text.split('\n');
  let paragrafos = [];
  let buffer = [];
  let wordIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    // Separa cada palavra e cria um span com o índice correto
    let words = lines[i].split(' ').map(word => {
      let span = `<span class="reading-word" data-index="${wordIndex}" onclick="markReadingPosition(this)">${word}</span>`;
      wordIndex++;  // Incrementa após criar o span
      return span;
    });
    buffer.push(words.join(' '));
    if (buffer.length === 4) {
      let paragraph = `<p style="text-align: justify;">${buffer.join('<br>')}</p>`;
      paragrafos.push(paragraph);
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    let paragraph = `<p style="text-align: justify;">${buffer.join('<br>')}</p>`;
    paragrafos.push(paragraph);
  }
  return paragrafos.join('');
}

/************************************************************
 * [5.3] Função para marcar a posição de leitura (salva no localStorage)
 ************************************************************/
function markReadingPosition(element) {
  const index = element.getAttribute('data-index');
  localStorage.setItem('readingPosition_' + currentStoryId, index);
  showToast("Posição de leitura salva (palavra " + index + ")");
}

/************************************************************
 * [5.4] Função para destacar a palavra marcada ao retomar a leitura
 ************************************************************/
function destacarPalavra() {
  const savedIndex = localStorage.getItem('readingPosition_' + currentStoryId);
  if (savedIndex !== null) {
    const wordSpan = modalFullText.querySelector(`[data-index="${savedIndex}"]`);
    if (wordSpan) {
      wordSpan.style.background = 'yellow';
      wordSpan.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

/************************************************************
 * [5.5] Função para criar o cartão (card) da história
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
 * [6] Cartão Placeholder (caso falte histórias)
 ************************************************************/
function createPlaceholderCard() {
  const div = document.createElement('div');
  div.className = 'sheet sheet-placeholder';
  const titleEl = document.createElement('div');
  titleEl.className = 'sheet-title';
  titleEl.textContent = 'Placeholder';
  div.appendChild(titleEl);
  const sinopseEl = document.createElement('div');
  sinopseEl.className = 'sheet-sinopse';
  sinopseEl.textContent = '(sem história)';
  div.appendChild(sinopseEl);
  return div;
}

/************************************************************
 * [7] FILTRO / ORDENAR / PESQUISA
 ************************************************************/
function matchesSearch(story, searchInput) {
  const text = searchInput.trim().toLowerCase();
  if (!text) return true;
  const splitted = text.split(/\s+/);
  const t = (story.cartao.tituloCartao || '').toLowerCase();
  const a = (story.cartao.autorCartao || '').toLowerCase();
  if (splitted.length === 1) {
    return t.includes(splitted[0]) || a.includes(splitted[0]);
  } else {
    const lastToken = splitted[splitted.length - 1];
    const firstTokens = splitted.slice(0, splitted.length - 1).join(' ');
    return t.includes(firstTokens) && a.includes(lastToken);
  }
}

function getFilteredStories() {
  let arr = [...allStories];
  const searchInput = (searchBar?.value || '').toLowerCase();
  arr = arr.filter(story => matchesSearch(story, searchInput));
  const cat = categoryFilter ? categoryFilter.value : '';
  if (cat) {
    arr = arr.filter(h => h.cartao.categorias && h.cartao.categorias.includes(cat));
  }
  const sortMode = sortFilter ? sortFilter.value : '';
  if (sortMode === 'date') {
    arr.sort((a, b) => {
      const dataA = a.cartao.dataCartao || '1900-01-01';
      const dataB = b.cartao.dataCartao || '1900-01-01';
      return dataA.localeCompare(dataB);
    });
  } else if (sortMode === 'popularity') {
    arr.sort((a, b) => {
      const popA = a.cartao.likes || 0;
      const popB = b.cartao.likes || 0;
      return popB - popA;
    });
  }
  return arr;
}

/************************************************************
 * [8] EXIBIR BATCH DE HISTÓRIAS
 ************************************************************/
function showBatch(count) {
  const filtered = getFilteredStories();
  const end = currentOffset + count;
  const realSlice = filtered.slice(currentOffset, end);
  realSlice.forEach(story => {
    container.appendChild(createStoryCard(story));
  });
  const needed = count - realSlice.length;
  if (needed > 0 && (currentOffset + needed) > filtered.length) {
    for (let i = 0; i < needed; i++) {
      container.appendChild(createPlaceholderCard());
    }
  }
  currentOffset += count;
  if (loadMoreBtn) {
    loadMoreBtn.disabled = false;
  }
}

/************************************************************
 * [9] INICIALIZAÇÃO
 ************************************************************/
function initialLoad() {
  container.innerHTML = '';
  currentOffset = 0;
  showBatch(initialCount);
}

function loadMore() {
  showBatch(increment);
}

function handleFilterOrSort() {
  container.innerHTML = '';
  currentOffset = 0;
  showBatch(initialCount);
}

/************************************************************
 * [10] MODAL E AVISO DE CLIQUE FORA
 ************************************************************/
if (modalClose) {
  modalClose.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
    isModalOpen = false;
  });
}
if (modalOverlay) {
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay && isModalOpen) {
      warningOverlay.style.display = 'flex';
    }
  });
}
if (warningYes && warningNo) {
  warningYes.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
    warningOverlay.style.display = 'none';
    isModalOpen = false;
  });
  warningNo.addEventListener('click', () => {
    warningOverlay.style.display = 'none';
  });
}

/************************************************************
 * [11] EVENTO DOMContentLoaded
 ************************************************************/
document.addEventListener('DOMContentLoaded', () => {
  exibirUsuarioLogado();
  loadAllStories();
  initialLoad();
  
  if (categoryFilter) {
    categoryFilter.addEventListener('change', handleFilterOrSort);
  }
  if (sortFilter) {
    sortFilter.addEventListener('change', handleFilterOrSort);
  }
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMore);
  }
  if (searchBar) {
    searchBar.addEventListener('input', () => {
      container.innerHTML = '';
      currentOffset = 0;
      showBatch(initialCount);
    });
  }
  
  // Adiciona o event listener para o botão "Continuar" que já está no HTML
  const continuarBtn = document.getElementById('continuarBtn');
  if (continuarBtn) {
    continuarBtn.addEventListener('click', () => {
      // Obtém a história atual com base no currentStoryId
      const story = allStories.find(s => s.id == currentStoryId);
      if (story) {
        modalTitle.textContent = story.titulo || "História Completa";
        originalText = story.cartao.historiaCompleta || '(sem história completa)';
        modalFullText.innerHTML = formatarTextoParaLeitura(originalText);
        setTimeout(destacarPalavra, 100);
      }
    });
  }
});
