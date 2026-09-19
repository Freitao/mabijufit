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
    sales: [],
    financialTransactions: []
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
    const number = Number(value || 0);

    return number.toLocaleString("pt-BR", {
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
        element.classList.remove("hidden");
    }
}

function hideElement(id) {
    const element = $(id);

    if (element) {
        element.classList.add("hidden");
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

    if (message.includes("not-null")) {
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

            showElement("appScreen");
            hideElement("loginScreen");

            await initializeApp();
        } else {
            state.user = null;

            hideElement("appScreen");
            showElement("loginScreen");
        }
    } catch (error) {
        console.error("Erro ao verificar sessão:", error);

        state.user = null;

        hideElement("appScreen");
        showElement("loginScreen");
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const email = $("loginEmail")?.value.trim();
    const password = $("loginPassword")?.value;

    const messageElement = $("loginMessage");

    if (!email || !password) {
        if (messageElement) {
            messageElement.textContent =
                "Informe e-mail e senha.";
        }

        return;
    }

    if (messageElement) {
        messageElement.textContent = "Entrando...";
    }

    try {
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) {
            throw error;
        }

        state.user = data.user;

        if (messageElement) {
            messageElement.textContent = "";
        }

        hideElement("loginScreen");
        showElement("appScreen");

        await initializeApp();
    } catch (error) {
        console.error("Erro no login:", error);

        if (messageElement) {
            messageElement.textContent =
                "E-mail ou senha inválidos.";
        }
    }
}

async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();
    } catch (error) {
        console.error("Erro ao sair:", error);
    }

    state.user = null;

    hideElement("appScreen");
    showElement("loginScreen");
}

/* =========================================================
   NAVEGAÇÃO
   ========================================================= */

function showSection(sectionId) {
    document
        .querySelectorAll("[data-section]")
        .forEach((section) => {
            section.classList.add("hidden");
        });

    const target = $(sectionId);

    if (target) {
        target.classList.remove("hidden");
    }

    document
        .querySelectorAll("[data-nav]")
        .forEach((button) => {
            button.classList.toggle(
                "active",
                button.dataset.nav === sectionId
            );
        });
}

function setupNavigation() {
    document
        .querySelectorAll("[data-nav]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                const sectionId = button.dataset.nav;

                if (sectionId) {
                    showSection(sectionId);
                }
            });
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

    modal.classList.remove("hidden");

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

    if (id === "transactionModal") {
        resetTransactionForm();
    }

    if (id === "saleModal") {
        resetSaleForm();
    }
}

function closeModal(id) {
    const modal = $(id);

    if (modal) {
        modal.classList.add("hidden");
    }
}

function setupModalCloseButtons() {
    document
        .querySelectorAll("[data-close-modal]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                closeModal(button.dataset.closeModal);
            });
        });

    document
        .querySelectorAll(".modal-overlay")
        .forEach((overlay) => {
            overlay.addEventListener("click", () => {
                const modal = overlay.closest(".modal");

                if (modal) {
                    modal.classList.add("hidden");
                }
            });
        });
}

/* =========================================================
   CATEGORIAS
   ========================================================= */

async function loadCategories() {
    if (!state.user) {
        return;
    }

    const { data, error } = await supabaseClient
        .from("categories")
        .select("*")
        .eq("user_id", state.user.id)
        .order("name");

    if (error) {
        console.error("Erro ao carregar categorias:", error);
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
                Nenhuma categoria cadastrada.
            </div>
        `;

        return;
    }

    container.innerHTML = state.categories
        .map((category) => {
            return `
                <div class="category-card">
                    <div class="category-card-info">
                        <div class="category-card-name">
                            ${escapeHtml(category.name)}
                        </div>

                        ${
                            category.description
                                ? `
                                    <div class="category-card-description">
                                        ${escapeHtml(category.description)}
                                    </div>
                                `
                                : ""
                        }
                    </div>

                    <div class="category-card-actions">
                        <button
                            class="icon-button"
                            type="button"
                            title="Editar"
                            data-edit-category="${category.id}"
                        >
                            ✎
                        </button>

                        <button
                            class="icon-button"
                            type="button"
                            title="Excluir"
                            data-delete-category="${category.id}"
                        >
                            ×
                        </button>
                    </div>
                </div>
            `;
        })
        .join("");

    container
        .querySelectorAll("[data-edit-category]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                editCategory(button.dataset.editCategory);
            });
        });

    container
        .querySelectorAll("[data-delete-category]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                deleteCategory(button.dataset.deleteCategory);
            });
        });
}

function populateCategorySelect() {
    const select = $("productCategory");

    if (!select) {
        return;
    }

    const currentValue = select.value;

    select.innerHTML = `
        <option value="">Selecione uma categoria</option>
        ${state.categories
            .filter((category) => category.is_active !== false)
            .map(
                (category) => `
                    <option value="${category.id}">
                        ${escapeHtml(category.name)}
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

    setMessage("categoryFormMessage");
}

function editCategory(id) {
    const category = state.categories.find(
        (item) => item.id === id
    );

    if (!category) {
        return;
    }

    openModal("categoryModal");

    if ($("categoryId")) {
        $("categoryId").value = category.id;
    }

    if ($("categoryName")) {
        $("categoryName").value = category.name || "";
    }

    if ($("categoryDescription")) {
        $("categoryDescription").value =
            category.description || "";
    }

    if ($("categoryActive")) {
        $("categoryActive").checked =
            category.is_active !== false;
    }
}

async function handleCategorySubmit(event) {
    event.preventDefault();

    if (!state.user) {
        return;
    }

    const id = $("categoryId")?.value || "";
    const name = $("categoryName")?.value.trim();
    const description =
        $("categoryDescription")?.value.trim() || "";
    const isActive =
        $("categoryActive")?.checked !== false;

    if (!name) {
        setMessage(
            "categoryFormMessage",
            "Informe o nome da categoria.",
            "error"
        );

        return;
    }

    try {
        setMessage(
            "categoryFormMessage",
            "Salvando..."
        );

        const payload = {
            name,
            description,
            is_active: isActive
        };

        let result;

        if (id) {
            result = await supabaseClient
                .from("categories")
                .update(payload)
                .eq("id", id)
                .eq("user_id", state.user.id);
        } else {
            result = await supabaseClient
                .from("categories")
                .insert({
                    ...payload,
                    user_id: state.user.id
                });
        }

        if (result.error) {
            throw result.error;
        }

        setMessage(
            "categoryFormMessage",
            "Categoria salva.",
            "success"
        );

        await loadCategories();

        setTimeout(() => {
            closeModal("categoryModal");
        }, 400);
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
    const category = state.categories.find(
        (item) => item.id === id
    );

    if (!category) {
        return;
    }

    const confirmed = confirm(
        `Excluir a categoria "${category.name}"?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("categories")
            .delete()
            .eq("id", id)
            .eq("user_id", state.user.id);

        if (error) {
            throw error;
        }

        await loadCategories();
    } catch (error) {
        console.error(error);

        alert(translateDatabaseError(error));
    }
}

/* =========================================================
   CORES
   ========================================================= */

async function loadColors() {
    if (!state.user) {
        return;
    }

    const { data, error } = await supabaseClient
        .from("colors")
        .select("*")
        .eq("user_id", state.user.id)
        .order("name");

    if (error) {
        console.error("Erro ao carregar cores:", error);
        return;
    }

    state.colors = data || [];

    renderColors();
    populateColorSelects();
}

function renderColors() {
    const container = $("colorsList");

    if (!container) {
        return;
    }

    if (!state.colors.length) {
        container.innerHTML = `
            <div class="empty-state">
                Nenhuma cor cadastrada.
            </div>
        `;

        return;
    }

    container.innerHTML = state.colors
        .map((color) => {
            const hex = normalizeHexColor(color.hex_code);

            return `
                <div class="color-card">
                    <div class="color-card-info">
                        <div
                            class="color-card-swatch"
                            style="background-color: ${escapeHtml(hex)}"
                        ></div>

                        <div class="color-card-text">
                            <div class="color-card-name">
                                ${escapeHtml(color.name)}
                            </div>

                            <div class="color-card-code">
                                ${escapeHtml(hex)}
                            </div>
                        </div>
                    </div>

                    <div class="color-card-actions">
                        <button
                            class="icon-button"
                            type="button"
                            title="Editar"
                            data-edit-color="${color.id}"
                        >
                            ✎
                        </button>

                        <button
                            class="icon-button"
                            type="button"
                            title="Excluir"
                            data-delete-color="${color.id}"
                        >
                            ×
                        </button>
                    </div>
                </div>
            `;
        })
        .join("");

    container
        .querySelectorAll("[data-edit-color]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                editColor(button.dataset.editColor);
            });
        });

    container
        .querySelectorAll("[data-delete-color]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                deleteColor(button.dataset.deleteColor);
            });
        });
}

function populateColorSelects() {
    document
        .querySelectorAll("[data-color-select]")
        .forEach((select) => {
            const currentValue = select.value;

            select.innerHTML = `
                <option value="">Selecione uma cor</option>

                ${state.colors
                    .filter(
                        (color) =>
                            color.is_active !== false
                    )
                    .map(
                        (color) => `
                            <option value="${color.id}">
                                ${escapeHtml(color.name)}
                            </option>
                        `
                    )
                    .join("")}
            `;

            if (currentValue) {
                select.value = currentValue;
            }
        });
}

function updateColorPreview() {
    const colorPicker = $("colorHex");
    const colorText = $("colorHexText");
    const preview = $("colorPreview");

    if (!colorPicker || !colorText) {
        return;
    }

    const hex = normalizeHexColor(colorPicker.value);

    colorText.value = hex;

    if (preview) {
        preview.style.backgroundColor = hex;
    }
}

function updateColorFromText() {
    const colorPicker = $("colorHex");
    const colorText = $("colorHexText");
    const preview = $("colorPreview");

    if (!colorPicker || !colorText) {
        return;
    }

    const value = normalizeHexColor(colorText.value);

    colorText.value = value;
    colorPicker.value = value;

    if (preview) {
        preview.style.backgroundColor = value;
    }
}

function resetColorForm() {
    const form = $("colorForm");

    if (form) {
        form.reset();
    }

    if ($("colorId")) {
        $("colorId").value = "";
    }

    if ($("colorActive")) {
        $("colorActive").checked = true;
    }

    if ($("colorHex")) {
        $("colorHex").value = "#D96B8A";
    }

    if ($("colorHexText")) {
        $("colorHexText").value = "#D96B8A";
    }

    if ($("colorPreview")) {
        $("colorPreview").style.backgroundColor =
            "#D96B8A";
    }

    setMessage("colorFormMessage");
}

function editColor(id) {
    const color = state.colors.find(
        (item) => item.id === id
    );

    if (!color) {
        return;
    }

    openModal("colorModal");

    const hex = normalizeHexColor(color.hex_code);

    if ($("colorId")) {
        $("colorId").value = color.id;
    }

    if ($("colorName")) {
        $("colorName").value = color.name || "";
    }

    if ($("colorHex")) {
        $("colorHex").value = hex;
    }

    if ($("colorHexText")) {
        $("colorHexText").value = hex;
    }

    if ($("colorPreview")) {
        $("colorPreview").style.backgroundColor = hex;
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

    const id = $("colorId")?.value || "";
    const name = $("colorName")?.value.trim();
    const hexCode = normalizeHexColor(
        $("colorHexText")?.value ||
            $("colorHex")?.value ||
            "#000000"
    );
    const isActive =
        $("colorActive")?.checked !== false;

    if (!name) {
        setMessage(
            "colorFormMessage",
            "Informe o nome da cor.",
            "error"
        );

        return;
    }

    try {
        setMessage(
            "colorFormMessage",
            "Salvando..."
        );

        const payload = {
            name,
            hex_code: hexCode,
            is_active: isActive
        };

        let result;

        if (id) {
            result = await supabaseClient
                .from("colors")
                .update(payload)
                .eq("id", id)
                .eq("user_id", state.user.id);
        } else {
            result = await supabaseClient
                .from("colors")
                .insert({
                    ...payload,
                    user_id: state.user.id
                });
        }

        if (result.error) {
            throw result.error;
        }

        setMessage(
            "colorFormMessage",
            "Cor salva.",
            "success"
        );

        await loadColors();

        setTimeout(() => {
            closeModal("colorModal");
        }, 400);
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
    const color = state.colors.find(
        (item) => item.id === id
    );

    if (!color) {
        return;
    }

    const confirmed = confirm(
        `Excluir a cor "${color.name}"?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("colors")
            .delete()
            .eq("id", id)
            .eq("user_id", state.user.id);

        if (error) {
            throw error;
        }

        await loadColors();
    } catch (error) {
        console.error(error);

        alert(translateDatabaseError(error));
    }
}

/* =========================================================
   TAMANHOS
   ========================================================= */

async function loadSizes() {
    if (!state.user) {
        return;
    }

    const { data, error } = await supabaseClient
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
        console.error("Erro ao carregar tamanhos:", error);
        return;
    }

    state.sizes = data || [];

    renderSizes();
    populateSizeSelects();
}

function renderSizes() {
    const container = $("sizesList");

    if (!container) {
        return;
    }

    if (!state.sizes.length) {
        container.innerHTML = `
            <div class="empty-state">
                Nenhum tamanho cadastrado.
            </div>
        `;

        return;
    }

    container.innerHTML = state.sizes
        .map((size) => {
            return `
                <div class="size-card">
                    <div class="size-card-info">
                        <div class="size-badge">
                            ${escapeHtml(size.name)}
                        </div>

                        <div>
                            <div class="size-card-name">
                                Tamanho ${escapeHtml(size.name)}
                            </div>

                            <div class="size-card-order">
                                Ordem: ${Number(
                                    size.display_order || 0
                                )}
                            </div>
                        </div>
                    </div>

                    <div class="size-card-actions">
                        <button
                            class="icon-button"
                            type="button"
                            title="Editar"
                            data-edit-size="${size.id}"
                        >
                            ✎
                        </button>

                        <button
                            class="icon-button"
                            type="button"
                            title="Excluir"
                            data-delete-size="${size.id}"
                        >
                            ×
                        </button>
                    </div>
                </div>
            `;
        })
        .join("");

    container
        .querySelectorAll("[data-edit-size]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                editSize(button.dataset.editSize);
            });
        });

    container
        .querySelectorAll("[data-delete-size]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                deleteSize(button.dataset.deleteSize);
            });
        });
}

function populateSizeSelects() {
    document
        .querySelectorAll("[data-size-select]")
        .forEach((select) => {
            const currentValue = select.value;

            select.innerHTML = `
                <option value="">Selecione um tamanho</option>

                ${state.sizes
                    .filter(
                        (size) =>
                            size.is_active !== false
                    )
                    .map(
                        (size) => `
                            <option value="${size.id}">
                                ${escapeHtml(size.name)}
                            </option>
                        `
                    )
                    .join("")}
            `;

            if (currentValue) {
                select.value = currentValue;
            }
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

    setMessage("sizeFormMessage");
}

function editSize(id) {
    const size = state.sizes.find(
        (item) => item.id === id
    );

    if (!size) {
        return;
    }

    openModal("sizeModal");

    if ($("sizeId")) {
        $("sizeId").value = size.id;
    }

    if ($("sizeName")) {
        $("sizeName").value = size.name || "";
    }

    if ($("sizeDisplayOrder")) {
        $("sizeDisplayOrder").value =
            size.display_order ?? 0;
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

    const id = $("sizeId")?.value || "";
    const name = $("sizeName")?.value.trim();
    const displayOrder = Number(
        $("sizeDisplayOrder")?.value || 0
    );
    const isActive =
        $("sizeActive")?.checked !== false;

    if (!name) {
        setMessage(
            "sizeFormMessage",
            "Informe o tamanho.",
            "error"
        );

        return;
    }

    try {
        setMessage(
            "sizeFormMessage",
            "Salvando..."
        );

        const payload = {
            name,
            display_order: displayOrder,
            is_active: isActive
        };

        let result;

        if (id) {
            result = await supabaseClient
                .from("sizes")
                .update(payload)
                .eq("id", id)
                .eq("user_id", state.user.id);
        } else {
            result = await supabaseClient
                .from("sizes")
                .insert({
                    ...payload,
                    user_id: state.user.id
                });
        }

        if (result.error) {
            throw result.error;
        }

        setMessage(
            "sizeFormMessage",
            "Tamanho salvo.",
            "success"
        );

        await loadSizes();

        setTimeout(() => {
            closeModal("sizeModal");
        }, 400);
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
    const size = state.sizes.find(
        (item) => item.id === id
    );

    if (!size) {
        return;
    }

    const confirmed = confirm(
        `Excluir o tamanho "${size.name}"?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("sizes")
            .delete()
            .eq("id", id)
            .eq("user_id", state.user.id);

        if (error) {
            throw error;
        }

        await loadSizes();
    } catch (error) {
        console.error(error);

        alert(translateDatabaseError(error));
    }
}

/* =========================================================
   PRODUTOS
   ========================================================= */

async function loadProducts() {
    if (!state.user) {
        return;
    }

    const { data, error } = await supabaseClient
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
        console.error("Erro ao carregar produtos:", error);
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
                Nenhum produto cadastrado.
            </div>
        `;

        return;
    }

    container.innerHTML = state.products
        .map((product) => {
            return `
                <div class="product-card">
                    <div class="product-card-top">
                        <div>
                            <div class="product-card-name">
                                ${escapeHtml(product.name)}
                            </div>

                            <div class="product-card-category">
                                ${
                                    product.categories?.name
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
                                        SKU: ${escapeHtml(
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
                                product.minimum_stock || 0
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

    if ($("productId")) {
        $("productId").value = "";
    }

    if ($("productActive")) {
        $("productActive").checked = true;
    }

    setMessage("productFormMessage");
}

async function handleProductSubmit(event) {
    event.preventDefault();

    if (!state.user) {
        return;
    }

    const name = $("productName")?.value.trim();
    const sku = $("productSku")?.value.trim() || "";
    const description =
        $("productDescription")?.value.trim() || "";
    const categoryId =
        $("productCategory")?.value || null;

    const costPrice = Number(
        $("productCostPrice")?.value || 0
    );

    const salePrice = Number(
        $("productSalePrice")?.value || 0
    );

    const minimumStock = Number(
        $("productMinimumStock")?.value || 0
    );

    const isActive =
        $("productActive")?.checked !== false;

    if (!name) {
        setMessage(
            "productFormMessage",
            "Informe o nome do produto.",
            "error"
        );

        return;
    }

    try {
        setMessage(
            "productFormMessage",
            "Salvando..."
        );

        const { error } = await supabaseClient
            .from("products")
            .insert({
                user_id: state.user.id,
                category_id: categoryId,
                name,
                sku,
                description,
                cost_price: costPrice,
                sale_price: salePrice,
                minimum_stock: minimumStock,
                is_active: isActive
            });

        if (error) {
            throw error;
        }

        setMessage(
            "productFormMessage",
            "Produto salvo.",
            "success"
        );

        await loadProducts();

        setTimeout(() => {
            closeModal("productModal");
        }, 400);
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
    const container = $("stockList");

    if (!container || !state.user) {
        return;
    }

    const { data, error } = await supabaseClient
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
        console.error("Erro ao carregar estoque:", error);

        container.innerHTML = `
            <div class="empty-state">
                Não foi possível carregar o estoque.
            </div>
        `;

        return;
    }

    if (!data?.length) {
        container.innerHTML = `
            <div class="empty-state">
                Nenhuma variação de produto cadastrada.
            </div>
        `;

        return;
    }

    container.innerHTML = data
        .map((variant) => {
            const quantity = Number(
                variant.stock_quantity || 0
            );

            const minimum = Number(
                variant.minimum_stock || 0
            );

            let className = "";

            if (quantity === 0) {
                className = "out-stock";
            } else if (quantity <= minimum) {
                className = "low-stock";
            }

            return `
                <div class="stock-card ${className}">
                    <div>
                        <strong>
                            ${escapeHtml(
                                variant.products?.name ||
                                    "Produto"
                            )}
                        </strong>

                        <div class="stock-label">
                            ${
                                variant.colors?.name
                                    ? escapeHtml(
                                          variant.colors
                                              .name
                                      )
                                    : ""
                            }

                            ${
                                variant.sizes?.name
                                    ? ` / ${escapeHtml(
                                          variant.sizes
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
}

/* =========================================================
   VENDAS
   ========================================================= */

function resetSaleForm() {
    const form = $("saleForm");

    if (form) {
        form.reset();
    }

    if ($("saleId")) {
        $("saleId").value = "";
    }

    setMessage("saleFormMessage");

    const items = $("saleItems");

    if (items) {
        items.innerHTML = `
            <div class="empty-state">
                Nenhum item adicionado.
            </div>
        `;
    }
}

async function handleSaleSubmit(event) {
    event.preventDefault();

    if (!state.user) {
        return;
    }

    const paymentMethod =
        $("salePaymentMethod")?.value || "";

    const discount = Number(
        $("saleDiscount")?.value || 0
    );

    const notes =
        $("saleNotes")?.value.trim() || "";

    try {
        setMessage(
            "saleFormMessage",
            "Registrando venda..."
        );

        /*
         * Nesta etapa registramos a venda principal.
         * Os itens e a baixa automática de estoque entram
         * na etapa de variações.
         */

        const { data, error } = await supabaseClient
            .from("sales")
            .insert({
                user_id: state.user.id,
                subtotal: 0,
                discount,
                total: 0,
                payment_method: paymentMethod,
                status: "completed",
                notes
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        console.log(
            "Venda criada:",
            data
        );

        setMessage(
            "saleFormMessage",
            "Venda registrada.",
            "success"
        );

        await loadSales();
        await loadDashboard();

        setTimeout(() => {
            closeModal("saleModal");
        }, 400);
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
    const container = $("salesList");

    if (!container || !state.user) {
        return;
    }

    const { data, error } = await supabaseClient
        .from("sales")
        .select("*")
        .eq("user_id", state.user.id)
        .order("created_at", {
            ascending: false
        })
        .limit(50);

    if (error) {
        console.error("Erro ao carregar vendas:", error);
        return;
    }

    state.sales = data || [];

    renderSales();
}

function renderSales() {
    const container = $("salesList");

    if (!container) {
        return;
    }

    if (!state.sales.length) {
        container.innerHTML = `
            <div class="empty-state">
                Nenhuma venda registrada.
            </div>
        `;

        return;
    }

    container.innerHTML = state.sales
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

/* =========================================================
   FINANCEIRO
   ========================================================= */

function resetTransactionForm() {
    const form = $("transactionForm");

    if (form) {
        form.reset();
    }

    if ($("transactionId")) {
        $("transactionId").value = "";
    }

    setMessage("transactionFormMessage");
}

async function handleTransactionSubmit(event) {
    event.preventDefault();

    if (!state.user) {
        return;
    }

    const type =
        $("transactionType")?.value || "expense";

    const category =
        $("transactionCategory")?.value.trim() || "";

    const description =
        $("transactionDescription")?.value.trim() ||
        "";

    const amount = Number(
        $("transactionAmount")?.value || 0
    );

    const date =
        $("transactionDate")?.value ||
        new Date().toISOString().slice(0, 10);

    const paymentMethod =
        $("transactionPaymentMethod")?.value ||
        "";

    const notes =
        $("transactionNotes")?.value.trim() || "";

    if (!description || amount <= 0) {
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

        const { error } = await supabaseClient
            .from("financial_transactions")
            .insert({
                user_id: state.user.id,
                transaction_type: type,
                category,
                description,
                amount,
                transaction_date: date,
                payment_method: paymentMethod,
                notes
            });

        if (error) {
            throw error;
        }

        setMessage(
            "transactionFormMessage",
            "Lançamento salvo.",
            "success"
        );

        await loadFinancialTransactions();
        await loadDashboard();

        setTimeout(() => {
            closeModal("transactionModal");
        }, 400);
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
    const container = $("financeList");

    if (!container || !state.user) {
        return;
    }

    const { data, error } = await supabaseClient
        .from("financial_transactions")
        .select("*")
        .eq("user_id", state.user.id)
        .order("transaction_date", {
            ascending: false
        })
        .order("created_at", {
            ascending: false
        })
        .limit(50);

    if (error) {
        console.error(
            "Erro ao carregar financeiro:",
            error
        );

        return;
    }

    state.financialTransactions = data || [];

    renderFinancialTransactions();
}

function renderFinancialTransactions() {
    const container = $("financeList");

    if (!container) {
        return;
    }

    if (!state.financialTransactions.length) {
        container.innerHTML = `
            <div class="empty-state">
                Nenhum lançamento financeiro.
            </div>
        `;

        return;
    }

    container.innerHTML =
        state.financialTransactions
            .map((transaction) => {
                const isIncome =
                    transaction.transaction_type ===
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
            })
            .join("");
}

/* =========================================================
   DASHBOARD
   ========================================================= */

async function loadDashboard() {
    if (!state.user) {
        return;
    }

    try {
        const [
            productsResult,
            salesResult,
            financeResult
        ] = await Promise.all([
            supabaseClient
                .from("products")
                .select("id", {
                    count: "exact",
                    head: true
                })
                .eq("user_id", state.user.id)
                .eq("is_active", true),

            supabaseClient
                .from("sales")
                .select("total")
                .eq("user_id", state.user.id)
                .eq("status", "completed"),

            supabaseClient
                .from("financial_transactions")
                .select(
                    "transaction_type, amount"
                )
                .eq("user_id", state.user.id)
        ]);

        const productCount =
            productsResult.count || 0;

        const sales =
            salesResult.data || [];

        const transactions =
            financeResult.data || [];

        const totalSales = sales.reduce(
            (sum, sale) =>
                sum + Number(sale.total || 0),
            0
        );

        const income = transactions
            .filter(
                (item) =>
                    item.transaction_type ===
                    "income"
            )
            .reduce(
                (sum, item) =>
                    sum + Number(item.amount || 0),
                0
            );

        const expenses = transactions
            .filter(
                (item) =>
                    item.transaction_type ===
                    "expense"
            )
            .reduce(
                (sum, item) =>
                    sum + Number(item.amount || 0),
                0
            );

        setDashboardValue(
            [
                "dashboardProducts",
                "totalProducts"
            ],
            productCount
        );

        setDashboardValue(
            [
                "dashboardSales",
                "totalSales"
            ],
            formatCurrency(totalSales)
        );

        setDashboardValue(
            [
                "dashboardIncome",
                "totalIncome"
            ],
            formatCurrency(income)
        );

        setDashboardValue(
            [
                "dashboardExpenses",
                "totalExpenses"
            ],
            formatCurrency(expenses)
        );
    } catch (error) {
        console.error(
            "Erro ao carregar dashboard:",
            error
        );
    }
}

function setDashboardValue(ids, value) {
    ids.forEach((id) => {
        const element = $(id);

        if (element) {
            element.textContent = value;
        }
    });
}

/* =========================================================
   EVENTOS
   ========================================================= */

function setupEvents() {
    $("loginForm")?.addEventListener(
        "submit",
        handleLogin
    );

    $("logoutButton")?.addEventListener(
        "click",
        handleLogout
    );

    $("newCategoryButton")?.addEventListener(
        "click",
        () => openModal("categoryModal")
    );

    $("newColorButton")?.addEventListener(
        "click",
        () => openModal("colorModal")
    );

    $("newSizeButton")?.addEventListener(
        "click",
        () => openModal("sizeModal")
    );

    $("newProductButton")?.addEventListener(
        "click",
        () => openModal("productModal")
    );

    $("newSaleButton")?.addEventListener(
        "click",
        () => openModal("saleModal")
    );

    $("newTransactionButton")?.addEventListener(
        "click",
        () => openModal("transactionModal")
    );

    $("categoryForm")?.addEventListener(
        "submit",
        handleCategorySubmit
    );

    $("colorForm")?.addEventListener(
        "submit",
        handleColorSubmit
    );

    $("sizeForm")?.addEventListener(
        "submit",
        handleSizeSubmit
    );

    $("productForm")?.addEventListener(
        "submit",
        handleProductSubmit
    );

    $("saleForm")?.addEventListener(
        "submit",
        handleSaleSubmit
    );

    $("transactionForm")?.addEventListener(
        "submit",
        handleTransactionSubmit
    );

    $("colorHex")?.addEventListener(
        "input",
        updateColorPreview
    );

    $("colorHexText")?.addEventListener(
        "input",
        updateColorFromText
    );

    setupNavigation();
    setupModalCloseButtons();
}

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

async function initializeApp() {
    console.log("Inicializando MabijuFit...");

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

    showSection("dashboardSection");

    console.log("MabijuFit inicializado.");
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
        if (event === "SIGNED_OUT") {
            state.user = null;

            hideElement("appScreen");
            showElement("loginScreen");

            return;
        }

        if (
            event === "SIGNED_IN" &&
            session?.user
        ) {
            state.user = session.user;

            hideElement("loginScreen");
            showElement("appScreen");

            await initializeApp();
        }
    }
);
