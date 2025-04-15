// userDisplay.js
import { supabase } from "./supabase.js";

async function exibirUsuarioLogado() {
  const userArea = document.getElementById("userMenuArea");
  if (!userArea) {
    console.error("Elemento 'userMenuArea' não encontrado no HTML.");
    return;
  }

  // Obtém a sessão atual do Supabase
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  console.log("Sessão retornada:", session, "Erro na sessão:", sessionError);

  // Se não houver sessão, exibe um link para login
  if (!session) {
    userArea.innerHTML = `
      <a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
    return;
  }

  // Se houver sessão, usa o ID do usuário para consultar a tabela 'profiles'
  const userId = session.user.id;
  console.log("Usuário autenticado. ID:", userId);

  // Consulta o campo 'username' na tabela 'profiles'
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  console.log("Dados do perfil:", profileData, "Erro no perfil:", profileError);

  // Define o nome a exibir
  let displayName = "";
  if (profileError || !profileData || !profileData.username) {
    displayName = session.user.email;
    console.warn("Não foi possível recuperar o nome de usuário. Usando e-mail:", displayName);
  } else {
    displayName = profileData.username;
  }

  // Atualiza a interface – exibe o nome do usuário e um menu para logout
  userArea.innerHTML = `
    <span id="user-name" style="cursor: pointer;">${displayName}</span>
    <div id="logout-menu" style="display: none; margin-top: 5px;">
      <button id="logout-btn">Deslogar</button>
    </div>
  `;

  // Ao clicar no nome do usuário, alterna a visibilidade do menu de logout
  const userNameEl = document.getElementById("user-name");
  const logoutMenu = document.getElementById("logout-menu");
  userNameEl.addEventListener("click", () => {
    logoutMenu.style.display = (logoutMenu.style.display === "none" ? "block" : "none");
  });

  // Configura o botão de logout para redirecionar para a página inicial após sair
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("Erro ao deslogar: " + error.message);
    } else {
      window.location.href = "Criacao.html"; // Redireciona para a página inicial
    }
  });
}

// Chama a função assim que o DOM for carregado
document.addEventListener("DOMContentLoaded", exibirUsuarioLogado);
