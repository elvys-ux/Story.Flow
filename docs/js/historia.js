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
 * [B] VARIÁVEIS GLOBAIS (Para localStorage)
 *************************************************************/
let modoCorrido = true;
let partesHistoria = [];
let parteAtual = 0;
let isTitleListVisible = false;
let currentStoryId = null;  // ID da história atualmente aberta
const wrapWidth = 80;       // nº de caracteres por linha
const lineHeightPx = 22;    // altura aproximada da linha (px)
let textoCompleto = "";     // Armazena o texto completo para o modo leitura

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
 * [D] OPERAR COM HISTÓRIAS E CARTÕES NO localStorage
 *************************************************************/
// Funções auxiliares para manipulação dos dados via localStorage
function obterHistorias() {
    return JSON.parse(localStorage.getItem('historias')) || [];
}

function salvarHistorias(historias) {
    localStorage.setItem('historias', JSON.stringify(historias));
}

async function mostrarHistorias() {
    const ul = document.getElementById('titleListUl');
    if (!ul) return;
    ul.innerHTML = '';
    const historias = obterHistorias();
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
    cartaoBtn.onclick = e => {
        e.stopPropagation();
        mostrarCartaoForm(storyID);
        menu.remove();
    };

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Editar';
    editBtn.onclick = e => {
        e.stopPropagation();
        editarHistoria(storyID);
        menu.remove();
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Excluir';
    delBtn.onclick = e => {
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
 * [E] SALVAR/EDITAR HISTÓRIA (via localStorage)
 *************************************************************/
async function salvarHistoria(titulo, descricao) {
    let historias = obterHistorias();
    const editID = document.getElementById('storyForm').dataset.editId;
    if (editID) {
        // Atualiza a história existente
        const idx = historias.findIndex(h => h.id === editID);
        if (idx !== -1) {
            historias[idx].titulo = titulo;
            historias[idx].descricao = descricao;
        }
        alert("História atualizada com sucesso!");
        exibirHistoriaNoContainer(editID);
    } else {
        // Nova história – gera um ID único e cria o objeto
        const newID = Date.now().toString();
        const nova = { id: newID, titulo, descricao, cartao: null };
        historias.push(nova);
        alert("História salva com sucesso (nova)!");
        limparFormulario();
        removerExibicaoHistoria();
    }
    salvarHistorias(historias);
    mostrarHistorias();
}

function editarHistoria(storyID) {
    let historias = obterHistorias();
    const found = historias.find(h => h.id === storyID);
    if (!found) return;
    document.getElementById('titulo').value = found.titulo;
    document.getElementById('descricao').value = found.descricao;
    document.getElementById('storyForm').dataset.editId = found.id;
    document.querySelector('.btn[type="submit"]').textContent = "Atualizar";
    exibirHistoriaNoContainer(storyID);
}

function excluirHistoria(storyID) {
    if (!confirm("Deseja excluir a história?")) return;
    let historias = obterHistorias();
    historias = historias.filter(h => h.id !== storyID);
    salvarHistorias(historias);
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

function exibirHistoriaNoContainer(storyID) {
    const container = document.getElementById('storyContainer');
    if (!container) return;
    const oldDiv = container.querySelector('.exibicao-historia');
    if (oldDiv) oldDiv.remove();
    let historias = obterHistorias();
    const found = historias.find(h => h.id === storyID);
    if (!found) return;
    currentStoryId = storyID;
    const div = document.createElement('div');
    div.classList.add('exibicao-historia');
    div.style.border = '1px solid #ccc';
    div.style.marginTop = '10px';
    div.style.padding = '10px';
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

/*************************************************************
 * [F] CARTÃO – OPERAR VIA localStorage
 *************************************************************/
function mostrarCartaoForm(storyID) {
    const storyContainer = document.getElementById('storyContainer');
    const cartaoContainer = document.getElementById('cartaoContainer');
    if (!storyContainer || !cartaoContainer) return;
    storyContainer.style.display = 'none';
    cartaoContainer.style.display = 'block';

    let historias = obterHistorias();
    const found = historias.find(h => h.id === storyID) || {};
    const cartao = found.cartao || { historia_completa: "", data_criacao: "", autor_cartao: "", categorias: [] };

    // Mesmo que o HTML possua um input para "cartaoTitulo", a tabela do cartão não possui esse campo, então podemos ignorá-lo
    document.getElementById('cartaoSinopse').value = cartao.historia_completa;
    document.getElementById('cartaoData').value = cartao.data_criacao || new Date().toISOString().split('T')[0];
    document.getElementById('cartaoAutor').value = cartao.autor_cartao || "";
    document.querySelectorAll('input[name="categoria"]').forEach(chk => chk.checked = false);
    if (cartao.categorias) {
        document.querySelectorAll('input[name="categoria"]').forEach(chk => {
            if (cartao.categorias.includes(chk.value)) chk.checked = true;
        });
    }
    document.getElementById('btnPublicarCartao').onclick = () => publicarCartao(storyID);
    document.getElementById('btnLerMais').onclick = () => lerMais(storyID);
    document.getElementById('btnVoltar').onclick = () => {
        cartaoContainer.style.display = 'none';
        storyContainer.style.display = 'block';
    };
}

function publicarCartao(storyID) {
    if (!confirm("Aviso: Ao publicar o cartão, o conteúdo fica definitivo.\nEdições futuras não serão refletidas no cartão.\n\nContinuar?")) {
        alert("Publicação cancelada.");
        return;
    }
    const cartaoTitulo = document.getElementById('cartaoTitulo').value.trim();
    const cartaoSinopse = document.getElementById('cartaoSinopse').value.trim();
    const cartaoData = document.getElementById('cartaoData').value.trim();
    const autor = document.getElementById('cartaoAutor').value.trim();
    const categoriasSelecionadas = Array.from(document.querySelectorAll('input[name="categoria"]:checked')).map(chk => chk.value);
    // Se desejar, você pode validar o input do "cartaoTitulo" embora a tabela não possua esse campo; aqui exemplifico:
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
    // Monta o objeto do cartão – observe que usamos os nomes que queremos persistir
    const cartao = {
        // Embora o input "cartaoTitulo" exista, a tabela não tem essa coluna. Você pode usá-lo internamente se desejar.
        historia_completa: cartaoSinopse,
        data_criacao: cartaoData || new Date().toISOString(),
        autor_cartao: autor || "Desconhecido",
        categorias: categoriasSelecionadas,
        likes: 0
    };

    // Atualiza o objeto da história no localStorage
    let historias = obterHistorias();
    const idx = historias.findIndex(h => h.id === storyID);
    if (idx !== -1) {
        historias[idx].cartao = cartao;
        salvarHistorias(historias);
        alert("Cartão publicado com sucesso!");
    } else {
        alert("Erro: História não encontrada.");
    }
}

function lerMais(storyID) {
    const modalOverlay = document.getElementById('modalOverlay');
    if (!modalOverlay) return;
    let historias = obterHistorias();
    const found = historias.find(h => h.id === storyID);
    if (!found) {
        alert("História não encontrada!");
        return;
    }
    document.getElementById('modalTitulo').textContent = found.titulo || "";
    document.getElementById('modalDescricao').textContent = found.descricao || "";
    if (!found.cartao) {
        document.getElementById('modalCartaoTitulo').textContent = "";
        document.getElementById('modalCartaoSinopse').textContent = "";
        document.getElementById('modalCartaoData').textContent = "";
        document.getElementById('modalCartaoAutor').textContent = "";
        document.getElementById('modalCartaoCategorias').textContent = "";
    } else {
        document.getElementById('modalCartaoTitulo').textContent = found.cartao.tituloCartao || "";
        document.getElementById('modalCartaoSinopse').textContent = found.cartao.historia_completa || "";
        document.getElementById('modalCartaoData').textContent = found.cartao.data_criacao || "";
        document.getElementById('modalCartaoAutor').textContent = found.cartao.autor_cartao || "";
        document.getElementById('modalCartaoCategorias').textContent =
            (found.cartao.categorias && found.cartao.categorias.length > 0)
                ? found.cartao.categorias.join(', ')
                : "";
    }
    modalOverlay.style.display = 'flex';
}

/*************************************************************
 * MODO DE LEITURA E MARCADOR
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
 * PESQUISA: Filtrar histórias por título ou autor (via localStorage)
 *************************************************************/
async function filtrarHistorias(query) {
    query = query.toLowerCase();
    const todas = obterHistorias();
    return todas.filter(story => {
        const t = (story.titulo || "").toLowerCase();
        const a = (story.cartao?.autor_cartao || "").toLowerCase();
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
        const t = story.titulo || "(Sem Título)";
        const a = story.cartao?.autor_cartao || "Desconhecido";
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
    exibirHistoriaNoContainer(storyId);
}

/*************************************************************
 * EVENTO DOMContentLoaded: INICIALIZAÇÃO
 *************************************************************/
document.addEventListener('DOMContentLoaded', function() {
    mostrarHistorias();

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

    const novaHistoriaBtn = document.getElementById('novaHistoriaBtn');
    if (novaHistoriaBtn) {
        novaHistoriaBtn.addEventListener('click', function () {
            if (confirm("Tem certeza de que deseja começar uma nova história?")) {
                limparFormulario();
                removerExibicaoHistoria();
            }
        });
    }

    exibirUsuarioLogado();

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
