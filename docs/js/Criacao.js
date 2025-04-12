
document.addEventListener("DOMContentLoaded", function () {
    const loginContainer = document.getElementById("login-container");

    function showRegisterScreen(event) {
        if (event) event.preventDefault();
        loginContainer.innerHTML = `
            <h2>Criar Conta</h2>
            <p>Preencha os campos abaixo para continuar</p>
            <p id="error-msg" class="error"></p>
            <input type="text" id="username" placeholder="Usuário">
            <input type="email" id="register-email" placeholder="E-mail">
            <input type="password" id="register-password" placeholder="Criar senha">
            <input type="password" id="confirm-password" placeholder="Confirmar senha">
            <button id="register-btn">Registrar</button>
            <div class="links">
                <a href="#" id="back-to-login">Já tem uma conta?</a>
            </div>
        `;

        document.getElementById("back-to-login").addEventListener("click", showLoginScreen);
        document.getElementById("register-btn").addEventListener("click", registerUser);
    }

    async function registerUser() {
        const email = document.getElementById("register-email").value.trim();
        const password = document.getElementById("register-password").value.trim();
        const confirmPassword = document.getElementById("confirm-password").value.trim();
        const errorMsg = document.getElementById("error-msg");

        if (!email || !password || !confirmPassword) {
            errorMsg.innerText = "Todos os campos devem ser preenchidos!";
            return;
        }

        if (password !== confirmPassword) {
            errorMsg.innerText = "As senhas não coincidem!";
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password
            });

            if (error) {
                throw error;
            }

            alert("Conta criada com sucesso! Verifique seu e-mail para ativá-la.");
            showLoginScreen();
        } catch (err) {
            errorMsg.innerText = err.message || "Erro ao criar conta!";
        }
    }

    function showLoginScreen() {
        loginContainer.innerHTML = `
            <h2>Iniciar Sessão</h2>
            <p>Acesse sua conta para continuar</p>
            <p id="error-msg" class="error"></p>
            <input type="email" id="login-email" placeholder="E-mail">
            <input type="password" id="login-password" placeholder="Senha">
            <button id="next-btn">Seguinte</button>
            <div class="links">
                <a href="#" id="create-account">Criar conta</a>
            </div>
        `;

        document.getElementById("next-btn").addEventListener("click", loginUser);
        document.getElementById("create-account").addEventListener("click", showRegisterScreen);
    }

    async function loginUser() {
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value.trim();
        const errorMsg = document.getElementById("error-msg");

        if (!email || !password) {
            errorMsg.innerText = "Por favor, insira um e-mail e uma senha!";
            return;
        }

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                throw error;
            }

            alert("Login bem-sucedido!");
            window.location.href = "Memories.html"; // Redireciona para a página principal
        } catch (err) {
            errorMsg.innerText = "Usuário ou senha incorretos!";
        }
    }

    showLoginScreen();
});

