// =========================================================
// MABIJUFIT — APLICAÇÃO PRINCIPAL
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
});


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

    const message =
        document.getElementById("loginMessage");


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

        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
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


        showLoginMessage(
    "Login realizado com sucesso."
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
// SESSÃO EXISTENTE
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
// MENSAGENS
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
// NAVEGAÇÃO ENTRE LOGIN E APLICAÇÃO
// =========================================================

function showAppScreen(user) {

    const loginScreen =
        document.getElementById("loginScreen");

    const appScreen =
        document.getElementById("appScreen");

    const userName =
        document.getElementById("userName");


    if (loginScreen) {
        loginScreen.hidden = true;
    }


    if (appScreen) {
        appScreen.hidden = false;
    }


    if (userName) {

        const name =
            user?.user_metadata?.full_name;

        userName.textContent =
            name || "MabijuFit";
    }
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
        async () => {

            const { error } =
                await supabaseClient.auth.signOut();


            if (error) {

                console.error(
                    "Erro ao sair:",
                    error
                );

                return;
            }


            window.location.reload();
        }
    );
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
