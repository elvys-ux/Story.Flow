// js/VerHistorias.js
import { supabase } from './supabase.js';

let sessionUserId = null;
let allStories    = [];
let likedStories  = new Set();
let currentOffset = 0;
const initialCount = 20;
const increment    = 5;

const container      = document.getElementById('storiesContainer');
const categoryFilter = document.getElementById('category-filter');
const sortFilter     = document.getElementById('sort-filter');
const searchForm     = document.getElementById('searchForm');
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

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // previne reload
  searchForm?.addEventListener('submit', e=>{
    e.preventDefault();
    initialLoad();
  });

  // sessão e área do usuário
  const { data:{session} } = await supabase.auth.getSession();
  sessionUserId = session?.user?.id || null;
  await renderUserArea();

  if(sessionUserId) await fetchUserLikes();
  await fetchCategories();
  await fetchStories();

  // render & finalize loader
  initialLoad();
  window.finalizeLoader?.();

  // filtros e paginação
  searchBar.addEventListener('input', initialLoad);
  categoryFilter.addEventListener('change', initialLoad);
  sortFilter.addEventListener('change', initialLoad);
  loadMoreBtn.addEventListener('click', ()=>{
    loadMoreBtn.disabled = true;
    showBatch(increment);
  });

  // modal e warning
  modalClose.addEventListener('click', ()=> modalOverlay.style.display='none');
  modalOverlay.addEventListener('click', e=>{
    if(e.target===modalOverlay) warningOverlay.style.display='flex';
  });
  warningYes.addEventListener('click', ()=>{
    warningOverlay.style.display='none';
    modalOverlay.style.display='none';
  });
  warningNo.addEventListener('click', ()=> warningOverlay.style.display='none');
}

async function renderUserArea(){
  const area = document.getElementById('userMenuArea');
  const { data:{session} } = await supabase.auth.getSession();
  if(!session){
    area.innerHTML = `<a href="Criacao.html"><i class="fas fa-user"></i> Login</a>`;
    return;
  }
  const { data:profile } = await supabase.from('profiles')
    .select('username').eq('id', session.user.id).single();
  const name = profile?.username || session.user.email;
  area.textContent = name;
  area.onclick = ()=> {
    if(confirm('Deseja sair?')) supabase.auth.signOut().then(()=> location.href='Criacao.html');
  };
}

async function fetchUserLikes(){
  const { data, error } = await supabase
    .from('user_likes').select('historia_id')
    .eq('user_id', sessionUserId);
  if(!error) likedStories = new Set(data.map(r=>r.historia_id));
}

let categoryMap = {};
async function fetchCategories(){
  const { data, error } = await supabase
    .from('categorias').select('id,nome');
  if(!error) categoryMap = Object.fromEntries(data.map(c=>[c.id,c.nome]));
}

async function fetchStories(){
  const { data:hist, error:eh } = await supabase
    .from('historias').select('id,titulo,descricao,data_criacao')
    .order('data_criacao',{ascending:false});
  if(eh){ container.innerHTML = '<p>Erro ao carregar.</p>'; return; }

  const { data:cards } = await supabase
    .from('cartoes').select('historia_id,titulo_cartao,sinopse_cartao,autor_cartao,data_criacao,likes');
  const cardMap = Object.fromEntries(cards.map(c=>[c.historia_id,c]));

  const { data:hc } = await supabase
    .from('historia_categorias').select('historia_id,categoria_id');
  const hcMap = {};
  hc.forEach(({historia_id,categoria_id})=>{
    hcMap[historia_id] = hcMap[historia_id]||[];
    hcMap[historia_id].push(categoryMap[categoria_id]);
  });

  allStories = hist.map(h=>{
    const c = cardMap[h.id]||{};
    return {
      id: h.id,
      hasCartao: !!c.titulo_cartao,
      cartao: {
        tituloCartao:     c.titulo_cartao || h.titulo    || 'Sem título',
        sinopseCartao:    c.sinopse_cartao|| h.descricao || '',
        historiaCompleta: h.descricao     || '',
        dataCartao:       (c.data_criacao|| h.data_criacao).split('T')[0],
        autorCartao:      c.autor_cartao  || 'Anônimo',
        categorias:       hcMap[h.id]     || [],
        likes:            c.likes ?? 0
      }
    };
  });
}

function formatSinopse(txt=''){
  return txt.split('\n').join('<br>');
}

function createStoryCard(story){
  const d = document.createElement('div');
  d.className = 'sheet';
  const h3 = document.createElement('h3');
  h3.textContent = story.cartao.tituloCartao;
  d.append(h3);

  const sin = document.createElement('div');
  sin.className = 'sheet-sinopse';
  sin.style.whiteSpace = 'pre-wrap';
  sin.innerHTML = formatSinopse(story.cartao.sinopseCartao);
  d.append(sin);

  const more = document.createElement('span');
  more.className = 'ver-mais';
  more.textContent = 'mais...';
  more.onclick = ()=> openModal(story);
  d.append(more);

  if(story.hasCartao){
    const likeDiv = document.createElement('div');
    likeDiv.style.marginTop='10px';
    const btn = document.createElement('button');
    btn.style='background:none;border:none;cursor:pointer;font-size:1.4rem';
    const count = document.createElement('span');

    let liked = likedStories.has(story.id);
    const update = ()=>{
      btn.textContent = liked ? '❤️' : '🤍';
      count.textContent = ` ${story.cartao.likes} curtida(s)`;
    };
    update();

    btn.onclick = async ()=>{
      if(!sessionUserId){ alert('Faça login'); return; }
      story.cartao.likes += liked ? -1 : 1;
      if(liked) await supabase.from('user_likes').delete().match({user_id:sessionUserId,historia_id:story.id});
      else     await supabase.from('user_likes').insert({user_id:sessionUserId,historia_id:story.id});
      liked = !liked;
      liked? likedStories.add(story.id): likedStories.delete(story.id);
      update();
      await supabase.from('cartoes').update({likes:story.cartao.likes}).eq('historia_id',story.id);
    };

    likeDiv.append(btn,count);
    d.append(likeDiv);
  }

  const catDiv = document.createElement('div');
  catDiv.className='sheet-categories';
  (story.cartao.categorias.length? story.cartao.categorias:['Sem Categoria'])
    .forEach(c=>{
      const b = document.createElement('span');
      b.className='badge'; b.textContent=c;
      catDiv.append(b);
    });
  d.append(catDiv);

  return d;
}

function openModal(story){
  modalOverlay.style.display='flex';
  modalTitle.textContent = story.cartao.tituloCartao;
  modalFullText.style.whiteSpace='pre-wrap';
  modalFullText.innerHTML = formatSinopse(story.cartao.sinopseCartao);

  const btn = document.createElement('button');
  btn.textContent='Ler';
  btn.onclick = ()=>{
    modalFullText.innerHTML = formatSinopse(story.cartao.historiaCompleta);
  };
  modalFullText.parentNode.insertBefore(btn, modalInfo);

  modalInfo.innerHTML = `
    <p><strong>Data:</strong> ${story.cartao.dataCartao}</p>
    <p><strong>Autor:</strong> ${story.cartao.autorCartao}</p>
    <p><strong>Categorias:</strong> ${story.cartao.categorias.join(', ')}</p>
  `;
}

function getFilteredStories(){
  let arr = allStories.filter(s=>{
    const term = searchBar.value.trim().toLowerCase();
    return !term ||
      s.cartao.tituloCartao.toLowerCase().includes(term) ||
      s.cartao.autorCartao.toLowerCase().includes(term);
  });
  if(categoryFilter.value)
    arr = arr.filter(s=>s.cartao.categorias.includes(categoryFilter.value));
  if(sortFilter.value==='date')
    arr.sort((a,b)=>b.cartao.dataCartao.localeCompare(a.cartao.dataCartao));
  else
    arr.sort((a,b)=>b.cartao.likes - a.cartao.likes);
  return arr;
}

function showBatch(cnt){
  const batch = getFilteredStories().slice(currentOffset, currentOffset+cnt);
  batch.forEach(s=>container.append(createStoryCard(s)));
  if(batch.length<cnt)
    for(let i=batch.length;i<cnt;i++)
      container.append(createPlaceholderCard());
  currentOffset += cnt;
  loadMoreBtn.disabled = false;
}

function initialLoad(){
  container.innerHTML=''; currentOffset=0; showBatch(initialCount);
}

function createPlaceholderCard(){
  const d = document.createElement('div');
  d.className='sheet sheet-placeholder';
  d.innerHTML='<h3>Placeholder</h3><p>(sem história)</p>';
  return d;
}

document.body.addEventListener('mousemove',e=>{
  const f = document.querySelector('footer');
  if(window.innerHeight - e.clientY < 50) f.classList.add('visible');
  else f.classList.remove('visible');
});
