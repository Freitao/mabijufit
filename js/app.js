// =========================================================
// MABIJUFIT — APLICAÇÃO PRINCIPAL
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
});


function initializeApp() {
    console.log("MabijuFit inicializada.");

    setupStartButton();
    registerServiceWorker();
}


function setupStartButton() {
    const button = document.getElementById("startButton");

    if (!button) {
        return;
    }

    button.addEventListener("click", () => {
        alert("A MabijuFit está sendo preparada.");
    });
}


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
