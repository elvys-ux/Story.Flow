// historia.js
import { supabase } from './supabase.js';

// Dispara quando a página carrega
document.addEventListener('DOMContentLoaded', async function() {
  exibirUsuarioLogado(); // Se tiver lógica para exibir usuário
  await mostrarHistorias(); // Carrega lista lateral de histórias

  // Lida com submit do form
  const storyForm = document.getElementById('storyForm');
  storyForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const titulo = document.getElementById('titulo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    if (!titulo || !descricao) {
      alert("Preencha o título e a descrição!");
      return;
    }
    await salvarHistoria(titulo, descricao);
  });

  // Botão Nova História
  const novaHistoriaBtn = document.getElementById('novaHistoriaBtn');
  if (novaHistoriaBtn) {
    novaHistoriaBtn.addEventListener('click', function () {
      if (confirm("Tem certeza de que deseja começar uma nova história?")) {
        limparFormulario();
        removerExibicaoHistoria();
      }
    });
  }
});

/*************************************************************
 * USUÁRIO LOGADO (OPCIONAL)
 *************************************************************/
async function exibirUsuarioLogado(){
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;

  const user = supabase.auth.user();
  userArea.innerHTML = '';
  if(user) {
    userArea.innerHTML = user.email; // ou user.user_metadata.name
    userArea.onclick = async function() {
      if(confirm("Deseja fazer logout?")){
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

/*************************************************************
 * MOSTRAR HISTÓRIAS NA LISTA LATERAL
 *************************************************************/
async function mostrarHistorias() {
  const ul = document.getElementById('titleListUl');
  if (!ul) return;
  ul.innerHTML = '';

  const user = supabase.auth.user();
  if(!user) {
    // Se quiser mostrar só do usuário, check aqui. Se desejar mostrar de todos, remova este if
    alert("Faça login para ver suas histórias.");
    return;
  }

  // Carrega as histórias da tabela "historias"
  // Ajuste se quiser mostrar histórias de todos os usuários
  // Por ex: .eq('user_id', user.id) para apenas as do usuário
  const { data: historias, error } = await supabase
    .from('historias')
    .select('*')
    .eq('user_id', user.id) 
    .order('id', { ascending: false });

  if (error) {
    console.error("Erro ao carregar histórias:", error.message);
    return;
  }

  // Para cada história, cria um <li> e adiciona a lógica de menu
  historias.forEach((h) => {
    const li = document.createElement('li');
    li.textContent = h.titulo || "(sem título)";
    li.dataset.id = h.id;

    li.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleMenuOpcoes(li, h);
    });
    ul.appendChild(li);
  });
}

/** Exibe ou oculta o menu de opções (Cartão, Editar, Excluir) */
function toggleMenuOpcoes(li, historiaObj) {
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
    mostrarCartaoForm(historiaObj);
    menu.remove();
  };

  const editBtn = document.createElement('button');
  editBtn.textContent = 'Editar';
  editBtn.onclick = (e) => {
    e.stopPropagation();
    editarHistoria(historiaObj);
    menu.remove();
  };

  const delBtn = document.createElement('button');
  delBtn.textContent = 'Excluir';
  delBtn.onclick = async (e) => {
    e.stopPropagation();
    await excluirHistoria(historiaObj.id);
    menu.remove();
  };

  menu.appendChild(cartaoBtn);
  menu.appendChild(editBtn);
  menu.appendChild(delBtn);
  li.appendChild(menu);
  menu.style.display = 'block';
}

/*************************************************************
 * SALVAR (NOVA) / EDITAR HISTÓRIA
 *************************************************************/
async function salvarHistoria(titulo, descricao) {
  const editID = document.getElementById('storyForm').dataset.editId;
  const user = supabase.auth.user();
  if(!user) {
    alert("Faça login para salvar a história.");
    return;
  }

  try {
    if (editID) {
      // Editando existente (UPDATE)
      const { data, error } = await supabase
        .from('historias')
        .update({ titulo, descricao })
        .eq('id', editID)
        .eq('user_id', user.id); // se quiser garantir que só o dono atualiza
      if(error) {
        alert("Erro ao atualizar história: " + error.message);
        return;
      }
      alert("História atualizada com sucesso!");
      exibirHistoriaNoContainer(editID, titulo, descricao, data?.[0]?.cartao); 
      // Se quiser limpar form:
      // limparFormulario(); removerExibicaoHistoria();

    } else {
      // Nova (INSERT)
      const { data, error } = await supabase
        .from('historias')
        .insert([{
          user_id: user.id,
          titulo,
          descricao
          // Pode ter campos do cartão também:
          // titulo_cartao, sinopse_cartao, etc.
        }]);
      if(error) {
        alert("Erro ao salvar história: " + error.message);
        return;
      }
      alert("História salva com sucesso (nova)!");
      limparFormulario();
      removerExibicaoHistoria();
    }
    // Atualiza lista lateral
    await mostrarHistorias();
  } catch(err) {
    console.error("Erro inesperado:", err);
  }
}

/** Editar história: Carrega dados no form */
function editarHistoria(historiaObj) {
  document.getElementById('titulo').value = historiaObj.titulo;
  document.getElementById('descricao').value = historiaObj.descricao;
  document.getElementById('storyForm').dataset.editId = historiaObj.id;
  document.querySelector('.btn[type="submit"]').textContent = "Atualizar";
  exibirHistoriaNoContainer(historiaObj.id, historiaObj.titulo, historiaObj.descricao, historiaObj.cartao);
}

/** Excluir história */
async function excluirHistoria(historiaId) {
  if (!confirm("Deseja excluir a história?")) return;
  const user = supabase.auth.user();
  if(!user) {
    alert("Faça login para excluir.");
    return;
  }
  const { data, error } = await supabase
    .from('historias')
    .delete()
    .eq('id', historiaId)
    .eq('user_id', user.id); // só o dono
  if(error) {
    alert("Erro ao excluir história: " + error.message);
    return;
  }
  alert("História excluída.");
  limparFormulario();
  removerExibicaoHistoria();
  await mostrarHistorias();
}

function limparFormulario() {
  document.getElementById('titulo').value = '';
  document.getElementById('descricao').value = '';
  document.getElementById('storyForm').dataset.editId = "";
  document.querySelector('.btn[type="submit"]').textContent = "Salvar";
}

/*************************************************************
 * EXIBIR HISTÓRIA NO CONTAINER ABAIXO DO FORM
 *************************************************************/
function exibirHistoriaNoContainer(storyID, titulo, descricao, cartao) {
  const container = document.getElementById('storyContainer');
  if (!container) return;

  // Remove exibição anterior
  const oldDiv = container.querySelector('.exibicao-historia');
  if (oldDiv) oldDiv.remove();

  const div = document.createElement('div');
  div.classList.add('exibicao-historia');
  div.style.border = '1px solid #ccc';
  div.style.marginTop = '10px';
  div.style.padding = '10px';

  // Título
  const h3 = document.createElement('h3');
  h3.textContent = titulo || "(sem título)";
  div.appendChild(h3);

  // Descrição
  const p = document.createElement('p');
  p.textContent = descricao || "";
  div.appendChild(p);

  // Se já tiver cartao, avisa
  if (cartao) {
    const infoCartao = document.createElement('p');
    infoCartao.innerHTML = "<em>(Este texto foi publicado no Cartão)</em>";
    div.appendChild(infoCartao);
  }

  container.appendChild(div);
}

function removerExibicaoHistoria() {
  const container = document.getElementById('storyContainer');
  if (!container) return;
  const oldDiv = container.querySelector('.exibicao-historia');
  if (oldDiv) oldDiv.remove();
}

/*************************************************************
 * CARTÃO
 *************************************************************/
async function mostrarCartaoForm(historiaObj) {
  // Exibe o form de cartão
  const storyContainer = document.getElementById('storyContainer');
  const cartaoContainer = document.getElementById('cartaoContainer');
  if (!storyContainer || !cartaoContainer) return;

  storyContainer.style.display = 'none';
  cartaoContainer.style.display = 'block';

  // Se a história não tiver campos de cartão, cria
  // (no Supabase você poderia ter colunas tipo titulo_cartao, sinopse_cartao, etc.
  //  ou armazenar como json. Ajuste conforme seu schema.)
  // Aqui apenas uso "cartao" como objeto local:
  let cartaoObj = historiaObj.cartao || {
    tituloCartao: "",
    sinopseCartao: "",
    dataCartao: "",
    autorCartao: "",
    categorias: []
  };

  document.getElementById('cartaoTitulo').value = cartaoObj.tituloCartao;
  document.getElementById('cartaoSinopse').value = cartaoObj.sinopseCartao;
  document.getElementById('cartaoData').value = cartaoObj.dataCartao || new Date().toISOString().split('T')[0];
  document.getElementById('cartaoAutor').value = cartaoObj.autorCartao || "";

  // Categorias (checkbox)
  document.querySelectorAll('input[name="categoria"]').forEach(chk => {
    chk.checked = false;
    if (cartaoObj.categorias && cartaoObj.categorias.includes(chk.value)) {
      chk.checked = true;
    }
  });

  document.getElementById('btnPublicarCartao').onclick = () => {
    publicarCartao(historiaObj.id);
  };
  document.getElementById('btnLerMais').onclick = () => {
    lerMais(historiaObj.id);
  };
  document.getElementById('btnVoltar').onclick = () => {
    cartaoContainer.style.display = 'none';
    storyContainer.style.display = 'block';
  };
}

/** Publicar Cartão: atualiza a história no Supabase com infos de cartão */
async function publicarCartao(storyID) {
  if (!confirm("Ao publicar o cartão, edições futuras não afetam o cartão publicado. Continuar?")) {
    alert("Publicação cancelada.");
    return;
  }
  const cartaoTitulo = document.getElementById('cartaoTitulo').value.trim();
  const cartaoSinopse = document.getElementById('cartaoSinopse').value.trim();
  const cartaoData = document.getElementById('cartaoData').value.trim();
  const autor = document.getElementById('cartaoAutor').value.trim();
  const categoriasSelecionadas = Array.from(document.querySelectorAll('input[name="categoria"]:checked'))
    .map(chk => chk.value);

  if(!cartaoTitulo) {
    alert("Preencha o título do Cartão!");
    return;
  }
  if(!cartaoSinopse) {
    alert("Preencha a sinopse do Cartão!");
    return;
  }
  if(categoriasSelecionadas.length === 0) {
    alert("Selecione pelo menos uma categoria!");
    return;
  }

  // Vamos supor que na tabela "historias" existem colunas correspondentes (ex.: titulo_cartao, sinopse_cartao, data_cartao, autor_cartao, categorias, etc.)
  // ou um campo JSON (ex.: cartao jsonb)
  // Aqui, mostro como atualizar colunas separadas:
  const user = supabase.auth.user();
  if(!user) {
    alert("Faça login.");
    return;
  }

  const updateFields = {
    titulo_cartao: cartaoTitulo,
    sinopse_cartao: cartaoSinopse,
    data_cartao: cartaoData,
    autor_cartao: autor,
    categorias: categoriasSelecionadas, // se for text[] no Postgres
    // se for jsonb => cartao: { tituloCartao, sinopseCartao, ... }
  };

  const { data, error } = await supabase
    .from('historias')
    .update(updateFields)
    .eq('id', storyID)
    .eq('user_id', user.id);
  if(error) {
    alert("Erro ao publicar cartão: " + error.message);
    return;
  }
  alert("Cartão publicado com sucesso!");
}

/** Ler Mais: exibir modal com dados da história */
async function lerMais(storyID) {
  const modalOverlay = document.getElementById('modalOverlay');
  if (!modalOverlay) return;

  const user = supabase.auth.user();
  // Carregue a história do banco
  const { data: historia, error } = await supabase
    .from('historias')
    .select('*')
    .eq('id', storyID)
    .single();
  if(error || !historia) {
    alert("História não encontrada ou erro no banco.");
    return;
  }

  document.getElementById('modalTitulo').textContent = historia.titulo || "";
  document.getElementById('modalDescricao').textContent = historia.descricao || "";

  // Se tiver as colunas do cartão, exiba
  const modalCartaoTitulo = document.getElementById('modalCartaoTitulo');
  const modalCartaoSinopse = document.getElementById('modalCartaoSinopse');
  const modalCartaoData = document.getElementById('modalCartaoData');
  const modalCartaoAutor = document.getElementById('modalCartaoAutor');
  const modalCartaoCategorias = document.getElementById('modalCartaoCategorias');

  if(!historia.titulo_cartao) {
    modalCartaoTitulo.textContent = "";
    modalCartaoSinopse.textContent = "";
    modalCartaoData.textContent = "";
    modalCartaoAutor.textContent = "";
    modalCartaoCategorias.textContent = "";
  } else {
    modalCartaoTitulo.textContent = historia.titulo_cartao || "";
    modalCartaoSinopse.textContent = historia.sinopse_cartao || "";
    modalCartaoData.textContent = historia.data_cartao || "";
    modalCartaoAutor.textContent = historia.autor_cartao || "";
    // Se for array de texto
    if(historia.categorias && historia.categorias.length > 0) {
      modalCartaoCategorias.textContent = historia.categorias.join(', ');
    } else {
      modalCartaoCategorias.textContent = "";
    }
  }

  modalOverlay.style.display = 'flex';
}

/*************************************************************
 * FUNÇÕES RELACIONADAS À LISTA (ON HOVER), IGUAL AO SEU CÓDIGO
 *************************************************************/
let isTitleListVisible = false;
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

function toggleTitleList(show) {
  const list = document.getElementById('titleListLeft');
  if (!list) return;
  if (show) {
    list.classList.add('visible');
    isTitleListVisible = true;
  } else {
    list.classList.remove('visible');
    isTitleListVisible = false;
  }
}
