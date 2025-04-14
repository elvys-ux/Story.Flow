// historia.JS
// - A história permanece no container após “Atualizar”.
// - Só aparece ao clicar em “Editar”. Se é “nova” não exibe nada.
// - Exibe o nome do usuário utilizando Supabase para login/logout.

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
        // Consulta a tabela profiles para obter o campo "username"
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
  
        // Ao clicar, pergunta se deseja fazer logout; se confirmado, efetua o logout e recarrega a página
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
 * [B] VARIÁVEIS GLOBAIS (Modo de Leitura, Marcador, etc.)
 *************************************************************/
let modoCorrido = true;
let partesHistoria = [];
let parteAtual = 0;
let isTitleListVisible = false;

// Variáveis para o marcador de linha
let currentStoryId = null;   // ID da história atualmente aberta
const wrapWidth = 80;        // número de caracteres por linha (para quebra de linha)
const lineHeightPx = 22;     // altura aproximada da linha (em px)

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
 * [E] SALVAR/EDITAR HISTÓRIA
 *************************************************************/
function salvarHistoria(titulo, descricao) {
    let historias = JSON.parse(localStorage.getItem('historias')) || [];
    const editID = document.getElementById('storyForm').dataset.editId;

    if (editID) {
        // Editando história existente
        const idx = historias.findIndex(h => h.id === editID);
        if (idx !== -1) {
            historias[idx].titulo = titulo;
            historias[idx].descricao = descricao;
        }
        localStorage.setItem('historias', JSON.stringify(historias));

        alert("História atualizada com sucesso!");
        exibirHistoriaNoContainer(editID);
    } else {
        // Nova história
        const newID = Date.now().toString();
        historias.push({ id: newID, titulo, descricao });
        localStorage.setItem('historias', JSON.stringify(historias));

        alert("História salva com sucesso (nova)!");
        limparFormulario();
        removerExibicaoHistoria(); 
    }
    mostrarHistorias(); // Atualiza a lista lateral
}

function editarHistoria(storyID) {
    let historias = JSON.parse(localStorage.getItem('historias')) || [];
    const found = historias.find(h => h.id === storyID);
    if (!found) return;

    // Preenche o formulário com os dados da história
    document.getElementById('titulo').value = found.titulo;
    document.getElementById('descricao').value = found.descricao;
    document.getElementById('storyForm').dataset.editId = found.id;
    document.querySelector('.btn[type="submit"]').textContent = "Atualizar";

    // Exibe a história no container
    exibirHistoriaNoContainer(storyID);
}

function excluirHistoria(storyID) {
    if (!confirm("Deseja excluir a história?")) return;
    let historias = JSON.parse(localStorage.getItem('historias')) || [];
    historias = historias.filter(h => h.id !== storyID);
    localStorage.setItem('historias', JSON.stringify(historias));

    alert("História excluída.");
    mostrarHistorias();

    // Se a história excluída estava sendo exibida, limpa o container
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
function exibirHistoriaNoContainer(storyID) {
    let historias = JSON.parse(localStorage.getItem('historias')) || [];
    const found = historias.find(h => h.id === storyID);
    if (!found) return;

    const container = document.getElementById('storyContainer');
    if (!container) return;

    // Remove exibição anterior
    const oldDiv = container.querySelector('.exibicao-historia');
    if (oldDiv) oldDiv.remove();

    // Cria um div para exibir a história
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

    // Se já estiver publicado no cartão, mostra aviso
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
 * [H] CARTÃO (ABORDAGEM B)
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

/*************************************************************
 * [I] EVENTO DOMContentLoaded
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
                limparFormulario();
                // Remove exibição da história no container
                removerExibicaoHistoria();
            }
        });
    }

    // Exibe usuário logado (usando Supabase)
    exibirUsuarioLogado();
});

/*************************************************************
 * [J] ATIVAR HOVER NA LISTA LATERAL
 *************************************************************/
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
 * [K] CARTÃO DE LEITURA: Formatação do texto para leitura
 * - Envolve cada palavra em <span> com atributo data-index
 *************************************************************/
function formatarTextoParaLeitura(text) {
    const lines = text.split('\n');
    let paragrafos = [];
    let buffer = [];
    let wordIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        let words = lines[i].split(' ').map(word => {
            let span = `<span class="reading-word" data-index="${wordIndex}" onclick="markReadingPosition(this)">${word}</span>`;
            wordIndex++;
            return span;
        });
        buffer.push(words.join(' '));
        if (buffer.length === 4) {
            let paragraph = `<p style="text-align: justify;">${buffer.join('<br>')}</p>`;
            paragrafos.push(paragraph);
            buffer = [];
        }
    }
    if (buffer.length > 0) {
        let paragraph = `<p style="text-align: justify;">${buffer.join('<br>')}</p>`;
        paragrafos.push(paragraph);
    }
    return paragrafos.join('');
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

// Clique no container de leitura para salvar a linha
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
function filtrarHistorias(query) {
    const todas = JSON.parse(localStorage.getItem('historias')) || [];
    query = query.toLowerCase();
    return todas.filter(story => {
        if (!story.cartao) {
            story.cartao = {
                tituloCartao: story.titulo || "(Sem Título)",
                autorCartao: story.autor || "Desconhecido",
                historiaCompleta: story.descricao || "",
                likes: 0
            };
        }
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

function abrirHistoriaPorId(storyId) {
    const todas = JSON.parse(localStorage.getItem('historias')) || [];
    const h = todas.find(x => x.id === storyId);
    if (!h) {
        alert("História não encontrada!");
        return;
    }
    exibirHistoriaNoContainer(h.id);
}

/*************************************************************
 * [N] EVENTO DOMContentLoaded => CONFIGURAR TUDO
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
                limparFormulario();
                // Remove exibição da história no container
                removerExibicaoHistoria();
            }
        });
    }

    // Exibe usuário logado usando Supabase
    exibirUsuarioLogado();
});

/*************************************************************
 * [O] ATIVAR HOVER NA LISTA LATERAL
 *************************************************************/
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
 * [P] CARTÃO DE LEITURA: Formatação do texto para leitura
 *************************************************************/
function formatarTextoParaLeitura(text) {
    const lines = text.split('\n');
    let paragrafos = [];
    let buffer = [];
    let wordIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        let words = lines[i].split(' ').map(word => {
            let span = `<span class="reading-word" data-index="${wordIndex}" onclick="markReadingPosition(this)">${word}</span>`;
            wordIndex++;
            return span;
        });
        buffer.push(words.join(' '));
        if (buffer.length === 4) {
            let paragraph = `<p style="text-align: justify;">${buffer.join('<br>')}</p>`;
            paragrafos.push(paragraph);
            buffer = [];
        }
    }
    if (buffer.length > 0) {
        let paragraph = `<p style="text-align: justify;">${buffer.join('<br>')}</p>`;
        paragrafos.push(paragraph);
    }
    return paragrafos.join('');
}

/*************************************************************
 * [Q] MARCADOR DE LINHA: Salvar posição de leitura
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

// Clique no container de leitura para salvar a linha
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
 * [R] PESQUISA: Filtrar histórias por título ou autor
 *************************************************************/
function filtrarHistorias(query) {
    const todas = JSON.parse(localStorage.getItem('historias')) || [];
    query = query.toLowerCase();
    return todas.filter(story => {
        if (!story.cartao) {
            story.cartao = {
                tituloCartao: story.titulo || "(Sem Título)",
                autorCartao: story.autor || "Desconhecido",
                historiaCompleta: story.descricao || "",
                likes: 0
            };
        }
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

function abrirHistoriaPorId(storyId) {
    const todas = JSON.parse(localStorage.getItem('historias')) || [];
    const h = todas.find(x => x.id === storyId);
    if (!h) {
        alert("História não encontrada!");
        return;
    }
    exibirHistoriaNoContainer(h.id);
}
