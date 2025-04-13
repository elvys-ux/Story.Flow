// userDisplay.js

import { supabase } from "./supabase.js";

async function exibirUsuarioLogado() {
  // 1) Pegamos o elemento que mostra o nome do usuário
  const userArea = document.getElementById("userMenuArea");
  if (!userArea) {
    console.error("Elemento #userMenuArea não encontrado no HTML.");
    return;
  }

  // 2) Obtemos a sessão atual do Supabase
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.warn("Erro ao obter sessão:", sessionError.message);
    // Sessão não pôde ser obtida => mostra link de Login
    userArea.innerHTML = `
      <a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
    return;
  }

  // 3) Se não houver sessão, o usuário não está logado
  if (!session) {
    userArea.innerHTML = `
      <a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
    return;
  }

  // 4) Se chegamos aqui, há uma sessão => obtemos o ID do usuário
  const userId = session.user?.id;
  if (!userId) {
    console.warn("Usuário sem ID? Sessão estranha:", session);
    userArea.innerHTML = `
      <a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
    return;
  }

  // 5) Consulta na tabela 'profiles' para buscar o 'username'
  //    (certifique-se de que a tabela 'profiles' tenha a coluna 'id' e 'username')
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  let displayName = "";
  if (profileError || !profileData) {
    // Falha ou não encontrou => fallback para e-mail do usuário
    displayName = session.user.email;
    console.warn("Não foi possível buscar username. Usando e-mail:", displayName);
  } else {
    displayName = profileData.username;
  }

  // 6) Montamos o HTML para exibir o nome e um menu simples de logout
  userArea.innerHTML = `
    <span id="user-name" style="cursor: pointer;">${displayName}</span>
    <div id="logout-menu" style="display: none; margin-top: 5px;">
      <button id="logout-btn">Deslogar</button>
    </div>
  `;

  // 7) Quando clica no nome, alternamos a exibição do menu de logout
  const userNameEl = document.getElementById("user-name");
  const logoutMenu = document.getElementById("logout-menu");
  userNameEl.addEventListener("click", () => {
    logoutMenu.style.display = logoutMenu.style.display === "none" ? "block" : "none";
  });

  // 8) Configura o botão de logout
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("Erro ao deslogar: " + error.message);
    } else {
      // Redireciona para a tela de login (Criacao.html), ou recarrega a página
      window.location.href = "Criacao.html";
    }
  });
}

// 9) Disparamos a função quando o DOM estiver carregado
document.addEventListener("DOMContentLoaded", exibirUsuarioLogado);
