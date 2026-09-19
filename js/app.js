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

    setupNavigation();

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
// MOSTRAR APLICAÇÃO
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

        loginScreen.style.display = "none";
    }


    if (appScreen) {

        appScreen.hidden = false;

        appScreen.style.display = "block";
    }


    if (userName) {

        const fullName =
            user?.user_metadata?.full_name;

        userName.textContent =
            fullName || "MabijuFit";
    }


    showSection("home");
}


// =========================================================
// NAVEGAÇÃO
// =========================================================

function setupNavigation() {

    const navigationButtons =
        document.querySelectorAll(
            "[data-section]"
        );


    navigationButtons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    const section =
                        button.dataset.section;

                    showSection(section);
                }
            );

        }
    );
}


function showSection(sectionName) {

    const sections = {

        home:
            document.getElementById(
                "homeScreen"
            ),

        products:
            document.getElementById(
                "productsScreen"
            ),

        stock:
            document.getElementById(
                "stockScreen"
            ),

        sales:
            document.getElementById(
                "salesScreen"
            ),

        finance:
            document.getElementById(
                "financeScreen"
            )
    };


    // Esconde todas as telas

    Object.values(sections).forEach(
        (section) => {

            if (!section) {
                return;
            }

            section.hidden = true;

            section.style.display = "none";
        }
    );


    // Mostra a tela escolhida

    const selectedSection =
        sections[sectionName];


    if (selectedSection) {

        selectedSection.hidden = false;

        selectedSection.style.display = "block";
    }


    // Atualiza o menu inferior

    const navigationButtons =
        document.querySelectorAll(
            ".nav-item"
        );


    navigationButtons.forEach(
        (button) => {

            const isActive =
                button.dataset.section === sectionName;

            button.classList.toggle(
                "active",
                isActive
            );

        }
    );
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
