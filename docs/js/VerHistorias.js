import { supabase } from './supabase.js';

let allStories     = [];
let currentOffset  = 0;
const initialCount = 20;
const increment    = 5;
let isUserLoggedIn = false;

const container      = document.getElementById('storiesContainer');
const categoryFilter = document.getElementById('category-filter');
const sortFilter     = document.getElementById('sort-filter');
const searchBar      = document.getElementById('searchBar');
const loadMoreBtn    = document.getElementById('loadMoreBtn');

const modalOverlay   = document.getElementById('modalOverlay');
const modalClose     = document.getElementById('modalClose');
const modalTitle     = document.getElementById('modalTitle');
const modalFullText  = document.getElementById('modalFullText');
const modalInfo      = document.getElementById('modalInfo');
const warningOverlay = document.getElementById('warningOverlay');
const warningYes     = document.getElementById('warningYes');
const warningNo      = document.getElementById('warningNo');
const continuarBtn   = document.getElementById('continuarBtn');

// [1] Verifica sessão e exibe login/usuário
async function exibirUsuarioLogado() {
  const area = document.getElementById('userMenuArea');
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.error('getSession error', error);
  if (!session) {
    isUserLoggedIn = false;
    area.innerHTML = `<a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
    return;
  }
  isUserLoggedIn = true;
  const { data: profile, error: errP } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', session.user.id)
    .single();
  if (errP) console.error('profile error', errP);
  const nome = profile?.username || session.user.email;
  area.textContent = nome;
  area.style.cursor = 'pointer';
  area.onclick = () => {
    if (confirm('Deseja fazer logout?')) {
      supabase.auth.signOut().then(() => location.href = 'Criacao.html');
    }
  };
}

// [2] Busca histórias + cartões + categorias + likes de uma vez
async function fetchStoriesFromSupabase() {
  const { data, error } = await supabase
    .from('historias')
    .select(`
      id,
      titulo,
      descricao,
      data_criacao,
      likes,
      cartoes (
        titulo_cartao,
        sinopse_cartao,
        autor_cartao,
        data_criacao
      ),
      historia_categorias (
        categorias ( nome )
      )
    `)
    .order('data_criacao', { ascending: false });
  if (error) {
    console.error('Erro ao buscar histórias:', error);
    container.innerHTML = '<p>Erro ao carregar histórias.</p>';
    return;
  }

  allStories = data.map(row => {
    const card = row.cartoes[0] || {};
    const cats = (row.historia_categorias || [])
      .map(hc => hc.categorias?.nome)
      .filter(Boolean);
    return {
      id: row.id,
      cartao: {
        tituloCartao:     card.titulo_cartao   || row.titulo      || 'Sem título',
        sinopseCartao:    card.sinopse_cartao  || '',
        historiaCompleta: row.descricao        || '',
        dataCartao:       (card.data_criacao || row.data_criacao).split('T')[0],
        autorCartao:      card.autor_cartao    || 'Anónimo',
        categorias:       cats,
        likes:            row.likes             || 0
      }
    };
  });
}

// [3] Formatação de texto
function formatarPor4Linhas(text) {
  const lines = text.split('\n'), paras = [];
  for (let i = 0; i < lines.length; i += 4) {
    paras.push(lines.slice(i, i + 4).join('<br>'));
  }
  return paras.map(p => `<p style="text-align: justify;">${p}</p>`).join('');
}
function formatarTextoParaLeitura(text) {
  const lines = text.split('\n'), paras = [], spans = [];
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    lines[i].split(' ').forEach(w => {
      spans.push(`<span data-index="${idx++}" onclick="markReadingPosition(this)">${w}</span>`);
    });
    if ((i+1)%4===0 || i===lines.length-1) {
      paras.push(`<p style="text-align: justify;">${spans.join(' ')}</p>`);
      spans.length = 0;
    }
  }
  return paras.join('');
}
function markReadingPosition(el) {
  localStorage.setItem(`readingPosition_${currentStoryId}`, el.dataset.index);
}
function destacarPalavra() {
  const saved = localStorage.getItem(`readingPosition_${currentStoryId}`);
  if (saved) {
    const span = modalFullText.querySelector(`[data-index="${saved}"]`);
    if (span) {
      span.style.background = 'yellow';
      span.scrollIntoView({ behavior:'smooth', block:'center' });
    }
  }
}

// [4] Criação de cards + tratamento de likes
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  // título
  const h3 = document.createElement('h3');
  h3.textContent = story.cartao.tituloCartao;
  div.appendChild(h3);

  // sinopse
  const sin = document.createElement('div');
  sin.className = 'sheet-sinopse';
  sin.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  div.appendChild(sin);

  // “mais...”
  const mais = document.createElement('span');
  mais.className = 'ver-mais';
  mais.textContent = 'mais...';
  mais.onclick = () => {
    currentStoryId = story.id;
    modalTitle.textContent = story.cartao.tituloCartao;
    modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
    modalInfo.innerHTML = `
      <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
      <p><strong>Autor:</strong> ${story.cartao.autorCartao}</p>
      <p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>
    `;
    const btnLer = document.createElement('button');
    btnLer.textContent = 'Ler';
    btnLer.onclick = () => {
      modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
      setTimeout(destacarPalavra, 100);
    };
    modalFullText.appendChild(btnLer);
    continuarBtn.style.display = localStorage.getItem(`readingPosition_${story.id}`) ? 'inline-block' : 'none';
    modalOverlay.style.display = 'flex';
  };
  div.appendChild(mais);

  // likes somente para user logado
  if (isUserLoggedIn) {
    const likeCont = document.createElement('div');
    likeCont.style.marginTop = '10px';
    const likeBtn = document.createElement('button');
    likeBtn.className = 'like-btn';
    const likeCt  = document.createElement('span');
    let userLiked = false;

    function updateUI() {
      likeBtn.textContent = userLiked ? '❤️' : '🤍';
      likeCt.textContent = ` ${story.cartao.likes}`;
    }
    updateUI();

    likeBtn.onclick = async () => {
      story.cartao.likes += userLiked ? -1 : 1;
      userLiked = !userLiked;
      const { error } = await supabase
        .from('historias')
        .update({ likes: story.cartao.likes })
        .eq('id', story.id);
      if (error) console.error('Erro ao atualizar likes:', error);
      updateUI();
    };

    likeCont.append(likeBtn, likeCt);
    div.appendChild(likeCont);
  }

  // categorias
  const catCont = document.createElement('div');
  catCont.className = 'sheet-categories';
  (story.cartao.categorias.length ? story.cartao.categorias : ['Sem Categoria'])
    .forEach(c => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = c;
      catCont.appendChild(badge);
    });
  div.appendChild(catCont);

  return div;
}

// placeholder
function createPlaceholderCard() {
  const div = document.createElement('div');
  div.className = 'sheet sheet-placeholder';
  div.innerHTML = '<h3>Placeholder</h3><p>(sem história)</p>';
  return div;
}

// [5] Filtrar / ordenar / pesquisar
function matchesSearch(story, txt) {
  if (!txt) return true;
  txt = txt.toLowerCase();
  return (
    story.cartao.tituloCartao.toLowerCase().includes(txt) ||
    story.cartao.autorCartao.toLowerCase().includes(txt)
  );
}
function getFilteredStories() {
  let arr = allStories.filter(st => matchesSearch(st, searchBar.value));
  if (categoryFilter.value) {
    arr = arr.filter(st => st.cartao.categorias.includes(categoryFilter.value));
  }
  if (sortFilter.value === 'date') {
    arr.sort((a, b) => b.cartao.dataCartao.localeCompare(a.cartao.dataCartao));
  } else if (sortFilter.value === 'popularity') {
    arr.sort((a, b) => b.cartao.likes - a.cartao.likes);
  }
  return arr;
}

// [6] Paginação
function showBatch(count) {
  const filtered = getFilteredStories();
  const slice = filtered.slice(currentOffset, currentOffset + count);
  const frag = document.createDocumentFragment();
  slice.forEach(s => frag.appendChild(createStoryCard(s)));
  for (let i = slice.length; i < count; i++) {
    frag.appendChild(createPlaceholderCard());
  }
  container.appendChild(frag);
  currentOffset += count;
  loadMoreBtn.disabled = false;
}
function initialLoad() {
  container.innerHTML = '';
  currentOffset = 0;
  showBatch(initialCount);
}
function loadMore() {
  loadMoreBtn.disabled = true;
  showBatch(increment);
}

// [7] Modal & aviso
modalClose.onclick = () => { modalOverlay.style.display = 'none'; };
modalOverlay.onclick = e => { if (e.target === modalOverlay) warningOverlay.style.display = 'flex'; };
warningYes.onclick   = () => { modalOverlay.style.display = 'none'; warningOverlay.style.display = 'none'; };
warningNo.onclick    = () => { warningOverlay.style.display = 'none'; };
continuarBtn.onclick = () => {
  modalFullText.innerHTML = formatarTextoParaLeitura(
    allStories.find(s => s.id === currentStoryId).cartao.historiaCompleta
  );
  setTimeout(destacarPalavra, 100);
};

// [8] Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await fetchStoriesFromSupabase();
  initialLoad();

  searchBar.oninput       = initialLoad;
  categoryFilter.onchange = initialLoad;
  sortFilter.onchange     = initialLoad;
  loadMoreBtn.onclick     = loadMore;
});
