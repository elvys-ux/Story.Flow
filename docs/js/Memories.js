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
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, duration);
}

/************************************************************
 * [3] VARIÁVEIS GLOBAIS
 ************************************************************/
let allStories = [];
let currentOffset = 0;
const initialCount = 4; // exibir 4 cartões inicialmente
const increment = 4;
const container = document.getElementById('featuredStories');

const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const modalFullText = document.getElementById('modalFullText');
const modalInfo = document.getElementById('modalInfo');
const warningOverlay = document.getElementById('warningOverlay');
const warningYes = document.getElementById('warningYes');
const warningNo = document.getElementById('warningNo');

let isModalOpen = false;
let currentStoryId = null;
let originalText = "";

let likedStories = JSON.parse(localStorage.getItem('likedStories') || '[]');

/************************************************************
 * [4] Carregar Histórias
 ************************************************************/
function loadAllStories() {
  // Obtém as histórias salvas no localStorage; se não houver, utiliza dados dummy.
  const raw = JSON.parse(localStorage.getItem('historias')) || [];
  if (raw.length === 0) {
    raw.push({
      id: 1,
      titulo: "Exemplo de História",
      descricao: "Linha 1 da história\nLinha 2 da história\nLinha 3 da história\nLinha 4 da história"
    });
  }
  // Para cada história sem a propriedade "cartao", define um cartão padrão
  const transformed = raw.map(st => {
    if (!st.cartao) {
      st.bloqueio2 = true; // Flag para limitar a visualização (se aplicável)
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
 * [5.1] Formatador para sinopse (4 linhas por parágrafo)
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
 * [5.2] Formatador para leitura completa com marcação
 ************************************************************/
function formatarTextoParaLeitura(text) {
  const lines = text.split('\n');
  let paragrafos = [];
  let buffer = [];
  let wordIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    let words = lines[i].split(' ').map(word => {
      return `<span class="reading-word" data-index="${wordIndex}" onclick="markReadingPosition(this)">${word}</span>`;
      wordIndex++;
    });
    buffer.push(words.join(' '));
    if (buffer.length === 4) {
      paragrafos.push(`<p style="text-align: justify;">${buffer.join('<br>')}</p>`);
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    paragrafos.push(`<p style="text-align: justify;">${buffer.join('<br>')}</p>`);
  }
  return paragrafos.join('');
}

/************************************************************
 * [5.3] Marcar posição de leitura
 ************************************************************/
function markReadingPosition(element) {
  const index = element.getAttribute('data-index');
  localStorage.setItem('readingPosition_' + currentStoryId, index);
  showToast("Posição de leitura salva (palavra " + index + ")");
}

/************************************************************
 * [5.4] Destacar a palavra marcada
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
 * [5.5] Criar o cartão da história
 ************************************************************/
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'featured-sheet';

  // Título do cartão
  const titleEl = document.createElement('div');
  titleEl.className = 'sheet-title';
  titleEl.textContent = story.cartao.tituloCartao || 'Sem Título';
  div.appendChild(titleEl);

  // Sinopse do cartão
  const sinopseEl = document.createElement('div');
  sinopseEl.className = 'sheet-sinopse';
  sinopseEl.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao || '(sem sinopse)');
  div.appendChild(sinopseEl);

  // Clique no cartão abre o modal com detalhes
  div.addEventListener('click', () => {
    isModalOpen = true;
    currentStoryId = story.id;
    modalTitle.textContent = story.cartao.tituloCartao || "Sem Título";
    modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao || '(sem sinopse)');
    modalInfo.innerHTML = '';

    // Botão "Ler" para exibir a história completa com palavras clicáveis
    const lerBtn = document.createElement('button');
    lerBtn.textContent = 'Ler';
    lerBtn.addEventListener('click', () => {
      modalTitle.textContent = story.titulo || "História Completa";
      originalText = story.cartao.historiaCompleta || '(sem história completa)';
      if (story.bloqueio2) {
        const lines = originalText.split('\n');
        if (lines.length > 2) {
          originalText = lines.slice(0, 2).join('\n') + '\n...';
        }
      }
      modalFullText.innerHTML = formatarTextoParaLeitura(originalText);
    });
    modalFullText.appendChild(lerBtn);

    // Botão "Continuar" se houver posição salva (exibido conforme flag)
    let continuarBtn = document.getElementById('continuarBtn');
    if (!continuarBtn) {
      continuarBtn = document.createElement('button');
      continuarBtn.id = 'continuarBtn';
      continuarBtn.textContent = 'Continuar';
      continuarBtn.addEventListener('click', () => {
        const storyAtual = allStories.find(s => s.id == currentStoryId);
        if (storyAtual) {
          modalTitle.textContent = storyAtual.titulo || "História Completa";
          originalText = storyAtual.cartao.historiaCompleta || '(sem história completa)';
          if (storyAtual.bloqueio2) {
            const lines = originalText.split('\n');
            if (lines.length > 2) {
              originalText = lines.slice(0, 2).join('\n') + '\n...';
            }
          }
          modalFullText.innerHTML = formatarTextoParaLeitura(originalText);
          setTimeout(destacarPalavra, 100);
        }
      });
      modalFullText.appendChild(continuarBtn);
    }
    if (story.bloqueio2) {
      continuarBtn.style.display = 'none';
    } else {
      const savedPosition = localStorage.getItem('readingPosition_' + story.id);
      continuarBtn.style.display = savedPosition !== null ? 'inline-block' : 'none';
    }
    modalOverlay.style.display = 'flex';
  });

  return div;
}

/************************************************************
 * [6] Cartão Placeholder (caso não haja histórias)
 ************************************************************/
function createPlaceholderCard() {
  const div = document.createElement('div');
  div.className = 'featured-sheet';
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
 * [7] Pesquisa, Filtro e Exibição de Sugestões
 ************************************************************/
// Função que testa se a história combina com o valor pesquisado pelo título ou autor
function matchesSearch(story, searchInput) {
  const text = searchInput.trim().toLowerCase();
  if (!text) return true;
  const titulo = (story.cartao.tituloCartao || "").toLowerCase();
  const autor = (story.cartao.autorCartao || "").toLowerCase();
  return titulo.includes(text) || autor.includes(text);
}

// Retorna as histórias filtradas com base no input e outros filtros (se houver)
function getFilteredStories() {
  let arr = [...allStories];
  const searchInput = (document.getElementById('searchBar')?.value || '').toLowerCase();
  arr = arr.filter(story => matchesSearch(story, searchInput));
  // Se houver filtro de categoria ou ordenação, poderão ser aplicados aqui
  return arr;
}

// Exibe sugestões (dropdown) abaixo da barra de pesquisa
function exibirSugestoes(lista) {
  const searchResults = document.getElementById('searchResults');
  if (!searchResults) return;
  if (!lista || lista.length === 0) {
    searchResults.innerHTML = `<div style="padding:6px;">Nenhuma história encontrada</div>`;
    searchResults.style.display = 'block';
    return;
  }
  let html = '';
  lista.forEach(story => {
    const t = story.cartao.tituloCartao || "(Sem Título)";
    const a = story.cartao.autorCartao || "Desconhecido";
    html += `
      <div class="suggestion-item" data-id="${story.id}" style="padding:6px; border-bottom:1px solid #ccc; cursor:pointer;">
        <strong>${t}</strong><br>
        <em>Autor: ${a}</em>
      </div>
    `;
  });
  searchResults.innerHTML = html;
  searchResults.style.display = 'block';

  // Ao clicar na sugestão, abre a história
  const items = searchResults.querySelectorAll('.suggestion-item');
  items.forEach(item => {
    item.addEventListener('click', function() {
      const storyId = this.getAttribute('data-id');
      abrirHistoriaPorId(storyId);
      searchResults.style.display = 'none';
    });
  });
}

// Abre a história correspondente ao ID (abrindo o modal)
function abrirHistoriaPorId(storyId) {
  const story = allStories.find(s => s.id == storyId);
  if (!story) {
    showToast("História não encontrada!");
    return;
  }
  isModalOpen = true;
  currentStoryId = story.id;
  modalTitle.textContent = story.cartao.tituloCartao || "Sem Título";
  modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao || '(sem sinopse)');
  modalInfo.innerHTML = '';
  modalOverlay.style.display = 'flex';
}

/************************************************************
 * [8] Exibir os Cartões (Batch)
 ************************************************************/
function showBatch(count) {
  const filtered = getFilteredStories();
  if (filtered.length === 0) return;
  const end = currentOffset + count;
  const realSlice = filtered.slice(currentOffset, end);
  realSlice.forEach(story => {
    container.appendChild(createStoryCard(story));
  });
  currentOffset += count;
}

/************************************************************
 * [9] Funções para inicialização e carregamento
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
 * [10] Modal e Aviso de Clique Fora
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
 * [11] Evento DOMContentLoaded – Inicializações
 ************************************************************/
document.addEventListener('DOMContentLoaded', () => {
  exibirUsuarioLogado();
  loadAllStories();
  initialLoad();

  const searchBar = document.getElementById('searchBar');
  const searchBtn = document.getElementById('searchBtn');
  const categoryFilter = document.getElementById('category-filter'); // se existir
  const sortFilter = document.getElementById('sort-filter');         // se existir
  const loadMoreBtn = document.getElementById('loadMoreBtn');          // se existir

  // Eventos para filtros (se houver)
  if (categoryFilter) {
    categoryFilter.addEventListener('change', handleFilterOrSort);
  }
  if (sortFilter) {
    sortFilter.addEventListener('change', handleFilterOrSort);
  }
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMore);
  }

  // Evento na barra de pesquisa: se houver input, exibe as sugestões; se estiver vazio, restaura os cartões.
  if (searchBar) {
    searchBar.addEventListener('input', () => {
      const valor = searchBar.value;
      const searchResults = document.getElementById('searchResults');
      if (valor.trim() === '') {
        searchResults.style.display = 'none';
        container.innerHTML = '';
        currentOffset = 0;
        showBatch(initialCount);
      } else {
        const filtrados = allStories.filter(st => matchesSearch(st, valor));
        exibirSugestoes(filtrados);
      }
    });
  }
  
  // Se o botão "Continuar" existir, adiciona event listener
  const continuarBtn = document.getElementById('continuarBtn');
  if (continuarBtn) {
    continuarBtn.addEventListener('click', () => {
      const story = allStories.find(s => s.id == currentStoryId);
      if (story) {
        modalTitle.textContent = story.titulo || "História Completa";
        originalText = story.cartao.historiaCompleta || '(sem história completa)';
        if (story.bloqueio2) {
          const lines = originalText.split('\n');
          if (lines.length > 2) {
            originalText = lines.slice(0, 2).join('\n') + '\n...';
          }
        }
        modalFullText.innerHTML = formatarTextoParaLeitura(originalText);
        setTimeout(destacarPalavra, 100);
      }
    });
  }
});
