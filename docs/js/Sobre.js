// Exemplo: userDisplay.js

import { supabase } from "./supabase.js";

async function exibirUsuarioLogado() {
  const userArea = document.getElementById("userMenuArea");
  if (!userArea) {
    console.error("Elemento 'userMenuArea' não encontrado no HTML.");
    return;
  }

  // Tente obter a sessão atual do Supabase
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log("Sessão retornada:", session, "Erro na sessão:", sessionError);

  if (!session) {
    // Se não houver sessão, exibe o link para login
    userArea.innerHTML = `<a href="Criacao.html" style="color:white;">
                              <i class="fas fa-user"></i> Login
                          </a>`;
    return;
  }

  // Se há sessão, obtenha o ID do usuário
  const userId = session.user.id;
  console.log("Usuário autenticado. ID:", userId);

  // Faça a consulta na tabela 'profiles' para obter o username
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  console.log("Dados do perfil:", profileData, "Erro no perfil:", profileError);

  // Use o username do profile ou, se der erro, use o e-mail do usuário (como fallback)
  let displayName = "";
  if (profileError || !profileData) {
    displayName = session.user.email;
    console.warn("Não foi possível recuperar username de 'profiles'. Usando o e-mail:", displayName);
  } else {
    displayName = profileData.username;
  }

  // Exibe o nome do usuário e um pequeno menu para deslogar
  userArea.innerHTML = `
    <span id="user-name" style="cursor:pointer;">${displayName}</span>
    <div id="logout-menu" style="display: none; margin-top: 5px;">
      <button id="logout-btn">Deslogar</button>
    </div>
  `;

  // Ao clicar no nome, alterna a exibição do menu de logout
  const userNameEl = document.getElementById("user-name");
  const logoutMenu = document.getElementById("logout-menu");
  userNameEl.addEventListener("click", () => {
    logoutMenu.style.display = (logoutMenu.style.display === "none" ? "block" : "none");
  });

  // Configura o botão de logout
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("Erro ao deslogar: " + error.message);
    } else {
      // Opcional: Limpe também o localStorage, se estiver usando para outros fins
      location.reload();
    }
  });
}

// Chama a função quando o DOM for carregado
document.addEventListener("DOMContentLoaded", exibirUsuarioLogado);
