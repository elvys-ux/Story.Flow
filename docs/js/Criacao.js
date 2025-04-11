// js/Criacao.js
import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", function () {
  // Referência ao container que conterá as telas de login e registro
  const loginContainer = document.getElementById("login-container");

  // Função para validar o formato de e-mail
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Exibe a tela de login
  function showLoginScreen() {
    loginContainer.innerHTML = `
      <h2>Iniciar Sessão</h2>
      <p>Acesse sua conta para continuar</p>
      <p id="error-msg" class="error"></p>
      <input type="text" id="login-identifier" placeholder="Nome de usuário ou e-mail">
      <input type="password" id="login-password" placeholder="Senha">
      <button id="next-btn">Entrar</button>
      <div class="links">
        <a href="#" id="create-account">Criar conta</a>
      </div>
    `;

    document.getElementById("next-btn").addEventListener("click", loginUser);
    document.getElementById("create-account").addEventListener("click", showRegisterScreen);
  }

  // Exibe a tela de criação de conta (registro)
  function showRegisterScreen(event) {
    if (event) event.preventDefault();
    loginContainer.innerHTML = `
      <h2>Criar Conta</h2>
      <p>Preencha os campos abaixo para criar sua conta</p>
      <p id="error-msg" class="error"></p>
      <input type="text" id="username" placeholder="Nome de usuário">
      <input type="email" id="register-email" placeholder="E-mail">
      <input type="password" id="register-password" placeholder="Criar senha">
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

  // Função para criar o usuário (registro)
  async function registerUser() {
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("register-email").value.trim().toLowerCase();
    const password = document.getElementById("register-password").value.trim();
    const confirmPassword = document.getElementById("confirm-password").value.trim();
    const birthdate = document.getElementById("reg-birthdate").value; // Formato: YYYY-MM-DD
    const errorMsg = document.getElementById("error-msg");

    // Verifica se todos os campos foram preenchidos
    if (!username || !email || !password || !confirmPassword || !birthdate) {
      errorMsg.innerText = "Todos os campos devem ser preenchidos!";
      return;
    }

    // Valida o formato do e-mail
    if (!isValidEmail(email)) {
      errorMsg.innerText = "Por favor, insira um e-mail válido!";
      return;
    }

    // Validação da senha: no mínimo 8 caracteres
    if (password.length < 8) {
      errorMsg.innerText = "A senha deve ter no mínimo 8 caracteres!";
      return;
    }

    // Validação: a senha não pode ser igual ao nome de usuário
    if (password === username) {
      errorMsg.innerText = "A senha não pode ser igual ao nome de usuário!";
      return;
    }

    // Verifica se a senha e a confirmação coincidem
    if (password !== confirmPassword) {
      errorMsg.innerText = "As senhas não coincidem!";
      return;
    }

    try {
      // Cria a conta via Supabase Auth
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        errorMsg.innerText = "Erro ao criar conta: " + error.message;
        return;
      }

      // Se a conta foi criada, insere o perfil na tabela "profiles"
      // OBS.: Se você deseja que o usuário seja salvo apenas na tabela profiles (sem o e-mail, por exemplo),
      //      basta ajustar a inserção removendo o campo email.
      if (data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert([{
            id: data.user.id,
            username: username,
            email: email, // Caso você deseje remover o email, basta excluir esta linha.
            data_nascimento: birthdate
          }]);
        if (profileError) {
          errorMsg.innerText = "Conta criada, mas erro ao salvar perfil: " + profileError.message;
          return;
        }
      }

      alert("Conta criada com sucesso! Verifique seu e-mail para ativar sua conta, se necessário.");
      errorMsg.innerText = "";
      // Retorna para a tela de login
      showLoginScreen();
    } catch (err) {
      errorMsg.innerText = "Erro inesperado: " + err.message;
    }
  }

  // Função de Login
  async function loginUser() {
    const identifier = document.getElementById("login-identifier").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value.trim();
    const errorMsg = document.getElementById("error-msg");

    if (!identifier || !password) {
      errorMsg.innerText = "Por favor, insira um nome de usuário/e-mail e uma senha!";
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

  // Inicializa a tela de login ao carregar a página
  showLoginScreen();
});
