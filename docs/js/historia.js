import { supabase } from "./supabase.js";

/*************************************************************
 * HISTORIA.JS
 * - Salva e atualiza histórias na tabela 'historias'.
 * - Publica cartões na tabela 'cartoes'
 * - Insere as categorias selecionadas na tabela 'historias_categoria'
 *************************************************************/

document.addEventListener('DOMContentLoaded', async function() {
    await mostrarHistorias(); // Carrega a lista lateral

    // Lida com o submit do formulário de história
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

    // Exibe usuário logado via Supabase
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
async function mostrarHistorias() {
    const ul = document.getElementById('titleListUl');
    if (!ul) return;

    ul.innerHTML = '';
    // Busca as histórias do Supabase, ordenadas por data_criacao decrescente
    const { data: historias, error } = await supabase
        .from('historias')
        .select('*')
        .order('data_criacao', { ascending: false });
    if (error) {
        console.error("Erro ao recuperar histórias:", error);
        return;
    }

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
async function salvarHistoria(titulo, descricao) {
    const storyForm = document.getElementById('storyForm');
    const editID = storyForm.dataset.editId;
    const user = (await supabase.auth.getSession()).data.session?.user;
    if (!user) {
        alert("Usuário não autenticado.");
        return;
    }

    if (editID) {
        // Atualiza história existente
        const { error } = await supabase
            .from('historias')
            .update({ titulo, descricao })
            .eq('id', editID);
        if (error) {
            console.error("Erro ao atualizar história:", error);
            alert("Erro ao atualizar história.");
            return;
        }
        alert("História atualizada com sucesso!");
        exibirHistoriaNoContainer(editID);
    } else {
        // Insere nova história; assume que o banco gera o ID automaticamente
        const data_criacao = new Date().toISOString();
        const { error } = await supabase
            .from('historias')
            .insert({ titulo, descricao, user_id: user.id, data_criacao });
        if (error) {
            console.error("Erro ao salvar nova história:", error);
            alert("Erro ao salvar história.");
            return;
        }
        alert("História salva com sucesso (nova)!");
        limparFormulario();
        removerExibicaoHistoria();
    }
    await mostrarHistorias();
}

async function editarHistoria(storyID) {
    const { data: historia, error } = await supabase
        .from('historias')
        .select('*')
        .eq('id', storyID)
        .single();
    if (error) {
        console.error("Erro ao recuperar história:", error);
        return;
    }
    // Preenche o formulário
    document.getElementById('titulo').value = historia.titulo;
    document.getElementById('descricao').value = historia.descricao;
    document.getElementById('storyForm').dataset.editId = historia.id;
    document.querySelector('.btn[type="submit"]').textContent = "Atualizar";
    exibirHistoriaNoContainer(storyID);
}

async function excluirHistoria(storyID) {
    if (!confirm("Deseja excluir a história?")) return;
    const { error } = await supabase
        .from('historias')
        .delete()
        .eq('id', storyID);
    if (error) {
        console.error("Erro ao excluir história:", error);
        alert("Erro ao excluir história.");
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

async function exibirHistoriaNoContainer(storyID) {
    const { data: historia, error } = await supabase
        .from('historias')
        .select('*')
        .eq('id', storyID)
        .single();
    if (error) {
        console.error("Erro ao recuperar história:", error);
        return;
    }
    const container = document.getElementById('storyContainer');
    if (!container) return;

    // Remove exibição anterior
    const oldDiv = container.querySelector('.exibicao-historia');
    if (oldDiv) oldDiv.remove();

    // Cria div para exibir a história
    const div = document.createElement('div');
    div.classList.add('exibicao-historia');
    div.style.border = '1px solid #ccc';
    div.style.marginTop = '10px';
    div.style.padding = '10px';

    // Título
    const h3 = document.createElement('h3');
    h3.textContent = historia.titulo || "(sem título)";
    div.appendChild(h3);

    // Descrição
    const p = document.createElement('p');
    p.textContent = historia.descricao || "";
    div.appendChild(p);

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
 * USUÁRIO LOGADO VIA SUPABASE
 *************************************************************/
async function exibirUsuarioLogado(){
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
 * CARTÃO – FORMULÁRIO E PUBLICAÇÃO
 *************************************************************/
async function mostrarCartaoForm(storyID) {
    const storyContainer = document.getElementById('storyContainer');
    const cartaoContainer = document.getElementById('cartaoContainer');
    if (!storyContainer || !cartaoContainer) return;

    storyContainer.style.display = 'none';
    cartaoContainer.style.display = 'block';

    // Recupera a história (mesmo que os dados do cartão estejam em outra tabela)
    const { data: historia, error } = await supabase
        .from('historias')
        .select('*')
        .eq('id', storyID)
        .single();
    if (error) {
        console.error("Erro ao obter história:", error);
        return;
    }

    // Tenta recuperar os dados do cartão, se já existentes
    const { data: card, error: cardError } = await supabase
        .from('cartoes')
        .select('*')
        .eq('historia_id', storyID)
        .single();

    document.getElementById('cartaoTitulo').value = card ? card.titulo_cartao : "";
    document.getElementById('cartaoSinopse').value = card ? card.sinopse_cartao : "";
    document.getElementById('cartaoData').value = card ? card.data_criacao : new Date().toISOString().split('T')[0];
    document.getElementById('cartaoAutor').value = card ? card.autor_cartao : "";

    // Ajusta a seleção de categorias com base na tabela de relacionamento
    let selectedCats = [];
    if (card) {
        const { data: catData, error: catError } = await supabase
            .from('historias_categoria')
            .select('categoria_id')
            .eq('historia_id', storyID);
        if (!catError && catData) {
            selectedCats = catData.map(item => item.categoria_id.toString());
        }
    }
    document.querySelectorAll('input[name="categoria"]').forEach(chk => {
        chk.checked = selectedCats.includes(chk.value);
    });
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

async function publicarCartao(storyID) {
    const msg = "Aviso: Ao publicar o cartão, o conteúdo fica definitivo.\nEdições futuras não serão refletidas no cartão.\n\nContinuar?";
    if (!confirm(msg)) {
        alert("Publicação cancelada.");
        return;
    }

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

    // Insere ou atualiza os dados do cartão na tabela 'cartoes'
    const { error: cardError } = await supabase
         .from('cartoes')
         .upsert({
            historia_id: storyID,
            titulo_cartao: cartaoTitulo,
            sinopse_cartao: cartaoSinopse,
            autor_cartao: autor,
            data_criacao: cartaoData
         });
    if (cardError) {
         console.error("Erro ao publicar cartão:", cardError);
         alert("Erro ao publicar cartão.");
         return;
    }

    // Insere as categorias selecionadas na tabela 'historias_categoria'
    // Para simplicidade, esta implementação insere os relacionamentos sem limpar préviamente os existentes.
    for (let catId of categoriasSelecionadas) {
         const { error: catError } = await supabase
             .from('historias_categoria')
             .insert({ historia_id: storyID, categoria_id: catId });
         if (catError) {
             console.error(`Erro ao inserir categoria ${catId}:`, catError);
         }
    }
    alert("Cartão publicado com sucesso!");
}

async function lerMais(storyID) {
    const modalOverlay = document.getElementById('modalOverlay');
    if (!modalOverlay) return;

    const { data: historia, error: histError } = await supabase
         .from('historias')
         .select('*')
         .eq('id', storyID)
         .single();
    if (histError) {
         console.error("Erro ao obter história:", histError);
         return;
    }
    document.getElementById('modalTitulo').textContent = historia.titulo || "";
    document.getElementById('modalDescricao').textContent = historia.descricao || "";

    // Recupera os dados do cartão
    const { data: card, error: cardError } = await supabase
         .from('cartoes')
         .select('*')
         .eq('historia_id', storyID)
         .single();
    if (cardError && cardError.code !== 'PGRST116') {
         console.error("Erro ao obter cartão:", cardError);
    }
    if (!card) {
         document.getElementById('modalCartaoTitulo').textContent = "";
         document.getElementById('modalCartaoSinopse').textContent = "";
         document.getElementById('modalCartaoData').textContent = "";
         document.getElementById('modalCartaoAutor').textContent = "";
         document.getElementById('modalCartaoCategorias').textContent = "";
    } else {
         document.getElementById('modalCartaoTitulo').textContent = card.titulo_cartao || "";
         document.getElementById('modalCartaoSinopse').textContent = card.sinopse_cartao || "";
         document.getElementById('modalCartaoData').textContent = card.data_criacao || "";
         document.getElementById('modalCartaoAutor').textContent = card.autor_cartao || "";
         // Recupera os nomes das categorias relacionadas
         const { data: catData, error: catJoinError } = await supabase
              .from('historias_categoria')
              .select('categoria_id')
              .eq('historia_id', storyID);
         if (catJoinError) {
              console.error("Erro ao obter categorias:", catJoinError);
         }
         const catNames = [];
         if (catData && catData.length > 0) {
              for (let rel of catData) {
                  const { data: cat, error: catError } = await supabase
                      .from('categorias')
                      .select('nome')
                      .eq('id', rel.categoria_id)
                      .single();
                  if (!catError && cat) {
                      catNames.push(cat.nome);
                  }
              }
         }
         document.getElementById('modalCartaoCategorias').textContent = catNames.join(', ');
    }
    modalOverlay.style.display = 'flex';
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
