  function exibirUsuarioLogado(){
      const userArea = document.getElementById('userMenuArea');
      userArea.innerHTML = '';
      const userData = JSON.parse(localStorage.getItem('loggedUser'));
  
      if(userData && userData.username){
        userArea.innerHTML = userData.username;
        userArea.onclick = function(){// Exemplo: userDisplay.js
import { supabase } from "./supabase.js";

async function exibirUsuarioLogado() {
  const userArea = document.getElementById("userMenuArea");
  if (!userArea) return;

  // Tenta obter a sessão atual do Supabase
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  // Se não houver sessão ou ocorrer erro, exibe o link para login
  if (sessionError || !session) {
    userArea.innerHTML = `
      <a href="Criacao.html" style="color:white;">
        <i class="fas fa-user"></i> Login
      </a>`;
    return;
  }

  // Obtenha o ID do usuário autenticado
  const userId = session.user.id;

  // Agora, consulte a tabela "profiles" para obter o nome do usuário
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  let displayName;
  if (profileError || !profileData) {
    // Se ocorrer algum erro ao buscar o perfil, utilize o e-mail como fallback
    displayName = session.user.email;
  } else {
    displayName = profileData.username;
  }

  // Exibe o nome do usuário e adiciona um menu simples de logout
  userArea.innerHTML = `
    <span id="user-name" style="cursor:pointer;">${displayName}</span>
    <div id="logout-menu" style="display: none; margin-top: 5px;">
      <button id="logout-btn">Deslogar</button>
    </div>
  `;

  // Ao clicar no nome, mostra ou esconde o menu de logout
  document.getElementById("user-name").addEventListener("click", () => {
    const logoutMenu = document.getElementById("logout-menu");
    logoutMenu.style.display = logoutMenu.style.display === "none" ? "block" : "none";
  });

  // Ao clicar no botão de logout, efetua o logout e recarrega a página
  document.getElementById("logout-btn").addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("Erro ao deslogar: " + error.message);
    } else {
      location.reload();
    }
  });
}

document.addEventListener("DOMContentLoaded", exibirUsuarioLogado);

          if(confirm("Deseja fazer logout?")){
            localStorage.removeItem('loggedUser');
            location.reload();
          }
        };
      } else {
        userArea.innerHTML = `
          <a href="Criacao.html" style="color:white;">
            <i class="fas fa-user"></i> Login
          </a>`;
        userArea.onclick = null;
      }
    }
    document.addEventListener('DOMContentLoaded', exibirUsuarioLogado);
