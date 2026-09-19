// =========================================================
// MABIJUFIT — APP.JS
// Versão consolidada
// =========================================================

"use strict";


// =========================================================
// ESTADO
// =========================================================

let currentUser = null;
let appInitialized = false;

let categoriesCache = [];
let colorsCache = [];
let sizesCache = [];
let productsCache = [];
let variantsCache = [];
let salesCache = [];
let financeCache = [];

// Variações que estão sendo cadastradas no produto atual.
let productVariationsDraft = [];


// =========================================================
// HELPERS
// =========================================================

function $(id) {
    return document.getElementById(id);
}


function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatCurrency(value) {
    const number = Number(value || 0);

    return number.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}


function todayISO() {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function showMessage(elementId, message, type = "error") {
    const element = $(elementId);

    if (!element) {
        return;
    }

    element.textContent = message || "";
    element.className = `form-message ${type}`;

    if (!message) {
        element.className = "form-message";
    }
}


function setLoading(button, loading, text = "Salvando...") {

    if (!button) {
        return;
    }

    if (loading) {

        button.dataset.originalText =
            button.textContent;

        button.disabled = true;
        button.textContent = text;

    } else {

        button.disabled = false;

        button.textContent =
            button.dataset.originalText ||
            button.textContent;
    }
}


function getAuthErrorMessage(error) {

    const message =
        String(error?.message || "").toLowerCase();

    if (
        message.includes("invalid login credentials") ||
        message.includes("invalid credentials")
    ) {
        return "E-mail ou senha incorretos.";
    }

    if (
        message.includes("email not confirmed")
    ) {
        return "O e-mail desta conta ainda não foi confirmado.";
    }

    if (
        message.includes("too many requests")
    ) {
        return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    }

    return error?.message ||
        "Não foi possível entrar. Tente novamente.";
}


// =========================================================
// TELAS
// =========================================================

const sectionMap = {
    home: "homeScreen",
    products: "productsScreen",
    stock: "stockScreen",
    sales: "salesScreen",
    finance: "financeScreen"
};


function showSection(sectionName) {

    Object.entries(sectionMap).forEach(
        ([name, elementId]) => {

            const section = $(elementId);

            if (!section) {
                return;
            }

            section.hidden =
                name !== sectionName;
        }
    );


    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.section === sectionName
            );

        });


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    if (sectionName === "home") {
        loadDashboard();
    }

    if (sectionName === "products") {
        loadProductsPage();
    }

    if (sectionName === "stock") {
        loadStock();
    }

    if (sectionName === "sales") {
        loadSales();
    }

    if (sectionName === "finance") {
        loadFinance();
    }
}


// =========================================================
// LOGIN / LOGOUT
// =========================================================

async function handleLogin(event) {

    event.preventDefault();
    event.stopPropagation();

    const emailInput = $("email");
    const passwordInput = $("password");
    const button = $("loginButton");

    const email =
        emailInput?.value.trim() || "";

    const password =
        passwordInput?.value || "";


    showMessage(
        "loginMessage",
        ""
    );


    if (!email || !password) {

        showMessage(
            "loginMessage",
            "Informe o e-mail e a senha."
        );

        return;
    }


    setLoading(
        button,
        true,
        "Entrando..."
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


        if (!data?.session) {

            showMessage(
                "loginMessage",
                "Login realizado, mas nenhuma sessão foi criada."
            );

            return;
        }


        currentUser =
            data.user;


        await showApplication(
            data.user
        );

    } catch (error) {

        console.error(
            "Erro no login:",
            error
        );

        showMessage(
            "loginMessage",
            getAuthErrorMessage(error)
        );

    } finally {

        setLoading(
            button,
            false
        );
    }
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


    currentUser = null;
    appInitialized = false;


    const appScreen = $("appScreen");
    const loginScreen = $("loginScreen");

    if (appScreen) {
        appScreen.hidden = true;
    }

    if (loginScreen) {
        loginScreen.hidden = false;
    }


    showSection("home");
}


async function showApplication(user) {

    currentUser = user;


    const loginScreen =
        $("loginScreen");

    const appScreen =
        $("appScreen");


    if (loginScreen) {
        loginScreen.hidden = true;
    }

    if (appScreen) {
        appScreen.hidden = false;
    }


    const userName =
        $("userName");


    if (userName) {

        const fullName =
            user.user_metadata?.full_name;

        userName.textContent =
            fullName ||
            user.email ||
            "Usuário";
    }


    if (!appInitialized) {

        appInitialized = true;

        await loadInitialData();
    }


    showSection("home");
}


// =========================================================
// CATEGORIAS
// =========================================================

async function loadCategories() {

    if (!currentUser) {
        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("categories")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("name");


    if (error) {

        console.error(
            "Erro ao carregar categorias:",
            error
        );

        return;
    }


    categoriesCache =
        data || [];


    renderCategories();
    populateCategorySelect();
}


function renderCategories() {

    const container =
        $("categoriesList");

    if (!container) {
        return;
    }


    if (!categoriesCache.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">C</div>
                <strong>Nenhuma categoria cadastrada</strong>
                <p>Crie categorias para organizar seus produtos.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        categoriesCache.map(category => `

            <div class="category-card">

                <div class="category-card-info">

                    <strong>
                        ${escapeHtml(category.name)}
                    </strong>

                    <span>
                        ${escapeHtml(
                            category.description || "Sem descrição"
                        )}
                    </span>

                </div>

                <div class="category-card-actions">

                    <button
                        type="button"
                        class="icon-button"
                        data-edit-category="${category.id}"
                    >
                        ✎
                    </button>

                    <button
                        type="button"
                        class="icon-button danger"
                        data-delete-category="${category.id}"
                    >
                        ×
                    </button>

                </div>

            </div>

        `).join("");
}


function populateCategorySelect() {

    const select =
        $("productCategory");

    if (!select) {
        return;
    }


    select.innerHTML = `
        <option value="">
            Selecione
        </option>
    `;


    categoriesCache
        .filter(category => category.is_active !== false)
        .forEach(category => {

            const option =
                document.createElement("option");

            option.value =
                category.id;

            option.textContent =
                category.name;

            select.appendChild(option);
        });
}


function openCategoryModal(category = null) {

    const form =
        $("categoryForm");

    if (!form) {
        return;
    }


    form.reset();


    $("categoryId").value =
        category?.id || "";

    $("categoryName").value =
        category?.name || "";

    $("categoryDescription").value =
        category?.description || "";

    $("categoryActive").checked =
        category?.is_active !== false;


    showMessage(
        "categoryFormMessage",
        ""
    );


    openModal("categoryModal");
}


async function saveCategory(event) {

    event.preventDefault();

    if (!currentUser) {
        return;
    }


    const id =
        $("categoryId").value.trim();

    const name =
        $("categoryName").value.trim();

    const description =
        $("categoryDescription").value.trim();

    const isActive =
        $("categoryActive").checked;


    if (!name) {

        showMessage(
            "categoryFormMessage",
            "Informe o nome da categoria."
        );

        return;
    }


    const payload = {
        name,
        description,
        is_active: isActive
    };


    try {

        let query;


        if (id) {

            query = await supabaseClient
                .from("categories")
                .update(payload)
                .eq("id", id)
                .eq("user_id", currentUser.id);

        } else {

            query = await supabaseClient
                .from("categories")
                .insert({
                    ...payload,
                    user_id: currentUser.id
                });
        }


        if (query.error) {
            throw query.error;
        }


        closeModal("categoryModal");

        await loadCategories();

    } catch (error) {

        console.error(
            "Erro ao salvar categoria:",
            error
        );

        showMessage(
            "categoryFormMessage",
            error.message ||
            "Não foi possível salvar a categoria."
        );
    }
}


async function deleteCategory(id) {

    if (!currentUser) {
        return;
    }


    const confirmed =
        confirm(
            "Excluir esta categoria?"
        );


    if (!confirmed) {
        return;
    }


    const {
        error
    } = await supabaseClient
        .from("categories")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id);


    if (error) {

        console.error(
            "Erro ao excluir categoria:",
            error
        );

        alert(
            "Não foi possível excluir. Verifique se existem produtos usando esta categoria."
        );

        return;
    }


    await loadCategories();
}


// =========================================================
// CORES
// =========================================================

async function loadColors() {

    if (!currentUser) {
        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("colors")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("name");


    if (error) {

        console.error(
            "Erro ao carregar cores:",
            error
        );

        return;
    }


    colorsCache =
        data || [];


    renderColors();
    renderProductVariationOptions();
}


function renderColors() {

    const container =
        $("colorsList");

    if (!container) {
        return;
    }


    if (!colorsCache.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">C</div>
                <strong>Nenhuma cor cadastrada</strong>
                <p>Cadastre cores para utilizar nos produtos.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        colorsCache.map(color => {

            const hex =
                color.hex_code || "#cccccc";


            return `

                <div class="color-card">

                    <div class="color-card-info">

                        <span
                            class="color-card-swatch"
                            style="background:${escapeHtml(hex)}"
                        ></span>

                        <div class="color-card-text">

                            <strong class="color-card-name">
                                ${escapeHtml(color.name)}
                            </strong>

                            <small class="color-card-code">
                                ${escapeHtml(hex)}
                            </small>

                        </div>

                    </div>


                    <div class="color-card-actions">

                        <button
                            type="button"
                            class="icon-button"
                            data-edit-color="${color.id}"
                        >
                            ✎
                        </button>

                        <button
                            type="button"
                            class="icon-button danger"
                            data-delete-color="${color.id}"
                        >
                            ×
                        </button>

                    </div>

                </div>

            `;

        }).join("");
}


function syncColorPreview() {

    const color =
        $("colorHex")?.value ||
        "#E8A0B8";

    const text =
        $("colorHexText");

    const preview =
        $("colorPreview");


    if (text) {
        text.value =
            color.toUpperCase();
    }

    if (preview) {
        preview.style.background =
            color;
    }
}


function openColorModal(color = null) {

    const form =
        $("colorForm");

    if (!form) {
        return;
    }


    form.reset();


    $("colorId").value =
        color?.id || "";

    $("colorName").value =
        color?.name || "";

    $("colorHex").value =
        color?.hex_code || "#E8A0B8";

    $("colorHexText").value =
        color?.hex_code || "#E8A0B8";

    $("colorActive").checked =
        color?.is_active !== false;


    syncColorPreview();


    showMessage(
        "colorFormMessage",
        ""
    );


    openModal("colorModal");
}


async function saveColor(event) {

    event.preventDefault();

    if (!currentUser) {
        return;
    }


    const id =
        $("colorId").value.trim();

    const name =
        $("colorName").value.trim();

    const hex =
        $("colorHexText").value.trim();

    const isActive =
        $("colorActive").checked;


    if (!name) {

        showMessage(
            "colorFormMessage",
            "Informe o nome da cor."
        );

        return;
    }


    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {

        showMessage(
            "colorFormMessage",
            "Informe uma cor hexadecimal válida, por exemplo #E8A0B8."
        );

        return;
    }


    const payload = {
        name,
        hex_code: hex.toUpperCase(),
        is_active: isActive
    };


    try {

        let query;


        if (id) {

            query = await supabaseClient
                .from("colors")
                .update(payload)
                .eq("id", id)
                .eq("user_id", currentUser.id);

        } else {

            query = await supabaseClient
                .from("colors")
                .insert({
                    ...payload,
                    user_id: currentUser.id
                });
        }


        if (query.error) {
            throw query.error;
        }


        closeModal("colorModal");

        await loadColors();

    } catch (error) {

        console.error(
            "Erro ao salvar cor:",
            error
        );

        showMessage(
            "colorFormMessage",
            error.message ||
            "Não foi possível salvar a cor."
        );
    }
}


async function deleteColor(id) {

    if (!currentUser) {
        return;
    }


    if (!confirm("Excluir esta cor?")) {
        return;
    }


    const {
        error
    } = await supabaseClient
        .from("colors")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id);


    if (error) {

        console.error(
            "Erro ao excluir cor:",
            error
        );

        alert(
            "Não foi possível excluir esta cor. Ela pode estar vinculada a produtos."
        );

        return;
    }


    await loadColors();
}


// =========================================================
// TAMANHOS
// =========================================================

async function loadSizes() {

    if (!currentUser) {
        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("sizes")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("display_order")
        .order("name");


    if (error) {

        console.error(
            "Erro ao carregar tamanhos:",
            error
        );

        return;
    }


    sizesCache =
        data || [];


    renderSizes();
    renderProductVariationOptions();
}


function renderSizes() {

    const container =
        $("sizesList");

    if (!container) {
        return;
    }


    if (!sizesCache.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">T</div>
                <strong>Nenhum tamanho cadastrado</strong>
                <p>Cadastre tamanhos para utilizar nos produtos.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        sizesCache.map(size => `

            <div class="size-card">

                <div class="size-card-info">

                    <span class="size-badge">
                        ${escapeHtml(size.name)}
                    </span>

                    <div>

                        <strong class="size-card-name">
                            Tamanho ${escapeHtml(size.name)}
                        </strong>

                        <small class="size-card-order">
                            Ordem: ${Number(size.display_order || 0)}
                        </small>

                    </div>

                </div>


                <div class="size-card-actions">

                    <button
                        type="button"
                        class="icon-button"
                        data-edit-size="${size.id}"
                    >
                        ✎
                    </button>

                    <button
                        type="button"
                        class="icon-button danger"
                        data-delete-size="${size.id}"
                    >
                        ×
                    </button>

                </div>

            </div>

        `).join("");
}


function openSizeModal(size = null) {

    const form =
        $("sizeForm");

    if (!form) {
        return;
    }


    form.reset();


    $("sizeId").value =
        size?.id || "";

    $("sizeName").value =
        size?.name || "";

    $("sizeDisplayOrder").value =
        size?.display_order ?? 0;

    $("sizeActive").checked =
        size?.is_active !== false;


    showMessage(
        "sizeFormMessage",
        ""
    );


    openModal("sizeModal");
}


async function saveSize(event) {

    event.preventDefault();

    if (!currentUser) {
        return;
    }


    const id =
        $("sizeId").value.trim();

    const name =
        $("sizeName").value.trim();

    const displayOrder =
        Number(
            $("sizeDisplayOrder").value || 0
        );

    const isActive =
        $("sizeActive").checked;


    if (!name) {

        showMessage(
            "sizeFormMessage",
            "Informe o tamanho."
        );

        return;
    }


    const payload = {
        name,
        display_order: displayOrder,
        is_active: isActive
    };


    try {

        let query;


        if (id) {

            query = await supabaseClient
                .from("sizes")
                .update(payload)
                .eq("id", id)
                .eq("user_id", currentUser.id);

        } else {

            query = await supabaseClient
                .from("sizes")
                .insert({
                    ...payload,
                    user_id: currentUser.id
                });
        }


        if (query.error) {
            throw query.error;
        }


        closeModal("sizeModal");

        await loadSizes();

    } catch (error) {

        console.error(
            "Erro ao salvar tamanho:",
            error
        );

        showMessage(
            "sizeFormMessage",
            error.message ||
            "Não foi possível salvar o tamanho."
        );
    }
}


async function deleteSize(id) {

    if (!currentUser) {
        return;
    }


    if (!confirm("Excluir este tamanho?")) {
        return;
    }


    const {
        error
    } = await supabaseClient
        .from("sizes")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id);


    if (error) {

        console.error(
            "Erro ao excluir tamanho:",
            error
        );

        alert(
            "Não foi possível excluir este tamanho. Ele pode estar vinculado a produtos."
        );

        return;
    }


    await loadSizes();
}


// =========================================================
// VARIAÇÕES DO PRODUTO
// =========================================================

function renderProductVariationOptions() {

    const colorSelect =
        $("productVariationColor");

    const sizeSelect =
        $("productVariationSize");


    if (colorSelect) {

        const currentColor =
            colorSelect.value;

        colorSelect.innerHTML = `
            <option value="">Selecione a cor</option>
        `;

        colorsCache
            .filter(color => color.is_active !== false)
            .forEach(color => {

                const option =
                    document.createElement("option");

                option.value =
                    color.id;

                option.textContent =
                    color.name;

                option.dataset.colorName =
                    color.name || "";

                option.dataset.colorHex =
                    color.hex_code || "#cccccc";

                colorSelect.appendChild(option);
            });

        if ([...colorSelect.options]
            .some(option => option.value === currentColor)) {

            colorSelect.value =
                currentColor;
        }
    }


    if (sizeSelect) {

        const currentSize =
            sizeSelect.value;

        sizeSelect.innerHTML = `
            <option value="">Selecione o tamanho</option>
        `;

        sizesCache
            .filter(size => size.is_active !== false)
            .forEach(size => {

                const option =
                    document.createElement("option");

                option.value =
                    size.id;

                option.textContent =
                    size.name;

                option.dataset.sizeName =
                    size.name || "";

                sizeSelect.appendChild(option);
            });

        if ([...sizeSelect.options]
            .some(option => option.value === currentSize)) {

            sizeSelect.value =
                currentSize;
        }
    }
}


function renderProductVariationsList() {

    const container =
        $("productVariantsList");

    if (!container) {
        return;
    }


    if (!productVariationsDraft.length) {

        container.innerHTML = `
            <div class="empty-state compact">
                <strong>Nenhuma variação adicionada</strong>
                <p>Selecione cor, tamanho e quantidade acima.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        productVariationsDraft.map((variation, index) => {

            const hex =
                variation.colorHex || "#cccccc";

            return `

                <div
                    class="product-variant-draft-item"
                    data-variation-index="${index}"
                >

                    <div class="product-variant-draft-info">

                        <span
                            class="variation-color-dot"
                            style="background:${escapeHtml(hex)}"
                        ></span>

                        <strong>
                            ${escapeHtml(variation.colorName || "Sem cor")}
                        </strong>

                        <span class="product-variant-draft-size">
                            ${escapeHtml(variation.sizeName || "Sem tamanho")}
                        </span>

                    </div>

                    <div class="product-variant-draft-actions">

                        <label class="product-variant-quantity-control">
                            <span>Qtd.</span>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                inputmode="numeric"
                                value="${Number(variation.quantity || 0)}"
                                data-variation-quantity="${index}"
                                aria-label="Quantidade da variação ${escapeHtml(variation.colorName || "")} ${escapeHtml(variation.sizeName || "")}"
                            >
                        </label>

                        <button
                            type="button"
                            class="icon-button danger"
                            data-remove-variation="${index}"
                            aria-label="Remover variação"
                            title="Remover variação"
                        >
                            🗑
                        </button>

                    </div>

                </div>

            `;

        }).join("");
}


function addProductVariation() {

    const colorSelect =
        $("productVariationColor");

    const sizeSelect =
        $("productVariationSize");

    const quantityInput =
        $("productVariationQuantity");


    if (!colorSelect || !sizeSelect || !quantityInput) {
        return;
    }


    const colorId =
        colorSelect.value;

    const sizeId =
        sizeSelect.value;

    const quantity =
        Number(quantityInput.value || 0);


    if (!colorId) {

        showMessage(
            "productFormMessage",
            "Selecione uma cor para adicionar a variação."
        );

        colorSelect.focus();
        return;
    }


    if (!sizeId) {

        showMessage(
            "productFormMessage",
            "Selecione um tamanho para adicionar a variação."
        );

        sizeSelect.focus();
        return;
    }


    if (!Number.isInteger(quantity) || quantity < 0) {

        showMessage(
            "productFormMessage",
            "Informe uma quantidade inteira igual ou maior que zero."
        );

        quantityInput.focus();
        return;
    }


    const alreadyExists =
        productVariationsDraft.some(
            variation =>
                variation.colorId === colorId &&
                variation.sizeId === sizeId
        );


    if (alreadyExists) {

        showMessage(
            "productFormMessage",
            "Essa combinação de cor e tamanho já foi adicionada."
        );

        return;
    }


    const color =
        colorsCache.find(item => item.id === colorId);

    const size =
        sizesCache.find(item => item.id === sizeId);


    productVariationsDraft.push({
        colorId,
        colorName: color?.name || colorSelect.selectedOptions[0]?.textContent || "",
        colorHex: color?.hex_code || colorSelect.selectedOptions[0]?.dataset.colorHex || "#cccccc",
        sizeId,
        sizeName: size?.name || sizeSelect.selectedOptions[0]?.textContent || "",
        quantity
    });


    renderProductVariationsList();


    quantityInput.value = "1";
    colorSelect.value = "";
    sizeSelect.value = "";


    showMessage(
        "productFormMessage",
        "Variação adicionada.",
        "success"
    );
}


function removeProductVariation(index) {

    const numericIndex =
        Number(index);


    if (
        !Number.isInteger(numericIndex) ||
        numericIndex < 0 ||
        numericIndex >= productVariationsDraft.length
    ) {
        return;
    }


    productVariationsDraft.splice(
        numericIndex,
        1
    );


    renderProductVariationsList();
}


function updateProductVariationQuantity(index, value) {

    const numericIndex =
        Number(index);

    if (!productVariationsDraft[numericIndex]) {
        return;
    }


    const quantity =
        Number(value);


    if (
        !Number.isInteger(quantity) ||
        quantity < 0
    ) {
        return;
    }


    productVariationsDraft[numericIndex].quantity =
        quantity;
}


function generateBatchVariations() {

    const activeColors =
        colorsCache.filter(
            color => color.is_active !== false
        );

    const activeSizes =
        sizesCache.filter(
            size => size.is_active !== false
        );


    if (!activeColors.length || !activeSizes.length) {

        showMessage(
            "productFormMessage",
            "Cadastre pelo menos uma cor e um tamanho antes de gerar combinações."
        );

        return;
    }


    const quantityValue =
        prompt(
            "Qual quantidade deve ser aplicada às novas combinações?",
            "1"
        );


    if (quantityValue === null) {
        return;
    }


    const quantity =
        Number(quantityValue);


    if (
        !Number.isInteger(quantity) ||
        quantity < 0
    ) {

        showMessage(
            "productFormMessage",
            "Informe uma quantidade inteira igual ou maior que zero."
        );

        return;
    }


    let added = 0;


    activeColors.forEach(color => {

        activeSizes.forEach(size => {

            const exists =
                productVariationsDraft.some(
                    variation =>
                        variation.colorId === color.id &&
                        variation.sizeId === size.id
                );


            if (exists) {
                return;
            }


            productVariationsDraft.push({
                colorId: color.id,
                colorName: color.name || "",
                colorHex: color.hex_code || "#cccccc",
                sizeId: size.id,
                sizeName: size.name || "",
                quantity
            });


            added += 1;
        });

    });


    renderProductVariationsList();


    showMessage(
        "productFormMessage",
        added
            ? `${added} combinação(ões) adicionada(s).`
            : "Todas as combinações já estavam adicionadas.",
        "success"
    );
}


// =========================================================
// PRODUTOS
// =========================================================

async function loadProducts() {

    if (!currentUser) {
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
        .eq("user_id", currentUser.id)
        .order("name");


    if (error) {

        console.error(
            "Erro ao carregar produtos:",
            error
        );

        return;
    }


    productsCache =
        data || [];


    renderProducts();
}


function renderProducts() {

    const container =
        $("productsList");

    if (!container) {
        return;
    }


    if (!productsCache.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">P</div>
                <strong>Nenhum produto cadastrado</strong>
                <p>Cadastre seu primeiro produto para começar a controlar o estoque.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        productsCache.map(product => `

            <div class="product-card">

                <div class="product-card-info">

                    <strong>
                        ${escapeHtml(product.name)}
                    </strong>

                    <span>
                        ${escapeHtml(product.sku || "Sem SKU")}
                    </span>

                    <small>
                        ${
                            escapeHtml(
                                product.categories?.name ||
                                "Sem categoria"
                            )
                        }
                    </small>

                </div>


                <div class="product-card-price">

                    <strong>
                        ${formatCurrency(product.sale_price)}
                    </strong>

                    <small>
                        Custo:
                        ${formatCurrency(product.cost_price)}
                    </small>

                </div>

            </div>

        `).join("");
}


function resetProductForm() {

    const form =
        $("productForm");

    if (!form) {
        return;
    }


    form.reset();


    $("productId").value = "";

    $("productMinimumStock").value = "0";

    $("productActive").checked = true;


    productVariationsDraft = [];


    const photoPreview =
        $("productPhotoPreview");

    if (photoPreview) {
        photoPreview.innerHTML = "";
    }


    showMessage(
        "productFormMessage",
        ""
    );


    renderProductVariationOptions();
    renderProductVariationsList();
    populateCategorySelect();
}


function openProductModal() {

    resetProductForm();

    openModal("productModal");
}


async function saveProduct(event) {

    event.preventDefault();

    if (!currentUser) {
        return;
    }


    const button =
        event.submitter;


    const name =
        $("productName").value.trim();

    const sku =
        $("productSku").value.trim();

    const categoryId =
        $("productCategory").value || null;

    const description =
        $("productDescription").value.trim();

    const costPrice =
        Number(
            $("productCostPrice").value || 0
        );

    const salePrice =
        Number(
            $("productSalePrice").value || 0
        );

    const minimumStock =
        Number(
            $("productMinimumStock").value || 0
        );

    const isActive =
        $("productActive").checked;


    if (!name) {

        showMessage(
            "productFormMessage",
            "Informe o nome do produto."
        );

        return;
    }


    if (salePrice < 0 || costPrice < 0) {

        showMessage(
            "productFormMessage",
            "Os preços não podem ser negativos."
        );

        return;
    }


    if (!Number.isInteger(minimumStock) || minimumStock < 0) {

        showMessage(
            "productFormMessage",
            "O estoque mínimo deve ser um número inteiro igual ou maior que zero."
        );

        return;
    }


    setLoading(
        button,
        true,
        "Salvando..."
    );


    let createdProductId = null;


    try {

        const {
            data: product,
            error: productError
        } = await supabaseClient
            .from("products")
            .insert({
                user_id: currentUser.id,
                category_id: categoryId,
                name,
                sku: sku || null,
                description: description || null,
                cost_price: costPrice,
                sale_price: salePrice,
                minimum_stock: minimumStock,
                is_active: isActive
            })
            .select()
            .single();


        if (productError) {
            throw productError;
        }


        createdProductId =
            product.id;


        // =============================================
        // CRIA SOMENTE AS VARIAÇÕES ADICIONADAS PELO USUÁRIO
        // =============================================

        if (productVariationsDraft.length) {

            const variants =
                productVariationsDraft.map(variation => ({
                    user_id: currentUser.id,
                    product_id: product.id,
                    color_id: variation.colorId,
                    size_id: variation.sizeId,
                    stock_quantity: Number(variation.quantity || 0),
                    minimum_stock: minimumStock,
                    is_active: true
                }));


            const {
                error: variantsError
            } = await supabaseClient
                .from("product_variants")
                .insert(variants);


            if (variantsError) {

                console.error(
                    "Erro ao criar variações:",
                    variantsError
                );

                throw new Error(
                    "Não foi possível criar as variações do produto. O produto será desfeito."
                );
            }
        }


        closeModal("productModal");

        productVariationsDraft = [];

        await loadProducts();

        await loadStock();

        await loadDashboard();

    } catch (error) {

        console.error(
            "Erro ao salvar produto:",
            error
        );


        // Se o produto foi criado mas as variações falharam,
        // tenta remover o produto para evitar cadastro incompleto.
        if (createdProductId) {

            const {
                error: cleanupError
            } = await supabaseClient
                .from("products")
                .delete()
                .eq("id", createdProductId)
                .eq("user_id", currentUser.id);


            if (cleanupError) {

                console.error(
                    "Erro ao desfazer produto após falha:",
                    cleanupError
                );
            }
        }


        showMessage(
            "productFormMessage",
            error.message ||
            "Não foi possível salvar o produto."
        );

    } finally {

        setLoading(
            button,
            false
        );
    }
}


// =========================================================
// ESTOQUE
// =========================================================

async function loadVariants() {

    if (!currentUser) {
        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("product_variants")
        .select(`
            *,
            products (
                id,
                name,
                sale_price,
                minimum_stock
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
        .eq("user_id", currentUser.id);


    if (error) {

        console.error(
            "Erro ao carregar variações:",
            error
        );

        variantsCache = [];

        return;
    }


    variantsCache =
        data || [];
}


async function loadStock() {

    await loadVariants();


    const total =
        variantsCache.reduce(
            (sum, variant) =>
                sum + Number(
                    variant.stock_quantity || 0
                ),
            0
        );


    const low =
        variantsCache.filter(variant => {

            const stock =
                Number(
                    variant.stock_quantity || 0
                );

            const minimum =
                Number(
                    variant.minimum_stock ??
                    variant.products?.minimum_stock ??
                    0
                );

            return stock > 0 &&
                stock <= minimum;

        }).length;


    const zero =
        variantsCache.filter(
            variant =>
                Number(
                    variant.stock_quantity || 0
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


    renderStock();
}


function renderStock() {

    const container =
        $("stockList");

    if (!container) {
        return;
    }


    if (!variantsCache.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">E</div>
                <strong>Estoque vazio</strong>
                <p>As variações dos produtos aparecerão aqui.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        variantsCache.map(variant => {

            const productName =
                variant.products?.name ||
                "Produto";

            const colorName =
                variant.colors?.name ||
                "Sem cor";

            const sizeName =
                variant.sizes?.name ||
                "Sem tamanho";

            const stock =
                Number(
                    variant.stock_quantity || 0
                );


            const minimum =
                Number(
                    variant.minimum_stock ??
                    variant.products?.minimum_stock ??
                    0
                );


            let status =
                "normal";

            if (stock === 0) {
                status = "zero";
            } else if (stock <= minimum) {
                status = "low";
            }


            return `

                <div class="stock-card">

                    <div class="stock-card-info">

                        <strong>
                            ${escapeHtml(productName)}
                        </strong>

                        <span>
                            ${escapeHtml(colorName)}
                            /
                            ${escapeHtml(sizeName)}
                        </span>

                    </div>


                    <div class="stock-card-quantity ${status}">

                        <strong>
                            ${stock}
                        </strong>

                        <small>
                            unidades
                        </small>

                    </div>

                </div>

            `;

        }).join("");
}


// =========================================================
// VENDAS
// =========================================================

async function loadSales() {

    if (!currentUser) {
        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("sales")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("sale_date", {
            ascending: false
        });


    if (error) {

        console.error(
            "Erro ao carregar vendas:",
            error
        );

        return;
    }


    salesCache =
        data || [];


    renderSales();

    updateSalesMetrics();
}


function updateSalesMetrics() {

    const today =
        todayISO();


    const todaySales =
        salesCache.filter(sale => {

            return String(
                sale.sale_date || ""
            ).startsWith(today);

        });


    const total =
        todaySales.reduce(
            (sum, sale) =>
                sum + Number(
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
}


function renderSales() {

    const container =
        $("salesList");

    if (!container) {
        return;
    }


    if (!salesCache.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">V</div>
                <strong>Nenhuma venda</strong>
                <p>As vendas registradas aparecerão aqui.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        salesCache.map(sale => `

            <div class="sale-card">

                <div>

                    <strong>
                        Venda #${sale.sale_number}
                    </strong>

                    <span>
                        ${new Date(
                            sale.sale_date
                        ).toLocaleDateString("pt-BR")}
                    </span>

                </div>


                <strong>
                    ${formatCurrency(sale.total)}
                </strong>

            </div>

        `).join("");
}


// =========================================================
// FINANCEIRO
// =========================================================

async function loadFinance() {

    if (!currentUser) {
        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("financial_transactions")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("transaction_date", {
            ascending: false
        });


    if (error) {

        console.error(
            "Erro ao carregar financeiro:",
            error
        );

        return;
    }


    financeCache =
        data || [];


    renderFinance();

    updateFinanceMetrics();
}


function updateFinanceMetrics() {

    const income =
        financeCache
            .filter(
                transaction =>
                    transaction.transaction_type ===
                    "income"
            )
            .reduce(
                (sum, transaction) =>
                    sum + Number(
                        transaction.amount || 0
                    ),
                0
            );


    const expenses =
        financeCache
            .filter(
                transaction =>
                    transaction.transaction_type ===
                    "expense"
            )
            .reduce(
                (sum, transaction) =>
                    sum + Number(
                        transaction.amount || 0
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
}


function renderFinance() {

    const container =
        $("financeList");

    if (!container) {
        return;
    }


    if (!financeCache.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">F</div>
                <strong>Nenhum lançamento</strong>
                <p>Receitas e despesas aparecerão aqui.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        financeCache.map(transaction => {

            const income =
                transaction.transaction_type ===
                "income";


            return `

                <div class="finance-card">

                    <div>

                        <strong>
                            ${escapeHtml(
                                transaction.description
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                transaction.category ||
                                "Sem categoria"
                            )}
                        </span>

                    </div>


                    <strong class="${
                        income
                            ? "income"
                            : "expense"
                    }">

                        ${income ? "+" : "-"}
                        ${formatCurrency(
                            transaction.amount
                        )}

                    </strong>

                </div>

            `;

        }).join("");
}


function openTransactionModal() {

    const form =
        $("transactionForm");

    if (!form) {
        return;
    }


    form.reset();


    $("transactionDate").value =
        todayISO();


    showMessage(
        "transactionFormMessage",
        ""
    );


    openModal("transactionModal");
}


async function saveTransaction(event) {

    event.preventDefault();

    if (!currentUser) {
        return;
    }


    const type =
        $("transactionType").value;

    const category =
        $("transactionCategory").value.trim();

    const description =
        $("transactionDescription").value.trim();

    const amount =
        Number(
            $("transactionAmount").value || 0
        );

    const date =
        $("transactionDate").value;

    const paymentMethod =
        $("transactionPaymentMethod").value;

    const notes =
        $("transactionNotes").value.trim();


    if (!type) {

        showMessage(
            "transactionFormMessage",
            "Selecione o tipo do lançamento."
        );

        return;
    }


    if (!description) {

        showMessage(
            "transactionFormMessage",
            "Informe a descrição."
        );

        return;
    }


    if (amount <= 0) {

        showMessage(
            "transactionFormMessage",
            "Informe um valor maior que zero."
        );

        return;
    }


    try {

        const {
            error
        } = await supabaseClient
            .from("financial_transactions")
            .insert({
                user_id: currentUser.id,
                transaction_type: type,
                category: category || null,
                description,
                amount,
                transaction_date: date,
                payment_method:
                    paymentMethod || null,
                notes: notes || null
            });


        if (error) {
            throw error;
        }


        closeModal("transactionModal");

        await loadFinance();

        await loadDashboard();

    } catch (error) {

        console.error(
            "Erro ao salvar lançamento:",
            error
        );

        showMessage(
            "transactionFormMessage",
            error.message ||
            "Não foi possível salvar o lançamento."
        );
    }
}


// =========================================================
// DASHBOARD
// =========================================================

async function loadDashboard() {

    if (!currentUser) {
        return;
    }


    await Promise.all([
        loadSales(),
        loadFinance(),
        loadVariants()
    ]);


    const today =
        todayISO();


    const todaySales =
        salesCache.filter(
            sale =>
                String(
                    sale.sale_date || ""
                ).startsWith(today)
        );


    const todayRevenue =
        todaySales.reduce(
            (sum, sale) =>
                sum + Number(
                    sale.total || 0
                ),
            0
        );


    const todayExpenses =
        financeCache
            .filter(transaction =>
                transaction.transaction_type ===
                "expense" &&
                String(
                    transaction.transaction_date || ""
                ).startsWith(today)
            )
            .reduce(
                (sum, transaction) =>
                    sum + Number(
                        transaction.amount || 0
                    ),
                0
            );


    const lowStock =
        variantsCache.filter(variant => {

            const stock =
                Number(
                    variant.stock_quantity || 0
                );

            const minimum =
                Number(
                    variant.minimum_stock ??
                    variant.products?.minimum_stock ??
                    0
                );

            return stock <= minimum;

        }).length;


    if ($("metricSales")) {

        $("metricSales").textContent =
            formatCurrency(todayRevenue);
    }


    if ($("metricOrders")) {

        $("metricOrders").textContent =
            todaySales.length;
    }


    if ($("metricLowStock")) {

        $("metricLowStock").textContent =
            lowStock;
    }


    if ($("metricExpenses")) {

        $("metricExpenses").textContent =
            formatCurrency(todayExpenses);
    }
}


// =========================================================
// MODAIS
// =========================================================

function openModal(id) {

    const modal =
        $(id);

    if (!modal) {
        return;
    }


    modal.hidden = false;

    document.body.classList.add(
        "modal-open"
    );
}


function closeModal(id) {

    const modal =
        $(id);

    if (!modal) {
        return;
    }


    modal.hidden = true;

    document.body.classList.remove(
        "modal-open"
    );
}


// =========================================================
// EVENTOS
// =========================================================

function bindEvents() {

    // =============================================
    // LOGIN
    // =============================================

    const loginForm =
        $("loginForm");


    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            handleLogin
        );
    }


    // =============================================
    // LOGOUT
    // =============================================

    const logoutButton =
        $("logoutButton");


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            handleLogout
        );
    }


    // =============================================
    // NAVEGAÇÃO
    // =============================================

    document
        .querySelectorAll(
            "[data-section]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const section =
                        button.dataset.section;

                    if (section) {
                        showSection(section);
                    }

                }
            );

        });


    // =============================================
    // NOVOS
    // =============================================

    $("newProductButton")
        ?.addEventListener(
            "click",
            openProductModal
        );


    $("newCategoryButton")
        ?.addEventListener(
            "click",
            () => openCategoryModal()
        );


    $("newColorButton")
        ?.addEventListener(
            "click",
            () => openColorModal()
        );


    $("newSizeButton")
        ?.addEventListener(
            "click",
            () => openSizeModal()
        );


    $("newSaleButton")
        ?.addEventListener(
            "click",
            () => openModal("saleModal")
        );


    $("newTransactionButton")
        ?.addEventListener(
            "click",
            openTransactionModal
        );


    // =============================================
    // FORMULÁRIOS
    // =============================================

    $("productForm")
        ?.addEventListener(
            "submit",
            saveProduct
        );


    $("categoryForm")
        ?.addEventListener(
            "submit",
            saveCategory
        );


    $("colorForm")
        ?.addEventListener(
            "submit",
            saveColor
        );


    $("sizeForm")
        ?.addEventListener(
            "submit",
            saveSize
        );


    $("transactionForm")
        ?.addEventListener(
            "submit",
            saveTransaction
        );


    // =============================================
    // COLOR PICKER
    // =============================================

    $("colorHex")
        ?.addEventListener(
            "input",
            syncColorPreview
        );


    $("colorHexText")
        ?.addEventListener(
            "input",
            event => {

                let value =
                    event.target.value.trim();

                if (
                    !value.startsWith("#")
                ) {
                    value =
                        "#" + value;
                }

                if (
                    /^#[0-9A-Fa-f]{6}$/.test(value)
                ) {

                    $("colorHex").value =
                        value;

                    syncColorPreview();
                }
            }
        );


    // =============================================
    // VARIAÇÕES DO PRODUTO
    // =============================================

    $("addProductVariationButton")
        ?.addEventListener(
            "click",
            addProductVariation
        );


    $("openBatchVariationButton")
        ?.addEventListener(
            "click",
            generateBatchVariations
        );


    $("productVariationColor")
        ?.addEventListener(
            "change",
            () => showMessage("productFormMessage", "")
        );


    $("productVariationSize")
        ?.addEventListener(
            "change",
            () => showMessage("productFormMessage", "")
        );


    $("productVariationQuantity")
        ?.addEventListener(
            "input",
            () => showMessage("productFormMessage", "")
        );


    document.addEventListener(
        "click",
        event => {

            const removeVariation =
                event.target.closest(
                    "[data-remove-variation]"
                );


            if (removeVariation) {

                removeProductVariation(
                    removeVariation.dataset.removeVariation
                );

                return;
            }
        }
    );


    document.addEventListener(
        "input",
        event => {

            const quantityInput =
                event.target.closest(
                    "[data-variation-quantity]"
                );


            if (quantityInput) {

                updateProductVariationQuantity(
                    quantityInput.dataset.variationQuantity,
                    quantityInput.value
                );
            }
        }
    );


    // =============================================
    // FECHAR MODAIS
    // =============================================

    document.addEventListener(
        "click",
        event => {

            const closeButton =
                event.target.closest(
                    "[data-close-modal]"
                );


            if (closeButton) {

                closeModal(
                    closeButton.dataset.closeModal
                );

                return;
            }


            const modal =
                event.target.closest(".modal");


            if (
                modal &&
                event.target === modal
            ) {

                closeModal(
                    modal.id
                );
            }

        }
    );


    // =============================================
    // AÇÕES DE CATEGORIA / COR / TAMANHO
    // =============================================

    document.addEventListener(
        "click",
        event => {

            const editCategory =
                event.target.closest(
                    "[data-edit-category]"
                );


            if (editCategory) {

                const category =
                    categoriesCache.find(
                        item =>
                            item.id ===
                            editCategory.dataset.editCategory
                    );


                if (category) {
                    openCategoryModal(category);
                }

                return;
            }


            const deleteCategoryButton =
                event.target.closest(
                    "[data-delete-category]"
                );


            if (deleteCategoryButton) {

                deleteCategory(
                    deleteCategoryButton.dataset.deleteCategory
                );

                return;
            }


            const editColor =
                event.target.closest(
                    "[data-edit-color]"
                );


            if (editColor) {

                const color =
                    colorsCache.find(
                        item =>
                            item.id ===
                            editColor.dataset.editColor
                    );


                if (color) {
                    openColorModal(color);
                }

                return;
            }


            const deleteColorButton =
                event.target.closest(
                    "[data-delete-color]"
                );


            if (deleteColorButton) {

                deleteColor(
                    deleteColorButton.dataset.deleteColor
                );

                return;
            }


            const editSize =
                event.target.closest(
                    "[data-edit-size]"
                );


            if (editSize) {

                const size =
                    sizesCache.find(
                        item =>
                            item.id ===
                            editSize.dataset.editSize
                    );


                if (size) {
                    openSizeModal(size);
                }

                return;
            }


            const deleteSizeButton =
                event.target.closest(
                    "[data-delete-size]"
                );


            if (deleteSizeButton) {

                deleteSize(
                    deleteSizeButton.dataset.deleteSize
                );
            }

        }
    );


    // =============================================
    // BUSCAS
    // =============================================

    $("productSearch")
        ?.addEventListener(
            "input",
            filterProducts
        );


    $("stockSearch")
        ?.addEventListener(
            "input",
            filterStock
        );


    $("salesSearch")
        ?.addEventListener(
            "input",
            filterSales
        );


    $("financeSearch")
        ?.addEventListener(
            "input",
            filterFinance
        );
}


// =========================================================
// FILTROS
// =========================================================

function filterProducts(event) {

    const search =
        event.target.value
            .toLowerCase()
            .trim();


    const filtered =
        productsCache.filter(product => {

            return (
                product.name
                    ?.toLowerCase()
                    .includes(search)
            ) ||
            (
                product.sku
                    ?.toLowerCase()
                    .includes(search)
            );

        });


    renderProductCollection(filtered);
}


function renderProductCollection(products) {

    const container =
        $("productsList");

    if (!container) {
        return;
    }


    if (!products.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">P</div>
                <strong>Nenhum produto encontrado</strong>
                <p>Tente outro termo de busca.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        products.map(product => `

            <div class="product-card">

                <div class="product-card-info">

                    <strong>
                        ${escapeHtml(product.name)}
                    </strong>

                    <span>
                        ${escapeHtml(product.sku || "Sem SKU")}
                    </span>

                    <small>
                        ${escapeHtml(
                            product.categories?.name ||
                            "Sem categoria"
                        )}
                    </small>

                </div>

                <div class="product-card-price">

                    <strong>
                        ${formatCurrency(product.sale_price)}
                    </strong>

                </div>

            </div>

        `).join("");
}


function filterStock(event) {

    const search =
        event.target.value
            .toLowerCase()
            .trim();


    const filtered =
        variantsCache.filter(variant => {

            const text = [

                variant.products?.name,
                variant.colors?.name,
                variant.sizes?.name

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            return text.includes(search);
        });


    renderStockCollection(filtered);
}


function renderStockCollection(variants) {

    const container =
        $("stockList");

    if (!container) {
        return;
    }


    if (!variants.length) {

        container.innerHTML = `
            <div class="empty-state">
                <strong>Nenhum resultado</strong>
                <p>Nenhuma variação corresponde à busca.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        variants.map(variant => `

            <div class="stock-card">

                <div class="stock-card-info">

                    <strong>
                        ${escapeHtml(
                            variant.products?.name ||
                            "Produto"
                        )}
                    </strong>

                    <span>
                        ${escapeHtml(
                            variant.colors?.name ||
                            "Sem cor"
                        )}
                        /
                        ${escapeHtml(
                            variant.sizes?.name ||
                            "Sem tamanho"
                        )}
                    </span>

                </div>

                <div class="stock-card-quantity">

                    <strong>
                        ${Number(
                            variant.stock_quantity || 0
                        )}
                    </strong>

                    <small>
                        unidades
                    </small>

                </div>

            </div>

        `).join("");
}


function filterSales(event) {

    const search =
        event.target.value
            .toLowerCase()
            .trim();


    const filtered =
        salesCache.filter(sale => {

            return String(
                sale.sale_number || ""
            ).includes(search);

        });


    const container =
        $("salesList");

    if (!container) {
        return;
    }


    if (!filtered.length) {

        container.innerHTML = `
            <div class="empty-state">
                <strong>Nenhuma venda encontrada</strong>
            </div>
        `;

        return;
    }


    container.innerHTML =
        filtered.map(sale => `

            <div class="sale-card">

                <div>

                    <strong>
                        Venda #${sale.sale_number}
                    </strong>

                    <span>
                        ${new Date(
                            sale.sale_date
                        ).toLocaleDateString("pt-BR")}
                    </span>

                </div>

                <strong>
                    ${formatCurrency(sale.total)}
                </strong>

            </div>

        `).join("");
}


function filterFinance(event) {

    const search =
        event.target.value
            .toLowerCase()
            .trim();


    const filtered =
        financeCache.filter(transaction => {

            const text = [

                transaction.description,
                transaction.category

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            return text.includes(search);
        });


    const container =
        $("financeList");

    if (!container) {
        return;
    }


    if (!filtered.length) {

        container.innerHTML = `
            <div class="empty-state">
                <strong>Nenhum lançamento encontrado</strong>
            </div>
        `;

        return;
    }


    container.innerHTML =
        filtered.map(transaction => {

            const income =
                transaction.transaction_type ===
                "income";


            return `

                <div class="finance-card">

                    <div>

                        <strong>
                            ${escapeHtml(
                                transaction.description
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                transaction.category ||
                                "Sem categoria"
                            )}
                        </span>

                    </div>

                    <strong class="${
                        income
                            ? "income"
                            : "expense"
                    }">

                        ${income ? "+" : "-"}
                        ${formatCurrency(
                            transaction.amount
                        )}

                    </strong>

                </div>

            `;

        }).join("");
}


// =========================================================
// CARREGAMENTO INICIAL
// =========================================================

async function loadProductsPage() {

    await Promise.all([
        loadCategories(),
        loadColors(),
        loadSizes(),
        loadProducts()
    ]);

}


async function loadInitialData() {

    await Promise.all([
        loadCategories(),
        loadColors(),
        loadSizes(),
        loadProducts(),
        loadVariants(),
        loadSales(),
        loadFinance()
    ]);


    await loadDashboard();
}


// =========================================================
// INICIALIZAÇÃO
// =========================================================

async function checkSession() {

    try {

        const {
            data,
            error
        } = await supabaseClient.auth.getSession();


        if (error) {
            throw error;
        }


        if (data?.session?.user) {

            await showApplication(
                data.session.user
            );

        } else {

            const loginScreen =
                $("loginScreen");

            const appScreen =
                $("appScreen");


            if (loginScreen) {
                loginScreen.hidden = false;
            }

            if (appScreen) {
                appScreen.hidden = true;
            }
        }

    } catch (error) {

        console.error(
            "Erro ao verificar sessão:",
            error
        );

        const loginScreen =
            $("loginScreen");

        const appScreen =
            $("appScreen");


        if (loginScreen) {
            loginScreen.hidden = false;
        }

        if (appScreen) {
            appScreen.hidden = true;
        }
    }
}


// =========================================================
// START
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "MabijuFit iniciando..."
        );


        if (
            typeof supabaseClient ===
            "undefined"
        ) {

            console.error(
                "supabaseClient não encontrado."
            );

            showMessage(
                "loginMessage",
                "Erro de conexão com o sistema."
            );

            return;
        }


        bindEvents();


        supabaseClient.auth.onAuthStateChange(
            async (event, session) => {

                console.log(
                    "Auth:",
                    event
                );


                if (
                    event === "SIGNED_IN" &&
                    session?.user
                ) {

                    await showApplication(
                        session.user
                    );

                }


                if (
                    event === "SIGNED_OUT"
                ) {

                    currentUser = null;
                    appInitialized = false;


                    if ($("appScreen")) {
                        $("appScreen").hidden = true;
                    }

                    if ($("loginScreen")) {
                        $("loginScreen").hidden = false;
                    }
                }

            }
        );


        await checkSession();

    }
);
