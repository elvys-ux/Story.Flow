// historiasqueescrevi.js
import { supabase } from "./supabase.js";

/* [A] Exibir usuário logado / Login-Logout */
async function exibirUsuarioLogado() {
  const userArea = document.getElementById("userMenuArea");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Erro ao obter sessão:", error);
    return;
  }

  if (!session) {
    userArea.innerHTML = `
      <a href="Criacao.html" style="color:white">
        <i class="fas fa-user"></i> Login
      </a>`;
    userArea.onclick = null;
    return;
  }

  const userId = session.user.id;
  let displayName = session.user.email;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  if (!profileError && profile?.username) {
    displayName = profile.username;
  }

  userArea.textContent = displayName;
  userArea.onclick = () => {
    if (confirm("Deseja fazer logout?")) {
      supabase.auth.signOut().then(({ error }) => {
        if (error) alert("Erro ao deslogar: " + error.message);
        else window.location.href = "Criacao.html";
      });
    }
  };
}

/* [B] Helpers Supabase */
async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

// Histórias do usuário autenticado (salvas ou publicadas por ele)
async function fetchUserStories() {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("historias")
    .select("id, titulo")
    .eq("user_id", userId);
  if (error) console.error("fetchUserStories:", error);
  return data || [];
}

// Histórias publicadas (para pesquisa por qualquer visitante)
async function fetchPublishedStories(query = "") {
  let builder = supabase
    .from("historias")
    .select("id, titulo")
    .eq("published", true);
  const q = query.trim();
  if (q) {
    builder = builder.or(`titulo.ilike.%${q}%,descricao.ilike.%${q}%`);
  }
  const { data, error } = await builder;
  if (error) console.error("fetchPublishedStories:", error);
  return data || [];
}

/* [C] CRUD de Histórias */
// Salvar nova história
async function salvarHistoria(titulo, descricao) {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("historias")
    .insert({ titulo, descricao, user_id: userId, published: true });
  if (error) {
    alert("Erro ao salvar: " + error.message);
  } else {
    document.getElementById("formPrincipal").reset();
    mostrarHistorias();
  }
}

// Excluir história existente
async function excluirHistoria(id) {
  if (!confirm("Deseja mesmo excluir esta história?")) return;
  const { error } = await supabase
    .from("historias")
    .delete()
    .eq("id", id);
  if (error) {
    alert("Erro ao excluir: " + error.message);
  } else {
    mostrarHistorias();
  }
}

/* [D] Exibição de História */
// Variáveis para paginação
let modoCorrido = true;
let partes = [];
let indiceParte = 0;
let textoCompleto = "";

// Abrir e exibir história completa (formatação básica)
async function abrirHistoria(id) {
  const { data: [hist], error } = await supabase
    .from("historias")
    .select("titulo, descricao")
    .eq("id", id);

  if (error || !hist) {
    alert("História não encontrada!");
    return;
  }

  // Formatar texto: inserir \n\n a cada 5 pontos finais
  let contador = 0, out = "";
  for (const c of hist.descricao) {
    out += c;
    if (c === ".") {
      contador++;
      if (contador === 5) {
        out += "\n\n";
        contador = 0;
      }
    }
  }
  textoCompleto = out;
  document.getElementById("historia-titulo").textContent = hist.titulo;
  const cont = document.getElementById("historia-conteudo");
  cont.innerText = textoCompleto;
  cont.setAttribute("data-full", textoCompleto);

  // Resetar modo de leitura
  modoCorrido = true;
  partes = [];
  indiceParte = 0;
}

// Alternar modo de leitura entre texto corrido e páginas de 5 linhas
function toggleReadingMode() {
  const cont = document.getElementById("historia-conteudo");
  const full = cont.getAttribute("data-full");
  const btnV = document.getElementById("btn-voltar");
  const btnC = document.getElementById("btn-continuar");

  if (modoCorrido) {
    const linhas = full.split(/\r?\n/);
    partes = [];
    for (let i = 0; i < linhas.length; i += 5) {
      partes.push(linhas.slice(i, i + 5).join("\n"));
    }
    indiceParte = 0;
    exibirParte();
    btnV.style.display = btnC.style.display = (partes.length > 1 ? "inline-block" : "none");
    modoCorrido = false;
  } else {
    cont.innerText = full;
    btnV.style.display = btnC.style.display = "none";
    modoCorrido = true;
  }
}

function exibirParte() {
  document.getElementById("historia-conteudo")
    .innerHTML = `<p>${partes[indiceParte]}</p>`;
}

function voltarPagina() {
  if (indiceParte > 0) {
    indiceParte--;
    exibirParte();
  }
}

function continuarHistoria() {
  if (indiceParte < partes.length - 1) {
    indiceParte++;
    exibirParte();
  }
}

/* [E] Lista lateral de Histórias do Usuário */
async function mostrarHistorias() {
  const ul = document.getElementById("titleListUl");
  ul.innerHTML = "";
  const lista = await fetchUserStories();
  lista.forEach(h => {
    const li = document.createElement("li");
    li.textContent = h.titulo || "(Sem título)";

    const span = document.createElement("span");
    span.classList.add("buttons");

    const btnLer = document.createElement("button");
    btnLer.textContent = "Ler";
    btnLer.onclick = () => abrirHistoria(h.id);

    const btnDel = document.createElement("button");
    btnDel.textContent = "Excluir";
    btnDel.onclick = () => excluirHistoria(h.id);

    span.append(btnLer, btnDel);
    li.appendChild(span);
    ul.appendChild(li);
  });
}

/* [F] Pesquisa pública de Histórias */
async function filtrarHistorias(query) {
  return await fetchPublishedStories(query);
}

function exibirSugestoes(lista) {
  const box = document.getElementById("searchResults");
  if (!lista.length) {
    box.innerHTML = `<div style="padding:6px;">Nenhuma história encontrada</div>`;
  } else {
    box.innerHTML = lista
      .map(h => `
        <div class="suggestion-item" data-id="${h.id}">
          <strong>${h.titulo}</strong>
        </div>`)
      .join("");
    box.querySelectorAll(".suggestion-item")
       .forEach(el => el.addEventListener("click", () => {
         abrirHistoria(el.dataset.id);
         box.style.display = "none";
       }));
  }
  box.style.display = "block";
}

/* [G] Eventos e Inicialização */
document.addEventListener("DOMContentLoaded", () => {
  exibirUsuarioLogado();
  mostrarHistorias();

  // Formulário de criação
  document.getElementById("formPrincipal")?.addEventListener("submit", e => {
    e.preventDefault();
    const t = document.getElementById("titulo").value.trim();
    const d = document.getElementById("descricao").value.trim();
    if (!t || !d) {
      alert("Título e descrição são obrigatórios.");
      return;
    }
    salvarHistoria(t, d);
  });

  // Pesquisa
  const sb = document.getElementById("searchBar");
  const btn = document.getElementById("searchBtn");
  [btn, sb].forEach(el => {
    if (!el) return;
    const ev = el === btn ? "click" : "input";
    el.addEventListener(ev, async () => {
      const q = sb.value.trim();
      if (!q) return document.getElementById("searchResults").style.display = "none";
      exibirSugestoes(await filtrarHistorias(q));
    });
  });

  // Modos de leitura
  document.getElementById("toggleMode")?.addEventListener("click", toggleReadingMode);
  document.getElementById("btn-voltar")?.addEventListener("click", voltarPagina);
  document.getElementById("btn-continuar")?.addEventListener("click", continuarHistoria);

  // Teclas de atalho
  document.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (["arrowleft","a","w"].includes(k)) voltarPagina();
    if (["arrowright","d","s"].includes(k)) continuarHistoria();
  });
});
