import { supabase } from "./supabase.js";

/*************************************************************
 * [A] USUÁRIO LOGADO VIA SUPABASE (LOGIN/LOGOUT)
 *************************************************************/
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
        // Se não houver sessão, exibe o link para login
        if (!session) {
            userArea.innerHTML = `<a href="Criacao.html" style="color:white;">
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
            // Se não encontrar, usa o email
            displayName = session.user.email;
            console.warn("Não foi possível recuperar o username; utilizando email:", displayName);
        } else {
            displayName = profileData.username;
        }

        userArea.innerHTML = displayName;

        // Ao clicar, pergunta se deseja fazer logout e, se confirmado, efetua o logout e recarrega a página.
        userArea.onclick = () => {
            if (confirm("Deseja fazer logout?")) {
                supabase.auth.signOut().then(({ error }) => {
                    if (error) {
                        alert("Erro ao deslogar: " + error.message);
                    } else {
                        location.reload();
                    }
                });
            }
        };
    } catch (ex) {
        console.error("Exceção em exibirUsuarioLogado:", ex);
    }
}

/*************************************************************
 * [B] VARIÁVEIS GLOBAIS
 *************************************************************/
let modoCorrido = true;
let partesHistoria = [];
let parteAtual = 0;
let isTitleListVisible = false;
let currentStoryId = null;  // ID da história atualmente aberta

// Parâmetros para formatação de leitura
const wrapWidth = 80;       // número de caracteres por linha (para quebra)
const lineHeightPx = 22;    // altura aproximada da linha (em px)

// Armazenar o texto completo original
let textoCompleto = "";

/*************************************************************
 * [C] LISTA LATERAL (HOVER) – Mostrar/Esconder
 *************************************************************/
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

/*************************************************************
 * [D] MOSTRAR HISTÓRIAS NA LISTA LATERAL
 *************************************************************/
async function mostrarHistorias() {
    const ul = document.getElementById('titleListUl');
    if (!ul) return;
    ul.innerHTML = '';

    // Busca as histórias do Supabase, ordenando pela data de criação (mais recentes primeiro)
    const { data: historias, error } = await supabase
        .from('historias')
        .select('*')
        .order('data_criacao', { ascending: false });
    if (error) {
        console.error("Erro ao buscar histórias:", error);
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
 * [E] SALVAR/EDITAR HISTÓRIA
 *************************************************************/
async function salvarHistoria(titulo, descricao) {
    const storyForm = document.getElementById('storyForm');
    const editID = storyForm.dataset.editId;

    // Obtém o usuário autenticado via Supabase
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
        alert("Usuário não autenticado.");
        return;
    }
    const user_id = userData.user.id;

    if (editID) {
        // Atualiza a história existente
        const { data, error } = await supabase
            .from('historias')
            .update({ titulo, descricao })
            .eq('id', editID);
        if (error) {
            console.error("Erro ao atualizar a história:", error);
            alert("Erro ao atualizar a história.");
            return;
        }
        alert("História atualizada com sucesso!");
        exibirHistoriaNoContainer(editID);
    } else {
        // Insere nova história com data de criação atual
        const data_criacao = new Date().toISOString();
        const { data: novaHistoria, error } = await supabase
            .from('historias')
            .insert([{ user_id, titulo, descricao, data_criacao }])
            .single();
        if (error) {
            console.error("Erro ao inserir a história:", error);
            alert("Erro ao salvar a história.");
            return;
        }
        alert("História salva com sucesso (nova)!");
        // Limpa o formulário e remove exibições anteriores
        limparFormulario();
        removerExibicaoHistoria();
        // Opcional: você pode atualizar a lista agora ou deixar o usuário escolher publicar o cartão posteriormente.
    }
    mostrarHistorias(); // Atualiza a lista lateral
}

async function editarHistoria(storyID) {
    // Busca a história pelo ID no Supabase
    const { data: found, error } = await supabase
        .from('historias')
        .select('*')
        .eq('id', storyID)
        .single();
    if (error) {
        console.error("Erro ao buscar a história:", error);
        return;
    }

    // Preenche o formulário com os dados da história
    document.getElementById('titulo').value = found.titulo;
    document.getElementById('descricao').value = found.descricao;
    document.getElementById('storyForm').dataset.editId = found.id;
    document.querySelector('.btn[type="submit"]').textContent = "Atualizar";

    // Exibe a história no container
    exibirHistoriaNoContainer(storyID);
}

async function excluirHistoria(storyID) {
    if (!confirm("Deseja excluir a história?")) return;
    const { data, error } = await supabase
        .from('historias')
        .delete()
        .eq('id', storyID);
    if (error) {
        console.error("Erro ao excluir a história:", error);
        alert("Erro ao excluir a história.");
        return;
    }
    alert("História excluída.");
    mostrarHistorias();
    const editID = document.getElementById('storyForm').dataset.editId;
    if (editID === storyID) {
        limparFormulario();
        removerExibicaoHistoria();
    }
}

function limparFormulario() {
    document.getElementById('titulo').value = '';
    document.getElementById('descricao').value = '';
    document.getElementById('storyForm').dataset.editId = "";
    document.querySelector('.btn[type="submit"]').textContent = "Salvar";
}

/*************************************************************
 * [F] EXIBIR UMA HISTÓRIA (ABAIXO DO FORMULÁRIO)
 *************************************************************/
async function exibirHistoriaNoContainer(storyID) {
    const container = document.getElementById('storyContainer');
    if (!container) return;

    // Remove exibição anterior
    const oldDiv = container.querySelector('.exibicao-historia');
    if (oldDiv) oldDiv.remove();

    // Busca a história no Supabase
    const { data: found, error } = await supabase
        .from('historias')
        .select('*')
        .eq('id', storyID)
        .single();
    if (error) {
        console.error("Erro ao buscar a história:", error);
        return;
    }

    currentStoryId = storyID; // Define a história atual para marcador de leitura

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

    // Se existir informação do cartão (opcional, se salva via outra função), exibe aviso
    if (found.cartao) {
        const infoCartao = document.createElement('p');
        infoCartao.innerHTML = "<em>(Este texto foi publicado no Cartão)</em>";
        div.appendChild(infoCartao);
    }

    container.appendChild(div);
}

/*************************************************************
 * [G] REMOVER EXIBIÇÃO DA HISTÓRIA
 *************************************************************/
function removerExibicaoHistoria() {
    const container = document.getElementById('storyContainer');
    if (!container) return;
    const oldDiv = container.querySelector('.exibicao-historia');
    if (oldDiv) oldDiv.remove();
}

/*************************************************************
 * [H] CARTÃO – EXIBIR FORMULÁRIO E PUBLICAR CARTÃO
 *************************************************************/
async function mostrarCartaoForm(storyID) {
    const storyContainer = document.getElementById('storyContainer');
    const cartaoContainer = document.getElementById('cartaoContainer');
    if (!storyContainer || !cartaoContainer) return;

    storyContainer.style.display = 'none';
    cartaoContainer.style.display = 'block';

    // Busca a história no Supabase para, se necessário, preencher os dados do cartão (se já existir)
    const { data: h, error } = await supabase
        .from('historias')
        .select('*')
        .eq('id', storyID)
        .single();
    if (error) {
        console.error("Erro ao buscar a história:", error);
        return;
    }

    // Se não houver dados de cartão, inicializa um objeto vazio (para os campos do formulário)
    // Note: A inserção no Cartões será feita na função "publicarCartao" e usará o mesmo ID (storyID)
    let cartao = { tituloCartao: "", sinopseCartao: "", dataCartao: "", autorCartao: "", categorias: [] };
    if (h.cartao) {
        cartao = h.cartao;
    }

    document.getElementById('cartaoTitulo').value = cartao.tituloCartao;
    document.getElementById('cartaoSinopse').value = cartao.sinopseCartao;
    document.getElementById('cartaoData').value = cartao.dataCartao || new Date().toISOString().split('T')[0];
    document.getElementById('cartaoAutor').value = cartao.autorCartao || "";

    // Limpa seleção de categorias e marca as que existem
    document.querySelectorAll('input[name="categoria"]').forEach(chk => {
        chk.checked = false;
    });
    if (cartao.categorias) {
        document.querySelectorAll('input[name="categoria"]').forEach(chk => {
            if (cartao.categorias.includes(chk.value)) {
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

    // Monta o objeto do cartão com os dados do formulário
    const cartao = {
        tituloCartao: cartaoTitulo,
        sinopseCartao: cartaoSinopse,
        dataCartao: cartaoData,
        autorCartao: autor,
        categorias: categoriasSelecionadas,
        // Aqui você pode definir outros campos se desejar (ex: likes permanece 0)
        likes: 0
    };

    // Insere ou atualiza o registro na tabela 'cartoes' utilizando o mesmo ID da história
    // Se o registro ainda não existir, insere; se existir, atualiza
    // Primeiro tenta atualizar (caso já exista)
    let { data, error } = await supabase
        .from('cartoes')
        .update(cartao)
        .eq('id', storyID);

    if (error || !data || data.length === 0) {
        // Se não existir, insere um novo registro usando o mesmo ID
        const { error: errInsert } = await supabase
            .from('cartoes')
            .insert([{ id: storyID, ...cartao }]);
        if (errInsert) {
            console.error("Erro ao inserir o cartão:", errInsert);
            alert("Erro ao publicar o cartão.");
            return;
        }
    }

    alert("Cartão publicado com sucesso!");
}

async function lerMais(storyID) {
    const modalOverlay = document.getElementById('modalOverlay');
    if (!modalOverlay) return;

    // Busca a história no Supabase
    const { data: h, error } = await supabase
        .from('historias')
        .select('*')
        .eq('id', storyID)
        .single();
    if (error) {
        console.error("Erro ao buscar a história:", error);
        return;
    }

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

/*************************************************************
 * [L] MARCADOR DE LINHA: Salvar posição de leitura
 *************************************************************/
function markReadingPosition(element) {
    const index = element.getAttribute('data-index');
    localStorage.setItem('lineNumber_' + currentStoryId, index);
    console.log("Linha salva:", index);
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

// Clique no container de leitura para salvar a linha (marcador)
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

/*************************************************************
 * [M] PESQUISA: Filtrar histórias por título ou autor
 *************************************************************/
async function filtrarHistorias(query) {
    query = query.toLowerCase();
    const { data: todas, error } = await supabase
        .from('historias')
        .select('*');
    if (error) {
        console.error("Erro ao buscar histórias para pesquisa:", error);
        return [];
    }
    // Para cada história, traz os dados do cartão se existirem
    const resultados = [];
    for (let story of todas) {
        // Tenta usar o campo "cartao" (se tiver sido salvo através de update) ou define a partir do título
        const cartao = story.cartao || { 
            tituloCartao: story.titulo || "(Sem Título)", 
            autorCartao: "Desconhecido" 
        };
        resultados.push({
            ...story,
            cartao: cartao
        });
    }
    return resultados.filter(story => {
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

async function abrirHistoriaPorId(storyId) {
    await exibirHistoriaNoContainer(storyId);
}

/*************************************************************
 * [N] EVENTO DOMContentLoaded: CONFIGURAR TUDO
 *************************************************************/
document.addEventListener('DOMContentLoaded', function() {
    // Inicializa a lista lateral
    mostrarHistorias();

    // Lida com o submit do formulário para salvar/editar a história
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
                limparFormulario();
                removerExibicaoHistoria();
            }
        });
    }

    // Exibe usuário logado (usando Supabase)
    exibirUsuarioLogado();

    // Ativa o hover na lista lateral (duplicado para garantir)
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

    // Configura os botões do modo de leitura e marcador
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
