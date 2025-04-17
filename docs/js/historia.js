import { supabase } from './supabase.js';
/*************************************************************
 * HISTORIA.JS
 * - A história permanece no container após “Atualizar”.
 * - Só aparece ao clicar em “Editar”. Se é “nova” não exibe nada.
 *************************************************************/
/************************************************************
 * [1] LOGIN/LOGOUT com Supabase
 ************************************************************/
async function exibirUsuarioLogado() {
  const userArea = document.getElementById('userMenuArea');
  if (!userArea) return;
  try {
    // Obtém a sessão atual do Supabase.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("Erro ao obter a sessão:", sessionError);
      userArea.innerHTML = `<a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
      return;
    }
    // Se não houver sessão ativa, exibe o link para login.
    if (!session) {
      userArea.innerHTML = `<a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
      userArea.onclick = null;
      return;
    }
    const userId = session.user.id;
    // Consulta a tabela "profiles" para obter o campo "username".
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();

    let username = "";
    if (profileError || !profile || !profile.username) {
      // Se não encontrar o username, utiliza o email do usuário.
      username = session.user.email;
      console.warn("Não foi possível recuperar o username; utilizando email:", username);
    } else {
      username = profile.username;
    }
    
    // Exibe o username na área destinada.
    userArea.innerHTML = username;
    // Ao clicar no nome do usuário, oferece a opção para logout.
    userArea.onclick = () => {
      if (confirm("Deseja fazer logout?")) {
        supabase.auth.signOut().then(({ error }) => {
          if (error) {
            alert("Erro ao deslogar: " + error.message);
          } else {
      window.location.href = "Criacao.html"; // Redireciona para a página inicial
    }
        });
      }
    };
  } catch (ex) {
    console.error("Exceção em exibirUsuarioLogado:", ex);
  }
}

/************************************************************
 * [2] TOAST (Notificação)
 ************************************************************/
function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'my-toast';
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, duration);
}
/*************************************************************
 * EVENTO DOMContentLoaded
 *************************************************************/
document.addEventListener('DOMContentLoaded', function() {
    mostrarHistorias(); // Carrega a lista lateral

    // Lida com submit do form
    const storyForm = document.getElementById('storyForm');
    storyForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const titulo = document.getElementById('titulo').value.trim();
        const descricao = document.getElementById('descricao').value.trim();
        if (!titulo || !descricao) {
            alert("Preencha o título e a descrição!");
            return;
        }
        salvarHistoria(titulo, descricao);
    });

    // Botão Nova História
    const novaHistoriaBtn = document.getElementById('novaHistoriaBtn');
    if (novaHistoriaBtn) {
        novaHistoriaBtn.addEventListener('click', function () {
            if (confirm("Tem certeza de que deseja começar uma nova história?")) {
              
            }
        });
    }

    // Exibe user logado (opcional)
    exibirUsuarioLogado();
});

/*************************************************************
 * LISTA LATERAL (HOVER)
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

/*************************************************************
 * MOSTRAR HISTÓRIAS NA LISTA LATERAL
 *************************************************************/
function mostrarHistorias() {
    const ul = document.getElementById('titleListUl');
    if (!ul) return;

    ul.innerHTML = '';
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
    editBtn.onclick = (e) => {
        e.stopPropagation();
        editarHistoria(storyID);
        menu.remove();
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Excluir';
    delBtn.onclick = (e) => {
        e.stopPropagation();
        excluirHistoria(storyID);
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
function salvarHistoria(titulo, descricao) {
    let historias = JSON.parse(localStorage.getItem('historias')) || [];
    const editID = document.getElementById('storyForm').dataset.editId;

    if (editID) {
        // Editando existente
        const idx = historias.findIndex(h => h.id === editID);
        if (idx !== -1) {
            historias[idx].titulo = titulo;
            historias[idx].descricao = descricao;
        }
        localStorage.setItem('historias', JSON.stringify(historias));

        alert("História atualizada com sucesso!");

        // Continua exibida no container:
        exibirHistoriaNoContainer(editID); 
        // (Não limpamos o form se queremos manter o texto; 
        //  mas se quiser limpar, comente a linha de remoção a seguir)

        // Se quiser manter os dados no form, COMENTE:
        // limparFormulario(); 
        // Se quiser mesmo limpar, mas manter o texto de exibição, 
        //   você pode limpá-lo e chamar exibirHistoriaNoContainer(editID).

    } else {
        // Nova
        const newID = Date.now().toString();
        historias.push({ id: newID, titulo, descricao });
        localStorage.setItem('historias', JSON.stringify(historias));

        alert("História salva com sucesso (nova)!");
         
    }

    mostrarHistorias(); // Atualiza lista lateral
}

function editarHistoria(storyID) {
    let historias = JSON.parse(localStorage.getItem('historias')) || [];
    const found = historias.find(h => h.id === storyID);
    if (!found) return;

    // Preenche o form
    document.getElementById('titulo').value = found.titulo;
    document.getElementById('descricao').value = found.descricao;
    document.getElementById('storyForm').dataset.editId = found.id;
    document.querySelector('.btn[type="submit"]').textContent = "Atualizar";

    // Exibe essa história no container
    exibirHistoriaNoContainer(storyID);
}

function excluirHistoria(storyID) {
    if (!confirm("Deseja excluir a história?")) return;
    let historias = JSON.parse(localStorage.getItem('historias')) || [];
    historias = historias.filter(h => h.id !== storyID);
    localStorage.setItem('historias', JSON.stringify(historias));

    alert("História excluída.");
    mostrarHistorias();

    // Se estava exibida, removemos do container
    const editID = document.getElementById('storyForm').dataset.editId;
    if (editID === storyID) {
      
    }
}

function limparFormulario() {
    document.getElementById('titulo').value = '';
    document.getElementById('descricao').value = '';
    document.getElementById('storyForm').dataset.editId = "";
    document.querySelector('.btn[type="submit"]').textContent = "Salvar";
}

/*************************************************************
 * EXIBIR UMA HISTÓRIA (ABAIXO DO FORMULÁRIO)
 *************************************************************/
function exibirHistoriaNoContainer(storyID) {
    let historias = JSON.parse(localStorage.getItem('historias')) || [];
    const found = historias.find(h => h.id === storyID);
    if (!found) return;

    const container = document.getElementById('storyContainer');
    if (!container) return;

    // Remove exibição anterior
    const oldDiv = container.querySelector('.exibicao-historia');
    if (oldDiv) oldDiv.remove();

    // Cria um div pra exibir
    const div = document.createElement('div');
    div.classList.add('exibicao-historia');
    div.style.border = '1px solid #ccc';
    div.style.marginTop = '10px';
    div.style.padding = '10px';

    // Título
    const h3 = document.createElement('h3');
    h3.textContent = found.titulo || "(sem título)";
    div.appendChild(h3);

    // Descrição
    const p = document.createElement('p');
    p.textContent = found.descricao || "";
    div.appendChild(p);

    // Se já tiver cartao, avisa
    if (found.cartao) {
        const infoCartao = document.createElement('p');
        infoCartao.innerHTML = "<em>(Este texto foi publicado no Cartão)</em>";
        div.appendChild(infoCartao);
    }

    container.appendChild(div);
}

/*************************************************************
 * REMOVER EXIBIÇÃO DA HISTÓRIA
 *************************************************************/
function removerExibicaoHistoria() {
    const container = document.getElementById('storyContainer');
    if (!container) return;
    const oldDiv = container.querySelector('.exibicao-historia');
    if (oldDiv) oldDiv.remove();
}
/*************************************************************
 * CARTÃO (ABORDAGEM B)
 *************************************************************/
function mostrarCartaoForm(storyID) {
    const storyContainer = document.getElementById('storyContainer');
    const cartaoContainer = document.getElementById('cartaoContainer');
    if (!storyContainer || !cartaoContainer) return;

    storyContainer.style.display = 'none';
    cartaoContainer.style.display = 'block';

    let historias = JSON.parse(localStorage.getItem('historias')) || [];
    const h = historias.find(st => st.id === storyID);
    if (!h) return;

    if (!h.cartao) {
        h.cartao = {
            tituloCartao: "",
            sinopseCartao: "",
            dataCartao: "",
            autorCartao: "",
            categorias: []
        };
    }

    document.getElementById('cartaoTitulo').value = h.cartao.tituloCartao;
    document.getElementById('cartaoSinopse').value = h.cartao.sinopseCartao;
    document.getElementById('cartaoData').value = h.cartao.dataCartao || new Date().toISOString().split('T')[0];
    document.getElementById('cartaoAutor').value = h.cartao.autorCartao || "";

    document.querySelectorAll('input[name="categoria"]').forEach(chk => {
        chk.checked = false;
    });
    if (h.cartao.categorias) {
        document.querySelectorAll('input[name="categoria"]').forEach(chk => {
            if (h.cartao.categorias.includes(chk.value)) {
                chk.checked = true;
            }
        });
    }

    document.querySelectorAll('.categoria').forEach(checkbox => {
        const subDiv = document.getElementById('sub' + checkbox.value.replace(/ /g, ''));
        if (checkbox.checked) {
            if (subDiv) subDiv.style.display = 'block';
        } else {
            if (subDiv) {
                subDiv.style.display = 'none';
                subDiv.querySelectorAll('input').forEach(sub => sub.checked = false);
            }
        }
    });

    document.getElementById('btnPublicarCartao').onclick = function() {
        publicarCartao(storyID);
    };
    document.getElementById('btnLerMais').onclick = function() {
        lerMais(storyID);
    };
    document.getElementById('btnVoltar').onclick = function() {
        cartaoContainer.style.display = 'none';
        storyContainer.style.display = 'block';
    };
}

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
    const cartaoData = document.getElementById('cartaoData').value.trim();
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
