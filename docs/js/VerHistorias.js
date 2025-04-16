// VerHistorias.js
import { supabase } from './supabase.js';

///////////////////////////////////////////
// [1] LOGIN / LOGOUT
///////////////////////////////////////////
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return console.error("userMenuArea não encontrado");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    userArea.innerHTML = `<a href="Criacao.html" style="color:white;">
      <i class="fas fa-user"></i> Login
    </a>`;
    userArea.onclick = null;
    return;
  }

  const userId = session.user.id;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single();

  const name = (!error && profile?.username) ? profile.username : session.user.email;
  userArea.innerText = name;
  userArea.onclick = () => {
    if (confirm("Deseja fazer logout?")) {
      supabase.auth.signOut().then(({ error }) => {
        if (error) alert("Erro ao deslogar: " + error.message);
        else window.location.href = "index.html";
      });
    }
  };
}

///////////////////////////////////////////
// [2] TOAST
///////////////////////////////////////////
function showToast(msg, ms = 2000) {
  const t = document.createElement('div');
  t.className = 'my-toast';
  t.innerText = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

///////////////////////////////////////////
// [3] ESTADO E SELECTORS
///////////////////////////////////////////
let allStories = [];
let offset = 0;
const BATCH = 5;
const FIRST_LOAD = 20;

const container     = document.getElementById('storiesContainer');
const categoryFilter= document.getElementById('category-filter');
const sortFilter    = document.getElementById('sort-filter');
const searchBar     = document.getElementById('searchBar');
const loadMoreBtn   = document.getElementById('loadMoreBtn');

const modalOverlay  = document.getElementById('modalOverlay');
const modalClose    = document.getElementById('modalClose');
const modalTitle    = document.getElementById('modalTitle');
const modalFullText = document.getElementById('modalFullText');
const modalInfo     = document.getElementById('modalInfo');
const warningOverlay= document.getElementById('warningOverlay');
const warningYes    = document.getElementById('warningYes');
const warningNo     = document.getElementById('warningNo');

let isModalOpen = false;
let currentStoryId = null;
let originalText = '';

///////////////////////////////////////////
// [4] BUSCAR DO SUPABASE
///////////////////////////////////////////
async function loadAllStories() {
  // Supondo tabela 'cartoes' com relacionamento a 'historias' e 'historia_categorias->categorias'
  const { data, error } = await supabase
    .from('cartoes')
    .select(`
      historia_id,
      titulo_cartao,
      sinopse_cartao,
      data_criacao,
      autor_cartao,
      likes,
      historias (
        titulo,
        descricao
      ),
      historia_categorias (
        categorias (nome)
      )
    `)
    .order('data_criacao', { ascending: false });

  if (error) {
    console.error('Erro ao buscar cartões:', error);
    return;
  }

  allStories = data.map(c => ({
    id: c.historia_id,
    titulo: c.historias.titulo,
    cartao: {
      tituloCartao:   c.titulo_cartao,
      sinopseCartao:  c.sinopse_cartao,
      historiaCompleta: c.historias.descricao,
      dataCartao:     c.data_criacao.split('T')[0],
      autorCartao:    c.autor_cartao || 'Anônimo',
      categorias:     c.historia_categorias.map(rc => rc.categorias.nome),
      likes:          c.likes || 0
    }
  }));
}

///////////////////////////////////////////
// [5] FORMATADORES
///////////////////////////////////////////
function formatarPor4Linhas(text) {
  const lines = text.split('\n');
  const paras = [], buf = [];
  lines.forEach((l, i) => {
    buf.push(l);
    if ((i+1)%4 === 0) {
      paras.push(buf.join('<br>'));
      buf.length = 0;
    }
  });
  if (buf.length) paras.push(buf.join('<br>'));
  return paras.map(p => `<p style="text-align:justify">${p}</p>`).join('');
}

function formatarTextoParaLeitura(text) {
  let idx = 0;
  const paras = [], buf = [];
  text.split('\n').forEach((line, i) => {
    const spans = line.split(' ')
      .map(w => `<span class="reading-word" data-index="${idx++}" onclick="markReadingPosition(this)">${w}</span>`)
      .join(' ');
    buf.push(spans);
    if ((i+1)%4 === 0) {
      paras.push(`<p style="text-align:justify">${buf.join('<br>')}</p>`);
      buf.length = 0;
    }
  });
  if (buf.length) paras.push(`<p style="text-align:justify">${buf.join('<br>')}</p>`);
  return paras.join('');
}

function markReadingPosition(el) {
  const ix = el.getAttribute('data-index');
  localStorage.setItem(`readingPosition_${currentStoryId}`, ix);
  showToast(`Posição salva: palavra ${ix}`);
}

function destacarPalavra() {
  const ix = localStorage.getItem(`readingPosition_${currentStoryId}`);
  if (!ix) return;
  const span = modalFullText.querySelector(`[data-index="${ix}"]`);
  if (span) {
    span.style.background = 'yellow';
    span.scrollIntoView({ block:'center', behavior:'smooth' });
  }
}

///////////////////////////////////////////
// [6] MONTAR CARTÃO
///////////////////////////////////////////
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'sheet';

  // Título do cartão
  const h = document.createElement('div');
  h.className = 'sheet-title';
  h.textContent = story.cartao.tituloCartao;
  div.appendChild(h);

  // Sinopse
  const s = document.createElement('div');
  s.className = 'sheet-sinopse';
  s.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  div.appendChild(s);

  // Ver Mais / Ler / Continuar
  const spanMais = document.createElement('span');
  spanMais.className = 'ver-mais';
  spanMais.textContent = 'mais...';
  spanMais.style.cursor = 'pointer';
  spanMais.onclick = () => abrirModal(story);
  div.appendChild(spanMais);

  // Curtidas
  const likeDiv = document.createElement('div');
  likeDiv.className = 'sheet-likes';
  const btnLike = document.createElement('button');
  btnLike.textContent = story.cartao.likes > 0 ? '❤️' : '🤍';
  const cnt = document.createElement('span');
  cnt.textContent = ` ${story.cartao.likes}`;
  btnLike.onclick = () => {
    // Se quiser salvar no Supabase, chame aqui .update({ likes: newCount })
    story.cartao.likes++;
    btnLike.textContent = '❤️';
    cnt.textContent = ` ${story.cartao.likes}`;
  };
  likeDiv.appendChild(btnLike);
  likeDiv.appendChild(cnt);
  div.appendChild(likeDiv);

  // Categorias
  const cdiv = document.createElement('div');
  cdiv.className = 'sheet-categorias';
  if (story.cartao.categorias.length) {
    story.cartao.categorias.forEach(n => {
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = n;
      cdiv.appendChild(b);
    });
  } else {
    const b = document.createElement('span');
    b.className = 'badge';
    b.textContent = 'Sem Categoria';
    cdiv.appendChild(b);
  }
  div.appendChild(cdiv);

  return div;
}

///////////////////////////////////////////
// [7] FILTROS / ORDENAR / PESQUISA
///////////////////////////////////////////
function matchesSearch(st, txt) {
  if (!txt) return true;
  const t = st.cartao.tituloCartao.toLowerCase();
  const a = st.cartao.autorCartao.toLowerCase();
  return t.includes(txt) || a.includes(txt);
}

function getFilteredStories() {
  let arr = [...allStories];
  const txt = (searchBar.value||'').toLowerCase();
  arr = arr.filter(s => matchesSearch(s, txt));
  const cat = categoryFilter.value;
  if (cat) arr = arr.filter(s => s.cartao.categorias.includes(cat));
  if (sortFilter.value === 'date') {
    arr.sort((a,b) => b.cartao.dataCartao.localeCompare(a.cartao.dataCartao));
  } else {
    arr.sort((a,b) => b.cartao.likes - a.cartao.likes);
  }
  return arr;
}

///////////////////////////////////////////
// [8] MOSTRAR EM BATCH
///////////////////////////////////////////
function showBatch(count) {
  const arr = getFilteredStories();
  const slice = arr.slice(offset, offset + count);
  slice.forEach(st => container.appendChild(createStoryCard(st)));
  offset += count;
  loadMoreBtn.disabled = offset >= arr.length;
}

///////////////////////////////////////////
// [9] MODAL
///////////////////////////////////////////
function abrirModal(story) {
  isModalOpen = true;
  currentStoryId = story.id;
  modalTitle.textContent = story.cartao.tituloCartao;
  modalFullText.innerHTML = formatarPor4Linhas(story.cartao.sinopseCartao);
  modalInfo.innerHTML = `
    <p><strong>Autor:</strong> ${story.cartao.autorCartao}</p>
    <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
    <p><strong>História:</strong></p>
    <p>${formatarPor4Linhas(story.cartao.historiaCompleta)}</p>
  `;
  document.getElementById('continuarBtn').style.display = 'inline-block';
  modalOverlay.style.display = 'flex';
}

// fechar modal
modalClose.onclick = () => { modalOverlay.style.display = 'none'; isModalOpen = false; };
modalOverlay.onclick = e => {
  if (e.target === modalOverlay && isModalOpen) {
    warningOverlay.style.display = 'flex';
  }
};
warningYes.onclick = () => {
  warningOverlay.style.display = 'none';
  modalOverlay.style.display  = 'none';
  isModalOpen = false;
};
warningNo.onclick = () => { warningOverlay.style.display = 'none'; };

///////////////////////////////////////////
// [10] INICIALIZAÇÃO
///////////////////////////////////////////
document.addEventListener('DOMContentLoaded', async () => {
  await exibirUsuarioLogado();
  await loadAllStories();
  container.innerHTML = '';
  offset = 0;
  showBatch(FIRST_LOAD);

  categoryFilter.onchange = () => { container.innerHTML=''; offset=0; showBatch(FIRST_LOAD); };
  sortFilter.onchange     = categoryFilter.onchange;
  searchBar.oninput       = categoryFilter.onchange;
  loadMoreBtn.onclick     = () => showBatch(BATCH);
});
