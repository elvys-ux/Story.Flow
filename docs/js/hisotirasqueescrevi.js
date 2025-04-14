import { supabase } from "./supabase.js";

/************************************************************
 * [A] LOGIN/LOGOUT (usando Supabase)
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;

  // Obtém a sessão atual do Supabase
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error("Erro ao obter a sessão:", sessionError);
  }
  
  // Se não houver sessão, exibe o link para login
  if (!session) {
    userArea.innerHTML = `<a href="Criacao.html" style="color:white;">
      <i class="fas fa-user"></i> Login
    </a>`;
    userArea.onclick = null;
    return;
  }
  
  const userId = session.user.id;
  // Consulta a tabela profiles para obter o campo username
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();
  
  let displayName = "";
  if (profileError || !profileData || !profileData.username) {
    displayName = session.user.email;
    console.warn("Não foi possível recuperar o username. Utilizando e-mail:", displayName);
  } else {
    displayName = profileData.username;
  }
  
  userArea.innerHTML = displayName;
  
  // Ao clicar, pergunta se deseja fazer logout e redireciona para index.html
  userArea.onclick = () => {
    if (confirm("Deseja fazer logout?")) {
      supabase.auth.signOut().then(({ error }) => {
        if (error) {
          alert("Erro ao deslogar: " + error.message);
        } else {
          window.location.href = "index.html";
        }
      });
    }
  };
}

/************************************************************
 * [B] VARIÁVEIS GLOBAIS E CONFIGURAÇÕES
 ************************************************************/
let modoCorrido = true;
let partesHistoria = [];
let parteAtual = 0;
let isTitleListVisible = false;
let currentStoryId = null;   // Para o marcador e exibição

const wrapWidth = 80;        // Nº de caracteres por linha
const lineHeightPx = 22;     // Valor aproximado do line-height (px)
let textoCompleto = "";      // Para armazenamento do texto completo

/************************************************************
 * [C] LISTA LATERAL: MOSTRAR/ESCONDER
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
document.body.addEventListener('mousemove', e => {
  if (e.clientX < 50 && !isTitleListVisible) toggleTitleList(true);
});
document.body.addEventListener('mouseleave', () => {
  if (isTitleListVisible) toggleTitleList(false);
});
document.body.addEventListener('click', e => {
  const titleList = document.getElementById('titleListLeft');
  if (isTitleListVisible && titleList && !titleList.contains(e.target)) {
    toggleTitleList(false);
  }
});

/************************************************************
 * [D] FUNÇÃO AUXILIAR: BUSCAR CARTÃO POR HISTÓRIA
 ************************************************************/
// Considera que o ID do cartão é o mesmo da história ou que haja um relacionamento.
async function buscarCartaoPorHistoria(storyId) {
  const { data: cartao, error } = await supabase
    .from('cartoes')
    .select('*')
    .eq('id', storyId)
    .single();
  if (error) {
    // Se não encontrar, retorna um objeto vazio com dados padrão
    return {
      sinopse_cartao: "",
      historia_completa: "",
      data_criacao: "",
      autor_cartao: "Desconhecido",
      categorias: [],
      likes: 0
    };
  }
  return cartao;
}

/************************************************************
 * [E] MOSTRAR HISTÓRIAS NA LISTA LATERAL
 * – A consulta busca os registros da tabela **historias** e, para cada
 * história, busca o respectivo cartão na tabela **cartoes**.
 ************************************************************/
async function mostrarHistorias() {
  const ul = document.getElementById('titleListUl');
  if (!ul) return;
  ul.innerHTML = '';

  // Busca todas as histórias (pode ordenar por data)
  const { data: historias, error } = await supabase
    .from('historias')
    .select('*')
    .order('data_criacao', { ascending: false });
  if (error) {
    console.error("Erro ao buscar histórias:", error);
    return;
  }

  // Para cada história, busca o cartão correspondente
  for (let h of historias) {
    const cartao = await buscarCartaoPorHistoria(h.id);
    // Cria um objeto auxiliar com os dados a exibir
    const exibir = {
      id: h.id,
      titulo: h.titulo,
      descricao: h.descricao,
      cartao: {
        tituloCartao: h.titulo || "(Sem Título)",
        autorCartao: cartao.autor_cartao || "Desconhecido",
        sinopseCartao: (cartao.sinopse_cartao || "").substring(0, 100),
        historiaCompleta: cartao.historia_completa || h.descricao || "",
        likes: cartao.likes || 0,
        categorias: cartao.categorias || []
      }
    };

    const li = document.createElement('li');
    li.textContent = exibir.cartao.tituloCartao;

    // Cria botões “Ler” e “Excluir”
    const buttons = document.createElement('span');
    buttons.classList.add('buttons');

    const lerBtn = document.createElement('button');
    lerBtn.textContent = 'Ler';
    lerBtn.onclick = () => abrirHistoriaPorId(exibir.id);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Excluir';
    delBtn.onclick = () => excluirHistoria(exibir.id);

    buttons.appendChild(lerBtn);
    buttons.appendChild(delBtn);
    li.appendChild(buttons);
    ul.appendChild(li);
  }
}

/************************************************************
 * [F] EXCLUIR HISTÓRIA
 * – Remove o registro da tabela **historias** e também o registro
 * correspondente na tabela **cartoes**.
 ************************************************************/
async function excluirHistoria(storyId) {
  if (!confirm("Deseja realmente excluir a história?")) return;

  // Exclui da tabela histórias
  const { error: errHist } = await supabase
    .from('historias')
    .delete()
    .eq('id', storyId);
  if (errHist) {
    console.error("Erro ao excluir história:", errHist);
    alert("Erro ao excluir a história.");
    return;
  }

  // Exclui da tabela cartoes
  const { error: errCartao } = await supabase
    .from('cartoes')
    .delete()
    .eq('id', storyId);
  if (errCartao) {
    console.error("Erro ao excluir cartão:", errCartao);
  }
  alert("História excluída com sucesso!");
  mostrarHistorias();
}

/************************************************************
 * [G] LIMPAR FORMULÁRIO
 ************************************************************/
function limparFormulario() {
  document.getElementById('titulo').value = '';
  document.getElementById('descricao').value = '';
  const autorEl = document.getElementById('autor');
  if (autorEl) autorEl.value = '';
}

/************************************************************
 * [H] SALVAR HISTÓRIA
 * – Insere um registro na tabela **historias** e, em seguida, cria
 * um registro mínimo na tabela **cartoes** (com informações iniciais e 0 likes).
 ************************************************************/
async function salvarHistoria(titulo, descricao, autor) {
  // Obtém o usuário logado para associar o registro
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert("Usuário não autenticado.");
    return;
  }
  const user_id = session.user.id;
  const data_criacao = new Date().toISOString();

  // Insere na tabela histórias
  const { data: novaHistoria, error: errHist } = await supabase
    .from('historias')
    .insert([{ titulo, descricao, user_id, data_criacao }])
    .single();
  if (errHist) {
    console.error("Erro ao salvar história:", errHist);
    alert("Erro ao salvar a história.");
    return;
  }

  // Insere um registro mínimo na tabela cartoes utilizando o id da história
  const cartaoMinimo = {
    id: novaHistoria.id,  // assume que o ID será compartilhado
    sinopse_cartao: (descricao || "").substring(0, 100),
    historia_completa: descricao,
    data_criacao,
    autor_cartao: autor || "Desconhecido",
    categorias: [],
    likes: 0
  };

  const { error: errCartao } = await supabase
    .from('cartoes')
    .insert([cartaoMinimo]);
  if (errCartao) {
    console.error("Erro ao criar cartão:", errCartao);
    alert("Erro ao criar o cartão.");
    return;
  }

  alert("História salva com sucesso!");
  mostrarHistorias();
}

/************************************************************
 * [I] ABRIR HISTÓRIA (detalhada) PELO ID
 ************************************************************/
async function abrirHistoriaPorId(storyId) {
  // Busca a história e o cartão correspondente
  const { data: hist, error: errHist } = await supabase
    .from('historias')
    .select('*')
    .eq('id', storyId)
    .single();
  if (errHist) {
    console.error("Erro ao buscar a história:", errHist);
    alert("História não encontrada.");
    return;
  }
  const cartao = await buscarCartaoPorHistoria(storyId);

  // Define o texto a exibir (priorizando a história completa do cartão, se existir)
  const textoBase = cartao.historia_completa || hist.descricao || "(Sem descrição)";
  const textoFormatado = formatarTexto(textoBase);
  textoCompleto = textoFormatado;
  currentStoryId = hist.id;

  document.getElementById('historia-titulo').textContent = hist.titulo || "(Sem título)";
  const container = document.getElementById('historia-conteudo');
  container.innerText = textoCompleto;
  container.setAttribute("data-full-text", textoCompleto);
  
  // Reseta o modo de leitura
  modoCorrido = true;
  partesHistoria = [];
  parteAtual = 0;
}

/************************************************************
 * [J] FUNÇÃO AUXILIAR: FORMATAÇÃO DO TEXTO
 * Insere quebras de linha a cada 5 pontos (exemplo)
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
 * [K] MODO DE LEITURA (CORRIDO VS PARÁGRAFOS)
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
    btnVoltar.style.display = (partesHistoria.length > 1) ? 'inline-block' : 'none';
    btnContinuar.style.display = (partesHistoria.length > 1) ? 'inline-block' : 'none';
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
  if (["arrowleft", "arrowup", "a", "w"].includes(key)) {
    voltarPagina();
  } else if (["arrowright", "arrowdown", "d", "s"].includes(key)) {
    continuarHistoria();
  }
});

/************************************************************
 * [L] MARCADOR DE LINHA: CLIQUE PARA SALVAR POSIÇÃO
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
 * [M] PESQUISA: BUSCAR HISTÓRIAS DA TABELA "historias"
 ************************************************************/
async function filtrarHistorias(query) {
  query = query.toLowerCase();
  // Busca os registros da tabela histórias (pode filtrar por título)
  const { data: resultados, error } = await supabase
    .from('historias')
    .select('*')
    .ilike('titulo', `%${query}%`);
  if (error) {
    console.error("Erro na pesquisa:", error);
    return [];
  }
  
  // Para cada história, buscarmos o cartão para poder filtrar também por autor do cartão se necessário
  const resultadosComCartao = [];
  for (let h of resultados) {
    const cartao = await buscarCartaoPorHistoria(h.id);
    resultadosComCartao.push({
      ...h,
      cartao: {
        tituloCartao: h.titulo || "(Sem Título)",
        autorCartao: cartao.autor_cartao || "Desconhecido",
        historiaCompleta: cartao.historia_completa || h.descricao || "",
        likes: cartao.likes || 0
      }
    });
  }
  
  // Filtra também pelo autor do cartão, se necessário
  return resultadosComCartao.filter(story => {
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
      <div class="suggestion-item" data-id="${story.id}" style="padding:6px; border-bottom:1px solid #ccc; cursor:pointer;">
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

/************************************************************
 * [N] FUNÇÃO: BUSCAR A HISTÓRIA COM MAIS CURTIDAS
 * – Consulta a tabela cartoes e retorna o cartão (e a história associada)
 *   com o maior número de likes.
 ************************************************************/
async function buscarHistoriaMaisCurtida() {
  const { data: cartaoMaisCurtido, error } = await supabase
    .from('cartoes')
    .select('*')
    .order('likes', { ascending: false })
    .limit(1)
    .single();
  if (error) {
    console.error("Erro ao buscar a história com mais curtidas:", error);
    return null;
  }
  
  // Agora buscamos a história correspondente na tabela histórias
  const { data: historia, error: errHistoria } = await supabase
    .from('historias')
    .select('*')
    .eq('id', cartaoMaisCurtido.id)
    .single();
  if (errHistoria) {
    console.error("Erro ao buscar a história correspondente:", errHistoria);
    return null;
  }
  
  return { historia, cartao: cartaoMaisCurtido };
}

/************************************************************
 * [O] DOMContentLoaded: INICIALIZAÇÃO
 ************************************************************/
document.addEventListener('DOMContentLoaded', function() {
  exibirUsuarioLogado();
  mostrarHistorias();
  
  // Configura o formulário de nova história
  const form = document.getElementById('formPrincipal');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      const titulo = document.getElementById('titulo').value.trim();
      const descricao = document.getElementById('descricao').value.trim();
      const autorEl = document.getElementById('autor');
      const autor = autorEl ? autorEl.value.trim() : '';
      if (!titulo || !descricao) {
        alert("Preencha título e descrição!");
        return;
      }
      await salvarHistoria(titulo, descricao, autor);
      limparFormulario();
    });
  }
  
  // Configura a pesquisa
  const searchBar = document.getElementById('searchBar');
  const searchBtn = document.getElementById('searchBtn');
  const searchResults = document.getElementById('searchResults');
  if (searchBar && searchBtn && searchResults) {
    searchBtn.addEventListener('click', async function() {
      const query = searchBar.value.trim();
      if (!query) {
        searchResults.style.display = 'none';
        return;
      }
      const resultados = await filtrarHistorias(query);
      exibirSugestoes(resultados);
    });
    searchBar.addEventListener('input', async function() {
      const query = searchBar.value.trim();
      if (!query) {
        searchResults.style.display = 'none';
        return;
      }
      const resultados = await filtrarHistorias(query);
      exibirSugestoes(resultados);
    });
    searchBar.addEventListener('keydown', async function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchBar.value.trim();
        const resultados = await filtrarHistorias(query);
        exibirSugestoes(resultados);
      }
    });
  }
  
  // Configura os botões do modo de leitura e do marcador
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
  
  // Exemplo: Buscar e exibir a história com mais curtidas em um elemento específico
  const destaque = document.getElementById('historia-destaque');
  if (destaque) {
    buscarHistoriaMaisCurtida().then(result => {
      if (result) {
        const { historia, cartao } = result;
        // Exibe título e sinopse (ou qualquer outra informação)
        destaque.innerHTML = `<h2>${historia.titulo}</h2>
          <p>${cartao.sinopse_cartao}</p>
          <p><strong>Likes:</strong> ${cartao.likes}</p>`;
      }
    });
  }
});
