// js/Criacao.js
import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", () => {
  // Começamos exibindo a tela de login
  showLoginScreen();
});

function showLoginScreen() {
  const container = document.getElementById("login-container");
  container.innerHTML = `
    <h2>Iniciar Sessão</h2>
    <p>Acesse sua conta para continuar</p>
    <p id="error-msg" class="error"></p>
    <input type="text" id="login-identifier" placeholder="Email ou telefone">
    <input type="password" id="login-password" placeholder="Senha">
    <button id="next-btn">Entrar</button>
    <div class="links">
      <a href="#" id="create-account">Criar conta</a>
    </div>
  `;

  document.getElementById("next-btn").addEventListener("click", loginUser);
  document.getElementById("create-account").addEventListener("click", showRegisterScreen);
}

function showRegisterScreen(event) {
  if (event) event.preventDefault();
  const container = document.getElementById("login-container");
  container.innerHTML = `
    <h2>Criar Conta</h2>
    <p>Preencha os campos para criar sua conta</p>
    <p id="error-msg" class="error"></p>
    <input type="text" id="username" placeholder="Nome de usuário">
    <input type="email" id="register-email" placeholder="Email">
    <input type="password" id="register-password" placeholder="Senha">
    <input type="password" id="confirm-password" placeholder="Confirmar senha">
    <input type="date" id="reg-birthdate" placeholder="Data de Nascimento">
    <button id="register-btn">Registrar</button>
    <div class="links">
      <a href="#" id="back-to-login">Já tem uma conta?</a>
    </div>
  `;

  document.getElementById("back-to-login").addEventListener("click", showLoginScreen);
  document.getElementById("register-btn").addEventListener("click", registerUser);
}

async function registerUser() {
  const username = document.getElementById("username").value.trim();

  const password = document.getElementById("register-password").value.trim();
  const confirmPassword = document.getElementById("confirm-password").value.trim();
  const birthdate = document.getElementById("reg-birthdate").value;
  const errorMsg = document.getElementById("error-msg");

  if (!username || !email || !password || !confirmPassword || !birthdate) {
    errorMsg.innerText = "Todos os campos devem ser preenchidos!";
    return;
  }
  
  if (password !== confirmPassword) {
    errorMsg.innerText = "As senhas não coincidem!";
    return;
  }
  
  // (Opcional) Validação básica do e-mail
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errorMsg.innerText = "Por favor, insira um e-mail válido!";
    return;
  }

  try {
    // Cria a conta usando o Supabase Auth
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      errorMsg.innerText = "Erro ao criar conta: " + error.message;
      return;
    }
    
    // A partir daqui você pode decidir se precisa inserir ou não dados adicionais na tabela "profiles".
    // Você mencionou que não quer incluir o campo "email" se não existe. 
    // Por exemplo, para inserir somente o username e data de nascimento:
    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert([{
          id: data.user.id,
          username: username,
          data_nascimento: birthdate
          // Aqui, se não existir a coluna "email" na tabela profiles, NÃO a inclua!
        }]);
      if (profileError) {
        errorMsg.innerText = "Conta criada, mas erro ao salvar perfil: " + profileError.message;
        return;
      }
    }

    alert("Conta criada com sucesso!");
    errorMsg.innerText = "";
    // Volta para a tela de login
    showLoginScreen();
  } catch (err) {
    errorMsg.innerText = "Erro inesperado: " + err.message;
  }
}

async function loginUser() {
  const identifier = document.getElementById("login-identifier").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value.trim();
  const errorMsg = document.getElementById("error-msg");

  if (!identifier || !password) {
    errorMsg.innerText = "Por favor, insira email e senha!";
    return;
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
    if (error) {
      errorMsg.innerText = "Usuário ou senha incorretos!";
      return;
    }
    alert("Login bem-sucedido!");
    window.location.href = "Memories.html";
  } catch (err) {
    errorMsg.innerText = "Erro inesperado: " + err.message;
  }
}
