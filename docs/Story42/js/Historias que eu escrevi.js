/************************************************************
 * HistoriasQueEuEscrevi.js
 * - Usa colunas da tabela "historia": 
 *   id, data_atualizacao, titulo_cartao, sinopse_cartao,
 *   data_cartao, autor_cartao, curtidas
 * - Salva, carrega, exclui e atualiza
 * - Possui "modo de leitura" paginado a cada 5 linhas
 * - Marcador de linha (apenas local, se quiser no Supabase, adapte)
 * - Pesquisa local (mínima)
 ************************************************************/

import { supabase } from './supabase.js';

/************************************************************
 * [A] LOGIN/LOGOUT
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;

  userArea.innerHTML = '';
  // Se não usa login, ignore:
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    userArea.textContent = user.email || 'Usuário';
    userArea.onclick = async () => {
      if (confirm("Deseja fazer logout?")) {
        await supabase.auth.signOut();
        location.reload();
      }
    };
  } else {
    userArea.innerHTML = `
      <a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
    userArea.onclick = null;
  }
}

/************************************************************
 * [B] VARIÁVEIS GLOBAIS
 ************************************************************/
let modoCorrido = true;
let partesHistoria = [];
let parteAtual = 0;
let isTitleListVisible = false;
let currentStoryId = null;   // ID da "historia" atual
let textoCompleto = "";      // Para modo de leitura a cada 5 linhas
const wrapWidth = 80;        // n° de caracteres por linha
const lineHeightPx = 22;     // line-height (px) para o marcador

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
document.body.addEventListener('mousemove', (e) => {
  if (e.clientX < 50 && !isTitleListVisible) {
    toggleTitleList(true);
  }
});
document.body.addEventListener('mouseleave', () => {
  if (isTitleListVisible) {
    toggleTitleList(false);
  }
});
document.body.addEventListener('click', (e) => {
  const titleList = document.getElementById('titleListLeft');
  if (isTitleListVisible && titleList && !titleList.contains(e.target)) {
    toggleTitleList(false);
  }
});

/************************************************************
 * [D] MOSTRAR HISTÓRIAS NA LISTA LATERAL (Carregar do Supabase)
 ************************************************************/
async function mostrarHistorias() {
  const ul = document.getElementById('titleListUl');
  if (!ul) return;
  ul.innerHTML = '';

  // Busca todas as linhas da tabela "historia"
  const { data: rows, error } = await supabase
    .from('historia')
    .select('*')
    .order('data_atualizacao', { ascending: false });
  if (error) {
    console.error("Erro ao carregar lista de historias:", error.message);
    return;
  }
  // Preenche a lista
  rows.forEach((hist) => {
    const li = document.createElement('li');
    // Usa "titulo_cartao" como título
    li.textContent = hist.titulo_cartao || "(Sem Título)";

    const buttons = document.createElement('span');
    buttons.classList.add('buttons');

    // Botão "Ler" => exibir
    const lerBtn = document.createElement('button');
    lerBtn.textContent = 'Ler';
    lerBtn.onclick = () => exibirHistoriaNoContainer(hist);

    // Botão "Excluir"
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Excluir';
    delBtn.onclick = () => excluirHistoria(hist.id);

    // Botão "Editar" (opcional)
    // Se quiser permitir edição de titulo_cartao, sinopse, etc.
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Editar';
    editBtn.onclick = () => editarHistoria(hist);

    buttons.appendChild(lerBtn);
    buttons.appendChild(editBtn);
    buttons.appendChild(delBtn);
    li.appendChild(buttons);
    ul.appendChild(li);
  });
}

/************************************************************
 * [E] EXCLUIR HISTÓRIA
 ************************************************************/
async function excluirHistoria(rowId) {
  if (!confirm("Deseja mesmo excluir?")) return;
  const { error } = await supabase
    .from('historia')
    .delete()
    .eq('id', rowId);
  if (error) {
    alert("Erro ao excluir: " + error.message);
    return;
  }
  alert("Excluído com sucesso!");
  mostrarHistorias();
}

/************************************************************
 * [F] LIMPAR FORMULÁRIO
 ************************************************************/
function limparFormulario() {
  document.getElementById('titulo').value = '';
  document.getElementById('descricao').value = '';
  document.getElementById('dataCartao').value = '';
  document.getElementById('autorCartao').value = '';
}

/************************************************************
 * [G] SALVAR HISTÓRIA (INSERT)
 ************************************************************/
async function salvarHistoria(tituloCartao, sinopseCartao, dataCartao, autorCartao) {
  // Quando salvar, data_atualizacao => now()
  const { data, error } = await supabase
    .from('historia')
    .insert([{
      data_atualizacao: new Date().toISOString(),
      titulo_cartao: tituloCartao,
      sinopse_cartao: sinopseCartao,
      data_cartao: dataCartao,
      autor_cartao: autorCartao,
      curtidas: 0
    }]);
  if (error) {
    alert("Erro ao salvar: " + error.message);
    return;
  }
  alert("História salva com sucesso!");
  limparFormulario();
  mostrarHistorias();
}

/************************************************************
 * [H] EDITAR HISTÓRIA (UPDATE)
 ************************************************************/
async function editarHistoria(rowObj) {
  // Aqui você pode preencher os inputs com rowObj e, ao salvar, chamar updateHistoria
  document.getElementById('titulo').value = rowObj.titulo_cartao || "";
  document.getElementById('descricao').value = rowObj.sinopse_cartao || "";
  document.getElementById('dataCartao').value = rowObj.data_cartao || "";
  document.getElementById('autorCartao').value = rowObj.autor_cartao || "";

  // Exemplo: guardamos o ID no form
  document.getElementById('formPrincipal').dataset.editId = rowObj.id;
  alert("Edição carregada. Ao clicar em Salvar, irá atualizar.");
}

/** De fato atualizar no Supabase */
async function updateHistoria(rowId, tituloCartao, sinopseCartao, dataCartao, autorCartao) {
  const { data, error } = await supabase
    .from('historia')
    .update({
      data_atualizacao: new Date().toISOString(),
      titulo_cartao: tituloCartao,
      sinopse_cartao: sinopseCartao,
      data_cartao: dataCartao,
      autor_cartao: autorCartao
    })
    .eq('id', rowId);
  if (error) {
    alert("Erro ao atualizar: " + error.message);
    return;
  }
  alert("Atualizado com sucesso!");
  limparFormulario();
  document.getElementById('formPrincipal').dataset.editId = "";
  mostrarHistorias();
}

/************************************************************
 * [I] EXIBIR HISTÓRIA NO CONTAINER (MODO LEITURA)
 ************************************************************/
function exibirHistoriaNoContainer(hist) {
  currentStoryId = hist.id;
  // Montamos um "textoCompleto" a partir de sinopse, por ex.
  // Se quiser exibir algo maior, crie outra coluna
  let textoBase = hist.sinopse_cartao || "(sem sinopse)";

  // A cada 5 pontos finais => \n\n
  const textoFormatado = formatarTexto(textoBase);
  textoCompleto = textoFormatado;
  
  document.getElementById('historia-titulo').textContent = hist.titulo_cartao || "(Sem título)";
  const container = document.getElementById('historia-conteudo');
  container.innerText = textoCompleto;
  container.setAttribute("data-full-text", textoCompleto);

  // Reseta modo de leitura
  modoCorrido = true;
  partesHistoria = [];
  parteAtual = 0;
}

/** formata a cada 5 pontos finais => \n\n */
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
 * [J] MODO DE LEITURA
 ************************************************************/
function toggleReadingMode() {
  const container = document.getElementById('historia-conteudo');
  const btnVoltar = document.getElementById('btn-voltar');
  const btnContinuar = document.getElementById('btn-continuar');

  if (modoCorrido) {
    const lines = textoCompleto.split(/\r?\n/);
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
    container.innerText = textoCompleto;
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

/************************************************************
 * [K] MARCADOR DE LINHA (Local)
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
// Clique => salva local
const containerLeitura = document.getElementById('historia-conteudo');
if (containerLeitura) {
  containerLeitura.addEventListener('click', (e) => {
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
 * [L] PESQUISA (Local)
 ************************************************************/
function filtrarHistorias(query) {
  // Se quiser filtrar do Supabase com LIKE, troque a lógica
  // Aqui, ex.: filtra do que já carregamos (faria fetch se quisesse)
  query = query.toLowerCase();
  // ...
  // Retorna array
}

/************************************************************
 * [N] DOMContentLoaded => CONFIGURAR TUDO
 ************************************************************/
document.addEventListener('DOMContentLoaded', async function() {
  await exibirUsuarioLogado();
  await mostrarHistorias();

  const form = document.getElementById('formPrincipal');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      // Coleta campos que correspondem à tabela
      const tituloCartao = document.getElementById('titulo').value.trim();
      const sinopseCartao = document.getElementById('descricao').value.trim();
      const dataCartao = document.getElementById('dataCartao').value.trim();
      const autorCartao = document.getElementById('autorCartao').value.trim();

      if (!tituloCartao || !sinopseCartao) {
        alert("Preencha pelo menos o Título e a Sinopse!");
        return;
      }

      // Se estiver em modo editar:
      const editID = form.dataset.editId;
      if (editID) {
        // update
        await updateHistoria(editID, tituloCartao, sinopseCartao, dataCartao, autorCartao);
      } else {
        // insert
        await salvarHistoria(tituloCartao, sinopseCartao, dataCartao, autorCartao);
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
