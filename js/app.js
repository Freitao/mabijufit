// =========================================================
// MABIJUFIT — APLICAÇÃO PRINCIPAL.
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
});


async function initializeApp() {
    console.log("MabijuFit inicializada.");

    setupStartButton();
    registerServiceWorker();

    await testSupabaseConnection();
}


// =========================================================
// TESTE SUPABASE
// =========================================================

async function testSupabaseConnection() {

    if (!window.supabase) {
        console.error(
            "Biblioteca Supabase não carregada."
        );

        return;
    }

    if (!supabaseClient) {
        console.error(
            "Cliente Supabase não inicializado."
        );

        return;
    }

    const { data, error } =
        await supabaseClient
            .from("categories")
            .select("id")
            .limit(1);

    if (error) {

        console.error(
            "Erro ao conectar ao Supabase:",
            error
        );

        return;
    }

    console.log(
        "Supabase conectado com sucesso.",
        data
    );
}


// =========================================================
// BOTÃO INICIAL
// =========================================================

function setupStartButton() {

    const button =
        document.getElementById("startButton");

    if (!button) {
        return;
    }

    button.addEventListener("click", () => {

        alert(
            "Supabase conectado. A MabijuFit está pronta para começar."
        );

    });
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
