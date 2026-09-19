// =========================================================
// MABIJUFIT — APLICAÇÃO PRINCIPAL
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
});


// =========================================================
// INICIALIZAÇÃO
// =========================================================

async function initializeApp() {

    console.log("MabijuFit inicializada.");

    registerServiceWorker();

    setupLoginForm();

    setupLogout();

    await checkExistingSession();
}


// =========================================================
// LOGIN
// =========================================================

function setupLoginForm() {

    const form =
        document.getElementById("loginForm");

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        handleLogin
    );
}


async function handleLogin(event) {

    event.preventDefault();

    const form = event.currentTarget;

    const email =
        form.email.value.trim();

    const password =
        form.password.value;

    const button =
        document.getElementById("loginButton");


    if (!email || !password) {

        showLoginMessage(
            "Preencha e-mail e senha."
        );

        return;
    }


    button.disabled = true;

    button.textContent = "Entrando...";

    showLoginMessage("");


    try {

        const {
            data,
            error
        } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });


        if (error) {

            console.error(
                "Erro no login:",
                error
            );

            showLoginMessage(
                getLoginErrorMessage(error)
            );

            return;
        }


        console.log(
            "Login realizado:",
            data.user
        );


        showAppScreen(data.user);

    } catch (error) {

        console.error(
            "Erro inesperado no login:",
            error
        );

        showLoginMessage(
            "Não foi possível realizar o login."
        );

    } finally {

        button.disabled = false;

        button.textContent = "Entrar";
    }
}


// =========================================================
// VERIFICAR SESSÃO EXISTENTE
// =========================================================

async function checkExistingSession() {

    try {

        const {
            data,
            error
        } = await supabaseClient.auth.getSession();


        if (error) {

            console.error(
                "Erro ao verificar sessão:",
                error
            );

            return;
        }


        if (data.session) {

            console.log(
                "Usuário já autenticado:",
                data.session.user
            );

            showAppScreen(
                data.session.user
            );

        }

    } catch (error) {

        console.error(
            "Erro ao verificar sessão:",
            error
        );
    }
}


// =========================================================
// NAVEGAÇÃO ENTRE LOGIN E APLICAÇÃO
// =========================================================

function showAppScreen(user) {

    const loginScreen =
        document.getElementById("loginScreen");

    const appScreen =
        document.getElementById("appScreen");

    const userName =
        document.getElementById("userName");


    // Esconde completamente o login
    if (loginScreen) {

        loginScreen.hidden = true;

        loginScreen.style.display = "none";
    }


    // Mostra o aplicativo
    if (appScreen) {

        appScreen.hidden = false;

        appScreen.style.display = "block";
    }


    // Nome do usuário
    if (userName) {

        const fullName =
            user?.user_metadata?.full_name;

        userName.textContent =
            fullName || "MabijuFit";
    }
}


// =========================================================
// MENSAGENS DE LOGIN
// =========================================================

function showLoginMessage(message) {

    const element =
        document.getElementById("loginMessage");

    if (!element) {
        return;
    }

    element.textContent = message;
}


function getLoginErrorMessage(error) {

    if (
        error &&
        error.message === "Invalid login credentials"
    ) {

        return "E-mail ou senha incorretos.";
    }


    if (
        error &&
        error.message
    ) {

        return error.message;
    }


    return "Não foi possível realizar o login.";
}


// =========================================================
// LOGOUT
// =========================================================

function setupLogout() {

    const button =
        document.getElementById("logoutButton");

    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        handleLogout
    );
}


async function handleLogout() {

    try {

        const {
            error
        } = await supabaseClient.auth.signOut();


        if (error) {

            console.error(
                "Erro ao sair:",
                error
            );

            return;
        }


        // Volta para a tela de login
        const loginScreen =
            document.getElementById("loginScreen");

        const appScreen =
            document.getElementById("appScreen");


        if (appScreen) {

            appScreen.hidden = true;

            appScreen.style.display = "none";
        }


        if (loginScreen) {

            loginScreen.hidden = false;

            loginScreen.style.display = "flex";
        }


        const form =
            document.getElementById("loginForm");

        if (form) {
            form.reset();
        }


        showLoginMessage("");


    } catch (error) {

        console.error(
            "Erro inesperado ao sair:",
            error
        );
    }
}


// =========================================================
// SERVICE WORKER
// =========================================================

function registerServiceWorker() {

    if (!("serviceWorker" in navigator)) {

        console.log(
            "Service Worker não é suportado neste navegador."
        );

        return;
    }


    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register("./service-worker.js")

            .then((registration) => {

                console.log(
                    "Service Worker registrado:",
                    registration.scope
                );

            })

            .catch((error) => {

                console.error(
                    "Erro ao registrar Service Worker:",
                    error
                );

            });

    });
}
