/* =========================================================
   MABIJUFIT — APP.JS
   VERSÃO CONSOLIDADA
   Produtos + Cores + Tamanhos + Variações + Estoque
   ========================================================= */

"use strict";


/* =========================================================
   HELPERS
   ========================================================= */

const $ = (id) => document.getElementById(id);

const $$ = (selector) => {
    return Array.from(document.querySelectorAll(selector));
};


function escapeHTML(value) {

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


function money(value) {

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


function formatDate(value) {

    if (!value) {
        return "";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("pt-BR");
}


function normalizeHex(value) {

    if (!value) {
        return "#000000";
    }

    let hex = String(value).trim();

    if (!hex.startsWith("#")) {
        hex = `#${hex}`;
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        return "#000000";
    }

    return hex.toUpperCase();
}


function showMessage(element, message, type = "error") {

    if (!element) {
        return;
    }

    element.textContent = message || "";

    element.style.color =
        type === "success"
            ? "#2f8f62"
            : "#b4235a";
}


function clearMessage(element) {

    if (!element) {
        return;
    }

    element.textContent = "";
}


function setButtonLoading(button, loading, loadingText = "Salvando...") {

    if (!button) {
        return;
    }

    if (loading) {

        button.dataset.originalText =
            button.textContent;

        button.disabled = true;
        button.textContent = loadingText;

        button.style.opacity = "0.7";

    } else {

        button.disabled = false;

        button.textContent =
            button.dataset.originalText ||
            button.textContent;

        button.style.opacity = "";
    }
}


/* =========================================================
   ESTADO DA APLICAÇÃO
   ========================================================= */

const state = {

    session: null,
    user: null,

    initialized: false,

    currentSection: "home",

    categories: [],
    colors: [],
    sizes: [],
    products: [],
    variants: [],

    sales: [],
    transactions: [],

    selectedProductColors: new Set(),
    selectedProductSizes: new Set(),

    productVariantDrafts: new Map()
};


/* =========================================================
   AUTH
   ========================================================= */

async function checkSession() {

    try {

        const {
            data,
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            console.error(error);
        }

        const session = data?.session || null;

        state.session = session;
        state.user = session?.user || null;

        updateAuthUI();

        if (session) {
            await initializeApp();
        }

    } catch (error) {

        console.error(
            "Erro ao verificar sessão:",
            error
        );

        updateAuthUI();
    }
}


function updateAuthUI() {

    const loginScreen = $("loginScreen");
    const appScreen = $("appScreen");

    if (!loginScreen || !appScreen) {
        return;
    }

    if (state.session) {

        loginScreen.hidden = true;
        appScreen.hidden = false;

        updateUserName();

    } else {

        loginScreen.hidden = false;
        appScreen.hidden = true;
    }
}


function updateUserName() {

    const userName = $("userName");

    if (!userName || !state.user) {
        return;
    }

    const fullName =
        state.user.user_metadata?.full_name ||
        state.user.user_metadata?.name ||
        state.user.email ||
        "MabijuFit";

    userName.textContent = fullName;
}


async function login(email, password) {

    const message = $("loginMessage");
    const button = $("loginButton");

    clearMessage(message);

    setButtonLoading(
        button,
        true,
        "Entrando..."
    );

    try {

        const {
            data,
            error
        } = await supabaseClient.auth.signInWithPassword({
            email: email.trim(),
            password
        });

        if (error) {
            throw error;
        }

        state.session = data.session;
        state.user = data.user;

        updateAuthUI();

        await initializeApp();

    } catch (error) {

        console.error(
            "Erro no login:",
            error
        );

        let text =
            error?.message ||
            "Não foi possível entrar.";

        if (
            text.toLowerCase().includes("invalid login credentials")
        ) {
            text =
                "E-mail ou senha incorretos.";
        }

        showMessage(
            message,
            text
        );

    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


async function logout() {

    try {

        await supabaseClient.auth.signOut();

    } catch (error) {

        console.error(
            "Erro ao sair:",
            error
        );

    } finally {

        state.session = null;
        state.user = null;

        state.initialized = false;

        updateAuthUI();

        showSection("home");
    }
}


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

async function initializeApp() {

    if (!state.user) {
        return;
    }

    if (state.initialized) {
        return;
    }

    state.initialized = true;

    updateUserName();

    await loadAllData();

    showSection("home");
}


async function loadAllData() {

    await Promise.all([
        loadCategories(),
        loadColors(),
        loadSizes(),
        loadProducts(),
        loadVariants(),
        loadSales(),
        loadTransactions()
    ]);

    populateCategorySelect();

    renderProductVariationSelectors();

    renderProducts();

    renderCategories();

    renderColors();

    renderSizes();

    renderStock();

    renderSales();

    renderFinance();

    updateDashboard();
}


/* =========================================================
   NAVEGAÇÃO
   ========================================================= */

function showSection(section) {

    const screens = {
        home: "homeScreen",
        products: "productsScreen",
        stock: "stockScreen",
        sales: "salesScreen",
        finance: "financeScreen"
    };

    Object.values(screens).forEach(id => {

        const element = $(id);

        if (element) {
            element.hidden = true;
        }
    });


    const target = $(screens[section]);

    if (target) {
        target.hidden = false;
    }


    $$(".nav-item").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.section === section
        );

    });


    state.currentSection = section;


    if (section === "home") {
        updateDashboard();
    }

    if (section === "products") {

        renderProducts();
        renderCategories();
        renderColors();
        renderSizes();

    }

    if (section === "stock") {
        renderStock();
    }

    if (section === "sales") {
        renderSales();
    }

    if (section === "finance") {
        renderFinance();
    }
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
}


function populateCategorySelect() {

    const select = $("productCategory");

    if (!select) {
        return;
    }

    const currentValue = select.value;

    select.innerHTML = `
        <option value="">Selecione</option>
    `;

    state.categories
        .filter(category => category.is_active !== false)
        .forEach(category => {

            const option =
                document.createElement("option");

            option.value = category.id;
            option.textContent = category.name;

            select.appendChild(option);
        });

    if (currentValue) {
        select.value = currentValue;
    }
}


function renderCategories() {

    const container = $("categoriesList");

    if (!container) {
        return;
    }

    if (!state.categories.length) {

        container.innerHTML = `
            <div class="empty-state">
                <strong>Nenhuma categoria cadastrada</strong>
                <p>
                    Crie categorias para organizar seus produtos.
                </p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        state.categories.map(category => {

            return `
                <article class="category-card">

                    <div class="category-card-header">

                        <div>
                            <div class="category-card-name">
                                ${escapeHTML(category.name)}
                            </div>

                            ${
                                category.is_active === false
                                    ? `<div class="category-card-description">Inativa</div>`
                                    : ""
                            }

                        </div>

                    </div>

                    ${
                        category.description
                            ? `
                                <div class="category-card-description">
                                    ${escapeHTML(category.description)}
                                </div>
                            `
                            : ""
                    }

                    <div class="category-card-actions">

                        <button
                            type="button"
                            class="secondary-button"
                            data-edit-category="${category.id}"
                        >
                            Editar
                        </button>

                        <button
                            type="button"
                            class="secondary-button"
                            data-delete-category="${category.id}"
                        >
                            Excluir
                        </button>

                    </div>

                </article>
            `;

        }).join("");
}


function resetCategoryForm() {

    const form = $("categoryForm");

    if (form) {
        form.reset();
    }

    $("categoryId").value = "";

    $("categoryActive").checked = true;

    clearMessage(
        $("categoryFormMessage")
    );
}


function openCategoryModal(category = null) {

    resetCategoryForm();

    if (category) {

        $("categoryId").value =
            category.id;

        $("categoryName").value =
            category.name || "";

        $("categoryDescription").value =
            category.description || "";

        $("categoryActive").checked =
            category.is_active !== false;
    }

    openModal("categoryModal");
}


async function saveCategory(event) {

    event.preventDefault();

    if (!state.user) {
        return;
    }

    const message = $("categoryFormMessage");

    const button =
        event.submitter ||
        $("categoryForm")?.querySelector(
            'button[type="submit"]'
        );

    clearMessage(message);

    const name =
        $("categoryName").value.trim();

    if (!name) {

        showMessage(
            message,
            "Informe o nome da categoria."
        );

        return;
    }


    setButtonLoading(
        button,
        true
    );


    try {

        const id =
            $("categoryId").value;

        const payload = {

            user_id: state.user.id,

            name,

            description:
                $("categoryDescription")
                    .value
                    .trim() || null,

            is_active:
                $("categoryActive").checked
        };


        let result;


        if (id) {

            result =
                await supabaseClient
                    .from("categories")
                    .update(payload)
                    .eq("id", id)
                    .eq("user_id", state.user.id);

        } else {

            result =
                await supabaseClient
                    .from("categories")
                    .insert(payload);
        }


        if (result.error) {
            throw result.error;
        }


        showMessage(
            message,
            "Categoria salva com sucesso.",
            "success"
        );


        await loadCategories();

        populateCategorySelect();

        renderCategories();


        setTimeout(() => {

            closeModal("categoryModal");

        }, 400);


    } catch (error) {

        console.error(error);

        showMessage(
            message,
            error.message ||
            "Erro ao salvar categoria."
        );

    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


async function deleteCategory(id) {

    if (!id) {
        return;
    }

    const confirmed =
        window.confirm(
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
        .eq("user_id", state.user.id);


    if (error) {

        console.error(error);

        alert(
            "Não foi possível excluir a categoria."
        );

        return;
    }


    await loadCategories();

    populateCategorySelect();

    renderCategories();
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
}


function renderColors() {

    const container = $("colorsList");

    if (!container) {
        return;
    }


    if (!state.colors.length) {

        container.innerHTML = `
            <div class="empty-state">
                <strong>Nenhuma cor cadastrada</strong>
                <p>
                    Cadastre cores para usar nas variações.
                </p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        state.colors.map(color => {

            const hex =
                normalizeHex(color.hex_code);


            return `
                <article class="color-card">

                    <span
                        class="color-card-swatch"
                        style="background:${hex};"
                    ></span>


                    <div class="color-card-info">

                        <div class="color-card-text">

                            <div class="color-card-name">
                                ${escapeHTML(color.name)}
                            </div>

                            <div class="color-card-code">
                                ${hex}
                            </div>

                        </div>

                    </div>


                    <div class="color-card-actions">

                        <button
                            type="button"
                            class="secondary-button"
                            data-edit-color="${color.id}"
                        >
                            ✎
                        </button>

                        <button
                            type="button"
                            class="secondary-button"
                            data-delete-color="${color.id}"
                        >
                            ×
                        </button>

                    </div>

                </article>
            `;

        }).join("");
}


function resetColorForm() {

    const form = $("colorForm");

    if (form) {
        form.reset();
    }

    $("colorId").value = "";

    $("colorHex").value =
        "#E8A0B8";

    $("colorHexText").value =
        "#E8A0B8";

    $("colorPreview").style.background =
        "#E8A0B8";

    $("colorActive").checked = true;

    clearMessage(
        $("colorFormMessage")
    );
}


function openColorModal(color = null) {

    resetColorForm();

    if (color) {

        const hex =
            normalizeHex(color.hex_code);

        $("colorId").value =
            color.id;

        $("colorName").value =
            color.name || "";

        $("colorHex").value =
            hex;

        $("colorHexText").value =
            hex;

        $("colorPreview").style.background =
            hex;

        $("colorActive").checked =
            color.is_active !== false;
    }

    openModal("colorModal");
}


async function saveColor(event) {

    event.preventDefault();

    if (!state.user) {
        return;
    }

    const message =
        $("colorFormMessage");

    const button =
        event.submitter;

    clearMessage(message);


    const name =
        $("colorName").value.trim();

    const hex =
        normalizeHex(
            $("colorHexText").value
        );


    if (!name) {

        showMessage(
            message,
            "Informe o nome da cor."
        );

        return;
    }


    setButtonLoading(
        button,
        true
    );


    try {

        const id =
            $("colorId").value;


        const payload = {

            user_id:
                state.user.id,

            name,

            hex_code:
                hex,

            is_active:
                $("colorActive").checked
        };


        let result;


        if (id) {

            result =
                await supabaseClient
                    .from("colors")
                    .update(payload)
                    .eq("id", id)
                    .eq("user_id", state.user.id);

        } else {

            result =
                await supabaseClient
                    .from("colors")
                    .insert(payload);
        }


        if (result.error) {
            throw result.error;
        }


        await loadColors();

        renderColors();

        renderProductVariationSelectors();


        showMessage(
            message,
            "Cor salva com sucesso.",
            "success"
        );


        setTimeout(() => {

            closeModal("colorModal");

        }, 400);


    } catch (error) {

        console.error(error);

        showMessage(
            message,
            error.message ||
            "Erro ao salvar cor."
        );

    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


async function deleteColor(id) {

    if (!id) {
        return;
    }

    const confirmed =
        window.confirm(
            "Excluir esta cor?"
        );

    if (!confirmed) {
        return;
    }


    const {
        error
    } = await supabaseClient
        .from("colors")
        .delete()
        .eq("id", id)
        .eq("user_id", state.user.id);


    if (error) {

        console.error(error);

        alert(
            "Não foi possível excluir a cor. Ela pode estar vinculada a uma variação."
        );

        return;
    }


    state.selectedProductColors.delete(id);

    await loadColors();

    renderColors();

    renderProductVariationSelectors();

    generateVariantPreview();
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
}


function renderSizes() {

    const container = $("sizesList");

    if (!container) {
        return;
    }


    if (!state.sizes.length) {

        container.innerHTML = `
            <div class="empty-state">
                <strong>Nenhum tamanho cadastrado</strong>
                <p>
                    Cadastre tamanhos para usar nas variações.
                </p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        state.sizes.map(size => {

            return `
                <article class="size-card">

                    <div class="size-card-info">

                        <span class="size-badge">
                            ${escapeHTML(size.name)}
                        </span>

                        <div>

                            <div class="size-card-name">
                                Tamanho ${escapeHTML(size.name)}
                            </div>

                            <div class="size-card-order">
                                Ordem: ${Number(size.display_order || 0)}
                            </div>

                        </div>

                    </div>


                    <div class="size-card-actions">

                        <button
                            type="button"
                            class="secondary-button"
                            data-edit-size="${size.id}"
                        >
                            ✎
                        </button>

                        <button
                            type="button"
                            class="secondary-button"
                            data-delete-size="${size.id}"
                        >
                            ×
                        </button>

                    </div>

                </article>
            `;

        }).join("");
}


function resetSizeForm() {

    const form = $("sizeForm");

    if (form) {
        form.reset();
    }

    $("sizeId").value = "";

    $("sizeDisplayOrder").value =
        "0";

    $("sizeActive").checked = true;

    clearMessage(
        $("sizeFormMessage")
    );
}


function openSizeModal(size = null) {

    resetSizeForm();

    if (size) {

        $("sizeId").value =
            size.id;

        $("sizeName").value =
            size.name || "";

        $("sizeDisplayOrder").value =
            Number(size.display_order || 0);

        $("sizeActive").checked =
            size.is_active !== false;
    }

    openModal("sizeModal");
}


async function saveSize(event) {

    event.preventDefault();

    if (!state.user) {
        return;
    }

    const message =
        $("sizeFormMessage");

    const button =
        event.submitter;

    clearMessage(message);


    const name =
        $("sizeName").value.trim();


    if (!name) {

        showMessage(
            message,
            "Informe o tamanho."
        );

        return;
    }


    setButtonLoading(
        button,
        true
    );


    try {

        const id =
            $("sizeId").value;


        const payload = {

            user_id:
                state.user.id,

            name,

            display_order:
                Number(
                    $("sizeDisplayOrder").value || 0
                ),

            is_active:
                $("sizeActive").checked
        };


        let result;


        if (id) {

            result =
                await supabaseClient
                    .from("sizes")
                    .update(payload)
                    .eq("id", id)
                    .eq("user_id", state.user.id);

        } else {

            result =
                await supabaseClient
                    .from("sizes")
                    .insert(payload);
        }


        if (result.error) {
            throw result.error;
        }


        await loadSizes();

        renderSizes();

        renderProductVariationSelectors();


        showMessage(
            message,
            "Tamanho salvo com sucesso.",
            "success"
        );


        setTimeout(() => {

            closeModal("sizeModal");

        }, 400);


    } catch (error) {

        console.error(error);

        showMessage(
            message,
            error.message ||
            "Erro ao salvar tamanho."
        );

    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


async function deleteSize(id) {

    if (!id) {
        return;
    }

    const confirmed =
        window.confirm(
            "Excluir este tamanho?"
        );

    if (!confirmed) {
        return;
    }


    const {
        error
    } = await supabaseClient
        .from("sizes")
        .delete()
        .eq("id", id)
        .eq("user_id", state.user.id);


    if (error) {

        console.error(error);

        alert(
            "Não foi possível excluir o tamanho. Ele pode estar vinculado a uma variação."
        );

        return;
    }


    state.selectedProductSizes.delete(id);

    await loadSizes();

    renderSizes();

    renderProductVariationSelectors();

    generateVariantPreview();
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
        .select("*")
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
}


async function loadVariants() {

    if (!state.user) {
        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("product_variants")
        .select("*")
        .eq("user_id", state.user.id);


    if (error) {

        console.error(
            "Erro ao carregar variações:",
            error
        );

        return;
    }


    state.variants = data || [];
}


function getCategoryName(categoryId) {

    const category =
        state.categories.find(
            item => item.id === categoryId
        );

    return category?.name || "";
}


function getColor(colorId) {

    return state.colors.find(
        item => item.id === colorId
    );
}


function getSize(sizeId) {

    return state.sizes.find(
        item => item.id === sizeId
    );
}


function getProductVariants(productId) {

    return state.variants.filter(
        variant =>
            variant.product_id === productId
    );
}


function renderProducts() {

    const container =
        $("productsList");

    if (!container) {
        return;
    }


    const search =
        (
            $("productSearch")?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    let products =
        state.products;


    if (search) {

        products =
            products.filter(product => {

                return (
                    String(product.name || "")
                        .toLowerCase()
                        .includes(search)
                    ||
                    String(product.sku || "")
                        .toLowerCase()
                        .includes(search)
                );

            });
    }


    if (!products.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    P
                </div>

                <strong>
                    Nenhum produto cadastrado
                </strong>

                <p>
                    Cadastre seu primeiro produto para começar a controlar o estoque.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        products.map(product => {

            const variants =
                getProductVariants(product.id);


            const totalStock =
                variants.reduce(
                    (sum, variant) =>
                        sum +
                        Number(
                            variant.stock_quantity || 0
                        ),
                    0
                );


            const variantCount =
                variants.length;


            return `
                <article class="product-card">

                    <div class="product-card-header">

                        <div>

                            <div class="product-card-name">
                                ${escapeHTML(product.name)}
                            </div>

                            ${
                                product.sku
                                    ? `
                                        <div class="product-card-sku">
                                            SKU: ${escapeHTML(product.sku)}
                                        </div>
                                    `
                                    : ""
                            }

                        </div>

                    </div>


                    ${
                        product.description
                            ? `
                                <div class="product-card-description">
                                    ${escapeHTML(product.description)}
                                </div>
                            `
                            : ""
                    }


                    <div class="product-card-prices">

                        <span class="product-cost">
                            Custo: ${money(product.cost_price)}
                        </span>

                        <span class="product-sale">
                            ${money(product.sale_price)}
                        </span>

                    </div>


                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            gap:10px;
                            margin-bottom:12px;
                            padding:10px 12px;
                            border-radius:12px;
                            background:#f8e7ed;
                            color:#765666;
                            font-size:12px;
                        "
                    >

                        <span>
                            ${variantCount}
                            ${variantCount === 1 ? "variação" : "variações"}
                        </span>

                        <strong>
                            ${totalStock} un.
                        </strong>

                    </div>


                    <div class="product-card-actions">

                        <button
                            type="button"
                            class="secondary-button"
                            data-edit-product="${product.id}"
                        >
                            Editar
                        </button>

                        <button
                            type="button"
                            class="secondary-button"
                            data-delete-product="${product.id}"
                        >
                            Excluir
                        </button>

                    </div>

                </article>
            `;

        }).join("");
}


/* =========================================================
   FORMULÁRIO DE PRODUTO
   ========================================================= */

function resetProductForm() {

    const form = $("productForm");

    if (form) {
        form.reset();
    }


    $("productId").value = "";


    $("productMinimumStock").value =
        "0";


    $("productActive").checked =
        true;


    state.selectedProductColors =
        new Set();

    state.selectedProductSizes =
        new Set();

    state.productVariantDrafts =
        new Map();


    clearMessage(
        $("productFormMessage")
    );


    populateCategorySelect();

    renderProductVariationSelectors();

    renderVariantPreview();
}


function openProductModal(product = null) {

    resetProductForm();


    if (product) {

        $("productId").value =
            product.id;

        $("productName").value =
            product.name || "";

        $("productSku").value =
            product.sku || "";

        $("productCategory").value =
            product.category_id || "";

        $("productDescription").value =
            product.description || "";

        $("productCostPrice").value =
            product.cost_price ?? "";

        $("productSalePrice").value =
            product.sale_price ?? "";

        $("productMinimumStock").value =
            product.minimum_stock ?? 0;

        $("productActive").checked =
            product.is_active !== false;


        const variants =
            getProductVariants(product.id);


        variants.forEach(variant => {

            if (variant.color_id) {
                state.selectedProductColors.add(
                    variant.color_id
                );
            }

            if (variant.size_id) {
                state.selectedProductSizes.add(
                    variant.size_id
                );


            const key =
                variantKey(
                    variant.color_id,
                    variant.size_id
                );


            state.productVariantDrafts.set(
                key,
                {
                    color_id:
                        variant.color_id,

                    size_id:
                        variant.size_id,

                    stock_quantity:
                        Number(
                            variant.stock_quantity || 0
                        ),

                    minimum_stock:
                        Number(
                            variant.minimum_stock ??
                            product.minimum_stock ??
                            0
                        )
                }
            );

        });


        renderProductVariationSelectors();

        renderVariantPreview();
    }


    openModal("productModal");
}


/* =========================================================
   SELEÇÃO DE CORES E TAMANHOS
   ========================================================= */

function renderProductVariationSelectors() {

    renderProductColors();

    renderProductSizes();
}


function renderProductColors() {

    const container =
        $("productColors");

    if (!container) {
        return;
    }


    const activeColors =
        state.colors.filter(
            color =>
                color.is_active !== false
        );


    if (!activeColors.length) {

        container.innerHTML = `
            <div class="empty-state">
                <strong>Nenhuma cor cadastrada</strong>
                <p>
                    Cadastre uma cor primeiro.
                </p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        activeColors.map(color => {

            const checked =
                state.selectedProductColors.has(
                    color.id
                );


            const hex =
                normalizeHex(
                    color.hex_code
                );


            return `
                <label
                    style="
                        display:flex;
                        align-items:center;
                        gap:10px;
                        width:100%;
                        padding:12px;
                        border:1px solid ${checked ? "#d982a1" : "#e7dce1"};
                        border-radius:14px;
                        background:${checked ? "#fdf0f4" : "#fff"};
                        cursor:pointer;
                    "
                >

                    <input
                        type="checkbox"
                        class="product-color-checkbox"
                        value="${color.id}"
                        ${checked ? "checked" : ""}
                        style="
                            width:20px;
                            height:20px;
                            accent-color:#c86e8f;
                            flex:0 0 20px;
                        "
                    >

                    <span
                        style="
                            width:28px;
                            height:28px;
                            flex:0 0 28px;
                            border-radius:50%;
                            background:${hex};
                            border:2px solid #fff;
                            box-shadow:0 0 0 1px #ddd3d8;
                        "
                    ></span>

                    <span
                        style="
                            flex:1;
                            font-weight:700;
                            color:#4d4148;
                        "
                    >
                        ${escapeHTML(color.name)}
                    </span>

                </label>
            `;

        }).join("");
}


function renderProductSizes() {

    const container =
        $("productSizes");

    if (!container) {
        return;
    }


    const activeSizes =
        state.sizes
            .filter(
                size =>
                    size.is_active !== false
            )
            .sort(
                (a, b) =>
                    Number(a.display_order || 0) -
                    Number(b.display_order || 0)
            );


    if (!activeSizes.length) {

        container.innerHTML = `
            <div class="empty-state">
                <strong>Nenhum tamanho cadastrado</strong>
                <p>
                    Cadastre um tamanho primeiro.
                </p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        activeSizes.map(size => {

            const checked =
                state.selectedProductSizes.has(
                    size.id
                );


            return `
                <label
                    style="
                        display:flex;
                        align-items:center;
                        gap:10px;
                        width:100%;
                        padding:12px;
                        border:1px solid ${checked ? "#d982a1" : "#e7dce1"};
                        border-radius:14px;
                        background:${checked ? "#fdf0f4" : "#fff"};
                        cursor:pointer;
                    "
                >

                    <input
                        type="checkbox"
                        class="product-size-checkbox"
                        value="${size.id}"
                        ${checked ? "checked" : ""}
                        style="
                            width:20px;
                            height:20px;
                            accent-color:#c86e8f;
                            flex:0 0 20px;
                        "
                    >

                    <span
                        style="
                            min-width:38px;
                            height:34px;
                            padding:0 8px;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            border-radius:10px;
                            background:#f8e7ed;
                            color:#a05272;
                            font-weight:800;
                        "
                    >
                        ${escapeHTML(size.name)}
                    </span>

                    <span
                        style="
                            flex:1;
                            font-weight:700;
                            color:#4d4148;
                        "
                    >
                        Tamanho ${escapeHTML(size.name)}
                    </span>

                </label>
            `;

        }).join("");
}


/* =========================================================
   VARIAÇÕES
   ========================================================= */

function variantKey(colorId, sizeId) {

    return `${colorId || "none"}_${sizeId || "none"}`;
}


function generateVariantCombinations() {

    const colors =
        state.colors.filter(
            color =>
                color.is_active !== false &&
                state.selectedProductColors.has(
                    color.id
                )
        );


    const sizes =
        state.sizes
            .filter(
                size =>
                    size.is_active !== false &&
                    state.selectedProductSizes.has(
                        size.id
                    )
            )
            .sort(
                (a, b) =>
                    Number(a.display_order || 0) -
                    Number(b.display_order || 0)
            );


    if (!colors.length || !sizes.length) {
        return [];
    }


    const combinations = [];


    colors.forEach(color => {

        sizes.forEach(size => {

            const key =
                variantKey(
                    color.id,
                    size.id
                );


            const previous =
                state.productVariantDrafts.get(
                    key
                );


            combinations.push({

                key,

                color_id:
                    color.id,

                color_name:
                    color.name,

                color_hex:
                    normalizeHex(
                        color.hex_code
                    ),

                size_id:
                    size.id,

                size_name:
                    size.name,

                stock_quantity:
                    previous?.stock_quantity ??
                    0,

                minimum_stock:
                    previous?.minimum_stock ??
                    Number(
                        $("productMinimumStock")?.value ||
                        0
                    )
            });

        });

    });


    return combinations;
}


function renderVariantPreview() {

    const container =
        $("productVariantsPreview");

    if (!container) {
        return;
    }


    const combinations =
        generateVariantCombinations();


    if (!combinations.length) {

        container.innerHTML = `
            <div class="empty-state">

                <strong>
                    Nenhuma variação selecionada
                </strong>

                <p>
                    Selecione pelo menos uma cor e um tamanho.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML = `

        <div
            style="
                display:flex;
                flex-direction:column;
                gap:10px;
            "
        >

            ${combinations.map(item => {

                return `
                    <div
                        style="
                            padding:13px;
                            border:1px solid #eadfe4;
                            border-radius:15px;
                            background:#fff;
                        "
                    >

                        <div
                            style="
                                display:flex;
                                align-items:center;
                                gap:9px;
                                margin-bottom:10px;
                            "
                        >

                            <span
                                style="
                                    width:25px;
                                    height:25px;
                                    flex:0 0 25px;
                                    border-radius:50%;
                                    background:${item.color_hex};
                                    border:2px solid #fff;
                                    box-shadow:0 0 0 1px #ddd3d8;
                                "
                            ></span>

                            <strong
                                style="
                                    color:#3f353c;
                                "
                            >
                                ${escapeHTML(item.color_name)}
                                /
                                ${escapeHTML(item.size_name)}
                            </strong>

                        </div>


                        <div
                            style="
                                display:grid;
                                grid-template-columns:1fr 1fr;
                                gap:10px;
                            "
                        >

                            <div>

                                <label
                                    style="
                                        display:block;
                                        margin-bottom:5px;
                                        color:#756970;
                                        font-size:11px;
                                        font-weight:700;
                                    "
                                >
                                    Estoque inicial
                                </label>

                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    inputmode="numeric"
                                    value="${Number(item.stock_quantity || 0)}"
                                    data-variant-stock="${item.key}"
                                    style="
                                        width:100%;
                                        min-height:44px;
                                        padding:0 11px;
                                        border:1px solid #ded2d8;
                                        border-radius:12px;
                                        outline:none;
                                        background:#fff;
                                    "
                                >

                            </div>


                            <div>

                                <label
                                    style="
                                        display:block;
                                        margin-bottom:5px;
                                        color:#756970;
                                        font-size:11px;
                                        font-weight:700;
                                    "
                                >
                                    Estoque mínimo
                                </label>

                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    inputmode="numeric"
                                    value="${Number(item.minimum_stock || 0)}"
                                    data-variant-minimum="${item.key}"
                                    style="
                                        width:100%;
                                        min-height:44px;
                                        padding:0 11px;
                                        border:1px solid #ded2d8;
                                        border-radius:12px;
                                        outline:none;
                                        background:#fff;
                                    "
                                >

                            </div>

                        </div>

                    </div>
                `;

            }).join("")}

        </div>
    `;
}


function generateVariantPreview() {

    renderVariantPreview();
}


function collectVariantDraftsFromScreen() {

    const stockInputs =
        $$("[data-variant-stock]");

    const minimumInputs =
        $$("[data-variant-minimum]");


    stockInputs.forEach(input => {

        const key =
            input.dataset.variantStock;

        const minimumInput =
            document.querySelector(
                `[data-variant-minimum="${CSS.escape(key)}"]`
            );


        const current =
            state.productVariantDrafts.get(
                key
            ) || {};


        state.productVariantDrafts.set(
            key,
            {

                ...current,

                stock_quantity:
                    Math.max(
                        0,
                        Number(input.value || 0)
                    ),

                minimum_stock:
                    Math.max(
                        0,
                        Number(
                            minimumInput?.value ||
                            0
                        )
                    )
            }
        );

    });
}


/* =========================================================
   SALVAR PRODUTO + VARIAÇÕES
   ========================================================= */

async function saveProduct(event) {

    event.preventDefault();

    if (!state.user) {
        return;
    }


    collectVariantDraftsFromScreen();


    const message =
        $("productFormMessage");


    const button =
        event.submitter;


    clearMessage(message);


    const name =
        $("productName").value.trim();


    const salePrice =
        Number(
            $("productSalePrice").value || 0
        );


    const costPrice =
        Number(
            $("productCostPrice").value || 0
        );


    const minimumStock =
        Math.max(
            0,
            Number(
                $("productMinimumStock").value || 0
            )
        );


    if (!name) {

        showMessage(
            message,
            "Informe o nome do produto."
        );

        return;
    }


    if (salePrice < 0 || costPrice < 0) {

        showMessage(
            message,
            "Os preços não podem ser negativos."
        );

        return;
    }


    const combinations =
        generateVariantCombinations();


    if (!combinations.length) {

        showMessage(
            message,
            "Selecione pelo menos uma cor e um tamanho."
        );

        return;
    }


    setButtonLoading(
        button,
        true
    );


    try {

        const productId =
            $("productId").value;


        const payload = {

            user_id:
                state.user.id,

            category_id:
                $("productCategory").value ||
                null,

            name,

            sku:
                $("productSku").value.trim() ||
                null,

            description:
                $("productDescription")
                    .value
                    .trim() ||
                null,

            cost_price:
                costPrice,

            sale_price:
                salePrice,

            minimum_stock:
                minimumStock,

            is_active:
                $("productActive").checked
        };


        let savedProduct;


        /* ===============================================
           ATUALIZAÇÃO
           =============================================== */

        if (productId) {

            const {
                data,
                error
            } = await supabaseClient
                .from("products")
                .update(payload)
                .eq("id", productId)
                .eq("user_id", state.user.id)
                .select()
                .single();


            if (error) {
                throw error;
            }


            savedProduct =
                data;


            /* -------------------------------------------
               Atualiza as variações existentes.
               Variações novas são inseridas.
               ------------------------------------------- */

            const existingVariants =
                getProductVariants(
                    productId
                );


            const desiredKeys =
                new Set(
                    combinations.map(
                        item =>
                            variantKey(
                                item.color_id,
                                item.size_id
                            )
                    )
                );


            for (
                const existing
                of existingVariants
            ) {

                const key =
                    variantKey(
                        existing.color_id,
                        existing.size_id
                    );


                if (
                    desiredKeys.has(key)
                ) {

                    const item =
                        combinations.find(
                            combination =>
                                combination.key === key
                        );


                    await supabaseClient
                        .from("product_variants")
                        .update({

                            color_id:
                                item.color_id,

                            size_id:
                                item.size_id,

                            stock_quantity:
                                item.stock_quantity,

                            minimum_stock:
                                item.minimum_stock,

                            is_active:
                                true

                        })
                        .eq(
                            "id",
                            existing.id
                        )
                        .eq(
                            "user_id",
                            state.user.id
                        );


                } else {

                    await supabaseClient
                        .from("product_variants")
                        .update({

                            is_active:
                                false

                        })
                        .eq(
                            "id",
                            existing.id
                        )
                        .eq(
                            "user_id",
                            state.user.id
                        );
                }
            }


            const existingKeys =
                new Set(
                    existingVariants.map(
                        variant =>
                            variantKey(
                                variant.color_id,
                                variant.size_id
                            )
                    )
                );


            const newVariants =
                combinations
                    .filter(
                        item =>
                            !existingKeys.has(
                                item.key
                            )
                    )
                    .map(item => ({

                        user_id:
                            state.user.id,

                        product_id:
                            productId,

                        color_id:
                            item.color_id,

                        size_id:
                            item.size_id,

                        stock_quantity:
                            item.stock_quantity,

                        minimum_stock:
                            item.minimum_stock,

                        is_active:
                            true
                    }));


            if (newVariants.length) {

                const {
                    error
                } = await supabaseClient
                    .from("product_variants")
                    .insert(newVariants);


                if (error) {
                    throw error;
                }
            }


        /* ===============================================
           NOVO PRODUTO
           =============================================== */

        } else {

            const {
                data,
                error
            } = await supabaseClient
                .from("products")
                .insert(payload)
                .select()
                .single();


            if (error) {
                throw error;
            }


            savedProduct =
                data;


            const variantsToInsert =
                combinations.map(item => ({

                    user_id:
                        state.user.id,

                    product_id:
                        savedProduct.id,

                    color_id:
                        item.color_id,

                    size_id:
                        item.size_id,

                    stock_quantity:
                        item.stock_quantity,

                    minimum_stock:
                        item.minimum_stock,

                    is_active:
                        true
                }));


            const {
                error:
                    variantError
            } = await supabaseClient
                .from("product_variants")
                .insert(
                    variantsToInsert
                );


            if (variantError) {

                /* ---------------------------------------
                   Segurança:
                   se as variações falharem, removemos
                   o produto recém-criado.
                   --------------------------------------- */

                await supabaseClient
                    .from("products")
                    .delete()
                    .eq(
                        "id",
                        savedProduct.id
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );


                throw variantError;
            }
        }


        await loadProducts();

        await loadVariants();

        renderProducts();

        renderStock();

        updateDashboard();


        showMessage(
            message,
            "Produto e variações salvos com sucesso.",
            "success"
        );


        setTimeout(() => {

            closeModal(
                "productModal"
            );

        }, 600);


    } catch (error) {

        console.error(
            "Erro ao salvar produto:",
            error
        );


        showMessage(
            message,
            error.message ||
            "Não foi possível salvar o produto."
        );


    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


/* =========================================================
   EXCLUIR PRODUTO
   ========================================================= */

async function deleteProduct(id) {

    if (!id) {
        return;
    }


    const product =
        state.products.find(
            item =>
                item.id === id
        );


    if (!product) {
        return;
    }


    const confirmed =
        window.confirm(
            `Excluir o produto "${product.name}"?`
        );


    if (!confirmed) {
        return;
    }


    try {

        /*
         * Primeiro removemos as variações.
         * Depois removemos o produto.
         */

        const {
            error:
                variantsError
        } = await supabaseClient
            .from("product_variants")
            .delete()
            .eq(
                "product_id",
                id
            )
            .eq(
                "user_id",
                state.user.id
            );


        if (variantsError) {
            throw variantsError;
        }


        const {
            error
        } = await supabaseClient
            .from("products")
            .delete()
            .eq(
                "id",
                id
            )
            .eq(
                "user_id",
                state.user.id
            );


        if (error) {
            throw error;
        }


        await loadProducts();

        await loadVariants();

        renderProducts();

        renderStock();

        updateDashboard();


    } catch (error) {

        console.error(error);

        alert(
            "Não foi possível excluir o produto."
        );
    }
}


/* =========================================================
   ESTOQUE
   ========================================================= */

function renderStock() {

    const container =
        $("stockList");

    if (!container) {
        return;
    }


    const search =
        (
            $("stockSearch")?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    let variants =
        state.variants.filter(
            variant =>
                variant.is_active !== false
        );


    const enriched =
        variants.map(variant => {

            const product =
                state.products.find(
                    item =>
                        item.id ===
                        variant.product_id
                );


            const color =
                getColor(
                    variant.color_id
                );


            const size =
                getSize(
                    variant.size_id
                );


            return {

                ...variant,

                product,

                color,

                size
            };

        });


    let filtered =
        enriched;


    if (search) {

        filtered =
            enriched.filter(item => {

                const text = [

                    item.product?.name,

                    item.product?.sku,

                    item.color?.name,

                    item.size?.name

                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();


                return text.includes(search);
            });
    }


    const total =
        variants.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.stock_quantity || 0
                ),
            0
        );


    const low =
        variants.filter(
            item =>
                Number(
                    item.stock_quantity || 0
                ) > 0 &&
                Number(
                    item.stock_quantity || 0
                ) <=
                Number(
                    item.minimum_stock || 0
                )
        ).length;


    const zero =
        variants.filter(
            item =>
                Number(
                    item.stock_quantity || 0
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


    if (!filtered.length) {

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

        return;
    }


    container.innerHTML =
        filtered.map(item => {

            const quantity =
                Number(
                    item.stock_quantity || 0
                );


            const minimum =
                Number(
                    item.minimum_stock || 0
                );


            let statusClass = "";

            if (quantity === 0) {
                statusClass = "stock-zero";
            } else if (quantity <= minimum) {
                statusClass = "stock-low";
            }


            const productName =
                item.product?.name ||
                "Produto";


            const colorName =
                item.color?.name ||
                "Sem cor";


            const sizeName =
                item.size?.name ||
                "Sem tamanho";


            const colorHex =
                normalizeHex(
                    item.color?.hex_code
                );


            return `
                <article class="stock-item">

                    <div class="stock-item-header">

                        <div
                            style="
                                min-width:0;
                                display:flex;
                                align-items:center;
                                gap:10px;
                            "
                        >

                            <span
                                style="
                                    width:30px;
                                    height:30px;
                                    flex:0 0 30px;
                                    border-radius:50%;
                                    background:${colorHex};
                                    border:2px solid #fff;
                                    box-shadow:0 0 0 1px #ddd3d8;
                                "
                            ></span>


                            <div
                                style="
                                    min-width:0;
                                "
                            >

                                <div
                                    class="stock-item-name"
                                    style="
                                        overflow:hidden;
                                        text-overflow:ellipsis;
                                        white-space:nowrap;
                                    "
                                >
                                    ${escapeHTML(productName)}
                                </div>

                                <div
                                    style="
                                        margin-top:3px;
                                        color:#8b7d84;
                                        font-size:11px;
                                    "
                                >
                                    ${escapeHTML(colorName)}
                                    /
                                    ${escapeHTML(sizeName)}
                                </div>

                            </div>

                        </div>


                        <strong
                            class="stock-quantity ${statusClass}"
                        >
                            ${quantity}
                        </strong>

                    </div>


                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            margin-top:10px;
                            padding-top:9px;
                            border-top:1px solid #f0e7eb;
                            color:#8b7d84;
                            font-size:11px;
                        "
                    >

                        <span>
                            Mínimo: ${minimum}
                        </span>

                        <span>
                            ${quantity === 0
                                ? "Sem estoque"
                                : quantity <= minimum
                                    ? "Estoque baixo"
                                    : "Disponível"
                            }
                        </span>

                    </div>

                </article>
            `;

        }).join("");
}


/* =========================================================
   VENDAS
   ========================================================= */

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
        .eq(
            "user_id",
            state.user.id
        )
        .order(
            "created_at",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Erro ao carregar vendas:",
            error
        );

        return;
    }


    state.sales =
        data || [];
}


function renderSales() {

    const container =
        $("salesList");

    if (!container) {
        return;
    }


    const search =
        (
            $("salesSearch")?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    const today =
        todayISO();


    const todaySales =
        state.sales.filter(
            sale =>
                sale.sale_date ===
                today &&
                sale.status !==
                "cancelled"
        );


    const todayTotal =
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
            money(todayTotal);
    }


    if ($("salesOrdersToday")) {

        $("salesOrdersToday").textContent =
            todaySales.length;
    }


    let sales =
        state.sales;


    if (search) {

        sales =
            sales.filter(sale => {

                return [

                    sale.sale_number,

                    sale.payment_method,

                    sale.status,

                    sale.notes

                ]
                    .filter(
                        value =>
                            value !== null &&
                            value !== undefined
                    )
                    .join(" ")
                    .toLowerCase()
                    .includes(search);
            });
    }


    if (!sales.length) {

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
        sales.map(sale => {

            const status =
                sale.status || "completed";


            return `
                <article class="sale-card">

                    <div class="sale-card-header">

                        <div>

                            <div class="sale-number">
                                Venda #${escapeHTML(sale.sale_number)}
                            </div>

                            <div class="sale-date">
                                ${formatDate(sale.sale_date)}
                            </div>

                        </div>

                        <span
                            style="
                                color:${status === "cancelled"
                                    ? "#b4235a"
                                    : "#2f8f62"};
                                font-size:11px;
                                font-weight:800;
                            "
                        >
                            ${
                                status === "cancelled"
                                    ? "Cancelada"
                                    : "Concluída"
                            }
                        </span>

                    </div>


                    <div class="sale-total">

                        <span>
                            ${escapeHTML(
                                sale.payment_method ||
                                "Pagamento"
                            )}
                        </span>

                        <strong>
                            ${money(sale.total)}
                        </strong>

                    </div>

                </article>
            `;

        }).join("");
}


/* =========================================================
   CRIAÇÃO DE VENDA
   ========================================================= */

function resetSaleForm() {

    const form =
        $("saleForm");

    if (form) {
        form.reset();
    }


    $("saleItems").innerHTML = "";


    $("saleDiscount").value =
        "0";


    $("saleTotal").textContent =
        money(0);


    clearMessage(
        $("saleFormMessage")
    );
}


function addSaleItem() {

    const container =
        $("saleItems");

    if (!container) {
        return;
    }


    const availableVariants =
        state.variants.filter(
            variant =>
                variant.is_active !== false &&
                Number(
                    variant.stock_quantity || 0
                ) > 0
        );


    if (!availableVariants.length) {

        alert(
            "Não existem variações com estoque disponível."
        );

        return;
    }


    const item =
        document.createElement("div");


    item.className =
        "sale-item";


    item.style.cssText = `
        padding:12px;
        border:1px solid #eadfe4;
        border-radius:14px;
        background:#fff;
    `;


    const options =
        availableVariants.map(variant => {

            const product =
                state.products.find(
                    p =>
                        p.id ===
                        variant.product_id
                );


            const color =
                getColor(
                    variant.color_id
                );


            const size =
                getSize(
                    variant.size_id
                );


            const label = [

                product?.name,

                color?.name,

                size?.name

            ]
                .filter(Boolean)
                .join(" / ");


            return `
                <option
                    value="${variant.id}"
                    data-price="${Number(product?.sale_price || 0)}"
                    data-stock="${Number(variant.stock_quantity || 0)}"
                >
                    ${escapeHTML(label)}
                    — ${money(product?.sale_price)}
                    — Estoque: ${variant.stock_quantity}
                </option>
            `;

        }).join("");


    item.innerHTML = `

        <div
            style="
                display:grid;
                grid-template-columns:minmax(0,1fr) 80px 34px;
                gap:8px;
                align-items:end;
            "
        >

            <div class="form-group">

                <label>
                    Produto
                </label>

                <select
                    class="sale-variant"
                >
                    ${options}
                </select>

            </div>


            <div class="form-group">

                <label>
                    Qtd.
                </label>

                <input
                    type="number"
                    class="sale-quantity"
                    min="1"
                    value="1"
                    inputmode="numeric"
                >

            </div>


            <button
                type="button"
                class="secondary-button remove-sale-item"
                style="
                    width:34px;
                    min-height:44px;
                    padding:0;
                "
            >
                ×
            </button>

        </div>

    `;


    container.appendChild(item);


    item.querySelector(
        ".remove-sale-item"
    ).addEventListener(
        "click",
        () => {

            item.remove();

            calculateSaleTotal();
        }
    );


    item.querySelector(
        ".sale-variant"
    ).addEventListener(
        "change",
        calculateSaleTotal
    );


    item.querySelector(
        ".sale-quantity"
    ).addEventListener(
        "input",
        calculateSaleTotal
    );


    calculateSaleTotal();
}


function calculateSaleTotal() {

    const items =
        $$(".sale-item");


    let subtotal = 0;


    items.forEach(item => {

        const select =
            item.querySelector(
                ".sale-variant"
            );


        const quantity =
            Number(
                item.querySelector(
                    ".sale-quantity"
                )?.value || 0
            );


        const option =
            select?.selectedOptions?.[0];


        const price =
            Number(
                option?.dataset?.price || 0
            );


        subtotal +=
            price * quantity;
    });


    const discount =
        Math.max(
            0,
            Number(
                $("saleDiscount")?.value ||
                0
            )
        );


    const total =
        Math.max(
            0,
            subtotal - discount
        );


    if ($("saleTotal")) {

        $("saleTotal").textContent =
            money(total);
    }


    return {
        subtotal,
        discount,
        total
    };
}


async function saveSale(event) {

    event.preventDefault();

    if (!state.user) {
        return;
    }


    const message =
        $("saleFormMessage");


    const button =
        event.submitter;


    clearMessage(message);


    const saleItems =
        $$(".sale-item");


    if (!saleItems.length) {

        showMessage(
            message,
            "Adicione pelo menos um produto."
        );

        return;
    }


    const calculated =
        calculateSaleTotal();


    if (calculated.total <= 0) {

        showMessage(
            message,
            "O total da venda precisa ser maior que zero."
        );

        return;
    }


    setButtonLoading(
        button,
        true,
        "Registrando..."
    );


    try {

        const preparedItems = [];


        for (
            const item
            of saleItems
        ) {

            const variantId =
                item.querySelector(
                    ".sale-variant"
                )?.value;


            const quantity =
                Number(
                    item.querySelector(
                        ".sale-quantity"
                    )?.value || 0
                );


            const variant =
                state.variants.find(
                    v =>
                        v.id ===
                        variantId
                );


            if (!variant) {
                throw new Error(
                    "Uma das variações selecionadas não foi encontrada."
                );
            }


            if (
                quantity <= 0
            ) {

                throw new Error(
                    "A quantidade precisa ser maior que zero."
                );
            }


            if (
                quantity >
                Number(
                    variant.stock_quantity || 0
                )
            ) {

                const product =
                    state.products.find(
                        p =>
                            p.id ===
                            variant.product_id
                    );


                const color =
                    getColor(
                        variant.color_id
                    );


                const size =
                    getSize(
                        variant.size_id
                    );


                throw new Error(
                    `Estoque insuficiente para ${product?.name || "produto"} / ${color?.name || ""} / ${size?.name || ""}.`
                );
            }


            const product =
                state.products.find(
                    p =>
                        p.id ===
                        variant.product_id
                );


            const color =
                getColor(
                    variant.color_id
                );


            const size =
                getSize(
                    variant.size_id
                );


            const unitPrice =
                Number(
                    product?.sale_price || 0
                );


            preparedItems.push({

                variant,

                product,

                color,

                size,

                quantity,

                unitPrice,

                total:
                    unitPrice *
                    quantity
            });
        }


        const {
            data: sale,
            error: saleError
        } = await supabaseClient
            .from("sales")
            .insert({

                user_id:
                    state.user.id,

                sale_date:
                    todayISO(),

                subtotal:
                    calculated.subtotal,

                discount:
                    calculated.discount,

                total:
                    calculated.total,

                payment_method:
                    $("salePaymentMethod")
                        .value ||
                    null,

                status:
                    "completed",

                notes:
                    $("saleNotes")
                        .value
                        .trim() ||
                    null
            })
            .select()
            .single();


        if (saleError) {
            throw saleError;
        }


        const saleItemsPayload =
            preparedItems.map(item => ({

                user_id:
                    state.user.id,

                sale_id:
                    sale.id,

                product_variant_id:
                    item.variant.id,

                product_name:
                    item.product?.name ||
                    "Produto",

                variant_description:
                    [
                        item.color?.name,
                        item.size?.name
                    ]
                        .filter(Boolean)
                        .join(" / "),

                quantity:
                    item.quantity,

                unit_price:
                    item.unitPrice,

                unit_cost:
                    Number(
                        item.product?.cost_price ||
                        0
                    ),

                discount:
                    0,

                total:
                    item.total
            }));


        const {
            error:
                itemsError
        } = await supabaseClient
            .from("sale_items")
            .insert(
                saleItemsPayload
            );


        if (itemsError) {

            await supabaseClient
                .from("sales")
                .delete()
                .eq(
                    "id",
                    sale.id
                )
                .eq(
                    "user_id",
                    state.user.id
                );

            throw itemsError;
        }


        /*
         * Atualiza o estoque.
         */

        for (
            const item
            of preparedItems
        ) {

            const newQuantity =
                Number(
                    item.variant.stock_quantity ||
                    0
                ) -
                item.quantity;


            const {
                error:
                    stockError
            } = await supabaseClient
                .from("product_variants")
                .update({

                    stock_quantity:
                        newQuantity

                })
                .eq(
                    "id",
                    item.variant.id
                )
                .eq(
                    "user_id",
                    state.user.id
                );


            if (stockError) {
                throw stockError;
            }


            await supabaseClient
                .from("inventory_movements")
                .insert({

                    user_id:
                        state.user.id,

                    product_variant_id:
                        item.variant.id,

                    movement_type:
                        "sale",

                    quantity:
                        -item.quantity,

                    reference_id:
                        sale.id,

                    reason:
                        "Venda",

                    notes:
                        `Venda #${sale.sale_number}`
                });
        }


        /*
         * Registra automaticamente a receita.
         */

        const {
            error:
                financeError
        } = await supabaseClient
            .from("financial_transactions")
            .insert({

                user_id:
                    state.user.id,

                transaction_type:
                    "income",

                category:
                    "Venda",

                description:
                    `Venda #${sale.sale_number}`,

                amount:
                    calculated.total,

                transaction_date:
                    todayISO(),

                payment_method:
                    $("salePaymentMethod")
                        .value ||
                    null,

                reference_id:
                    sale.id,

                notes:
                    null
            });


        if (financeError) {
            throw financeError;
        }


        await loadSales();

        await loadVariants();

        await loadTransactions();

        renderSales();

        renderStock();

        renderFinance();

        renderProducts();

        updateDashboard();


        showMessage(
            message,
            "Venda registrada com sucesso.",
            "success"
        );


        setTimeout(() => {

            closeModal(
                "saleModal"
            );

        }, 600);


    } catch (error) {

        console.error(
            "Erro ao registrar venda:",
            error
        );


        showMessage(
            message,
            error.message ||
            "Não foi possível registrar a venda."
        );


    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


/* =========================================================
   FINANCEIRO
   ========================================================= */

async function loadTransactions() {

    if (!state.user) {
        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("financial_transactions")
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
        );


    if (error) {

        console.error(
            "Erro ao carregar financeiro:",
            error
        );

        return;
    }


    state.transactions =
        data || [];
}


function renderFinance() {

    const container =
        $("financeList");

    if (!container) {
        return;
    }


    const search =
        (
            $("financeSearch")?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    let transactions =
        state.transactions;


    if (search) {

        transactions =
            transactions.filter(item => {

                return [

                    item.description,

                    item.category,

                    item.transaction_type,

                    item.payment_method

                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(search);
            });
    }


    const income =
        state.transactions
            .filter(
                item =>
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
        state.transactions
            .filter(
                item =>
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
        income -
        expenses;


    if ($("financeIncome")) {

        $("financeIncome").textContent =
            money(income);
    }


    if ($("financeExpenses")) {

        $("financeExpenses").textContent =
            money(expenses);
    }


    if ($("financeBalance")) {

        $("financeBalance").textContent =
            money(balance);
    }


    if (!transactions.length) {

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
        transactions.map(item => {

            const isIncome =
                item.transaction_type ===
                "income";


            return `
                <article class="finance-item">

                    <div class="finance-item-header">

                        <div>

                            <div class="finance-item-description">
                                ${escapeHTML(
                                    item.description
                                )}
                            </div>

                            <div class="finance-item-category">
                                ${escapeHTML(
                                    item.category ||
                                    "Sem categoria"
                                )}
                                •
                                ${formatDate(
                                    item.transaction_date
                                )}
                            </div>

                        </div>


                        <div
                            class="
                                finance-item-value
                                ${
                                    isIncome
                                        ? "finance-income"
                                        : "finance-expense"
                                }
                            "
                        >
                            ${isIncome ? "+" : "-"}
                            ${money(item.amount)}
                        </div>

                    </div>

                </article>
            `;

        }).join("");
}


function resetTransactionForm() {

    const form =
        $("transactionForm");

    if (form) {
        form.reset();
    }


    $("transactionDate").value =
        todayISO();


    clearMessage(
        $("transactionFormMessage")
    );
}


function openTransactionModal() {

    resetTransactionForm();

    openModal(
        "transactionModal"
    );
}


async function saveTransaction(event) {

    event.preventDefault();

    if (!state.user) {
        return;
    }


    const message =
        $("transactionFormMessage");


    const button =
        event.submitter;


    clearMessage(message);


    const type =
        $("transactionType").value;


    const description =
        $("transactionDescription")
            .value
            .trim();


    const amount =
        Number(
            $("transactionAmount").value ||
            0
        );


    if (!type) {

        showMessage(
            message,
            "Selecione o tipo do lançamento."
        );

        return;
    }


    if (!description) {

        showMessage(
            message,
            "Informe a descrição."
        );

        return;
    }


    if (amount <= 0) {

        showMessage(
            message,
            "Informe um valor maior que zero."
        );

        return;
    }


    setButtonLoading(
        button,
        true
    );


    try {

        const {
            error
        } = await supabaseClient
            .from("financial_transactions")
            .insert({

                user_id:
                    state.user.id,

                transaction_type:
                    type,

                category:
                    $("transactionCategory")
                        .value
                        .trim() ||
                    null,

                description,

                amount,

                transaction_date:
                    $("transactionDate")
                        .value ||
                    todayISO(),

                payment_method:
                    $("transactionPaymentMethod")
                        .value ||
                    null,

                notes:
                    $("transactionNotes")
                        .value
                        .trim() ||
                    null
            });


        if (error) {
            throw error;
        }


        await loadTransactions();

        renderFinance();

        updateDashboard();


        showMessage(
            message,
            "Lançamento salvo com sucesso.",
            "success"
        );


        setTimeout(() => {

            closeModal(
                "transactionModal"
            );

        }, 500);


    } catch (error) {

        console.error(error);

        showMessage(
            message,
            error.message ||
            "Não foi possível salvar o lançamento."
        );

    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function updateDashboard() {

    const today =
        todayISO();


    const todaySales =
        state.sales.filter(
            sale =>
                sale.sale_date ===
                today &&
                sale.status !==
                "cancelled"
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


    const todayExpenses =
        state.transactions
            .filter(
                transaction =>
                    transaction.transaction_date ===
                    today &&
                    transaction.transaction_type ===
                    "expense"
            )
            .reduce(
                (sum, transaction) =>
                    sum +
                    Number(
                        transaction.amount || 0
                    ),
                0
            );


    const lowStock =
        state.variants.filter(
            variant => {

                const quantity =
                    Number(
                        variant.stock_quantity || 0
                    );

                const minimum =
                    Number(
                        variant.minimum_stock || 0
                    );


                return (
                    quantity <= minimum
                );
            }
        ).length;


    if ($("metricSales")) {

        $("metricSales").textContent =
            money(salesTotal);
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
            money(todayExpenses);
    }
}


/* =========================================================
   MODAIS
   ========================================================= */

function openModal(id) {

    const modal =
        $(id);

    if (!modal) {
        return;
    }


    modal.hidden = false;

    document.body.style.overflow =
        "hidden";
}


function closeModal(id) {

    const modal =
        $(id);

    if (!modal) {
        return;
    }


    modal.hidden = true;

    document.body.style.overflow =
        "";
}


/* =========================================================
   EVENTOS
   ========================================================= */

function bindEvents() {

    /* -----------------------------------------------
       LOGIN
       ----------------------------------------------- */

    $("loginForm")?.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            login(
                $("email").value,
                $("password").value
            );
        }
    );


    /* -----------------------------------------------
       LOGOUT
       ----------------------------------------------- */

    $("logoutButton")?.addEventListener(
        "click",
        logout
    );


    /* -----------------------------------------------
       NAVEGAÇÃO
       ----------------------------------------------- */

    $$(".nav-item").forEach(button => {

        button.addEventListener(
            "click",
            () => {

                showSection(
                    button.dataset.section
                );

            }
        );

    });


    /* -----------------------------------------------
       ACESSOS RÁPIDOS
       ----------------------------------------------- */

    $$(".quick-action").forEach(button => {

        button.addEventListener(
            "click",
            () => {

                showSection(
                    button.dataset.section
                );

            }
        );

    });


    /* -----------------------------------------------
       NOVO PRODUTO
       ----------------------------------------------- */

    $("newProductButton")?.addEventListener(
        "click",
        () => {

            openProductModal();

        }
    );


    /* -----------------------------------------------
       NOVA CATEGORIA
       ----------------------------------------------- */

    $("newCategoryButton")?.addEventListener(
        "click",
        () => {

            openCategoryModal();

        }
    );


    /* -----------------------------------------------
       NOVA COR
       ----------------------------------------------- */

    $("newColorButton")?.addEventListener(
        "click",
        () => {

            openColorModal();

        }
    );


    /* -----------------------------------------------
       NOVO TAMANHO
       ----------------------------------------------- */

    $("newSizeButton")?.addEventListener(
        "click",
        () => {

            openSizeModal();

        }
    );


    /* -----------------------------------------------
       NOVA VENDA
       ----------------------------------------------- */

    $("newSaleButton")?.addEventListener(
        "click",
        () => {

            resetSaleForm();

            openModal(
                "saleModal"
            );

        }
    );


    /* -----------------------------------------------
       NOVO LANÇAMENTO
       ----------------------------------------------- */

    $("newTransactionButton")?.addEventListener(
        "click",
        openTransactionModal
    );


    /* -----------------------------------------------
       FORMULÁRIOS
       ----------------------------------------------- */

    $("productForm")?.addEventListener(
        "submit",
        saveProduct
    );


    $("categoryForm")?.addEventListener(
        "submit",
        saveCategory
    );


    $("colorForm")?.addEventListener(
        "submit",
        saveColor
    );


    $("sizeForm")?.addEventListener(
        "submit",
        saveSize
    );


    $("saleForm")?.addEventListener(
        "submit",
        saveSale
    );


    $("transactionForm")?.addEventListener(
        "submit",
        saveTransaction
    );


    /* -----------------------------------------------
       CORES DO PRODUTO
       ----------------------------------------------- */

    $("productColors")?.addEventListener(
        "change",
        event => {

            if (
                !event.target.matches(
                    ".product-color-checkbox"
                )
            ) {
                return;
            }


            const id =
                event.target.value;


            if (event.target.checked) {

                state.selectedProductColors.add(
                    id
                );

            } else {

                state.selectedProductColors.delete(
                    id
                );
            }


            renderProductColors();

            renderVariantPreview();

        }
    );


    /* -----------------------------------------------
       TAMANHOS DO PRODUTO
       ----------------------------------------------- */

    $("productSizes")?.addEventListener(
        "change",
        event => {

            if (
                !event.target.matches(
                    ".product-size-checkbox"
                )
            ) {
                return;
            }


            const id =
                event.target.value;


            if (event.target.checked) {

                state.selectedProductSizes.add(
                    id
                );

            } else {

                state.selectedProductSizes.delete(
                    id
                );
            }


            renderProductSizes();

            renderVariantPreview();

        }
    );


    /* -----------------------------------------------
       ALTERAÇÃO DE ESTOQUE MÍNIMO
       ----------------------------------------------- */

    $("productMinimumStock")?.addEventListener(
        "input",
        () => {

            renderVariantPreview();

        }
    );


    /* -----------------------------------------------
       COLETAR ESTOQUE DAS VARIAÇÕES
       ----------------------------------------------- */

    $("productVariantsPreview")?.addEventListener(
        "input",
        event => {

            const stockKey =
                event.target.dataset.variantStock;


            const minimumKey =
                event.target.dataset.variantMinimum;


            if (
                !stockKey &&
                !minimumKey
            ) {
                return;
            }


            const key =
                stockKey ||
                minimumKey;


            const current =
                state.productVariantDrafts.get(
                    key
                ) || {};


            if (stockKey) {

                current.stock_quantity =
                    Math.max(
                        0,
                        Number(
                            event.target.value ||
                            0
                        )
                    );
            }


            if (minimumKey) {

                current.minimum_stock =
                    Math.max(
                        0,
                        Number(
                            event.target.value ||
                            0
                        )
                    );
            }


            state.productVariantDrafts.set(
                key,
                current
            );

        }
    );


    /* -----------------------------------------------
       COR — COLOR PICKER
       ----------------------------------------------- */

    $("colorHex")?.addEventListener(
        "input",
        event => {

            const hex =
                normalizeHex(
                    event.target.value
                );


            $("colorHexText").value =
                hex;


            $("colorPreview").style.background =
                hex;
        }
    );


    $("colorHexText")?.addEventListener(
        "input",
        event => {

            let value =
                event.target.value
                    .trim();


            if (
                !value.startsWith("#") &&
                value.length > 0
            ) {
                value =
                    `#${value}`;
            }


            if (
                /^#[0-9A-Fa-f]{6}$/.test(
                    value
                )
            ) {

                const hex =
                    value.toUpperCase();


                $("colorHex").value =
                    hex;


                $("colorPreview").style.background =
                    hex;
            }
        }
    );


    /* -----------------------------------------------
       VENDA
       ----------------------------------------------- */

    $("addSaleItemButton")?.addEventListener(
        "click",
        addSaleItem
    );


    $("saleDiscount")?.addEventListener(
        "input",
        calculateSaleTotal
    );


    /* -----------------------------------------------
       BUSCAS
       ----------------------------------------------- */

    $("productSearch")?.addEventListener(
        "input",
        renderProducts
    );


    $("stockSearch")?.addEventListener(
        "input",
        renderStock
    );


    $("salesSearch")?.addEventListener(
        "input",
        renderSales
    );


    $("financeSearch")?.addEventListener(
        "input",
        renderFinance
    );


    /* -----------------------------------------------
       FECHAR MODAIS
       ----------------------------------------------- */

    $$("[data-close-modal]").forEach(
        element => {

            element.addEventListener(
                "click",
                () => {

                    closeModal(
                        element.dataset.closeModal
                    );

                }
            );

        }
    );


    /* -----------------------------------------------
       ESC
       ----------------------------------------------- */

    document.addEventListener(
        "keydown",
        event => {

            if (event.key !== "Escape") {
                return;
            }


            $$(".modal").forEach(
                modal => {

                    if (!modal.hidden) {

                        closeModal(
                            modal.id
                        );
                    }

                }
            );

        }
    );


    /* -----------------------------------------------
       CLIQUES NAS LISTAS
       ----------------------------------------------- */

    document.addEventListener(
        "click",
        async event => {

            const editCategory =
                event.target.closest(
                    "[data-edit-category]"
                );


            if (editCategory) {

                const category =
                    state.categories.find(
                        item =>
                            item.id ===
                            editCategory.dataset.editCategory
                    );


                if (category) {
                    openCategoryModal(
                        category
                    );
                }

                return;
            }


            const deleteCategoryButton =
                event.target.closest(
                    "[data-delete-category]"
                );


            if (deleteCategoryButton) {

                await deleteCategory(
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
                    state.colors.find(
                        item =>
                            item.id ===
                            editColor.dataset.editColor
                    );


                if (color) {
                    openColorModal(
                        color
                    );
                }

                return;
            }


            const deleteColorButton =
                event.target.closest(
                    "[data-delete-color]"
                );


            if (deleteColorButton) {

                await deleteColor(
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
                    state.sizes.find(
                        item =>
                            item.id ===
                            editSize.dataset.editSize
                    );


                if (size) {
                    openSizeModal(
                        size
                    );
                }

                return;
            }


            const deleteSizeButton =
                event.target.closest(
                    "[data-delete-size]"
                );


            if (deleteSizeButton) {

                await deleteSize(
                    deleteSizeButton.dataset.deleteSize
                );

                return;
            }


            const editProductButton =
                event.target.closest(
                    "[data-edit-product]"
                );


            if (editProductButton) {

                const product =
                    state.products.find(
                        item =>
                            item.id ===
                            editProductButton.dataset.editProduct
                    );


                if (product) {

                    openProductModal(
                        product
                    );
                }

                return;
            }


            const deleteProductButton =
                event.target.closest(
                    "[data-delete-product]"
                );


            if (deleteProductButton) {

                await deleteProduct(
                    deleteProductButton.dataset.deleteProduct
                );

                return;
            }

        }
    );
}


/* =========================================================
   AUTH STATE
   ========================================================= */

function bindAuthState() {

    supabaseClient.auth.onAuthStateChange(
        async (event, session) => {

            state.session =
                session;

            state.user =
                session?.user ||
                null;


            updateAuthUI();


            if (
                event === "SIGNED_IN" &&
                session
            ) {

                await initializeApp();
            }


            if (
                event === "SIGNED_OUT"
            ) {

                state.initialized =
                    false;

                state.categories =
                    [];

                state.colors =
                    [];

                state.sizes =
                    [];

                state.products =
                    [];

                state.variants =
                    [];

                state.sales =
                    [];

                state.transactions =
                    [];
            }

        }
    );
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        bindEvents();

        bindAuthState();

        await checkSession();

    }
);
