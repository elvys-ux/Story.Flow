// js/Memories.js
import { supabase } from './supabase.js';

/************************************************************
 * [1] LOGIN/LOGOUT com Supabase
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      userArea.innerHTML = `<a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
      return;
    }

    const userId = session.user.id;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();

    const username = (profileError || !profile?.username)
      ? session.user.email
      : profile.username;

    userArea.textContent = username;
    userArea.style.cursor = 'pointer';
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
    console.error('Exceção em exibirUsuarioLogado:', err);
  }
}

/************************************************************
 * [2] GLOBALS e ELEMENTOS
 ************************************************************/
let allStories      = [];
const container      = document.getElementById('featuredStories');
const searchBar      = document.getElementById('searchBar');
const searchResults  = document.getElementById('searchResults');
const modalOverlay   = document.getElementById('modalOverlay');
const modalClose     = document.getElementById('modalClose');
const modalTitle     = document.getElementById('modalTitle');
const modalFullText  = document.getElementById('modalFullText');
const modalInfo      = document.getElementById('modalInfo');
const warningOverlay = document.getElementById('warningOverlay');
const warningYes     = document.getElementById('warningYes');
const warningNo      = document.getElementById('warningNo');

let isModalOpen     = false;
let currentStoryId  = null;

/************************************************************
 * [3] BUSCA os 4 CARTÕES mais curtidos do Supabase
 ************************************************************/
async function fetchFeaturedStories() {
  const { data: cartoes, error } = await supabase
    .from('cartoes')
    .select(`
      historia_id,
      titulo_cartao,
      sinopse_cartao,
      autor_cartao,
      data_criacao,
      likes,
      historia_completa
    `)
    .order('likes', { ascending: false })
    .limit(4);

  if (error) {
    console.error('Erro ao buscar destaques:', error);
    return;
  }

  allStories = cartoes.map(c => ({
    id: c.historia_id,
    cartao: {
      tituloCartao:     c.titulo_cartao      || 'Sem Título',
      sinopseCartao:    c.sinopse_cartao     || '',
      historiaCompleta: c.historia_completa  || '',
      dataCartao:       c.data_criacao
                          ? c.data_criacao.split('T')[0]
                          : '',
      autorCartao:      c.autor_cartao       || 'Anônimo',
      likes:            c.likes ?? 0
    }
  }));
}

/************************************************************
 * [4] FORMATADORES DE TEXTO
 ************************************************************/
function formatarPor4Linhas(text) {
  return text.split('\n').slice(0, 4).join('<br>');
}

function formatarTextoParaLeitura(text) {
  return text.split('\n').map(l => `<p>${l}</p>`).join('');
}

/************************************************************
 * [5] CRIAÇÃO DE CARTÕES
 ************************************************************/
function createStoryCard(story) {
  const div = document.createElement('div');
  div.className = 'featured-sheet';
  div.innerHTML = `
    <h3>${story.cartao.tituloCartao}</h3>
    <div class="sheet-sinopse">${formatarPor4Linhas(story.cartao.sinopseCartao)}</div>
    <span class="ver-mais">mais...</span>
  `;
  div.querySelector('.ver-mais').onclick = () => openModal(story);
  return div;
}

/************************************************************
 * [6] RENDERIZAÇÃO DOS DESTAQUES
 ************************************************************/
function renderFeatured() {
  container.innerHTML = '';
  allStories.forEach(story => {
    container.appendChild(createStoryCard(story));
  });
}

/************************************************************
 * [7] MODAL: SINOPSE + BOTÃO “Ler”
 ************************************************************/
function openModal(story) {
  isModalOpen     = true;
  currentStoryId  = story.id;

  modalTitle.textContent = story.cartao.tituloCartao;
  modalFullText.innerHTML = `
    <div>${formatarPor4Linhas(story.cartao.sinopseCartao)}</div>
    <button id="btnLer">Ler</button>
  `;
  modalInfo.innerHTML = `
    <p><strong>Autor:</strong> ${story.cartao.autorCartao}</p>
    <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
    <p><strong>Curtidas:</strong> ${story.cartao.likes}</p>
  `;

  document.getElementById('btnLer').onclick = () => {
    modalFullText.innerHTML = formatarTextoParaLeitura(story.cartao.historiaCompleta);
  };

  modalOverlay.style.display = 'flex';
}

/************************************************************
 * [8] CONTROLE DO MODAL E AVISOS
 ************************************************************/
modalClose.onclick = () => {
  modalOverlay.style.display = 'none';
  isModalOpen = false;
};

modalOverlay.onclick = e => {
  if (e.target === modalOverlay && isModalOpen) {
    warningOverlay.style.display = 'flex';
  }
};

warningYes.onclick = () => {
  modalOverlay.style.display   = 'none';
  warningOverlay.style.display = 'none';
  isModalOpen                  = false;
};

warningNo.onclick = () => {
  warningOverlay.style.display = 'none';
};

/************************************************************
 * [9] PESQUISA COM SUGESTÕES
 ************************************************************/
function matchesSearch(story, txt) {
  const t = txt.trim().toLowerCase();
  return story.cartao.tituloCartao.toLowerCase().includes(t)
      || story.cartao.autorCartao.toLowerCase().includes(t);
}

function exibirSugestoes(lista) {
  if (!searchResults) return;
  if (!lista.length) {
    searchResults.innerHTML = `<div style="padding:6px;">Nenhuma história encontrada</div>`;
  } else {
    searchResults.innerHTML = lista.map(s => `
      <div class="suggestion-item" data-id="${s.id}">
        <strong>${s.cartao.tituloCartao}</strong><br>
        <em>Autor: ${s.cartao.autorCartao}</em>
      </div>
    `).join('');
  }
  searchResults.style.display = 'block';
  searchResults.querySelectorAll('.suggestion-item')
    .forEach(el => el.onclick = () => {
      const story = allStories.find(x => x.id == el.dataset.id);
      if (story) openModal(story);
      searchResults.style.display = 'none';
    });
}

/************************************************************
 * [10] INICIALIZAÇÃO
 ************************************************************/
document.addEventListener('DOMContentLoaded', async () => {
  // 1) login e destaques
  await exibirUsuarioLogado();
  await fetchFeaturedStories();
  renderFeatured();

  // 2) pesquisa
  if (searchBar) {
    searchBar.oninput = () => {
      const v = searchBar.value;
      if (!v.trim()) {
        searchResults.style.display = 'none';
        return;
      }
      const filtrados = allStories.filter(s => matchesSearch(s, v));
      exibirSugestoes(filtrados);
    };
  }

  // 3) rodapé ao hover
  document.body.addEventListener('mousemove', e => {
    const footer = document.querySelector('footer');
    if (!footer) return;
    if (window.innerHeight - e.clientY < 50) {
      footer.classList.add('visible');
    } else {
      footer.classList.remove('visible');
    }
  });

  // 4) menu hamburger mobile
  const navToggle = document.getElementById('navToggle');
  const navLinks  = document.querySelector('.nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }
});
