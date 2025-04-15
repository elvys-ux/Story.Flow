import { supabase } from "./supabase.js";

/*************************************************************
 * HISTORIA.JS
 * - Gerencia a criação/edição de histórias, publicação dos cartões
 * - Armazena todas as informações via Supabase:
 *     Tabela "historias": id, titulo, descricao, user_id, data_criacao
 *     Tabela "cartoes": id, historia_id, titulo_cartao, sinopse_cartao,
 *                       historia_completa, data_criacao, autor_cartao
 *     Tabela "categorias": id, nome
 *     Tabela "historias_categoria": historia_id, categoria_id
 *************************************************************/

// Variável global para armazenar o id da história atualmente selecionada
let currentStoryId = null;
// Controle da visibilidade da lista lateral
let isTitleListVisible = false;

document.addEventListener('DOMContentLoaded', async function() {
  console.log("DOM carregado");

  // Exibe usuário logado via Supabase
  await exibirUsuarioLogado();

  // Carrega a lista lateral de histórias (consulta Supabase)
  await mostrarHistorias();

  // Configura o formulário de história (criação/edição)
  const storyForm = document.getElementById('storyForm');
  if (storyForm) {
    storyForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const titulo = document.getElementById('titulo').value.trim();
      const descricao = document.getElementById('descricao').value.trim();
      if (!titulo || !descricao) {
        alert("Preencha o título e a descrição!");
        return;
      }
      const editID = storyForm.dataset.editId;
      if (editID) {
        // Atualiza história existente
        const { error } = await supabase
          .from('historias')
          .update({ titulo, descricao })
          .eq('id', editID);
        if (error) {
          console.error("Erro ao atualizar a história:", error);
          alert("Erro ao atualizar a história.");
          return;
        }
        alert("História atualizada com sucesso!");
        currentStoryId = editID;
      } else {
        // Insere nova história; utiliza Date.now() como id e define data_criacao
        const newID = Date.now().toString();
        const { data: novaHistoria, error } = await supabase
          .from('historias')
          .insert([{ 
            id: newID, 
            titulo, 
            descricao, 
            user_id: supabase.auth.session()?.user.id || null,
            data_criacao: new Date().toISOString() 
          }])
          .single();
        if (error) {
          console.error("Erro ao inserir a história:", error);
          alert("Erro ao salvar a história.");
          return;
        }
        alert("História salva com sucesso (nova)!");
        storyForm.reset();
        currentStoryId = newID;
      }
      await mostrarHistorias();
    });
  }

  // Botão Nova História: limpa o formulário e reseta o estado
  const novaHistoriaBtn = document.getElementById('novaHistoriaBtn');
  if (novaHistoriaBtn) {
    novaHistoriaBtn.addEventListener('click', function () {
      if (confirm("Tem certeza de que deseja começar uma nova história?")) {
        document.getElementById('storyForm').reset();
        document.getElementById('storyForm').dataset.editId = "";
        currentStoryId = null;
        document.getElementById('storyContainer').style.display = 'block';
        document.getElementById('cartaoContainer').style.display = 'none';
      }
    });
  }

  // Configura os botões do cartão
  const btnPublicar = document.getElementById('btnPublicarCartao');
  if (btnPublicar) {
    btnPublicar.addEventListener('click', async function() {
      await publicarCartao(currentStoryId);
    });
  }

  const btnLerMais = document.getElementById('btnLerMais');
  if (btnLerMais) {
    btnLerMais.addEventListener('click', function() {
      if (currentStoryId) lerMais(currentStoryId);
    });
  }

  const btnVoltar = document.getElementById('btnVoltar');
  if (btnVoltar) {
    btnVoltar.addEventListener('click', function() {
      document.getElementById('cartaoContainer').style.display = 'none';
      document.getElementById('storyContainer').style.display = 'block';
    });
  }

  // Configura os eventos para a lista lateral (on hover)
  document.body.addEventListener('mousemove', function(e) {
    if (e.clientX < 100 && !isTitleListVisible) {  // Threshold ajustado para 100px
      toggleTitleList(true);
    }
  });
  const titleList = document.getElementById('titleListLeft');
  if (titleList) {
    titleList.addEventListener('mouseleave', function() {
      toggleTitleList(false);
    });
  }
  document.body.addEventListener('click', function(e) {
    const titleList = document.getElementById('titleListLeft');
    if (isTitleListVisible && titleList && !titleList.contains(e.target)) {
      toggleTitleList(false);
    }
  });
});

/*************************************************************
 * USUÁRIO LOGADO VIA SUPABASE
 * Exibe o usuário na área "userMenuArea" e configura logout.
 *************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("Erro ao obter a sessão:", sessionError);
      return;
    }
    if (!session) {
      userArea.innerHTML = `<a href="Criacao.html" style="color:white;">
                              <i class="fas fa-user"></i> Login
                            </a>`;
      userArea.onclick = null;
      return;
    }
    const userId = session.user.id;
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

/*************************************************************
 * MOSTRAR HISTÓRIAS NA LISTA LATERAL
 * Consulta a tabela "historias" e monta a lista.
 *************************************************************/
async function mostrarHistorias() {
  const ul = document.getElementById('titleListUl');
  if (!ul) {
    console.error("Elemento 'titleListUl' não encontrado!");
    return;
  }
  // Consulta histórias ordenadas por data_criacao (descendente)
  const { data: historias, error } = await supabase
      .from('historias')
      .select('*')
      .order('data_criacao', { ascending: false });
  if (error) {
    console.error("Erro ao buscar histórias:", error);
    return;
  }
  console.log("Histórias retornadas:", historias);
  ul.innerHTML = '';
  historias.forEach((h) => {
    const li = document.createElement('li');
    li.textContent = h.titulo || "(sem título)";
    li.dataset.id = h.id;
    li.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleMenuOpcoes(li, h.id);
    });
    ul.appendChild(li);
  });
}

/*************************************************************
 * TOGGLE MENU OPÇÕES (LISTA LATERAL)
 *************************************************************/
function toggleMenuOpcoes(li, storyID) {
  const existingMenu = li.querySelector('.menu-opcoes');
  if (existingMenu) {
    existingMenu.remove();
    return;
  }
  const menu = document.createElement('div');
  menu.classList.add('menu-opcoes');

  const cartaoBtn = document.createElement('button');
  cartaoBtn.textContent = 'Cartão';
  cartaoBtn.onclick = (e) => {
    e.stopPropagation();
    mostrarCartaoForm(storyID);
    menu.remove();
  };

  const editBtn = document.createElement('button');
  editBtn.textContent = 'Editar';
  editBtn.onclick = async (e) => {
    e.stopPropagation();
    await editarHistoria(storyID);
    menu.remove();
  };

  const delBtn = document.createElement('button');
  delBtn.textContent = 'Excluir';
  delBtn.onclick = async (e) => {
    e.stopPropagation();
    await excluirHistoria(storyID);
    menu.remove();
  };

  menu.appendChild(cartaoBtn);
  menu.appendChild(editBtn);
  menu.appendChild(delBtn);
  li.appendChild(menu);
  menu.style.display = 'block';
}

/*************************************************************
 * SALVAR/EDITAR HISTÓRIA
 *************************************************************/
async function salvarHistoria(titulo, descricao) {
  const storyForm = document.getElementById('storyForm');
  const editID = storyForm.dataset.editId;

  if (editID) {
    const { error } = await supabase
      .from('historias')
      .update({ titulo, descricao })
      .eq('id', editID);
    if (error) {
      console.error("Erro ao atualizar a história:", error);
      alert("Erro ao atualizar a história.");
      return;
    }
    alert("História atualizada com sucesso!");
    currentStoryId = editID;
  } else {
    const newID = Date.now().toString();
    const { data: novaHistoria, error } = await supabase
      .from('historias')
      .insert([{ 
          id: newID, 
          titulo, 
          descricao, 
          user_id: supabase.auth.session()?.user.id || null, 
          data_criacao: new Date().toISOString() 
      }])
      .single();
    if (error) {
      console.error("Erro ao inserir a história:", error);
      alert("Erro ao salvar a história.");
      return;
    }
    alert("História salva com sucesso (nova)!");
    document.getElementById('storyForm').reset();
    currentStoryId = newID;
  }

  await mostrarHistorias();
}

/*************************************************************
 * EDITAR HISTÓRIA
 *************************************************************/
async function editarHistoria(storyID) {
  const { data: historia, error } = await supabase
    .from('historias')
    .select('*')
    .eq('id', storyID)
    .single();
  if (error || !historia) {
    console.error("Erro ao buscar a história:", error);
    return;
  }
  document.getElementById('titulo').value = historia.titulo;
  document.getElementById('descricao').value = historia.descricao;
  document.getElementById('storyForm').dataset.editId = historia.id;
  document.querySelector('.btn[type="submit"]').textContent = "Atualizar";
  exibirHistoriaNoContainer(storyID);
}

/*************************************************************
 * EXCLUIR HISTÓRIA
 *************************************************************/
async function excluirHistoria(storyID) {
  if (!confirm("Deseja excluir a história?")) return;
  const { error } = await supabase
    .from('historias')
    .delete()
    .eq('id', storyID);
  if (error) {
    console.error("Erro ao excluir a história:", error);
    alert("Erro ao excluir a história.");
    return;
  }
  alert("História excluída.");
  await mostrarHistorias();
  const editID = document.getElementById('storyForm').dataset.editId;
  if (editID === storyID) {
    limparFormulario();
    removerExibicaoHistoria();
  }
}

/*************************************************************
 * LIMPAR FORMULÁRIO
 *************************************************************/
function limparFormulario() {
  document.getElementById('titulo').value = '';
  document.getElementById('descricao').value = '';
  document.getElementById('storyForm').dataset.editId = "";
  document.querySelector('.btn[type="submit"]').textContent = "Salvar";
}

/*************************************************************
 * EXIBIR UMA HISTÓRIA NO CONTEINER
 *************************************************************/
async function exibirHistoriaNoContainer(storyID) {
  const { data: historia, error } = await supabase
    .from('historias')
    .select('*')
    .eq('id', storyID)
    .single();
  if (error || !historia) {
    console.error("Erro ao buscar a história para exibição:", error);
    return;
  }
  const container = document.getElementById('storyContainer');
  if (!container) return;

  // Remove exibições anteriores
  const oldDiv = container.querySelector('.exibicao-historia');
  if (oldDiv) oldDiv.remove();

  const div = document.createElement('div');
  div.classList.add('exibicao-historia');
  div.style.border = '1px solid #ccc';
  div.style.marginTop = '10px';
  div.style.padding = '10px';

  const h3 = document.createElement('h3');
  h3.textContent = historia.titulo || "(sem título)";
  div.appendChild(h3);

  const p = document.createElement('p');
  p.textContent = historia.descricao || "";
  div.appendChild(p);

  // Se houver cartão publicado (opcional, se salvo via outra função), exibe aviso
  if (historia.cartao) {
    const infoCartao = document.createElement('p');
    infoCartao.innerHTML = "<em>(Este texto foi publicado no Cartão)</em>";
    div.appendChild(infoCartao);
  }

  container.appendChild(div);
}

/*************************************************************
 * MOSTRAR CARTÃO – Exibe a área de publicação do cartão
 *************************************************************/
async function mostrarCartaoForm(storyID) {
  const storyContainer = document.getElementById('storyContainer');
  const cartaoContainer = document.getElementById('cartaoContainer');
  if (!storyContainer || !cartaoContainer) return;

  // Esconde a área de criação e mostra a área do cartão
  storyContainer.style.display = 'none';
  cartaoContainer.style.display = 'block';

  // Se necessário, consulte a tabela "cartoes" para preencher os inputs caso o cartão já exista
}

/*************************************************************
 * PUBLICAR CARTÃO
 * Mapeia os inputs para a estrutura da tabela "cartoes" e realiza um upsert via Supabase.
 *************************************************************/
async function publicarCartao(storyID) {
  if (!storyID) {
    alert("Nenhuma história foi selecionada para publicar o cartão.");
    return;
  }
  
  const confirmMsg = "Aviso: Ao publicar o cartão, o conteúdo fica definitivo.\nEdições futuras não serão refletidas no cartão.\n\nContinuar?";
  if (!confirm(confirmMsg)) {
    alert("Publicação cancelada.");
    return;
  }

  const cartaoTitulo = document.getElementById('titulo_cartao').value.trim();
  const cartaoSinopse = document.getElementById('sinopse_cartao').value.trim();
  const cartaoData = document.getElementById('data_criacao').value.trim() || new Date().toISOString();
  const autor = document.getElementById('autor_cartao').value.trim();
  // Obtém os nomes das categorias selecionadas (ex: "Fantasia", "Terror", etc.)
  const categoriasSelecionadas = Array.from(document.querySelectorAll('input[name="categoria"]:checked'))
                                         .map(chk => chk.value);

  if (!cartaoTitulo) {
    alert("Preencha o título do Cartão!");
    return;
  }
  if (!cartaoSinopse) {
    alert("Preencha a sinopse do Cartão!");
    return;
  }
  if (categoriasSelecionadas.length === 0) {
    alert("Selecione pelo menos uma categoria!");
    return;
  }

  // Mapeia os dados para o objeto que será salvo na tabela "cartoes"
  const novoCartao = {
    id: storyID,              // Usa o mesmo id da história como id do cartão
    historia_id: storyID,      // Associação com a história
    titulo_cartao: cartaoTitulo,
    sinopse_cartao: cartaoSinopse,
    // "historia_completa" utiliza a descrição completa da história do input "descricao"
    historia_completa: document.getElementById('descricao').value.trim() || "",
    data_criacao: cartaoData,
    autor_cartao: autor || "Anônimo",
    categorias: categoriasSelecionadas,
    likes: 0
  };

  // Upsert na tabela "cartoes"
  const { error } = await supabase
    .from('cartoes')
    .upsert(novoCartao, { returning: 'minimal' });
  if (error) {
    console.error("Erro ao publicar cartão no Supabase:", error);
    alert("Erro ao publicar o cartão.");
    return;
  }
  
  alert("Cartão publicado com sucesso!");
  
  // Processa as categorias: para cada categoria selecionada, garante que a categoria existe e insere associação
  await processarCategorias(storyID, categoriasSelecionadas);
}

/*************************************************************
 * PROCESSAR CATEGORIAS
 * Para cada categoria selecionada (pelo nome), verifica se existe na tabela "categorias";
 * se não existir, insere-a e, em seguida, insere a associação em "historias_categoria".
 *************************************************************/
async function processarCategorias(storyID, categoriasSelecionadas) {
  for (const catNome of categoriasSelecionadas) {
    // Verifica se a categoria já existe
    let { data: categoria, error } = await supabase
      .from('categorias')
      .select('id')
      .eq('nome', catNome)
      .single();

    if (error || !categoria) {
      // Se não existir, insere a nova categoria
      const { data: novaCat, error: insertError } = await supabase
        .from('categorias')
        .insert([{ nome: catNome }])
        .single();
      if (insertError) {
        console.error("Erro ao inserir categoria:", insertError);
        continue;
      }
      categoria = novaCat;
    }

    // Insere a associação na tabela "historias_categoria"
    // Você pode usar "upsert" para evitar duplicatas
    const { error: assocError } = await supabase
      .from('historias_categoria')
      .upsert({ historia_id: storyID, categoria_id: categoria.id }, { returning: 'minimal' });
    if (assocError) {
      console.error("Erro ao associar categoria com a história:", assocError);
    }
  }
}

/*************************************************************
 * LER MAIS
 * Consulta os dados do cartão e exibe no modal.
 *************************************************************/
async function lerMais(storyID) {
  const modalOverlay = document.getElementById('modalOverlay');
  if (!modalOverlay) return;

  const { data: item, error } = await supabase
    .from('cartoes')
    .select('*')
    .eq('id', storyID)
    .single();

  if (error || !item) {
    console.error("Erro ao buscar os dados do cartão:", error);
    alert("Cartão não encontrado.");
    return;
  }

  document.getElementById('modalTitulo').textContent = item.autor_cartao || "";
  document.getElementById('modalDescricao').textContent = item.historia_completa || "";
  document.getElementById('modalCartaoTitulo').textContent = item.titulo_cartao ? item.titulo_cartao.substring(0, 50) : "";
  document.getElementById('modalCartaoSinopse').textContent = item.sinopse_cartao || "";
  document.getElementById('modalCartaoData').textContent = item.data_criacao ? new Date(item.data_criacao).toLocaleDateString() : "";
  document.getElementById('modalCartaoAutor').textContent = item.autor_cartao || "";
  document.getElementById('modalCartaoCategorias').textContent =
    (item.categorias && item.categorias.length > 0) ? item.categorias.join(', ') : "";

  modalOverlay.style.display = 'flex';
}

/*************************************************************
 * FUNÇÕES AUXILIARES: Formatação, modo de leitura, marcador, etc.
 *************************************************************/
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
  const lines = wrapText(fullText, 80);
  if (lineNumber < 1 || lineNumber > lines.length) {
    alert("Linha fora do intervalo!");
    return;
  }
  lines[lineNumber - 1] = `<span style="background:yellow">${lines[lineNumber - 1]}</span>`;
  container.innerHTML = lines.join('<br>');
  const scrollTarget = (lineNumber - 1) * 22;
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
    const lineNumber = Math.floor(totalY / 22) + 1;
    console.log("Linha salva:", lineNumber);
    // Implemente aqui a lógica de marcador se necessário.
  });
}

function continuarMarcador() {
  if (!currentStoryId) return;
  alert("Função de marcador não implementada completamente.");
}
