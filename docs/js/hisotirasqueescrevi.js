import { supabase } from "./supabase.js";

/* [A] AUTENTICAÇÃO */
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) { console.error(error); return; }

  if (!session) {
    userArea.innerHTML = `
      <a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
    userArea.onclick = null;
    return;
  }

  const userId = session.user.id;
  let displayName = session.user.email;

  const { data: profile, error: errProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single();

  if (!errProfile && profile?.username) {
    displayName = profile.username;
  }

  userArea.textContent = displayName;
  userArea.onclick = () => {
    if (confirm('Deseja fazer logout?')) {
      supabase.auth.signOut().then(({ error }) => {
        if (error) alert('Erro ao deslogar: ' + error.message);
        else window.location.href = 'Criacao.html';
      });
    }
  };
}

/* [B] HELPERS DE DADOS */
async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

// 1) Histórias salvas OU publicadas pelo usuário autenticado
async function fetchUserStories() {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('historias')
    .select('id, cartao')
    .or(`created_by.eq.${userId},published_by.eq.${userId}`);
  if (error) console.error('fetchUserStories:', error);
  return data || [];
}

// 2) Histórias publicadas com cartão, filtradas por título ou autor (qualquer usuário)
async function fetchPublishedWithCartao(query = '') {
  const filtro = query.trim();
  let builder = supabase
    .from('historias')
    .select(`
      id,
      cartao->>tituloCartao as titulo,
      cartao->>autorCartao  as autor
    `)
    .eq('published', true);

  if (filtro) {
    const orFilter = 
      `cartao->>tituloCartao.ilike.%${filtro}%,` +
      `cartao->>autorCartao.ilike.%${filtro}%`;
    builder = builder.or(orFilter);
  }

  const { data, error } = await builder;
  if (error) console.error('fetchPublishedWithCartao:', error);
  return data || [];
}

// 3) Inserir nova história
async function salvarHistoria(titulo, descricao, autor) {
  const userId = await getCurrentUserId();
  const novo = {
    titulo,
    descricao,
    created_by: userId,
    published_by: userId,
    published: true,
    cartao: {
      tituloCartao: titulo || '(Sem Título)',
      autorCartao:  autor   || 'Desconhecido',
      sinopseCartao: descricao.substring(0, 100),
      historiaCompleta: descricao,
      likes: 0,
      categorias: []
    }
  };

  const { error } = await supabase.from('historias').insert(novo);
  if (error) {
    alert('Erro ao salvar: ' + error.message);
  } else {
    document.getElementById('formPrincipal').reset();
    mostrarHistorias();
  }
}

// 4) Excluir história por ID
async function excluirHistoriaPeloId(id) {
  if (!confirm('Deseja mesmo excluir a história?')) return;
  const { error } = await supabase
    .from('historias')
    .delete()
    .eq('id', id);
  if (error) {
    alert('Erro ao excluir: ' + error.message);
  } else {
    mostrarHistorias();
  }
}

/* [C] FORMATAÇÃO E PAGINAÇÃO */
let modoCorrido = true;
let partesHistoria = [];
let parteAtual     = 0;
let textoCompleto  = '';

function formatarTexto(str) {
  let cnt = 0, out = '';
  for (const c of str) {
    out += c;
    if (c === '.') {
      cnt += 1;
      if (cnt === 5) {
        out += '\n\n';
        cnt = 0;
      }
    }
  }
  return out;
}

function toggleReadingMode() {
  const cont   = document.getElementById('historia-conteudo');
  const full   = cont.getAttribute('data-full-text');
  const btnV   = document.getElementById('btn-voltar');
  const btnC   = document.getElementById('btn-continuar');

  if (modoCorrido) {
    const lines = full.split(/\r?\n/);
    partesHistoria = [];
    for (let i = 0; i < lines.length; i += 5) {
      partesHistoria.push(lines.slice(i, i + 5).join('\n'));
    }
    parteAtual = 0;
    exibirParteAtual();
    btnV.style.display = btnC.style.display = (partesHistoria.length > 1 ? 'inline-block' : 'none');
    modoCorrido = false;
  } else {
    cont.innerText = full;
    btnV.style.display = btnC.style.display = 'none';
    modoCorrido = true;
  }
}

function exibirParteAtual() {
  document.getElementById('historia-conteudo')
    .innerHTML = `<p>${partesHistoria[parteAtual]}</p>`;
}

function voltarPagina()   { if (parteAtual > 0)                     parteAtual-- && exibirParteAtual(); }
function continuarHistoria() { if (parteAtual < partesHistoria.length - 1) parteAtual++ && exibirParteAtual(); }

/* [D] LISTA LATERAL */
async function mostrarHistorias() {
  const ul = document.getElementById('titleListUl');
  ul.innerHTML = '';
  const historias = await fetchUserStories();
  historias.forEach(h => {
    const titulo = h.cartao?.tituloCartao || '(Sem Título)';
    const li     = document.createElement('li');
    li.textContent = titulo;

    const btns = document.createElement('span');
    btns.classList.add('buttons');

    const ler = document.createElement('button');
    ler.textContent = 'Ler';
    ler.onclick     = () => abrirHistoriaPorId(h.id);

    const deletar = document.createElement('button');
    deletar.textContent = 'Excluir';
    deletar.onclick     = () => excluirHistoriaPeloId(h.id);

    btns.append(ler, deletar);
    li.appendChild(btns);
    ul.appendChild(li);
  });
}

/* [E] EXIBIR UMA HISTÓRIA */
async function abrirHistoriaPorId(id) {
  const { data: [hist], error } = await supabase
    .from('historias')
    .select(`
      descricao,
      cartao->>tituloCartao     as titulo,
      cartao->>historiaCompleta as total
    `)
    .eq('id', id);

  if (error || !hist) {
    alert('História não encontrada!');
    return;
  }

  textoCompleto = formatarTexto(hist.total || hist.descricao || '(Sem descrição)');
  const cont    = document.getElementById('historia-conteudo');
  cont.innerText = textoCompleto;
  cont.setAttribute('data-full-text', textoCompleto);
  document.getElementById('historia-titulo').textContent = hist.titulo;
  modoCorrido = true;
  partesHistoria = [];
  parteAtual = 0;
}

/* [F] PESQUISA */
async function filtrarHistorias(query) {
  const dados = await fetchPublishedWithCartao(query);
  return dados.map(h => ({
    id:            h.id,
    tituloCartao:  h.titulo,
    autorCartao:   h.autor
  }));
}

function exibirSugestoes(lista) {
  const box = document.getElementById('searchResults');
  if (!lista.length) {
    box.innerHTML = `<div style="padding:6px;">Nenhuma história encontrada</div>`;
  } else {
    box.innerHTML = lista.map(s => `
      <div class="suggestion-item" data-id="${s.id}">
        <strong>${s.tituloCartao}</strong><br>
        <em>Autor: ${s.autorCartao}</em>
      </div>
    `).join('');
    box.querySelectorAll('.suggestion-item')
       .forEach(item => item.addEventListener('click', () => {
         abrirHistoriaPorId(item.dataset.id);
         box.style.display = 'none';
       }));
  }
  box.style.display = 'block';
}

/* [G] EVENTOS & INICIALIZAÇÃO */
document.body.addEventListener('mousemove', e => {
  if (e.clientX < 50) document.getElementById('titleListLeft')?.classList.add('visible');
});

document.body.addEventListener('click', e => {
  const tl = document.getElementById('titleListLeft');
  if (tl?.classList.contains('visible') && !tl.contains(e.target)) {
    tl.classList.remove('visible');
  }
});

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowleft', 'a', 'w'].includes(k)) voltarPagina();
  if (['arrowright','d','s'].includes(k)) continuarHistoria();
});

document.addEventListener('DOMContentLoaded', () => {
  exibirUsuarioLogado();
  mostrarHistorias();

  document.getElementById('formPrincipal')?.addEventListener('submit', e => {
    e.preventDefault();
    const t = document.getElementById('titulo').value.trim();
    const d = document.getElementById('descricao').value.trim();
    const a = document.getElementById('autor')?.value.trim() || '';
    if (!t || !d) return alert('Preencha título e descrição!');
    salvarHistoria(t, d, a);
  });

  const sb  = document.getElementById('searchBar');
  const btn = document.getElementById('searchBtn');

  [btn, sb].forEach(el => {
    if (!el) return;
    const ev = el === btn ? 'click' : 'input';
    el.addEventListener(ev, async () => {
      const q = sb.value.trim();
      if (!q) return document.getElementById('searchResults').style.display = 'none';
      exibirSugestoes(await filtrarHistorias(q));
    });
  });

  document.getElementById('toggleMode')?.addEventListener('click', toggleReadingMode);
  document.getElementById('btn-voltar')?.addEventListener('click', voltarPagina);
  document.getElementById('btn-continuar')?.addEventListener('click', continuarHistoria);
});
