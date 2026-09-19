/* =========================================================
   MABIJUFIT — APP PRINCIPAL
   ========================================================= */

"use strict";

/* =========================================================
   ESTADO
   ========================================================= */

const state = {
    user: null,

    categories: [],
    colors: [],
    sizes: [],
    products: [],
    variants: [],
    sales: [],
    financialTransactions: [],

    saleItems: []
};

/* =========================================================
   UTILITÁRIOS
   ========================================================= */

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatCurrency(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleDateString("pt-BR");
}

function formatDateTime(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString("pt-BR");
}

function normalizeHexColor(value) {
    if (!value) {
        return "#000000";
    }

    let hex = String(value).trim();

    if (!hex.startsWith("#")) {
        hex = `#${hex}`;
    }

    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        return hex.toUpperCase();
    }

    return "#000000";
}

function showElement(id) {
    const element = $(id);

    if (element) {
        element.hidden = false;
    }
}

function hideElement(id) {
    const element = $(id);

    if (element) {
        element.hidden = true;
    }
}

function setMessage(id, message, type = "") {
    const element = $(id);

    if (!element) {
        return;
    }

    element.textContent = message || "";
    element.className = "form-message";

    if (type) {
        element.classList.add(type);
    }
}

function translateDatabaseError(error) {
    if (!error) {
        return "Ocorreu um erro inesperado.";
    }

    const message = error.message || String(error);

    if (
        message.includes("duplicate key") ||
        message.includes("unique constraint")
    ) {
        return "Este registro já existe.";
    }

    if (
        message.includes("row-level security") ||
        message.includes("violates row-level security")
    ) {
        return "Você não possui permissão para realizar esta operação.";
    }

    if (message.includes("foreign key")) {
        return "Este registro está sendo utilizado por outro registro.";
    }

    if (
        message.includes("not-null") ||
        message.includes("null value")
    ) {
        return "Preencha todos os campos obrigatórios.";
    }

    return message;
}

/* =========================================================
   AUTENTICAÇÃO
   ========================================================= */

async function checkSession() {
    try {
        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            throw error;
        }

        if (session?.user) {
            state.user = session.user;

            hideElement("loginScreen");
            showElement("appScreen");

            await initializeApp();
        } else {
            state.user = null;

            showElement("loginScreen");
            hideElement("appScreen");
        }
    } catch (error) {
        console.error(
            "Erro ao verificar sessão:",
            error
        );

        state.user = null;

        showElement("loginScreen");
        hideElement("appScreen");
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const email = $("email")?.value.trim();
    const password = $("password")?.value;

    if (!email || !password) {
        setMessage(
            "loginMessage",
            "Informe o e-mail e a senha.",
            "error"
        );

        return;
    }

    const button = $("loginButton");

    if (button) {
        button.disabled = true;
        button.textContent = "Entrando...";
    }

    setMessage(
        "loginMessage",
        "Autenticando..."
    );

    try {
        const {
            data,
            error
        } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        state.user = data.user;

        setMessage(
            "loginMessage",
            ""
        );

        hideElement("loginScreen");
        showElement("appScreen");

        await initializeApp();
    } catch (error) {
        console.error(
            "Erro no login:",
            error
        );

        setMessage(
            "loginMessage",
            translateAuthError(error),
            "error"
        );
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Entrar";
        }
    }
}

function translateAuthError(error) {
    if (!error) {
        return "Não foi possível entrar.";
    }

    const message = (
        error.message ||
        ""
    ).toLowerCase();

    if (
        message.includes("invalid login credentials")
    ) {
        return "E-mail ou senha incorretos.";
    }

    if (
        message.includes("email not confirmed")
    ) {
        return "O e-mail da conta ainda não foi confirmado.";
    }

    if (
        message.includes("too many requests")
    ) {
        return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    }

    return error.message ||
        "Não foi possível realizar o login.";
}

async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();
    } catch (error) {
        console.error(
            "Erro ao sair:",
            error
        );
    }

    state.user = null;

    hideElement("appScreen");
    showElement("loginScreen");
}

/* =========================================================
   NAVEGAÇÃO
   ========================================================= */

function showSection(sectionName) {
    const mapping = {
        home: "homeScreen",
        products: "productsScreen",
        stock: "stockScreen",
        sales: "salesScreen",
        finance: "financeScreen"
    };

    const targetId = mapping[sectionName];

    if (!targetId) {
        return;
    }

    document
        .querySelectorAll(".module-screen")
        .forEach((section) => {
            section.hidden = true;
        });

    const target = $(targetId);

    if (target) {
        target.hidden = false;
    }

    document
        .querySelectorAll("[data-section]")
        .forEach((button) => {
            button.classList.toggle(
                "active",
                button.dataset.section === sectionName
            );
        });
}

function setupNavigation() {
    document
        .querySelectorAll("[data-section]")
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    showSection(
                        button.dataset.section
                    );
                }
            );
        });
}

/* =========================================================
   MODAIS
   ========================================================= */

function openModal(id) {
    const modal = $(id);

    if (!modal) {
        return;
    }

    modal.hidden = false;

    if (id === "productModal") {
        resetProductForm();
    }

    if (id === "categoryModal") {
        resetCategoryForm();
    }

    if (id === "colorModal") {
        resetColorForm();
    }

    if (id === "sizeModal") {
        resetSizeForm();
    }

    if (id === "saleModal") {
        resetSaleForm();
    }

    if (id === "transactionModal") {
        resetTransactionForm();
    }
}

function closeModal(id) {
    const modal = $(id);

    if (modal) {
        modal.hidden = true;
    }
}

function setupModalCloseButtons() {
    document
        .querySelectorAll("[data-close-modal]")
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    closeModal(
                        button.dataset.closeModal
                    );
                }
            );
        });

    document
        .querySelectorAll(".modal-overlay")
        .forEach((overlay) => {
            overlay.addEventListener(
                "click",
                () => {
                    const modal =
                        overlay.closest(".modal");

                    if (modal) {
                        modal.hidden = true;
                    }
                }
            );
        });
}

/* =========================================================
   CATEGORIAS
   ========================================================= */

async function loadCategories() {
    if (!state.user) {
        return;
    }

    const {
        data,
        error
    } = await supabaseClient
        .from("categories")
        .select("*")
        .eq("user_id", state.user.id)
        .order("name");

    if (error) {
        console.error(
            "Erro ao carregar categorias:",
            error
        );

        return;
    }

    state.categories = data || [];

    renderCategories();
    populateCategorySelect();
}

function renderCategories() {
    const container = $("categoriesList");

    if (!container) {
        return;
    }

    if (!state.categories.length) {
        container.innerHTML = `
            <div class="empty-state">
                <strong>
                    Nenhuma categoria cadastrada
                </strong>

                <p>
                    Crie categorias para organizar seus produtos.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        state.categories
            .map((category) => {
                return `
                    <div class="category-card">

                        <div class="category-card-info">

                            <div class="category-card-name">
                                ${escapeHtml(
                                    category.name
                                )}
                            </div>

                            ${
                                category.description
                                    ? `
                                        <div class="category-card-description">
                                            ${escapeHtml(
                                                category.description
                                            )}
                                        </div>
                                    `
                                    : ""
                            }

                        </div>

                        <div class="category-card-actions">

                            <button
                                type="button"
                                class="icon-button"
                                data-edit-category="${category.id}"
                                title="Editar"
                            >
                                ✎
                            </button>

                            <button
                                type="button"
                                class="icon-button"
                                data-delete-category="${category.id}"
                                title="Excluir"
                            >
                                ×
                            </button>

                        </div>

                    </div>
                `;
            })
            .join("");

    container
        .querySelectorAll(
            "[data-edit-category]"
        )
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    editCategory(
                        button.dataset.editCategory
                    );
                }
            );
        });

    container
        .querySelectorAll(
            "[data-delete-category]"
        )
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    deleteCategory(
                        button.dataset.deleteCategory
                    );
                }
            );
        });
}

function populateCategorySelect() {
    const select = $("productCategory");

    if (!select) {
        return;
    }

    const currentValue = select.value;

    select.innerHTML = `
        <option value="">
            Selecione
        </option>

        ${state.categories
            .filter(
                (category) =>
                    category.is_active !== false
            )
            .map(
                (category) => `
                    <option value="${category.id}">
                        ${escapeHtml(
                            category.name
                        )}
                    </option>
                `
            )
            .join("")}
    `;

    if (currentValue) {
        select.value = currentValue;
    }
}

function resetCategoryForm() {
    const form = $("categoryForm");

    if (form) {
        form.reset();
    }

    if ($("categoryId")) {
        $("categoryId").value = "";
    }

    if ($("categoryActive")) {
        $("categoryActive").checked = true;
    }

    setMessage(
        "categoryFormMessage",
        ""
    );
}

function editCategory(id) {
    const category =
        state.categories.find(
            (item) => item.id === id
        );

    if (!category) {
        return;
    }

    openModal("categoryModal");

    $("categoryName").value =
        category.name || "";

    $("categoryDescription").value =
        category.description || "";

    if ($("categoryId")) {
        $("categoryId").value =
            category.id;
    }

    $("categoryActive").checked =
        category.is_active !== false;
}

async function handleCategorySubmit(event) {
    event.preventDefault();

    if (!state.user) {
        return;
    }

    const name =
        $("categoryName")?.value.trim();

    const description =
        $("categoryDescription")
            ?.value.trim() || "";

    const isActive =
        $("categoryActive")
            ?.checked !== false;

    if (!name) {
        setMessage(
            "categoryFormMessage",
            "Informe o nome da categoria.",
            "error"
        );

        return;
    }

    const id =
        $("categoryId")?.value || "";

    try {
        setMessage(
            "categoryFormMessage",
            "Salvando..."
        );

        let result;

        const payload = {
            name,
            description,
            is_active: isActive
        };

        if (id) {
            result =
                await supabaseClient
                    .from("categories")
                    .update(payload)
                    .eq("id", id)
                    .eq(
                        "user_id",
                        state.user.id
                    );
        } else {
            result =
                await supabaseClient
                    .from("categories")
                    .insert({
                        ...payload,
                        user_id:
                            state.user.id
                    });
        }

        if (result.error) {
            throw result.error;
        }

        await loadCategories();

        setMessage(
            "categoryFormMessage",
            "Categoria salva.",
            "success"
        );

        setTimeout(
            () =>
                closeModal(
                    "categoryModal"
                ),
            500
        );
    } catch (error) {
        console.error(error);

        setMessage(
            "categoryFormMessage",
            translateDatabaseError(error),
            "error"
        );
    }
}

async function deleteCategory(id) {
    const category =
        state.categories.find(
            (item) => item.id === id
        );

    if (!category) {
        return;
    }

    if (
        !confirm(
            `Excluir a categoria "${category.name}"?`
        )
    ) {
        return;
    }

    try {
        const { error } =
            await supabaseClient
                .from("categories")
                .delete()
                .eq("id", id)
                .eq(
                    "user_id",
                    state.user.id
                );

        if (error) {
            throw error;
        }

        await loadCategories();
    } catch (error) {
        console.error(error);

        alert(
            translateDatabaseError(error)
        );
    }
}

/* =========================================================
   CORES
   ========================================================= */

async function loadColors() {
    if (!state.user) {
        return;
    }

    const {
        data,
        error
    } = await supabaseClient
        .from("colors")
        .select("*")
        .eq("user_id", state.user.id)
        .order("name");

    if (error) {
        console.error(
            "Erro ao carregar cores:",
            error
        );

        return;
    }

    state.colors = data || [];

    renderColors();
}

function renderColors() {
    const container = $("colorsList");

    if (!container) {
        return;
    }

    if (!state.colors.length) {
        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    C
                </div>

                <strong>
                    Nenhuma cor cadastrada
                </strong>

                <p>
                    Cadastre as cores utilizadas nos produtos.
                </p>

            </div>
        `;

        return;
    }

    container.innerHTML =
        state.colors
            .map((color) => {
                const hex =
                    normalizeHexColor(
                        color.hex_code
                    );

                return `
                    <div class="color-card">

                        <div class="color-card-info">

                            <div
                                class="color-card-swatch"
                                style="background-color:${hex}"
                            ></div>

                            <div class="color-card-text">

                                <div class="color-card-name">
                                    ${escapeHtml(
                                        color.name
                                    )}
                                </div>

                                <div class="color-card-code">
                                    ${escapeHtml(
                                        hex
                                    )}
                                </div>

                            </div>

                        </div>

                        <div class="color-card-actions">

                            <button
                                type="button"
                                class="icon-button"
                                data-edit-color="${color.id}"
                                title="Editar"
                            >
                                ✎
                            </button>

                            <button
                                type="button"
                                class="icon-button"
                                data-delete-color="${color.id}"
                                title="Excluir"
                            >
                                ×
                            </button>

                        </div>

                    </div>
                `;
            })
            .join("");

    container
        .querySelectorAll(
            "[data-edit-color]"
        )
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    editColor(
                        button.dataset.editColor
                    );
                }
            );
        });

    container
        .querySelectorAll(
            "[data-delete-color]"
        )
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    deleteColor(
                        button.dataset.deleteColor
                    );
                }
            );
        });
}

function resetColorForm() {
    const form = $("colorForm");

    if (form) {
        form.reset();
    }

    if ($("colorId")) {
        $("colorId").value = "";
    }

    if ($("colorName")) {
        $("colorName").value = "";
    }

    if ($("colorHex")) {
        $("colorHex").value = "#D96B8A";
    }

    if ($("colorHexText")) {
        $("colorHexText").value =
            "#D96B8A";
    }

    if ($("colorPreview")) {
        $("colorPreview").style.backgroundColor =
            "#D96B8A";
    }

    if ($("colorActive")) {
        $("colorActive").checked = true;
    }

    setMessage(
        "colorFormMessage",
        ""
    );
}

function updateColorPreview() {
    const picker = $("colorHex");
    const text = $("colorHexText");
    const preview = $("colorPreview");

    if (!picker) {
        return;
    }

    const hex =
        normalizeHexColor(
            picker.value
        );

    if (text) {
        text.value = hex;
    }

    if (preview) {
        preview.style.backgroundColor =
            hex;
    }
}

function updateColorFromText() {
    const picker = $("colorHex");
    const text = $("colorHexText");
    const preview = $("colorPreview");

    if (!text) {
        return;
    }

    let value =
        text.value.trim();

    if (!value.startsWith("#")) {
        value = `#${value}`;
    }

    if (
        !/^#[0-9a-fA-F]{6}$/.test(
            value
        )
    ) {
        return;
    }

    value = value.toUpperCase();

    if (picker) {
        picker.value = value;
    }

    text.value = value;

    if (preview) {
        preview.style.backgroundColor =
            value;
    }
}

function editColor(id) {
    const color =
        state.colors.find(
            (item) => item.id === id
        );

    if (!color) {
        return;
    }

    openModal("colorModal");

    const hex =
        normalizeHexColor(
            color.hex_code
        );

    if ($("colorId")) {
        $("colorId").value =
            color.id;
    }

    if ($("colorName")) {
        $("colorName").value =
            color.name || "";
    }

    if ($("colorHex")) {
        $("colorHex").value =
            hex;
    }

    if ($("colorHexText")) {
        $("colorHexText").value =
            hex;
    }

    if ($("colorPreview")) {
        $("colorPreview").style.backgroundColor =
            hex;
    }

    if ($("colorActive")) {
        $("colorActive").checked =
            color.is_active !== false;
    }
}

async function handleColorSubmit(event) {
    event.preventDefault();

    if (!state.user) {
        return;
    }

    const name =
        $("colorName")?.value.trim();

    const hex =
        normalizeHexColor(
            $("colorHexText")?.value ||
            $("colorHex")?.value
        );

    const isActive =
        $("colorActive")
            ?.checked !== false;

    if (!name) {
        setMessage(
            "colorFormMessage",
            "Informe o nome da cor.",
            "error"
        );

        return;
    }

    const id =
        $("colorId")?.value || "";

    try {
        setMessage(
            "colorFormMessage",
            "Salvando..."
        );

        const payload = {
            name,
            hex_code: hex,
            is_active: isActive
        };

        let result;

        if (id) {
            result =
                await supabaseClient
                    .from("colors")
                    .update(payload)
                    .eq("id", id)
                    .eq(
                        "user_id",
                        state.user.id
                    );
        } else {
            result =
                await supabaseClient
                    .from("colors")
                    .insert({
                        ...payload,
                        user_id:
                            state.user.id
                    });
        }

        if (result.error) {
            throw result.error;
        }

        await loadColors();

        setMessage(
            "colorFormMessage",
            "Cor salva.",
            "success"
        );

        setTimeout(
            () =>
                closeModal(
                    "colorModal"
                ),
            500
        );
    } catch (error) {
        console.error(error);

        setMessage(
            "colorFormMessage",
            translateDatabaseError(error),
            "error"
        );
    }
}

async function deleteColor(id) {
    const color =
        state.colors.find(
            (item) => item.id === id
        );

    if (!color) {
        return;
    }

    if (
        !confirm(
            `Excluir a cor "${color.name}"?`
        )
    ) {
        return;
    }

    try {
        const { error } =
            await supabaseClient
                .from("colors")
                .delete()
                .eq("id", id)
                .eq(
                    "user_id",
                    state.user.id
                );

        if (error) {
            throw error;
        }

        await loadColors();
    } catch (error) {
        console.error(error);

        alert(
            translateDatabaseError(error)
        );
    }
}

/* =========================================================
   TAMANHOS
   ========================================================= */

async function loadSizes() {
    if (!state.user) {
        return;
    }

    const {
        data,
        error
    } = await supabaseClient
        .from("sizes")
        .select("*")
        .eq("user_id", state.user.id)
        .order("display_order", {
            ascending: true
        })
        .order("name", {
            ascending: true
        });

    if (error) {
        console.error(
            "Erro ao carregar tamanhos:",
            error
        );

        return;
    }

    state.sizes = data || [];

    renderSizes();
}

function renderSizes() {
    const container = $("sizesList");

    if (!container) {
        return;
    }

    if (!state.sizes.length) {
        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    T
                </div>

                <strong>
                    Nenhum tamanho cadastrado
                </strong>

                <p>
                    Cadastre os tamanhos utilizados nos produtos.
                </p>

            </div>
        `;

        return;
    }

    container.innerHTML =
        state.sizes
            .map((size) => {
                return `
                    <div class="size-card">

                        <div class="size-card-info">

                            <div class="size-badge">
                                ${escapeHtml(
                                    size.name
                                )}
                            </div>

                            <div>

                                <div class="size-card-name">
                                    Tamanho ${escapeHtml(
                                        size.name
                                    )}
                                </div>

                                <div class="size-card-order">
                                    Ordem:
                                    ${Number(
                                        size.display_order ||
                                            0
                                    )}
                                </div>

                            </div>

                        </div>

                        <div class="size-card-actions">

                            <button
                                type="button"
                                class="icon-button"
                                data-edit-size="${size.id}"
                                title="Editar"
                            >
                                ✎
                            </button>

                            <button
                                type="button"
                                class="icon-button"
                                data-delete-size="${size.id}"
                                title="Excluir"
                            >
                                ×
                            </button>

                        </div>

                    </div>
                `;
            })
            .join("");

    container
        .querySelectorAll(
            "[data-edit-size]"
        )
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    editSize(
                        button.dataset.editSize
                    );
                }
            );
        });

    container
        .querySelectorAll(
            "[data-delete-size]"
        )
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    deleteSize(
                        button.dataset.deleteSize
                    );
                }
            );
        });
}

function resetSizeForm() {
    const form = $("sizeForm");

    if (form) {
        form.reset();
    }

    if ($("sizeId")) {
        $("sizeId").value = "";
    }

    if ($("sizeDisplayOrder")) {
        $("sizeDisplayOrder").value = "0";
    }

    if ($("sizeActive")) {
        $("sizeActive").checked = true;
    }

    setMessage(
        "sizeFormMessage",
        ""
    );
}

function editSize(id) {
    const size =
        state.sizes.find(
            (item) => item.id === id
        );

    if (!size) {
        return;
    }

    openModal("sizeModal");

    if ($("sizeId")) {
        $("sizeId").value =
            size.id;
    }

    if ($("sizeName")) {
        $("sizeName").value =
            size.name || "";
    }

    if ($("sizeDisplayOrder")) {
        $("sizeDisplayOrder").value =
            size.display_order || 0;
    }

    if ($("sizeActive")) {
        $("sizeActive").checked =
            size.is_active !== false;
    }
}

async function handleSizeSubmit(event) {
    event.preventDefault();

    if (!state.user) {
        return;
    }

    const name =
        $("sizeName")?.value.trim();

    const displayOrder =
        Number(
            $("sizeDisplayOrder")
                ?.value || 0
        );

    const isActive =
        $("sizeActive")
            ?.checked !== false;

    if (!name) {
        setMessage(
            "sizeFormMessage",
            "Informe o tamanho.",
            "error"
        );

        return;
    }

    const id =
        $("sizeId")?.value || "";

    try {
        setMessage(
            "sizeFormMessage",
            "Salvando..."
        );

        const payload = {
            name,
            display_order:
                displayOrder,
            is_active: isActive
        };

        let result;

        if (id) {
            result =
                await supabaseClient
                    .from("sizes")
                    .update(payload)
                    .eq("id", id)
                    .eq(
                        "user_id",
                        state.user.id
                    );
        } else {
            result =
                await supabaseClient
                    .from("sizes")
                    .insert({
                        ...payload,
                        user_id:
                            state.user.id
                    });
        }

        if (result.error) {
            throw result.error;
        }

        await loadSizes();

        setMessage(
            "sizeFormMessage",
            "Tamanho salvo.",
            "success"
        );

        setTimeout(
            () =>
                closeModal(
                    "sizeModal"
                ),
            500
        );
    } catch (error) {
        console.error(error);

        setMessage(
            "sizeFormMessage",
            translateDatabaseError(error),
            "error"
        );
    }
}

async function deleteSize(id) {
    const size =
        state.sizes.find(
            (item) => item.id === id
        );

    if (!size) {
        return;
    }

    if (
        !confirm(
            `Excluir o tamanho "${size.name}"?`
        )
    ) {
        return;
    }

    try {
        const { error } =
            await supabaseClient
                .from("sizes")
                .delete()
                .eq("id", id)
                .eq(
                    "user_id",
                    state.user.id
                );

        if (error) {
            throw error;
        }

        await loadSizes();
    } catch (error) {
        console.error(error);

        alert(
            translateDatabaseError(error)
        );
    }
}

/* =========================================================
   PRODUTOS
   ========================================================= */

async function loadProducts() {
    if (!state.user) {
        return;
    }

    const {
        data,
        error
    } = await supabaseClient
        .from("products")
        .select(`
            *,
            categories (
                id,
                name
            )
        `)
        .eq("user_id", state.user.id)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error(
            "Erro ao carregar produtos:",
            error
        );

        return;
    }

    state.products = data || [];

    renderProducts();
}

function renderProducts() {
    const container = $("productsList");

    if (!container) {
        return;
    }

    if (!state.products.length) {
        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    P
                </div>

                <strong>
                    Nenhum produto cadastrado
                </strong>

                <p>
                    Cadastre seu primeiro produto
                    para começar a controlar o estoque.
                </p>

            </div>
        `;

        return;
    }

    container.innerHTML =
        state.products
            .map((product) => {
                return `
                    <div class="product-card">

                        <div class="product-card-top">

                            <div>

                                <div class="product-card-name">
                                    ${escapeHtml(
                                        product.name
                                    )}
                                </div>

                                <div class="product-card-category">
                                    ${
                                        product.categories
                                            ?.name
                                            ? escapeHtml(
                                                  product
                                                      .categories
                                                      .name
                                              )
                                            : "Sem categoria"
                                    }
                                </div>

                            </div>

                            <div class="product-card-price">
                                ${formatCurrency(
                                    product.sale_price
                                )}
                            </div>

                        </div>

                        <div class="product-card-meta">

                            ${
                                product.sku
                                    ? `
                                        <span class="product-meta-badge">
                                            SKU:
                                            ${escapeHtml(
                                                product.sku
                                            )}
                                        </span>
                                    `
                                    : ""
                            }

                            <span class="product-meta-badge">
                                Custo:
                                ${formatCurrency(
                                    product.cost_price
                                )}
                            </span>

                            <span class="product-meta-badge">
                                Estoque mínimo:
                                ${Number(
                                    product.minimum_stock ||
                                        0
                                )}
                            </span>

                        </div>

                    </div>
                `;
            })
            .join("");
}

function resetProductForm() {
    const form = $("productForm");

    if (form) {
        form.reset();
    }

    if ($("productActive")) {
        $("productActive").checked =
            true;
    }

    setMessage(
        "productFormMessage",
        ""
    );

    populateCategorySelect();
}

async function handleProductSubmit(event) {
    event.preventDefault();

    if (!state.user) {
        return;
    }

    const name =
        $("productName")?.value.trim();

    const sku =
        $("productSku")
            ?.value.trim() || "";

    const description =
        $("productDescription")
            ?.value.trim() || "";

    const categoryId =
        $("productCategory")
            ?.value || null;

    const costPrice =
        Number(
            $("productCostPrice")
                ?.value || 0
        );

    const salePrice =
        Number(
            $("productSalePrice")
                ?.value || 0
        );

    const minimumStock =
        Number(
            $("productMinimumStock")
                ?.value || 0
        );

    const isActive =
        $("productActive")
            ?.checked !== false;

    if (!name) {
        setMessage(
            "productFormMessage",
            "Informe o nome do produto.",
            "error"
        );

        return;
    }

    if (salePrice < 0) {
        setMessage(
            "productFormMessage",
            "Informe um preço de venda válido.",
            "error"
        );

        return;
    }

    try {
        setMessage(
            "productFormMessage",
            "Salvando..."
        );

        const { error } =
            await supabaseClient
                .from("products")
                .insert({
                    user_id:
                        state.user.id,
                    category_id:
                        categoryId,
                    name,
                    sku,
                    description,
                    cost_price:
                        costPrice,
                    sale_price:
                        salePrice,
                    minimum_stock:
                        minimumStock,
                    is_active:
                        isActive
                });

        if (error) {
            throw error;
        }

        await loadProducts();
        await loadDashboard();

        setMessage(
            "productFormMessage",
            "Produto salvo.",
            "success"
        );

        setTimeout(
            () =>
                closeModal(
                    "productModal"
                ),
            500
        );
    } catch (error) {
        console.error(error);

        setMessage(
            "productFormMessage",
            translateDatabaseError(error),
            "error"
        );
    }
}

/* =========================================================
   ESTOQUE
   ========================================================= */

async function loadStock() {
    if (!state.user) {
        return;
    }

    const container =
        $("stockList");

    const {
        data,
        error
    } = await supabaseClient
        .from("product_variants")
        .select(`
            *,
            products (
                id,
                name
            ),
            colors (
                id,
                name,
                hex_code
            ),
            sizes (
                id,
                name
            )
        `)
        .eq("user_id", state.user.id)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error(
            "Erro ao carregar estoque:",
            error
        );

        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    Não foi possível carregar o estoque.
                </div>
            `;
        }

        return;
    }

    state.variants = data || [];

    renderStock();
}

function renderStock() {
    const container =
        $("stockList");

    if (!container) {
        return;
    }

    if (!state.variants.length) {
        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    E
                </div>

                <strong>
                    Estoque vazio
                </strong>

                <p>
                    As variações dos produtos aparecerão aqui.
                </p>

            </div>
        `;

        updateStockMetrics([]);

        return;
    }

    container.innerHTML =
        state.variants
            .map((variant) => {
                const quantity =
                    Number(
                        variant.stock_quantity ||
                            0
                    );

                const minimum =
                    Number(
                        variant.minimum_stock ||
                            0
                    );

                let className = "";

                if (quantity === 0) {
                    className =
                        "out-stock";
                } else if (
                    quantity <= minimum
                ) {
                    className =
                        "low-stock";
                }

                return `
                    <div class="stock-card ${className}">

                        <div>

                            <strong>
                                ${escapeHtml(
                                    variant
                                        .products
                                        ?.name ||
                                        "Produto"
                                )}
                            </strong>

                            <div class="stock-label">

                                ${
                                    variant
                                        .colors
                                        ?.name
                                        ? escapeHtml(
                                              variant
                                                  .colors
                                                  .name
                                          )
                                        : ""
                                }

                                ${
                                    variant
                                        .sizes
                                        ?.name
                                        ? ` / ${escapeHtml(
                                              variant
                                                  .sizes
                                                  .name
                                          )}`
                                        : ""
                                }

                            </div>

                        </div>

                        <div class="stock-quantity">
                            ${quantity}
                        </div>

                    </div>
                `;
            })
            .join("");

    updateStockMetrics(
        state.variants
    );
}

function updateStockMetrics(variants) {
    const total =
        variants.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.stock_quantity ||
                        0
                ),
            0
        );

    const low =
        variants.filter((item) => {
            const quantity =
                Number(
                    item.stock_quantity ||
                        0
                );

            const minimum =
                Number(
                    item.minimum_stock ||
                        0
                );

            return (
                quantity > 0 &&
                quantity <= minimum
            );
        }).length;

    const zero =
        variants.filter(
            (item) =>
                Number(
                    item.stock_quantity ||
                        0
                ) === 0
        ).length;

    if ($("stockTotal")) {
        $("stockTotal").textContent =
            total;
    }

    if ($("stockLow")) {
        $("stockLow").textContent =
            low;
    }

    if ($("stockZero")) {
        $("stockZero").textContent =
            zero;
    }

    if ($("metricLowStock")) {
        $("metricLowStock").textContent =
            low;
    }
}

/* =========================================================
   VENDAS
   ========================================================= */

function resetSaleForm() {
    const form =
        $("saleForm");

    if (form) {
        form.reset();
    }

    state.saleItems = [];

    renderSaleItems();
    updateSaleTotal();

    setMessage(
        "saleFormMessage",
        ""
    );
}

function renderSaleItems() {
    const container =
        $("saleItems");

    if (!container) {
        return;
    }

    if (!state.saleItems.length) {
        container.innerHTML = `
            <div class="empty-state">

                <strong>
                    Nenhum item
                </strong>

                <p>
                    Adicione produtos à venda.
                </p>

            </div>
        `;

        return;
    }

    container.innerHTML =
        state.saleItems
            .map((item, index) => {
                return `
                    <div class="sale-item">

                        <div class="sale-item-header">

                            <div class="sale-item-name">
                                ${escapeHtml(
                                    item.name
                                )}
                            </div>

                            <button
                                type="button"
                                class="sale-item-remove"
                                data-remove-sale-item="${index}"
                            >
                                Remover
                            </button>

                        </div>

                        <div class="sale-item-meta">
                            Quantidade:
                            ${item.quantity}

                            •
                            ${formatCurrency(
                                item.unit_price
                            )}

                            •
                            ${formatCurrency(
                                item.total
                            )}
                        </div>

                    </div>
                `;
            })
            .join("");

    container
        .querySelectorAll(
            "[data-remove-sale-item]"
        )
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    const index =
                        Number(
                            button.dataset
                                .removeSaleItem
                        );

                    state.saleItems.splice(
                        index,
                        1
                    );

                    renderSaleItems();
                    updateSaleTotal();
                }
            );
        });
}

function updateSaleTotal() {
    const subtotal =
        state.saleItems.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.total || 0
                ),
            0
        );

    const discount =
        Number(
            $("saleDiscount")
                ?.value || 0
        );

    const total =
        Math.max(
            0,
            subtotal - discount
        );

    if ($("saleTotal")) {
        $("saleTotal").textContent =
            formatCurrency(total);
    }

    return {
        subtotal,
        discount,
        total
    };
}

async function handleSaleSubmit(event) {
    event.preventDefault();

    if (!state.user) {
        return;
    }

    const paymentMethod =
        $("salePaymentMethod")
            ?.value || "";

    const notes =
        $("saleNotes")
            ?.value.trim() || "";

    if (!paymentMethod) {
        setMessage(
            "saleFormMessage",
            "Selecione a forma de pagamento.",
            "error"
        );

        return;
    }

    const totals =
        updateSaleTotal();

    try {
        setMessage(
            "saleFormMessage",
            "Registrando venda..."
        );

        const {
            data: sale,
            error
        } = await supabaseClient
            .from("sales")
            .insert({
                user_id:
                    state.user.id,
                subtotal:
                    totals.subtotal,
                discount:
                    totals.discount,
                total:
                    totals.total,
                payment_method:
                    paymentMethod,
                status:
                    "completed",
                notes
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        /*
         * Os sale_items serão implementados junto
         * com o sistema completo de variações.
         */

        console.log(
            "Venda criada:",
            sale
        );

        await loadSales();
        await loadDashboard();

        setMessage(
            "saleFormMessage",
            "Venda registrada.",
            "success"
        );

        setTimeout(
            () =>
                closeModal(
                    "saleModal"
                ),
            500
        );
    } catch (error) {
        console.error(error);

        setMessage(
            "saleFormMessage",
            translateDatabaseError(error),
            "error"
        );
    }
}

async function loadSales() {
    if (!state.user) {
        return;
    }

    const {
        data,
        error
    } = await supabaseClient
        .from("sales")
        .select("*")
        .eq("user_id", state.user.id)
        .order("created_at", {
            ascending: false
        })
        .limit(50);

    if (error) {
        console.error(
            "Erro ao carregar vendas:",
            error
        );

        return;
    }

    state.sales = data || [];

    renderSales();
    updateSalesMetrics();
}

function renderSales() {
    const container =
        $("salesList");

    if (!container) {
        return;
    }

    if (!state.sales.length) {
        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    V
                </div>

                <strong>
                    Nenhuma venda
                </strong>

                <p>
                    As vendas registradas aparecerão aqui.
                </p>

            </div>
        `;

        return;
    }

    container.innerHTML =
        state.sales
            .map((sale) => {
                return `
                    <div class="sale-card">

                        <div class="sale-card-header">

                            <div>

                                <div class="sale-number">
                                    Venda #${sale.sale_number}
                                </div>

                                <div class="sale-date">
                                    ${formatDateTime(
                                        sale.sale_date
                                    )}
                                </div>

                            </div>

                            <div class="sale-total">
                                ${formatCurrency(
                                    sale.total
                                )}
                            </div>

                        </div>

                        <div class="sale-payment">
                            Pagamento:
                            ${escapeHtml(
                                sale.payment_method ||
                                    "-"
                            )}
                        </div>

                    </div>
                `;
            })
            .join("");
}

function updateSalesMetrics() {
    const today =
        new Date()
            .toISOString()
            .slice(0, 10);

    const todaySales =
        state.sales.filter((sale) => {
            return (
                String(
                    sale.sale_date
                ).slice(0, 10) ===
                today
            );
        });

    const total =
        todaySales.reduce(
            (sum, sale) =>
                sum +
                Number(
                    sale.total || 0
                ),
            0
        );

    if ($("salesToday")) {
        $("salesToday").textContent =
            formatCurrency(total);
    }

    if ($("salesOrdersToday")) {
        $("salesOrdersToday").textContent =
            todaySales.length;
    }

    if ($("metricSales")) {
        $("metricSales").textContent =
            formatCurrency(total);
    }

    if ($("metricOrders")) {
        $("metricOrders").textContent =
            todaySales.length;
    }
}

/* =========================================================
   FINANCEIRO
   ========================================================= */

function resetTransactionForm() {
    const form =
        $("transactionForm");

    if (form) {
        form.reset();
    }

    if ($("transactionDate")) {
        $("transactionDate").value =
            new Date()
                .toISOString()
                .slice(0, 10);
    }

    setMessage(
        "transactionFormMessage",
        ""
    );
}

async function handleTransactionSubmit(event) {
    event.preventDefault();

    if (!state.user) {
        return;
    }

    const type =
        $("transactionType")
            ?.value || "";

    const category =
        $("transactionCategory")
            ?.value.trim() || "";

    const description =
        $("transactionDescription")
            ?.value.trim() || "";

    const amount =
        Number(
            $("transactionAmount")
                ?.value || 0
        );

    const date =
        $("transactionDate")
            ?.value ||
        new Date()
            .toISOString()
            .slice(0, 10);

    const paymentMethod =
        $("transactionPaymentMethod")
            ?.value || "";

    const notes =
        $("transactionNotes")
            ?.value.trim() || "";

    if (!type) {
        setMessage(
            "transactionFormMessage",
            "Selecione o tipo de lançamento.",
            "error"
        );

        return;
    }

    if (
        !description ||
        amount <= 0
    ) {
        setMessage(
            "transactionFormMessage",
            "Informe descrição e valor válido.",
            "error"
        );

        return;
    }

    try {
        setMessage(
            "transactionFormMessage",
            "Salvando..."
        );

        const { error } =
            await supabaseClient
                .from(
                    "financial_transactions"
                )
                .insert({
                    user_id:
                        state.user.id,
                    transaction_type:
                        type,
                    category,
                    description,
                    amount,
                    transaction_date:
                        date,
                    payment_method:
                        paymentMethod,
                    notes
                });

        if (error) {
            throw error;
        }

        await loadFinancialTransactions();
        await loadDashboard();

        setMessage(
            "transactionFormMessage",
            "Lançamento salvo.",
            "success"
        );

        setTimeout(
            () =>
                closeModal(
                    "transactionModal"
                ),
            500
        );
    } catch (error) {
        console.error(error);

        setMessage(
            "transactionFormMessage",
            translateDatabaseError(error),
            "error"
        );
    }
}

async function loadFinancialTransactions() {
    if (!state.user) {
        return;
    }

    const {
        data,
        error
    } = await supabaseClient
        .from(
            "financial_transactions"
        )
        .select("*")
        .eq(
            "user_id",
            state.user.id
        )
        .order(
            "transaction_date",
            {
                ascending: false
            }
        )
        .order(
            "created_at",
            {
                ascending: false
            }
        )
        .limit(50);

    if (error) {
        console.error(
            "Erro ao carregar financeiro:",
            error
        );

        return;
    }

    state.financialTransactions =
        data || [];

    renderFinancialTransactions();
    updateFinanceMetrics();
}

function renderFinancialTransactions() {
    const container =
        $("financeList");

    if (!container) {
        return;
    }

    if (
        !state
            .financialTransactions
            .length
    ) {
        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    F
                </div>

                <strong>
                    Nenhum lançamento
                </strong>

                <p>
                    Receitas e despesas aparecerão aqui.
                </p>

            </div>
        `;

        return;
    }

    container.innerHTML =
        state
            .financialTransactions
            .map(
                (transaction) => {
                    const isIncome =
                        transaction
                            .transaction_type ===
                        "income";

                    return `
                        <div class="finance-card">

                            <div class="finance-card-header">

                                <div>

                                    <div class="finance-description">
                                        ${escapeHtml(
                                            transaction.description
                                        )}
                                    </div>

                                    <div class="finance-meta">
                                        ${formatDate(
                                            transaction.transaction_date
                                        )}

                                        ${
                                            transaction.category
                                                ? ` • ${escapeHtml(
                                                      transaction.category
                                                  )}`
                                                : ""
                                        }
                                    </div>

                                </div>

                                <div class="finance-amount ${
                                    isIncome
                                        ? "income"
                                        : "expense"
                                }">

                                    ${
                                        isIncome
                                            ? "+"
                                            : "-"
                                    }

                                    ${formatCurrency(
                                        transaction.amount
                                    )}

                                </div>

                            </div>

                        </div>
                    `;
                }
            )
            .join("");
}

function updateFinanceMetrics() {
    const today =
        new Date()
            .toISOString()
            .slice(0, 10);

    const todayTransactions =
        state.financialTransactions.filter(
            (transaction) =>
                String(
                    transaction.transaction_date
                ).slice(0, 10) ===
                today
        );

    const income =
        todayTransactions
            .filter(
                (item) =>
                    item.transaction_type ===
                    "income"
            )
            .reduce(
                (sum, item) =>
                    sum +
                    Number(
                        item.amount || 0
                    ),
                0
            );

    const expenses =
        todayTransactions
            .filter(
                (item) =>
                    item.transaction_type ===
                    "expense"
            )
            .reduce(
                (sum, item) =>
                    sum +
                    Number(
                        item.amount || 0
                    ),
                0
            );

    const balance =
        income - expenses;

    if ($("financeIncome")) {
        $("financeIncome").textContent =
            formatCurrency(income);
    }

    if ($("financeExpenses")) {
        $("financeExpenses").textContent =
            formatCurrency(expenses);
    }

    if ($("financeBalance")) {
        $("financeBalance").textContent =
            formatCurrency(balance);
    }

    if ($("metricExpenses")) {
        $("metricExpenses").textContent =
            formatCurrency(expenses);
    }
}

/* =========================================================
   DASHBOARD
   ========================================================= */

async function loadDashboard() {
    if (!state.user) {
        return;
    }

    try {
        const {
            data: sales
        } = await supabaseClient
            .from("sales")
            .select(
                "total,sale_date,status"
            )
            .eq(
                "user_id",
                state.user.id
            )
            .eq(
                "status",
                "completed"
            );

        const {
            data: transactions
        } =
            await supabaseClient
                .from(
                    "financial_transactions"
                )
                .select(
                    "transaction_type,amount,transaction_date"
                )
                .eq(
                    "user_id",
                    state.user.id
                );

        const {
            count: productCount
        } =
            await supabaseClient
                .from("products")
                .select(
                    "id",
                    {
                        count:
                            "exact",
                        head: true
                    }
                )
                .eq(
                    "user_id",
                    state.user.id
                )
                .eq(
                    "is_active",
                    true
                );

        const allSales =
            sales || [];

        const allTransactions =
            transactions || [];

        const today =
            new Date()
                .toISOString()
                .slice(0, 10);

        const todaySales =
            allSales.filter(
                (sale) =>
                    String(
                        sale.sale_date
                    ).slice(0, 10) ===
                    today
            );

        const todayTransactions =
            allTransactions.filter(
                (transaction) =>
                    String(
                        transaction.transaction_date
                    ).slice(0, 10) ===
                    today
            );

        const salesTotal =
            todaySales.reduce(
                (sum, sale) =>
                    sum +
                    Number(
                        sale.total || 0
                    ),
                0
            );

        const expenses =
            todayTransactions
                .filter(
                    (item) =>
                        item.transaction_type ===
                        "expense"
                )
                .reduce(
                    (sum, item) =>
                        sum +
                        Number(
                            item.amount || 0
                        ),
                    0
                );

        if ($("metricSales")) {
            $("metricSales").textContent =
                formatCurrency(
                    salesTotal
                );
        }

        if ($("metricOrders")) {
            $("metricOrders").textContent =
                todaySales.length;
        }

        if ($("metricExpenses")) {
            $("metricExpenses").textContent =
                formatCurrency(
                    expenses
                );
        }

        if ($("totalProducts")) {
            $("totalProducts").textContent =
                productCount || 0;
        }

        updateSalesMetrics();
        updateFinanceMetrics();
    } catch (error) {
        console.error(
            "Erro no dashboard:",
            error
        );
    }
}

/* =========================================================
   EVENTOS
   ========================================================= */

function setupEvents() {

    /* LOGIN */

    $("loginForm")?.addEventListener(
        "submit",
        handleLogin
    );

    $("logoutButton")?.addEventListener(
        "click",
        handleLogout
    );


    /* NAVEGAÇÃO */

    setupNavigation();


    /* MODAIS */

    setupModalCloseButtons();


    /* CATEGORIAS */

    $("newCategoryButton")
        ?.addEventListener(
            "click",
            () =>
                openModal(
                    "categoryModal"
                )
        );

    $("categoryForm")
        ?.addEventListener(
            "submit",
            handleCategorySubmit
        );


    /* CORES */

    $("newColorButton")
        ?.addEventListener(
            "click",
            () =>
                openModal(
                    "colorModal"
                )
        );

    $("colorForm")
        ?.addEventListener(
            "submit",
            handleColorSubmit
        );

    $("colorHex")
        ?.addEventListener(
            "input",
            updateColorPreview
        );

    $("colorHexText")
        ?.addEventListener(
            "input",
            updateColorFromText
        );


    /* TAMANHOS */

    $("newSizeButton")
        ?.addEventListener(
            "click",
            () =>
                openModal(
                    "sizeModal"
                )
        );

    $("sizeForm")
        ?.addEventListener(
            "submit",
            handleSizeSubmit
        );


    /* PRODUTOS */

    $("newProductButton")
        ?.addEventListener(
            "click",
            () =>
                openModal(
                    "productModal"
                )
        );

    $("productForm")
        ?.addEventListener(
            "submit",
            handleProductSubmit
        );


    /* VENDAS */

    $("newSaleButton")
        ?.addEventListener(
            "click",
            () =>
                openModal(
                    "saleModal"
                )
        );

    $("saleForm")
        ?.addEventListener(
            "submit",
            handleSaleSubmit
        );

    $("saleDiscount")
        ?.addEventListener(
            "input",
            updateSaleTotal
        );


    /* FINANCEIRO */

    $("newTransactionButton")
        ?.addEventListener(
            "click",
            () =>
                openModal(
                    "transactionModal"
                )
        );

    $("transactionForm")
        ?.addEventListener(
            "submit",
            handleTransactionSubmit
        );


    /* ADICIONAR ITEM DE VENDA */

    $("addSaleItemButton")
        ?.addEventListener(
            "click",
            () => {
                alert(
                    "O cadastro de variações de produtos será implementado na próxima etapa."
                );
            }
        );
}

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

async function initializeApp() {
    console.log(
        "Inicializando MabijuFit..."
    );

    if ($("userName")) {
        const fullName =
            state.user?.user_metadata
                ?.full_name ||
            state.user?.email ||
            "MabijuFit";

        $("userName").textContent =
            fullName;
    }

    await Promise.all([
        loadCategories(),
        loadColors(),
        loadSizes(),
        loadProducts(),
        loadStock(),
        loadSales(),
        loadFinancialTransactions(),
        loadDashboard()
    ]);

    showSection("home");

    console.log(
        "MabijuFit inicializado."
    );
}

/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        setupEvents();
        await checkSession();
    }
);

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

        if (
            event === "SIGNED_OUT"
        ) {
            state.user = null;

            hideElement(
                "appScreen"
            );

            showElement(
                "loginScreen"
            );

            return;
        }

        if (
            event === "SIGNED_IN" &&
            session?.user
        ) {
            state.user =
                session.user;

            hideElement(
                "loginScreen"
            );

            showElement(
                "appScreen"
            );

            await initializeApp();
        }
    }
);
