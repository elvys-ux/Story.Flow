// userDisplay.js
import { supabase } from "./supabase.js";

async function exibirUsuarioLogado() {
  const userArea = document.getElementById("userMenuArea");
  if (!userArea) {
    console.error("Elemento 'userMenuArea' não encontrado no HTML.");
    return;
  }

  // Tenta obter a sessão atual do Supabase
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log("Sessão retornada:", session, "Erro na sessão:", sessionError);

  // Se não houver sessão, exibe o link para login
  if (!session) {
    userArea.innerHTML = `<a href="Criacao.html" style="color:white;">
                            <i class="fas fa-user"></i> Login
                          </a>`;
    return;
  }

  // Obtém o ID do usuário (da sessão)
  const userId = session.user.id;
  console.log("Usuário autenticado. ID:", userId);

  // Consulta a tabela 'profiles' – neste exemplo, selecionamos a coluna "id" (que contém o "nome" do usuário)
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id")  // Alterado: seleciona a coluna "id" pois é nela que o nome do usuário foi salvo.
    .eq("id", userId)
    .single();

  console.log("Dados do perfil:", profileData, "Erro no perfil:", profileError);

  // Se houver erro ou não existirem dados, usamos como fallback o e-mail da sessão;
  // caso contrário, usamos o valor retornado em profileData.id.
  let displayName = "";
  if (profileError || !profileData) {
    displayName = session.user.email;
    console.warn("Não foi possível recuperar 'id' do 'profiles'. Usando o e-mail:", displayName);
  } else {
    displayName = profileData.id;
  }

  // Atualiza a interface: mostra o nome do usuário e cria um menu simples para logout.
  userArea.innerHTML = `
    <span id="user-name" style="cursor: pointer;">${displayName}</span>
    <div id="logout-menu" style="display: none; margin-top: 5px;">
      <button id="logout-btn">Deslogar</button>
    </div>
  `;

  // Ao clicar no nome do usuário, alterna a exibição do menu de logout.
  const userNameEl = document.getElementById("user-name");
  const logoutMenu = document.getElementById("logout-menu");
  userNameEl.addEventListener("click", () => {
    logoutMenu.style.display = (logoutMenu.style.display === "none" ? "block" : "none");
  });

  // Configura o botão de logout – ao clicar, realiza o signOut no Supabase.
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("Erro ao deslogar: " + error.message);
    } else {
      // Redireciona para a página de login (ou recarrega para atualizar a interface)
      window.location.href = "Criacao.html";
    }
  });
}

// Chama a função quando o DOM for carregado
document.addEventListener("DOMContentLoaded", exibirUsuarioLogado);
