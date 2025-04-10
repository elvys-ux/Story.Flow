document.addEventListener("DOMContentLoaded", function () {
    const loginContainer = document.getElementById("login-container");

    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

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

    function showRegisterScreen(event) {
        if (event) event.preventDefault();
        loginContainer.innerHTML = `
            <h2>Criar Conta</h2>
            <p>Preencha os campos abaixo para continuar</p>
            <p id="error-msg" class="error"></p>
            <input type="text" id="username" placeholder="Nome de usuário">
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
        const username = document.getElementById("username").value.trim().toLowerCase();
        const email = document.getElementById("register-email").value.trim().toLowerCase();
        const password = document.getElementById("register-password").value.trim();
        const confirmPassword = document.getElementById("confirm-password").value.trim();
        const errorMsg = document.getElementById("error-msg");

        if (!username || !email || !password || !confirmPassword) {
            errorMsg.innerText = "Todos os campos devem ser preenchidos!";
            return;
        }

        if (!isValidEmail(email)) {
            errorMsg.innerText = "Por favor, insira um e-mail válido!";
            return;
        }

        if (password.length <= 5) {
            errorMsg.innerText = "A senha deve ter mais de 5 caracteres!";
            return;
        }

        if (password === username) {
            errorMsg.innerText = "A senha não pode ser igual ao nome do usuário!";
            return;
        }

        if (password !== confirmPassword) {
            errorMsg.innerText = "As senhas não coincidem!";
            return;
        }

        try {
            // Cria a conta via Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password
            });

            if (error) {
                errorMsg.innerText = error.message || "Erro ao criar conta!";
                return;
            }

            // Insere o perfil na tabela "profiles"
            if (data.user) {
                const { error: profileError } = await supabase
                    .from("profiles")
                    .insert([{ id: data.user.id, username: username }]);

                if (profileError) {
                    errorMsg.innerText = "Conta criada, mas erro ao salvar perfil: " + profileError.message;
                    return;
                }
            }

            alert("Conta criada com sucesso! Verifique seu e-mail para ativar sua conta, se necessário.");
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
            errorMsg.innerText = "Por favor, insira um nome de usuário/e-mail e uma senha!";
            return;
        }

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: identifier,
                password: password
            });

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

    showLoginScreen();
});
