import { supabase } from "./supabase.js";

/*************************************************************
 * HISTORIA.JS
 * - Gerencia a criação/edição de histórias e a publicação dos cartões
 * - Utiliza o Supabase para salvar/consultar/atualizar os dados
 *************************************************************/

// Variável global para armazenar o id da história atualmente selecionada
let currentStoryId = null;

document.addEventListener('DOMContentLoaded', async function() {
  // Exibe o usuário logado (via Supabase)
  await exibirUsuarioLogado();

  // Carrega a lista lateral de histórias
  await mostrarHistorias();

  // Configura o submit do formulário de história (criação/edição)
  const storyForm = document.getElementById('storyForm');
  storyForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const titulo = document.getElementById('titulo').value.trim();
      const descricao = document.getElementById('descricao').value.trim();
      if (!titulo || !descricao) {
          alert("Preencha o título e a descrição!");
          return;
      }

      // Se estiver editando, atualize; senão, insere uma nova história
      const editID = storyForm.dataset.editId;
      if (editID) {
          const { error } = await supabase
            .from("historias")
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
          // Nova história: usamos Date.now() para gerar um id (ou permita que o Supabase gere o id se preferir)
          const newID = Date.now().toString();
          const { data: novaHistoria, error } = await supabase
            .from("historias")
            .insert([{ id: newID, titulo, descricao }])
            .single();
          if (error) {
              console.error("Erro ao salvar a história:", error);
              alert("Erro ao salvar a história.");
              return;
          }
          alert("História salva com sucesso (nova)!");
          storyForm.reset();
          currentStoryId = newID;
      }
      
      await mostrarHistorias();
  });

  // Botão Nova História: limpa o formulário e reseta o estado
  const novaHistoriaBtn = document.getElementById('novaHistoriaBtn');
  if (novaHistoriaBtn) {
      novaHistoriaBtn.addEventListener('click', function () {
          if (confirm("Tem certeza de que deseja começar uma nova história?")) {
              document.getElementById('storyForm').reset();
              document.getElementById('storyForm').dataset.editId = "";
              currentStoryId = null;
              // Exibe a área de criação e esconde a área de cartão
              document.getElementById('storyContainer').style.display = 'block';
              document.getElementById('cartaoContainer').style.display = 'none';
          }
      });
  }

  // Configura os botões do cartão:
  document.getElementById('btnPublicarCartao').addEventListener('click', async function() {
      await publicarCartao(currentStoryId);
  });
  
  document.getElementById('btnLerMais').addEventListener('click', function() {
      if (currentStoryId) {
          lerMais(currentStoryId);
      }
  });
  
  document.getElementById('btnVoltar').addEventListener('click', function() {
      // Volta para a área de criação da história
      document.getElementById('cartaoContainer').style.display = 'none';
      document.getElementById('storyContainer').style.display = 'block';
  });

  // Outras configurações (por exemplo, lista lateral, leitura de teclado, etc.) podem ser adicionadas aqui
});

/*************************************************************
 * USUÁRIO LOGADO VIA SUPABASE
 * Exibe o usuário (com dados do Supabase) e permite logout.
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
          userArea.innerHTML = `
            <a href="Criacao.html" style="color:white;">
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
 * FUNÇÃO: MOSTRAR HISTÓRIAS NA LISTA LATERAL
 * Realiza uma consulta à tabela "historias" e exibe os itens.
 *************************************************************/
async function mostrarHistorias() {
  const ul = document.getElementById('titleListUl');
  if (!ul) return;

  // Consulta as histórias do Supabase – você pode ordenar conforme desejar
  const { data: historias, error } = await supabase
      .from('historias')
      .select('*')
      .order('created_at', { ascending: false });
  if (error) {
      console.error("Erro ao buscar histórias:", error);
      return;
  }

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
 * FUNÇÃO: TOGGLE MENU OPÇÕES (LISTA LATERAL)
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
      // Exibe a área para publicação do cartão
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
 * FUNÇÃO: SALVAR/EDITAR HISTÓRIA
 * Se estiver editando, atualiza o registro; se nova, insere no Supabase.
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
          .insert([{ id: newID, titulo, descricao }])
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
}

/*************************************************************
 * FUNÇÃO: EDITAR HISTÓRIA
 * Preenche o formulário com os dados da história consultada via Supabase.
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
  // Exibe a história no container (caso queira exibi-la)
  exibirHistoriaNoContainer(storyID);
}

/*************************************************************
 * FUNÇÃO: EXCLUIR HISTÓRIA
 * Remove a história do Supabase.
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
  // Se a história excluída estava em edição, limpa o formulário e a exibição
  const editID = document.getElementById('storyForm').dataset.editId;
  if (editID === storyID) {
      limparFormulario();
      removerExibicaoHistoria();
  }
}

/*************************************************************
 * FUNÇÃO: LIMPAR FORMULÁRIO
 *************************************************************/
function limparFormulario() {
  document.getElementById('titulo').value = '';
  document.getElementById('descricao').value = '';
  document.getElementById('storyForm').dataset.editId = "";
  document.querySelector('.btn[type="submit"]').textContent = "Salvar";
}

/*************************************************************
 * FUNÇÃO: EXIBIR UMA HISTÓRIA NO CONTEINER
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

  // Se houver cartão publicado, exibe aviso
  if (historia.cartao) {
      const infoCartao = document.createElement('p');
      infoCartao.innerHTML = "<em>(Este texto foi publicado no Cartão)</em>";
      div.appendChild(infoCartao);
  }

  container.appendChild(div);
}

/*************************************************************
 * FUNÇÃO: MOSTRAR CARTÃO – Área de Publicação do Cartão
 *************************************************************/
async function mostrarCartaoForm(storyID) {
  const storyContainer = document.getElementById('storyContainer');
  const cartaoContainer = document.getElementById('cartaoContainer');
  if (!storyContainer || !cartaoContainer) return;

  // Esconde a área de criação e exibe a área do cartão
  storyContainer.style.display = 'none';
  cartaoContainer.style.display = 'block';

  // Para exibir o formulário, pode-se, se necessário, buscar os dados do cartão já publicado
  // Neste exemplo, assumimos que o usuário preencherá os campos do cartão
  // Caso deseje, você pode consultar a tabela "cartoes" para popular o formulário se o cartão já existir
}

/*************************************************************
 * FUNÇÃO: PUBLICAR CARTÃO
 * Mapeia os dados dos inputs para a estrutura da tabela "cartoes"
 * e realiza um upsert via Supabase.
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

  const cartaoTitulo = document.getElementById('cartaoTitulo').value.trim();
  const cartaoSinopse = document.getElementById('cartaoSinopse').value.trim();
  const cartaoData = document.getElementById('cartaoData').value.trim() || new Date().toISOString();
  const autor = document.getElementById('cartaoAutor').value.trim();
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

const novoCartao = {
  id: storyID, // ou outro id que você utilize
  historia_id: storyID, // associando ao id da história
  titulo_cartao: document.getElementById('cartaoTitulo').value.trim(), // Título do cartão
  historia_completa: document.getElementById('descricao').value.trim() || "",
  data_criacao: cartaoData,
  autor_cartao: autor || "Anônimo",
  categorias: categoriasSelecionadas,
  likes: 0,
  sinopse_cartao: cartaoSinopse
};


  const { error } = await supabase
    .from('cartoes')
    .upsert(novoCartao, { returning: 'minimal' });
  if (error) {
      console.error("Erro ao publicar cartão no Supabase:", error);
      alert("Erro ao publicar o cartão.");
      return;
  }
  
  alert("Cartão publicado com sucesso!");
}

/*************************************************************
 * FUNÇÃO: LER MAIS – Exibe detalhes do cartão no modal
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
  document.getElementById('modalCartaoTitulo').textContent = item.cartaoSinopse ? item.cartaoSinopse.substring(0, 50) : "";
  document.getElementById('modalCartaoSinopse').textContent = item.cartaoSinopse || "";
  document.getElementById('modalCartaoData').textContent = item.data_criacao ? new Date(item.data_criacao).toLocaleDateString() : "";
  document.getElementById('modalCartaoAutor').textContent = item.autor_cartao || "";
  document.getElementById('modalCartaoCategorias').textContent =
    (item.categorias && item.categorias.length > 0) ? item.categorias.join(', ') : "";

  modalOverlay.style.display = 'flex';
}

/*************************************************************
 * OUTRAS FUNÇÕES (ex.: formatação, modo de leitura, marcador, etc.)
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

// Exemplo: funções para modo de leitura e marcador de linha podem ser adicionadas aqui.
// Caso deseje implementar navegação por partes do texto, use as funções abaixo (personalize conforme necessário):

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
      // Você pode implementar a lógica para salvar essa informação se necessário
  });
}

function continuarMarcador() {
  if (!currentStoryId) return;
  // Exemplo: implementar lógica para recuperar e destacar a linha salva
  alert("Função de marcador não implementada completamente.");
}
