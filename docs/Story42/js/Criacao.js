// js/Criacao.js
import { supabase } from './supabase.js';

document.addEventListener("DOMContentLoaded", function () {
  // Referências aos containers
  const loginContainer = document.getElementById("login-container");
  const registerContainer = document.getElementById("register-container");

  // Botões/links
  const createAccountLink = document.getElementById("create-account");
  const backToLoginLink = document.getElementById("back-to-login");
  const loginBtn = document.getElementById("next-btn");       // Botão de login
  const registerBtn = document.getElementById("register-btn"); // Botão de registrar

  // Alterna entre login e registro
  createAccountLink.addEventListener("click", (e) => {
    e.preventDefault();
    loginContainer.style.display = "none";
    registerContainer.style.display = "block";
  });
  backToLoginLink.addEventListener("click", (e) => {
    e.preventDefault();
    registerContainer.style.display = "none";
    loginContainer.style.display = "block";
  });

  // Função de Login
  async function loginUser() {
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const errorMsg = document.getElementById("error-msg");

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();

    if(!email || !password) {
      errorMsg.textContent = "Preencha seu e-mail e senha.";
      return;
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if(error) {
        errorMsg.textContent = "Erro no login: " + error.message;
        return;
      }
      if(data.user) {
        errorMsg.textContent = "";
        alert("Login realizado com sucesso!");
        // Redirecionar para a página principal
        window.location.href = "Memories.html";
      }
    } catch(err) {
      errorMsg.textContent = "Ocorreu um erro: " + err.message;
    }
  }

  // Função de Registro
  async function registerUser() {
    const regUsername = document.getElementById("reg-username");
    const regEmail = document.getElementById("reg-email");
    const regPassword = document.getElementById("reg-password");
    const regBirthdate = document.getElementById("reg-birthdate");
    const errorMsg = document.getElementById("register-error");

    const username = regUsername.value.trim();
    const email = regEmail.value.trim().toLowerCase();
    const password = regPassword.value.trim();
    const birthdate = regBirthdate.value; // YYYY-MM-DD

    if(!username || !email || !password || !birthdate) {
      errorMsg.textContent = "Preencha todos os campos (incluindo Data de Nascimento).";
      return;
    }
    try {
      // Cria a conta no Supabase Auth
      const { data, error } = await supabase.auth.signUp({ email, password });
      if(error) {
        errorMsg.textContent = "Erro ao criar conta: " + error.message;
        return;
      }
      // Se deu certo, insere o perfil
      if(data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert([{
            id: data.user.id,
            username,
            data_nascimento: birthdate
          }]);
        if(profileError) {
          errorMsg.textContent = "Conta criada, mas erro ao salvar perfil: " + profileError.message;
          return;
        }
        alert("Conta criada com sucesso! Agora faça login.");
        errorMsg.textContent = "";
        // Volta para tela de login
        registerContainer.style.display = "none";
        loginContainer.style.display = "block";
      }
    } catch(err) {
      errorMsg.textContent = "Ocorreu um erro: " + err.message;
    }
  }

  // Eventos nos botões
  loginBtn.addEventListener("click", loginUser);
  registerBtn.addEventListener("click", registerUser);
});
