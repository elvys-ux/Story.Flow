import { supabase } from "./supabase.js";

/************************************************************
 * HistoriasQueEuEscrevi.js
 * - Lista Lateral
 * - Salvar história (se não tiver cartao, cria)
 * - Ler, Excluir
 * - Modo de Leitura
 * - Formatação a cada 5 pontos
 * - Marcador de linha
 * - Pesquisa por cartao.autorCartao ou cartao.tituloCartao
 ************************************************************/

/************************************************************
 * [A] LOGIN/LOGOUT - Usando Supabase
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;

  try {
    // Obtém a sessão atual do Supabase
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("Erro ao obter a sessão:", sessionError);
      return;
    }
    // Se não houver sessão, exibe link para login
    if (!session) {
      userArea.innerHTML = `
        <a href="Criacao.html" style="color:white;">
          <i class="fas fa-user"></i> Login
        </a>`;
      userArea.onclick = null;
      return;
    }

    const userId = session.user.id;
    // Consulta a tabela "profiles" para obter o campo "username"
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();

    let displayName = "";
    if (profileError || !profileData || !profileData.username) {
      displayName = session.user.email;
      console.warn("Não foi possível recuperar o username; utilizando email:", displayName);
    } else {
      displayName = profileData.username;
    }

    userArea.innerHTML = displayName;

    // Ao clicar, pergunta se deseja fazer logout e redireciona para "Criacao.html"
    userArea.onclick = () => {
      if (confirm("Deseja fazer logout?")) {
        supabase.auth.signOut().then(({ error }) => {
          if (error) {
            alert("Erro ao deslogar: " + error.message);
          } else {
            window.location.href = "Criacao.html";
          }
        });
      }
    };

  } catch (ex) {
    console.error("Exceção em exibirUsuarioLogado:", ex);
  }
}

/************************************************************
 * [B] VARIÁVEIS GLOBAIS (modo de leitura, etc.)
 ************************************************************/
let modoCorrido = true;
let partesHistoria = [];
let parteAtual = 0;
let isTitleListVisible = false;

// Para o marcador
let currentStoryId = null;   // Qual história está aberta
const wrapWidth = 80;        // nº de caracteres por linha
const lineHeightPx = 22;     // line-height aproximada (px)

// Variável para guardar o texto completo original
let textoCompleto = "";

/************************************************************
 * [C] LISTA LATERAL => MOSTRAR/ESCONDER
 ************************************************************/
function toggleTitleList(show) {
  const titleList = document.getElementById('titleListLeft');
  if (!titleList) return;
  if (show) {
    titleList.classList.add('visible');
    isTitleListVisible = true;
  } else {
    titleList.classList.remove('visible');
    isTitleListVisible = false;
  }
}
document.body.addEventListener('mousemove', function(e) {
  if (e.clientX < 50 && !isTitleListVisible) {
    toggleTitleList(true);
  }
});
document.body.addEventListener('mouseleave', function() {
  if (isTitleListVisible) {
    toggleTitleList(false);
  }
});
document.body.addEventListener('click', function(e) {
  const titleList = document.getElementById('titleListLeft');
  if (isTitleListVisible && titleList && !titleList.contains(e.target)) {
    toggleTitleList(false);
  }
});

/************************************************************
 * [D] MOSTRAR HISTÓRIAS NA LISTA LATERAL
 ************************************************************/
function mostrarHistorias() {
  const ul = document.getElementById('titleListUl');
  if (!ul) return;

  ul.innerHTML = '';
  const historias = JSON.parse(localStorage.getItem('historias')) || [];

  historias.forEach((h, index) => {
    // Se não tiver cartao, cria
    if (!h.cartao) {
      h.cartao = {
        tituloCartao: h.titulo || "(Sem Título)",
        autorCartao: "Desconhecido",
        sinopseCartao: (h.descricao || "").slice(0, 100),
        historiaCompleta: h.descricao || "",
        likes: 0,
        categorias: []
      };
    }

    const li = document.createElement('li');
    li.textContent = h.cartao.tituloCartao || '(Sem Título)';

    const buttons = document.createElement('span');
    buttons.classList.add('buttons');

    // Botão "Ler"
    const lerBtn = document.createElement('button');
    lerBtn.textContent = 'Ler';
    lerBtn.onclick = () => abrirHistoriaPorIndex(index);

    // Botão "Excluir"
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Excluir';
    delBtn.onclick = () => excluirHistoria(index);

    buttons.appendChild(lerBtn);
    buttons.appendChild(delBtn);
    li.appendChild(buttons);

    ul.appendChild(li);
  });
}

/************************************************************
 * [E] EXCLUIR HISTÓRIA
 ************************************************************/
function excluirHistoria(index) {
  if (!confirm("Deseja mesmo excluir a história?")) return;
  const historias = JSON.parse(localStorage.getItem('historias')) || [];
  historias.splice(index, 1);
  localStorage.setItem('historias', JSON.stringify(historias));
  mostrarHistorias();
}

/************************************************************
 * [F] LIMPAR FORMULÁRIO
 ************************************************************/
function limparFormulario() {
  document.getElementById('titulo').value = '';
  document.getElementById('descricao').value = '';
  const autorEl = document.getElementById('autor');
  if (autorEl) autorEl.value = '';
}

/************************************************************
 * [G] SALVAR HISTÓRIA
 ************************************************************/
function salvarHistoria(titulo, descricao, autor) {
  let historias = JSON.parse(localStorage.getItem('historias')) || [];
  const newID = Date.now().toString();

  // Monta cartao mínimo
  const cartaoMinimo = {
    tituloCartao: titulo || "(Sem Título)",
    autorCartao: autor || "Desconhecido",
    sinopseCartao: (descricao || "").substring(0, 100),
    historiaCompleta: descricao || "",
    likes: 0,
    categorias: []
  };

  const nova = {
    id: newID,
    titulo,
    descricao,
    autor,
    cartao: cartaoMinimo
  };
  historias.push(nova);
  localStorage.setItem('historias', JSON.stringify(historias));
  mostrarHistorias();
}

/************************************************************
 * [H] ABRIR HISTÓRIA PELO ÍNDICE
 ************************************************************/
function abrirHistoriaPorIndex(index) {
  const historias = JSON.parse(localStorage.getItem('historias')) || [];
  if (!historias[index]) {
    alert("História não encontrada!");
    return;
  }
  exibirHistoriaNoContainer(historias[index]);
}

/************************************************************
 * [I] FORMATAÇÃO: A CADA 5 PONTOS FINAIS => \n\n
 ************************************************************/
function formatarTexto(str) {
  let contador = 0;
  let resultado = '';
  for (let i = 0; i < str.length; i++) {
    resultado += str[i];
    if (str[i] === '.') {
      contador++;
      if (contador === 5) {
        resultado += '\n\n';
        contador = 0;
      }
    }
  }
  return resultado;
}

/************************************************************
 * [J] EXIBIR HISTÓRIA NO CONTEINER
 ************************************************************/
function exibirHistoriaNoContainer(hist) {
  currentStoryId = hist.id; // para o marcador

  // Usa cartao.historiaCompleta
  const textoBase = hist.cartao?.historiaCompleta || hist.descricao || "(Sem descrição)";
  const textoFormatado = formatarTexto(textoBase);

  // Armazena o texto completo original para o modo de leitura
  textoCompleto = textoFormatado;

  document.getElementById('historia-titulo').textContent = hist.cartao?.tituloCartao || "(Sem título)";

  const container = document.getElementById('historia-conteudo');
  container.innerText = textoCompleto;
  container.setAttribute("data-full-text", textoCompleto);

  // Reseta modo de leitura
  modoCorrido = true;
  partesHistoria = [];
  parteAtual = 0;
}

/************************************************************
 * [K] MODO DE LEITURA (CORRIDO VS PARÁGRAFOS)
 * Pagina o texto em blocos de 5 linhas.
 ************************************************************/
function toggleReadingMode() {
  const container = document.getElementById("historia-conteudo");
  const btnVoltar = document.getElementById("btn-voltar");
  const btnContinuar = document.getElementById("btn-continuar");

  let fullText = textoCompleto;
  container.setAttribute("data-full-text", fullText);

  if (modoCorrido) {
    const lines = fullText.split(/\r?\n/);
    const linesPerPage = 5;
    partesHistoria = [];
    for (let i = 0; i < lines.length; i += linesPerPage) {
      partesHistoria.push(lines.slice(i, i + linesPerPage).join('\n'));
    }
    parteAtual = 0;
    exibirParteAtual();
    if (partesHistoria.length > 1) {
      btnVoltar.style.display = 'inline-block';
      btnContinuar.style.display = 'inline-block';
    } else {
      btnVoltar.style.display = 'none';
      btnContinuar.style.display = 'none';
    }
    modoCorrido = false;
  } else {
    container.innerText = fullText;
    btnVoltar.style.display = 'none';
    btnContinuar.style.display = 'none';
    modoCorrido = true;
  }
}
function exibirParteAtual() {
  const container = document.getElementById("historia-conteudo");
  container.innerHTML = `<p>${partesHistoria[parteAtual]}</p>`;
}
function voltarPagina() {
  if (parteAtual > 0) {
    parteAtual--;
    exibirParteAtual();
  }
}
function continuarHistoria() {
  if (parteAtual < partesHistoria.length - 1) {
    parteAtual++;
    exibirParteAtual();
  }
}
document.addEventListener('keydown', function(e) {
  const key = e.key.toLowerCase();
  if (key === "arrowleft" || key === "arrowup" || key === "a" || key === "w") {
    voltarPagina();
  } else if (key === "arrowright" || key === "arrowdown" || key === "d" || key === "s") {
    continuarHistoria();
  }
});

/************************************************************
 * [L] MARCADOR DE LINHA: CLIQUE E "CONTINUAR"
 ************************************************************/
function wrapText(str, width) {
  const result = [];
  let i = 0;
  while (i < str.length) {
    result.push(str.slice(i, i + width));
    i += width;
  }
  return result;
}
function highlightLine(lineNumber) {
  const container = document.getElementById("historia-conteudo");
  const fullText = container.getAttribute("data-full-text") || container.innerText;
  if (!fullText) {
    alert("Nenhum texto para destacar!");
    return;
  }
  const lines = wrapText(fullText, wrapWidth);
  if (lineNumber < 1 || lineNumber > lines.length) {
    alert("Linha fora do intervalo!");
    return;
  }
  lines[lineNumber - 1] = `<span style="background:yellow">${lines[lineNumber - 1]}</span>`;
  container.innerHTML = lines.join('<br>');
  const scrollTarget = (lineNumber - 1) * lineHeightPx;
  container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
}
const containerLeitura = document.getElementById('historia-conteudo');
if (containerLeitura) {
  containerLeitura.addEventListener('click', function(e) {
    if (!currentStoryId) return;
    const rect = containerLeitura.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const scrollOffset = containerLeitura.scrollTop;
    const totalY = clickY + scrollOffset;
    const lineNumber = Math.floor(totalY / lineHeightPx) + 1;
    localStorage.setItem(`lineNumber_${currentStoryId}`, lineNumber);
    console.log("Linha salva:", lineNumber);
  });
}
function continuarMarcador() {
  if (!currentStoryId) return;
  const saved = localStorage.getItem(`lineNumber_${currentStoryId}`);
  if (!saved) {
    alert("Nenhuma linha salva para esta história.");
    return;
  }
  highlightLine(parseInt(saved, 10));
}

/************************************************************
 * [M] PESQUISA (POR cartao.tituloCartao OU cartao.autorCartao)
 ************************************************************/
function filtrarHistorias(query) {
  const todas = JSON.parse(localStorage.getItem('historias')) || [];
  query = query.toLowerCase();

  return todas.filter(story => {
    if (!story.cartao) {
      story.cartao = {
        tituloCartao: story.titulo || "(Sem Título)",
        autorCartao: story.autor || "Desconhecido",
        historiaCompleta: story.descricao || "",
        likes: 0
      };
    }
    const t = (story.cartao.tituloCartao || "").toLowerCase();
    const a = (story.cartao.autorCartao || "").toLowerCase();
    return t.includes(query) || a.includes(query);
  });
}
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
    const t = story.cartao?.tituloCartao || "(Sem Título)";
    const a = story.cartao?.autorCartao || "Desconhecido";
    html += `
      <div class="suggestion-item" data-id="${story.id}"
           style="padding:6px; border-bottom:1px solid #ccc; cursor:pointer;">
        <strong>${t}</strong><br>
        <em>Autor: ${a}</em>
      </div>
    `;
  });
  searchResults.innerHTML = html;
  searchResults.style.display = 'block';

  const items = searchResults.querySelectorAll('.suggestion-item');
  items.forEach(item => {
    item.addEventListener('click', function() {
      const storyId = this.dataset.id;
      abrirHistoriaPorId(storyId);
      searchResults.style.display = 'none';
    });
  });
}
function abrirHistoriaPorId(storyId) {
  const todas = JSON.parse(localStorage.getItem('historias')) || [];
  const h = todas.find(x => x.id === storyId);
  if (!h) {
    alert("História não encontrada!");
    return;
  }
  exibirHistoriaNoContainer(h);
}

/************************************************************
 * [N] DOMContentLoaded => CONFIGURAR TUDO
 ************************************************************/
document.addEventListener('DOMContentLoaded', function() {
  // Já foram chamadas funções de exibição de login e lista de histórias
  exibirUsuarioLogado();
  mostrarHistorias();

  const form = document.getElementById('formPrincipal');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const titulo = document.getElementById('titulo').value.trim();
      const descricao = document.getElementById('descricao').value.trim();
      const autorEl = document.getElementById('autor');
      const autor = autorEl ? autorEl.value.trim() : '';

      if (!titulo || !descricao) {
        alert("Preencha título e descrição!");
        return;
      }
      salvarHistoria(titulo, descricao, autor);
      limparFormulario();
    });
  }

  const searchBar = document.getElementById('searchBar');
  const searchBtn = document.getElementById('searchBtn');
  const searchResults = document.getElementById('searchResults');

  if (searchBar && searchBtn && searchResults) {
    searchBtn.addEventListener('click', function() {
      const query = searchBar.value.trim();
      if (!query) {
        searchResults.style.display = 'none';
        return;
      }
      const resultados = filtrarHistorias(query);
      exibirSugestoes(resultados);
    });

    searchBar.addEventListener('input', function() {
      const query = searchBar.value.trim();
      if (!query) {
        searchResults.style.display = 'none';
        return;
      }
      const resultados = filtrarHistorias(query);
      exibirSugestoes(resultados);
    });

    searchBar.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchBar.value.trim();
        const resultados = filtrarHistorias(query);
        exibirSugestoes(resultados);
      }
    });
  }

  const btnVoltar = document.getElementById('btn-voltar');
  const btnContinuar = document.getElementById('btn-continuar');
  if (btnVoltar) btnVoltar.addEventListener('click', voltarPagina);
  if (btnContinuar) btnContinuar.addEventListener('click', continuarHistoria);

  const toggleBtn = document.getElementById('toggleMode');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleReadingMode);
  }

  const btnMarcador = document.getElementById('btnMarcador');
  if (btnMarcador) {
    btnMarcador.addEventListener('click', continuarMarcador);
  }
});
