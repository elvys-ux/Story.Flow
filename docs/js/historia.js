import { supabase } from "./supabase.js";

/*************************************************************
 * FUNÇÕES DE HISTÓRIA E CARTÃO (LocalStorage)
 *************************************************************/

/**
 * Salva ou atualiza uma história no localStorage.
 */
function salvarHistoria(titulo, descricao) {
  let historias = JSON.parse(localStorage.getItem('historias')) || [];
  const editID = document.getElementById('storyForm').dataset.editId;

  if (editID) {
    // Atualiza a história existente
    const idx = historias.findIndex(h => h.id === editID);
    if (idx !== -1) {
      historias[idx].titulo = titulo;
      historias[idx].descricao = descricao;
    }
    localStorage.setItem('historias', JSON.stringify(historias));
    alert("História atualizada com sucesso!");
    exibirHistoriaNoContainer(editID);
  } else {
    // Insere nova história
    const newID = Date.now().toString();
    historias.push({ id: newID, titulo, descricao });
    localStorage.setItem('historias', JSON.stringify(historias));
    alert("História salva com sucesso (nova)!");
    limparFormulario();
    removerExibicaoHistoria();
  }

  mostrarHistorias();
}

/**
 * Publica o cartão de uma história no localStorage.
 */
function publicarCartao(storyID) {
  const msg = "Aviso: Ao publicar o cartão, o conteúdo fica definitivo.\nEdições futuras não serão refletidas no cartão.\n\nContinuar?";
  if (!confirm(msg)) {
    alert("Publicação cancelada.");
    return;
  }

  let historias = JSON.parse(localStorage.getItem('historias')) || [];
  const h = historias.find(st => st.id === storyID);
  if (!h) return;

  const cartaoTitulo = document.getElementById('cartaoTitulo').value.trim();
  const cartaoSinopse = document.getElementById('cartaoSinopse').value.trim();
  const cartaoData = document.getElementById('cartaoData').value.trim(); // formato: yyyy-MM-dd
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

  // Atualiza o objeto do cartão dentro da história
  h.cartao = {
    tituloCartao: cartaoTitulo,
    sinopseCartao: cartaoSinopse,
    dataCartao: cartaoData,
    autorCartao: autor,
    categorias: categoriasSelecionadas,
    historiaCompleta: h.descricao || "",
    likes: (h.cartao && h.cartao.likes) ? h.cartao.likes : 0
  };

  const idx = historias.findIndex(st => st.id === storyID);
  if (idx >= 0) {
    historias[idx] = h;
    localStorage.setItem('historias', JSON.stringify(historias));
  }

  alert("Cartão publicado com sucesso!");
}

/**
 * Exibe os detalhes de uma história (e seu cartão, se existir) no modal.
 */
function lerMais(storyID) {
  const modalOverlay = document.getElementById('modalOverlay');
  if (!modalOverlay) return;

  let historias = JSON.parse(localStorage.getItem('historias')) || [];
  const h = historias.find(st => st.id === storyID);
  if (!h) return;

  document.getElementById('modalTitulo').textContent = h.titulo || "";
  document.getElementById('modalDescricao').textContent = h.descricao || "";

  if (!h.cartao) {
    document.getElementById('modalCartaoTitulo').textContent = "";
    document.getElementById('modalCartaoSinopse').textContent = "";
    document.getElementById('modalCartaoData').textContent = "";
    document.getElementById('modalCartaoAutor').textContent = "";
    document.getElementById('modalCartaoCategorias').textContent = "";
  } else {
    document.getElementById('modalCartaoTitulo').textContent = h.cartao.tituloCartao || "";
    document.getElementById('modalCartaoSinopse').textContent = h.cartao.sinopseCartao || "";
    document.getElementById('modalCartaoData').textContent = h.cartao.dataCartao || "";
    document.getElementById('modalCartaoAutor').textContent = h.cartao.autorCartao || "";
    document.getElementById('modalCartaoCategorias').textContent =
      (h.cartao.categorias && h.cartao.categorias.length > 0)
        ? h.cartao.categorias.join(', ')
        : "";
  }
  modalOverlay.style.display = 'flex';
}

/**
 * Mostra a lista de histórias na lateral.
 */
function mostrarHistorias() {
  const ul = document.getElementById('titleListUl');
  if (!ul) return;
  ul.innerHTML = "";
  let historias = JSON.parse(localStorage.getItem('historias')) || [];
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

/**
 * Exibe um menu de opções (Cartão, Editar, Excluir) para uma história.
 */
function toggleMenuOpcoes(li, storyID) {
  const existingMenu = li.querySelector('.menu-opcoes');
  if (existingMenu) {
    existingMenu.remove();
    return;
  }
  const menu = document.createElement('div');
  menu.classList.add('menu-opcoes');

  const cartaoBtn = document.createElement('button');
  cartaoBtn.textContent = "Cartão";
  cartaoBtn.onclick = (e) => {
    e.stopPropagation();
    mostrarCartaoForm(storyID);
    menu.remove();
  };

  const editBtn = document.createElement('button');
  editBtn.textContent = "Editar";
  editBtn.onclick = (e) => {
    e.stopPropagation();
    editarHistoria(storyID);
    menu.remove();
  };

  const delBtn = document.createElement('button');
  delBtn.textContent = "Excluir";
  delBtn.onclick = (e) => {
    e.stopPropagation();
    excluirHistoria(storyID);
    menu.remove();
  };

  menu.appendChild(cartaoBtn);
  menu.appendChild(editBtn);
  menu.appendChild(delBtn);
  li.appendChild(menu);
  menu.style.display = "block";
}

/**
 * Preenche o formulário de história para edição.
 */
function editarHistoria(storyID) {
  let historias = JSON.parse(localStorage.getItem('historias')) || [];
  const found = historias.find(h => h.id === storyID);
  if (!found) return;
  document.getElementById('titulo').value = found.titulo;
  document.getElementById('descricao').value = found.descricao;
  document.getElementById('storyForm').dataset.editId = found.id;
  document.querySelector('.btn[type="submit"]').textContent = "Atualizar";
  exibirHistoriaNoContainer(storyID);
}

/**
 * Exclui uma história do localStorage.
 */
function excluirHistoria(storyID) {
  if (!confirm("Deseja excluir a história?")) return;
  let historias = JSON.parse(localStorage.getItem('historias')) || [];
  historias = historias.filter(h => h.id !== storyID);
  localStorage.setItem('historias', JSON.stringify(historias));
  alert("História excluída.");
  mostrarHistorias();
  const editID = document.getElementById('storyForm').dataset.editId;
  if (editID === storyID) {
    limparFormulario();
    removerExibicaoHistoria();
  }
}

/**
 * Limpa o formulário da história.
 */
function limparFormulario() {
  document.getElementById('titulo').value = "";
  document.getElementById('descricao').value = "";
  document.getElementById('storyForm').dataset.editId = "";
  document.querySelector('.btn[type="submit"]').textContent = "Salvar";
}

/**
 * Exibe uma única história no container.
 */
function exibirHistoriaNoContainer(storyID) {
  let historias = JSON.parse(localStorage.getItem('historias')) || [];
  const found = historias.find(h => h.id === storyID);
  if (!found) return;
  const container = document.getElementById('storyContainer');
  if (!container) return;
  const oldDiv = container.querySelector('.exibicao-historia');
  if (oldDiv) oldDiv.remove();

  const div = document.createElement('div');
  div.classList.add('exibicao-historia');
  div.style.border = "1px solid #ccc";
  div.style.marginTop = "10px";
  div.style.padding = "10px";

  const h3 = document.createElement('h3');
  h3.textContent = found.titulo || "(sem título)";
  div.appendChild(h3);

  const p = document.createElement('p');
  p.textContent = found.descricao || "";
  div.appendChild(p);

  if (found.cartao) {
    const infoCartao = document.createElement('p');
    infoCartao.innerHTML = "<em>(Este texto foi publicado no Cartão)</em>";
    div.appendChild(infoCartao);
  }
  
  container.appendChild(div);
}

/**
 * Exibe o formulário do cartão e preenche os dados salvos no localStorage.
 */
function mostrarCartaoForm(storyID) {
  const storyContainer = document.getElementById('storyContainer');
  const cartaoContainer = document.getElementById('cartaoContainer');
  if (!storyContainer || !cartaoContainer) return;

  storyContainer.style.display = "none";
  cartaoContainer.style.display = "block";

  let historias = JSON.parse(localStorage.getItem('historias')) || [];
  const h = historias.find(st => st.id === storyID);
  if (!h) return;

  // Inicializa o objeto do cartão se não existir
  if (!h.cartao) {
    h.cartao = { tituloCartao: "", sinopseCartao: "", dataCartao: "", autorCartao: "", categorias: [] };
  }

  document.getElementById('cartaoTitulo').value = h.cartao.tituloCartao;
  document.getElementById('cartaoSinopse').value = h.cartao.sinopseCartao;
  document.getElementById('cartaoData').value = h.cartao.dataCartao || new Date().toISOString().split('T')[0];
  document.getElementById('cartaoAutor').value = h.cartao.autorCartao;

  // Configura os checkboxes das categorias: desmarca todos e depois marca os que estão salvos
  document.querySelectorAll('input[name="categoria"]').forEach(chk => { chk.checked = false; });
  if (h.cartao.categorias) {
    document.querySelectorAll('input[name="categoria"]').forEach(chk => {
      if (h.cartao.categorias.includes(chk.value)) {
        chk.checked = true;
      }
    });
  }

  document.getElementById('btnPublicarCartao').onclick = function() {
    publicarCartao(storyID);
  };
  document.getElementById('btnLerMais').onclick = function() {
    lerMais(storyID);
  };
  document.getElementById('btnVoltar').onclick = function() {
    cartaoContainer.style.display = "none";
    storyContainer.style.display = "block";
  };
}

/*************************************************************
 * EVENTOS INICIAIS (DOMContentLoaded)
 *************************************************************/
document.addEventListener('DOMContentLoaded', () => {
  mostrarHistorias();
  
  // Configura o formulário de história
  const storyForm = document.getElementById('storyForm');
  storyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const titulo = document.getElementById('titulo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    if (!titulo || !descricao) {
      alert("Preencha o título e a descrição!");
      return;
    }
    salvarHistoria(titulo, descricao);
  });
  
  // Configura o botão "Nova História"
  const novaHistoriaBtn = document.getElementById('novaHistoriaBtn');
  if (novaHistoriaBtn) {
    novaHistoriaBtn.addEventListener('click', () => {
      if (confirm("Tem certeza de que deseja começar uma nova história?")) {
        limparFormulario();
        removerExibicaoHistoria();
      }
    });
  }
  
  exibirUsuarioLogado();
});
