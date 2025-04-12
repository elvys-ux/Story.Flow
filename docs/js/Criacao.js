// js/Criacao.js
import { supabase } from './supabase.js';

document.addEventListener("DOMContentLoaded", function () {
  // Exibir a tela de login por padrão
  showLoginScreen();

  // Função para validar o formato de e-mail (opcional)
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Exibe a tela de login
  function showLoginScreen() {
    const container = document.getElementById("login-container");
    container.innerHTML = `
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
    const container = document.getElementById("login-container");
    container.innerHTML = `
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
    // Captura os valores dos inputs
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("register-email").value.trim().toLowerCase();
    const password = document.getElementById("register-password").value.trim();
    const confirmPassword = document.getElementById("confirm-password").value.trim();
    const birthdate = document.getElementById("reg-birthdate").value; // Formato: YYYY-MM-DD
    const errorMsg = document.getElementById("error-msg");

    // Valida se todos os campos foram preenchidos
    if (!username || !email || !password || !confirmPassword || !birthdate) {
      errorMsg.innerText = "Todos os campos devem ser preenchidos!";
      return;
    }

    // Valida o e-mail (opcional)
    if (!isValidEmail(email)) {
      errorMsg.innerText = "Por favor, insira um e-mail válido!";
      return;
    }

    // Valida a senha (pelo menos 8 caracteres, senha ≠ username, e confirmação)
    if (password.length < 8) {
      errorMsg.innerText = "A senha deve ter no mínimo 8 caracteres!";
      return;
    }
    if (password === username) {
      errorMsg.innerText = "A senha não pode ser igual ao nome de usuário!";
      return;
    }
    if (password !== confirmPassword) {
      errorMsg.innerText = "As senhas não coincidem!";
      return;
    }

    try {
      // Cria a conta via Supabase Auth usando o email e senha
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        errorMsg.innerText = "Erro ao criar conta: " + error.message;
        return;
      }

      // Se o usuário foi criado, insere o perfil na tabela "profiles" sem a coluna email
      if (data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert([{
            id: data.user.id,
            username: username,
            data_nascimento: birthdate
            // Não inclua o campo "email" aqui, pois ele não existe na sua tabela
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

});
