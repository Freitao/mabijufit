// =========================================================
// MABIJUFIT — APLICAÇÃO PRINCIPAL
// =========================================================

const App = {

    currentSection: "home",
    currentUser: null,
    products: [],
    categories: [],
    saleItems: [],


    // =====================================================
    // INICIALIZAÇÃO
    // =====================================================

    async init() {

        this.bindEvents();

        await this.checkSession();

        this.setDefaultTransactionDate();

    },


    // =====================================================
    // EVENTOS
    // =====================================================

    bindEvents() {

        // LOGIN
        const loginForm = document.getElementById("loginForm");

        if (loginForm) {
            loginForm.addEventListener(
                "submit",
                (event) => this.handleLogin(event)
            );
        }


        // LOGOUT
        const logoutButton =
            document.getElementById("logoutButton");

        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                () => this.handleLogout()
            );

        }


        // NAVEGAÇÃO
        document
            .querySelectorAll("[data-section]")
            .forEach((button) => {

                button.addEventListener(
                    "click",
                    () => {

                        const section =
                            button.dataset.section;

                        if (section) {
                            this.navigate(section);
                        }

                    }
                );

            });


        // NOVO PRODUTO
        const newProductButton =
            document.getElementById("newProductButton");

        if (newProductButton) {

            newProductButton.addEventListener(
                "click",
                () => this.openModal("productModal")
            );

        }


        // NOVA CATEGORIA
        const newCategoryButton =
            document.getElementById("newCategoryButton");

        if (newCategoryButton) {

            newCategoryButton.addEventListener(
                "click",
                () => this.openModal("categoryModal")
            );

        }


        // NOVA VENDA
        const newSaleButton =
            document.getElementById("newSaleButton");

        if (newSaleButton) {

            newSaleButton.addEventListener(
                "click",
                () => this.openSaleModal()
            );

        }


        // NOVO LANÇAMENTO
        const newTransactionButton =
            document.getElementById("newTransactionButton");

        if (newTransactionButton) {

            newTransactionButton.addEventListener(
                "click",
                () => this.openModal("transactionModal")
            );

        }


        // FECHAR MODAIS
        document
            .querySelectorAll("[data-close-modal]")
            .forEach((button) => {

                button.addEventListener(
                    "click",
                    () => {

                        const modalId =
                            button.dataset.closeModal;

                        this.closeModal(modalId);

                    }
                );

            });


        // CLIQUE NO OVERLAY
        document
            .querySelectorAll(".modal-overlay")
            .forEach((overlay) => {

                overlay.addEventListener(
                    "click",
                    () => {

                        const modal =
                            overlay.closest(".modal");

                        if (modal) {
                            this.closeModal(modal.id);
                        }

                    }
                );

            });


        // FORM PRODUTO
        const productForm =
            document.getElementById("productForm");

        if (productForm) {

            productForm.addEventListener(
                "submit",
                (event) => this.handleProductSubmit(event)
            );

        }


        // FORM CATEGORIA
        const categoryForm =
            document.getElementById("categoryForm");

        if (categoryForm) {

            categoryForm.addEventListener(
                "submit",
                (event) => this.handleCategorySubmit(event)
            );

        }


        // FORM VENDA
        const saleForm =
            document.getElementById("saleForm");

        if (saleForm) {

            saleForm.addEventListener(
                "submit",
                (event) => this.handleSaleSubmit(event)
            );

        }


        // FORM FINANCEIRO
        const transactionForm =
            document.getElementById("transactionForm");

        if (transactionForm) {

            transactionForm.addEventListener(
                "submit",
                (event) => this.handleTransactionSubmit(event)
            );

        }


        // BUSCA PRODUTOS
        const productSearch =
            document.getElementById("productSearch");

        if (productSearch) {

            productSearch.addEventListener(
                "input",
                () => this.renderProducts()
            );

        }


        // BUSCA ESTOQUE
        const stockSearch =
            document.getElementById("stockSearch");

        if (stockSearch) {

            stockSearch.addEventListener(
                "input",
                () => this.renderStock()
            );

        }


        // BUSCA VENDAS
        const salesSearch =
            document.getElementById("salesSearch");

        if (salesSearch) {

            salesSearch.addEventListener(
                "input",
                () => this.loadSales()
            );

        }


        // BUSCA FINANCEIRO
        const financeSearch =
            document.getElementById("financeSearch");

        if (financeSearch) {

            financeSearch.addEventListener(
                "input",
                () => this.loadFinancialTransactions()
            );

        }


        // ADICIONAR ITEM À VENDA
        const addSaleItemButton =
            document.getElementById("addSaleItemButton");

        if (addSaleItemButton) {

            addSaleItemButton.addEventListener(
                "click",
                () => this.addSaleItem()
            );

        }


        // DESCONTO DA VENDA
        const saleDiscount =
            document.getElementById("saleDiscount");

        if (saleDiscount) {

            saleDiscount.addEventListener(
                "input",
                () => this.calculateSaleTotal()
            );

        }


        // ESC
        document.addEventListener(
            "keydown",
            (event) => {

                if (event.key !== "Escape") {
                    return;
                }

                document
                    .querySelectorAll(".modal:not([hidden])")
                    .forEach((modal) => {

                        this.closeModal(modal.id);

                    });

            }
        );

    },


    // =====================================================
    // SESSÃO
    // =====================================================

    async checkSession() {

        try {

            const {
                data,
                error
            } = await supabaseClient.auth.getSession();


            if (error) {
                throw error;
            }


            if (data.session) {

                this.currentUser =
                    data.session.user;

                await this.showApp();

            } else {

                this.showLogin();

            }


            supabaseClient.auth.onAuthStateChange(
                async (_event, session) => {

                    if (session) {

                        this.currentUser =
                            session.user;

                        await this.showApp();

                    } else {

                        this.currentUser = null;

                        this.showLogin();

                    }

                }
            );

        } catch (error) {

            console.error(
                "Erro ao verificar sessão:",
                error
            );

            this.showLogin();

        }

    },


    // =====================================================
    // LOGIN
    // =====================================================

    async handleLogin(event) {

        event.preventDefault();


        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value;


        const button =
            document.getElementById("loginButton");

        const message =
            document.getElementById("loginMessage");


        if (!email || !password) {

            this.showMessage(
                message,
                "Preencha e-mail e senha.",
                "error"
            );

            return;

        }


        button.disabled = true;

        button.textContent = "Entrando...";

        message.textContent = "";


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


            this.currentUser = data.user;

            await this.showApp();


        } catch (error) {

            console.error(
                "Erro no login:",
                error
            );


            this.showMessage(
                message,
                this.translateAuthError(error),
                "error"
            );


        } finally {

            button.disabled = false;

            button.textContent = "Entrar";

        }

    },


    // =====================================================
    // LOGOUT
    // =====================================================

    async handleLogout() {

        try {

            await supabaseClient.auth.signOut();

        } catch (error) {

            console.error(
                "Erro ao sair:",
                error
            );

        }

    },


    // =====================================================
    // MOSTRAR LOGIN
    // =====================================================

    showLogin() {

        const loginScreen =
            document.getElementById("loginScreen");

        const appScreen =
            document.getElementById("appScreen");


        if (loginScreen) {
            loginScreen.hidden = false;
        }

        if (appScreen) {
            appScreen.hidden = true;
        }

    },


    // =====================================================
    // MOSTRAR APLICAÇÃO
    // =====================================================

    async showApp() {

        const loginScreen =
            document.getElementById("loginScreen");

        const appScreen =
            document.getElementById("appScreen");


        if (loginScreen) {
            loginScreen.hidden = true;
        }

        if (appScreen) {
            appScreen.hidden = false;
        }


        await this.loadUserProfile();

        await this.loadCategories();

        await this.loadProducts();

        await this.loadDashboard();

    },


    // =====================================================
    // PERFIL
    // =====================================================

    async loadUserProfile() {

        if (!this.currentUser) {
            return;
        }


        const userName =
            document.getElementById("userName");


        if (!userName) {
            return;
        }


        try {

            const {
                data,
                error
            } = await supabaseClient
                .from("profiles")
                .select("full_name")
                .eq("id", this.currentUser.id)
                .maybeSingle();


            if (error) {
                throw error;
            }


            const name =
                data?.full_name ||
                this.currentUser.email?.split("@")[0] ||
                "MabijuFit";


            userName.textContent = name;


        } catch (error) {

            console.error(
                "Erro ao carregar perfil:",
                error
            );


            userName.textContent =
                this.currentUser.email?.split("@")[0] ||
                "MabijuFit";

        }

    },


    // =====================================================
    // NAVEGAÇÃO
    // =====================================================

    async navigate(section) {

        const screens = {

            home: "homeScreen",

            products: "productsScreen",

            stock: "stockScreen",

            sales: "salesScreen",

            finance: "financeScreen"

        };


        if (!screens[section]) {
            return;
        }


        Object.values(screens)
            .forEach((screenId) => {

                const screen =
                    document.getElementById(screenId);

                if (screen) {
                    screen.hidden = true;
                }

            });


        const target =
            document.getElementById(
                screens[section]
            );


        if (target) {
            target.hidden = false;
        }


        document
            .querySelectorAll(
                ".nav-item[data-section]"
            )
            .forEach((button) => {

                button.classList.toggle(
                    "active",
                    button.dataset.section === section
                );

            });


        this.currentSection = section;


        if (section === "products") {

            await this.loadCategories();

            await this.loadProducts();

        }


        if (section === "stock") {

            await this.loadProducts();

            this.renderStock();

        }


        if (section === "sales") {

            await this.loadSales();

        }


        if (section === "finance") {

            await this.loadFinancialTransactions();

        }


        if (section === "home") {

            await this.loadDashboard();

        }

    },


    // =====================================================
    // MODAIS
    // =====================================================

    openModal(modalId) {

        const modal =
            document.getElementById(modalId);


        if (!modal) {
            return;
        }


        modal.hidden = false;

        document.body.classList.add(
            "modal-open"
        );


        if (modalId === "productModal") {

            this.resetProductForm();

            this.populateCategorySelect();

        }


        if (modalId === "categoryModal") {

            this.resetCategoryForm();

        }


        if (modalId === "transactionModal") {

            this.resetTransactionForm();

        }

    },


    closeModal(modalId) {

        const modal =
            document.getElementById(modalId);


        if (!modal) {
            return;
        }


        modal.hidden = true;


        const visibleModals =
            document.querySelectorAll(
                ".modal:not([hidden])"
            );


        if (visibleModals.length === 0) {

            document.body.classList.remove(
                "modal-open"
            );

        }

    },


    // =====================================================
    // CATEGORIAS
    // =====================================================

    async loadCategories() {

        if (!this.currentUser) {
            return;
        }


        try {

            const {
                data,
                error
            } = await supabaseClient
                .from("categories")
                .select("*")
                .eq("user_id", this.currentUser.id)
                .eq("is_active", true)
                .order("name", {
                    ascending: true
                });


            if (error) {
                throw error;
            }


            this.categories = data || [];


            this.renderCategories();

            this.populateCategorySelect();


        } catch (error) {

            console.error(
                "Erro ao carregar categorias:",
                error
            );

        }

    },


    renderCategories() {

        const container =
            document.getElementById(
                "categoriesList"
            );


        if (!container) {
            return;
        }


        if (!this.categories.length) {

            container.innerHTML = `

                <div class="empty-state">

                    <div class="empty-state-icon">
                        C
                    </div>

                    <strong>
                        Nenhuma categoria
                    </strong>

                    <p>
                        Crie categorias para organizar
                        seus produtos.
                    </p>

                </div>

            `;

            return;

        }


        container.innerHTML =
            this.categories
                .map((category) => `

                    <article class="category-card">

                        <div>

                            <strong>
                                ${this.escapeHtml(
                                    category.name
                                )}
                            </strong>

                            ${
                                category.description
                                    ? `
                                        <p>
                                            ${this.escapeHtml(
                                                category.description
                                            )}
                                        </p>
                                      `
                                    : ""
                            }

                        </div>

                    </article>

                `)
                .join("");

    },


    populateCategorySelect() {

        const select =
            document.getElementById(
                "productCategory"
            );


        if (!select) {
            return;
        }


        const currentValue =
            select.value;


        select.innerHTML = `

            <option value="">
                Selecione
            </option>

        `;


        this.categories.forEach((category) => {

            const option =
                document.createElement("option");


            option.value =
                category.id;


            option.textContent =
                category.name;


            select.appendChild(option);

        });


        if (currentValue) {
            select.value = currentValue;
        }

    },


    async handleCategorySubmit(event) {

        event.preventDefault();


        if (!this.currentUser) {
            return;
        }


        const form =
            event.currentTarget;


        const button =
            document.getElementById(
                "saveCategoryButton"
            );


        const message =
            document.getElementById(
                "categoryFormMessage"
            );


        const formData =
            new FormData(form);


        const name =
            formData.get("name")?.toString().trim();


        const description =
            formData.get("description")?.toString().trim();


        const isActive =
            form.querySelector(
                '[name="is_active"]'
            )?.checked ?? true;


        if (!name) {

            this.showMessage(
                message,
                "Informe o nome da categoria.",
                "error"
            );

            return;

        }


        button.disabled = true;

        button.textContent = "Salvando...";


        try {

            const {
                error
            } = await supabaseClient
                .from("categories")
                .insert({

                    user_id:
                        this.currentUser.id,

                    name,

                    description:
                        description || null,

                    is_active:
                        isActive

                });


            if (error) {
                throw error;
            }


            this.showMessage(
                message,
                "Categoria criada com sucesso.",
                "success"
            );


            await this.loadCategories();


            setTimeout(() => {

                this.closeModal(
                    "categoryModal"
                );

            }, 500);


        } catch (error) {

            console.error(
                "Erro ao criar categoria:",
                error
            );


            this.showMessage(
                message,
                this.translateDatabaseError(error),
                "error"
            );


        } finally {

            button.disabled = false;

            button.textContent =
                "Salvar categoria";

        }

    },


    // =====================================================
    // PRODUTOS
    // =====================================================

    async loadProducts() {

        if (!this.currentUser) {
            return;
        }


        try {

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
                .eq("user_id", this.currentUser.id)
                .order("created_at", {
                    ascending: false
                });


            if (error) {
                throw error;
            }


            this.products = data || [];


            this.renderProducts();


            if (this.currentSection === "stock") {
                this.renderStock();
            }


        } catch (error) {

            console.error(
                "Erro ao carregar produtos:",
                error
            );

        }

    },


    renderProducts() {

        const container =
            document.getElementById(
                "productsList"
            );


        if (!container) {
            return;
        }


        const search =
            document
                .getElementById("productSearch")
                ?.value
                .trim()
                .toLowerCase() || "";


        const filtered =
            this.products.filter((product) => {

                const name =
                    product.name?.toLowerCase() || "";


                const sku =
                    product.sku?.toLowerCase() || "";


                const category =
                    product.categories?.name
                        ?.toLowerCase() || "";


                return (
                    name.includes(search) ||
                    sku.includes(search) ||
                    category.includes(search)
                );

            });


        if (!filtered.length) {

            container.innerHTML = `

                <div class="empty-state">

                    <div class="empty-state-icon">
                        P
                    </div>

                    <strong>
                        ${
                            search
                                ? "Nenhum produto encontrado"
                                : "Nenhum produto cadastrado"
                        }
                    </strong>

                    <p>
                        ${
                            search
                                ? "Tente outro termo de busca."
                                : "Cadastre seu primeiro produto para começar."
                        }
                    </p>

                </div>

            `;

            return;

        }


        container.innerHTML =
            filtered
                .map((product) => {

                    const price =
                        this.formatCurrency(
                            product.sale_price
                        );


                    const category =
                        product.categories?.name ||
                        "Sem categoria";


                    return `

                        <article
                            class="product-card"
                            data-product-id="${product.id}"
                        >

                            <div class="product-card-main">

                                <div class="product-placeholder">
                                    M
                                </div>


                                <div class="product-card-info">

                                    <strong>
                                        ${this.escapeHtml(
                                            product.name
                                        )}
                                    </strong>

                                    <span>
                                        ${this.escapeHtml(
                                            category
                                        )}
                                    </span>

                                    ${
                                        product.sku
                                            ? `
                                                <small>
                                                    SKU:
                                                    ${this.escapeHtml(
                                                        product.sku
                                                    )}
                                                </small>
                                              `
                                            : ""
                                    }

                                </div>

                            </div>


                            <div class="product-card-price">

                                <strong>
                                    ${price}
                                </strong>

                            </div>

                        </article>

                    `;

                })
                .join("");

    },


    async handleProductSubmit(event) {

        event.preventDefault();


        if (!this.currentUser) {
            return;
        }


        const form =
            event.currentTarget;


        const button =
            document.getElementById(
                "saveProductButton"
            );


        const message =
            document.getElementById(
                "productFormMessage"
            );


        const formData =
            new FormData(form);


        const name =
            formData.get("name")?.toString().trim();


        const sku =
            formData.get("sku")?.toString().trim();


        const description =
            formData.get("description")?.toString().trim();


        const categoryId =
            formData.get("category_id") ||
            null;


        const costPrice =
            this.parseNumber(
                formData.get("cost_price")
            );


        const salePrice =
            this.parseNumber(
                formData.get("sale_price")
            );


        const minimumStock =
            parseInt(
                formData.get("minimum_stock"),
                10
            ) || 0;


        const isActive =
            form.querySelector(
                '[name="is_active"]'
            )?.checked ?? true;


        if (!name) {

            this.showMessage(
                message,
                "Informe o nome do produto.",
                "error"
            );

            return;

        }


        if (salePrice === null || salePrice < 0) {

            this.showMessage(
                message,
                "Informe um preço de venda válido.",
                "error"
            );

            return;

        }


        button.disabled = true;

        button.textContent = "Salvando...";


        try {

            const {
                data,
                error
            } = await supabaseClient
                .from("products")
                .insert({

                    user_id:
                        this.currentUser.id,

                    category_id:
                        categoryId,

                    name,

                    sku:
                        sku || null,

                    description:
                        description || null,

                    cost_price:
                        costPrice ?? 0,

                    sale_price:
                        salePrice,

                    minimum_stock:
                        minimumStock,

                    is_active:
                        isActive

                })
                .select()
                .single();


            if (error) {
                throw error;
            }


            console.log(
                "Produto criado:",
                data
            );


            this.showMessage(
                message,
                "Produto criado com sucesso.",
                "success"
            );


            await this.loadProducts();


            await this.loadDashboard();


            setTimeout(() => {

                this.closeModal(
                    "productModal"
                );

            }, 500);


        } catch (error) {

            console.error(
                "Erro ao criar produto:",
                error
            );


            this.showMessage(
                message,
                this.translateDatabaseError(error),
                "error"
            );


        } finally {

            button.disabled = false;

            button.textContent =
                "Salvar produto";

        }

    },


    resetProductForm() {

        const form =
            document.getElementById(
                "productForm"
            );


        if (!form) {
            return;
        }


        form.reset();


        const active =
            document.getElementById(
                "productActive"
            );


        if (active) {
            active.checked = true;
        }


        const minimum =
            document.getElementById(
                "productMinimumStock"
            );


        if (minimum) {
            minimum.value = "0";
        }


        const message =
            document.getElementById(
                "productFormMessage"
            );


        if (message) {
            message.textContent = "";
            message.className =
                "form-message";
        }

    },


    // =====================================================
    // ESTOQUE
    // =====================================================

    renderStock() {

        const container =
            document.getElementById(
                "stockList"
            );


        if (!container) {
            return;
        }


        const search =
            document
                .getElementById("stockSearch")
                ?.value
                .trim()
                .toLowerCase() || "";


        const filtered =
            this.products.filter((product) => {

                const name =
                    product.name?.toLowerCase() || "";


                const sku =
                    product.sku?.toLowerCase() || "";


                return (
                    name.includes(search) ||
                    sku.includes(search)
                );

            });


        if (!filtered.length) {

            container.innerHTML = `

                <div class="empty-state">

                    <div class="empty-state-icon">
                        E
                    </div>

                    <strong>
                        Nenhum produto no estoque
                    </strong>

                    <p>
                        Cadastre produtos para
                        controlar o estoque.
                    </p>

                </div>

            `;

            return;

        }


        container.innerHTML =
            filtered
                .map((product) => `

                    <article class="stock-card">

                        <div>

                            <strong>
                                ${this.escapeHtml(
                                    product.name
                                )}
                            </strong>

                            <span>
                                Estoque mínimo:
                                ${product.minimum_stock || 0}
                            </span>

                        </div>

                        <strong>
                            —
                        </strong>

                    </article>

                `)
                .join("");

    },


    // =====================================================
    // VENDAS
    // =====================================================

    openSaleModal() {

        this.saleItems = [];

        this.renderSaleItems();

        this.calculateSaleTotal();

        this.openModal("saleModal");

    },


    addSaleItem() {

        if (!this.products.length) {

            alert(
                "Cadastre pelo menos um produto antes de registrar uma venda."
            );

            return;

        }


        this.saleItems.push({

            product_id:
                this.products[0].id,

            quantity:
                1,

            unit_price:
                Number(
                    this.products[0].sale_price || 0
                )

        });


        this.renderSaleItems();

        this.calculateSaleTotal();

    },


    renderSaleItems() {

        const container =
            document.getElementById(
                "saleItems"
            );


        if (!container) {
            return;
        }


        if (!this.saleItems.length) {

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
            this.saleItems
                .map((item, index) => {

                    const options =
                        this.products
                            .map((product) => `

                                <option
                                    value="${product.id}"
                                    ${
                                        product.id ===
                                        item.product_id
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    ${this.escapeHtml(
                                        product.name
                                    )}
                                </option>

                            `)
                            .join("");


                    return `

                        <div
                            class="sale-item"
                            data-sale-item="${index}"
                        >

                            <div class="form-group">

                                <label>
                                    Produto
                                </label>

                                <select
                                    class="sale-product-select"
                                    data-index="${index}"
                                >

                                    ${options}

                                </select>

                            </div>


                            <div class="form-row">

                                <div class="form-group">

                                    <label>
                                        Quantidade
                                    </label>

                                    <input
                                        type="number"
                                        class="sale-quantity-input"
                                        data-index="${index}"
                                        min="1"
                                        step="1"
                                        value="${item.quantity}"
                                    >

                                </div>


                                <div class="form-group">

                                    <label>
                                        Valor
                                    </label>

                                    <input
                                        type="number"
                                        class="sale-price-input"
                                        data-index="${index}"
                                        min="0"
                                        step="0.01"
                                        value="${item.unit_price}"
                                    >

                                </div>

                            </div>


                            <button
                                type="button"
                                class="secondary-button"
                                data-remove-sale-item="${index}"
                            >
                                Remover
                            </button>

                        </div>

                    `;

                })
                .join("");


        container
            .querySelectorAll(
                ".sale-product-select"
            )
            .forEach((select) => {

                select.addEventListener(
                    "change",
                    (event) => {

                        const index =
                            Number(
                                event.target.dataset.index
                            );


                        const product =
                            this.products.find(
                                (item) =>
                                    item.id ===
                                    event.target.value
                            );


                        if (!product) {
                            return;
                        }


                        this.saleItems[index].product_id =
                            product.id;


                        this.saleItems[index].unit_price =
                            Number(
                                product.sale_price || 0
                            );


                        this.renderSaleItems();

                        this.calculateSaleTotal();

                    }
                );

            });


        container
            .querySelectorAll(
                ".sale-quantity-input"
            )
            .forEach((input) => {

                input.addEventListener(
                    "input",
                    (event) => {

                        const index =
                            Number(
                                event.target.dataset.index
                            );


                        this.saleItems[index].quantity =
                            Math.max(
                                1,
                                parseInt(
                                    event.target.value,
                                    10
                                ) || 1
                            );


                        this.calculateSaleTotal();

                    }
                );

            });


        container
            .querySelectorAll(
                ".sale-price-input"
            )
            .forEach((input) => {

                input.addEventListener(
                    "input",
                    (event) => {

                        const index =
                            Number(
                                event.target.dataset.index
                            );


                        this.saleItems[index].unit_price =
                            Math.max(
                                0,
                                Number(
                                    event.target.value
                                ) || 0
                            );


                        this.calculateSaleTotal();

                    }
                );

            });


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


                        this.saleItems.splice(
                            index,
                            1
                        );


                        this.renderSaleItems();

                        this.calculateSaleTotal();

                    }
                );

            });

    },


    calculateSaleTotal() {

        const subtotal =
            this.saleItems.reduce(
                (total, item) =>
                    total +
                    (
                        Number(item.quantity) *
                        Number(item.unit_price)
                    ),
                0
            );


        const discount =
            Number(
                document.getElementById(
                    "saleDiscount"
                )?.value
            ) || 0;


        const total =
            Math.max(
                0,
                subtotal - discount
            );


        const element =
            document.getElementById(
                "saleTotal"
            );


        if (element) {

            element.textContent =
                this.formatCurrency(total);

        }


        return {
            subtotal,
            discount,
            total
        };

    },


    async handleSaleSubmit(event) {

        event.preventDefault();


        if (!this.currentUser) {
            return;
        }


        if (!this.saleItems.length) {

            alert(
                "Adicione pelo menos um produto à venda."
            );

            return;

        }


        const button =
            document.getElementById(
                "saveSaleButton"
            );


        const message =
            document.getElementById(
                "saleFormMessage"
            );


        const paymentMethod =
            document.getElementById(
                "salePaymentMethod"
            )?.value || null;


        const notes =
            document.getElementById(
                "saleNotes"
            )?.value.trim() || null;


        const totals =
            this.calculateSaleTotal();


        button.disabled = true;

        button.textContent =
            "Salvando...";


        try {

            const {
                data: sale,
                error: saleError
            } = await supabaseClient
                .from("sales")
                .insert({

                    user_id:
                        this.currentUser.id,

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


            if (saleError) {
                throw saleError;
            }


            const saleItems =
                this.saleItems.map((item) => {

                    const product =
                        this.products.find(
                            (product) =>
                                product.id ===
                                item.product_id
                        );


                    return {

                        user_id:
                            this.currentUser.id,

                        sale_id:
                            sale.id,

                        product_variant_id:
                            null,

                        product_name:
                            product?.name ||
                            "Produto",

                        variant_description:
                            null,

                        quantity:
                            Number(item.quantity),

                        unit_price:
                            Number(item.unit_price),

                        unit_cost:
                            Number(
                                product?.cost_price || 0
                            ),

                        discount:
                            0,

                        total:
                            Number(item.quantity) *
                            Number(item.unit_price)

                    };

                });


            /*
             * A tabela sale_items exige product_variant_id.
             * Como ainda não implementamos as variações,
             * a criação dos itens será finalizada na etapa
             * de variantes/estoque.
             */

            console.log(
                "Venda criada:",
                sale
            );

            console.log(
                "Itens preparados:",
                saleItems
            );


            this.showMessage(
                message,
                "Venda registrada. Os itens serão vinculados às variações quando o módulo de estoque estiver ativo.",
                "success"
            );


            await this.loadSales();

            await this.loadDashboard();


            setTimeout(() => {

                this.closeModal(
                    "saleModal"
                );

            }, 800);


        } catch (error) {

            console.error(
                "Erro ao criar venda:",
                error
            );


            this.showMessage(
                message,
                this.translateDatabaseError(error),
                "error"
            );


        } finally {

            button.disabled = false;

            button.textContent =
                "Finalizar venda";

        }

    },


    async loadSales() {

        const container =
            document.getElementById(
                "salesList"
            );


        if (!container || !this.currentUser) {
            return;
        }


        try {

            const {
                data,
                error
            } = await supabaseClient
                .from("sales")
                .select("*")
                .eq("user_id", this.currentUser.id)
                .order("sale_date", {
                    ascending: false
                })
                .limit(50);


            if (error) {
                throw error;
            }


            if (!data?.length) {

                container.innerHTML = `

                    <div class="empty-state">

                        <div class="empty-state-icon">
                            V
                        </div>

                        <strong>
                            Nenhuma venda
                        </strong>

                        <p>
                            As vendas registradas
                            aparecerão aqui.
                        </p>

                    </div>

                `;

                return;

            }


            container.innerHTML =
                data
                    .map((sale) => `

                        <article class="sale-card">

                            <div>

                                <strong>
                                    Venda #${sale.sale_number}
                                </strong>

                                <span>
                                    ${this.formatDateTime(
                                        sale.sale_date
                                    )}
                                </span>

                            </div>


                            <strong>
                                ${this.formatCurrency(
                                    sale.total
                                )}
                            </strong>

                        </article>

                    `)
                    .join("");


        } catch (error) {

            console.error(
                "Erro ao carregar vendas:",
                error
            );

        }

    },


    // =====================================================
    // FINANCEIRO
    // =====================================================

    async handleTransactionSubmit(event) {

        event.preventDefault();


        if (!this.currentUser) {
            return;
        }


        const form =
            event.currentTarget;


        const button =
            document.getElementById(
                "saveTransactionButton"
            );


        const message =
            document.getElementById(
                "transactionFormMessage"
            );


        const formData =
            new FormData(form);


        const type =
            formData
                .get("transaction_type")
                ?.toString();


        const category =
            formData
                .get("category")
                ?.toString()
                .trim();


        const description =
            formData
                .get("description")
                ?.toString()
                .trim();


        const amount =
            this.parseNumber(
                formData.get("amount")
            );


        const transactionDate =
            formData
                .get("transaction_date")
                ?.toString();


        const paymentMethod =
            formData
                .get("payment_method")
                ?.toString();


        const notes =
            formData
                .get("notes")
                ?.toString()
                .trim();


        if (!type) {

            this.showMessage(
                message,
                "Selecione o tipo do lançamento.",
                "error"
            );

            return;

        }


        if (!description) {

            this.showMessage(
                message,
                "Informe a descrição.",
                "error"
            );

            return;

        }


        if (amount === null || amount < 0) {

            this.showMessage(
                message,
                "Informe um valor válido.",
                "error"
            );

            return;

        }


        if (!transactionDate) {

            this.showMessage(
                message,
                "Informe a data.",
                "error"
            );

            return;

        }


        button.disabled = true;

        button.textContent =
            "Salvando...";


        try {

            const {
                error
            } = await supabaseClient
                .from("financial_transactions")
                .insert({

                    user_id:
                        this.currentUser.id,

                    transaction_type:
                        type,

                    category:
                        category || null,

                    description,

                    amount,

                    transaction_date:
                        transactionDate,

                    payment_method:
                        paymentMethod || null,

                    notes:
                        notes || null

                });


            if (error) {
                throw error;
            }


            this.showMessage(
                message,
                "Lançamento salvo com sucesso.",
                "success"
            );


            await this.loadFinancialTransactions();

            await this.loadDashboard();


            setTimeout(() => {

                this.closeModal(
                    "transactionModal"
                );

            }, 500);


        } catch (error) {

            console.error(
                "Erro ao criar lançamento:",
                error
            );


            this.showMessage(
                message,
                this.translateDatabaseError(error),
                "error"
            );


        } finally {

            button.disabled = false;

            button.textContent =
                "Salvar lançamento";

        }

    },


    async loadFinancialTransactions() {

        const container =
            document.getElementById(
                "financeList"
            );


        if (!container || !this.currentUser) {
            return;
        }


        try {

            const {
                data,
                error
            } = await supabaseClient
                .from("financial_transactions")
                .select("*")
                .eq("user_id", this.currentUser.id)
                .order("transaction_date", {
                    ascending: false
                })
                .limit(100);


            if (error) {
                throw error;
            }


            const transactions =
                data || [];


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
                            Receitas e despesas
                            aparecerão aqui.
                        </p>

                    </div>

                `;

            } else {

                container.innerHTML =
                    transactions
                        .map((transaction) => `

                            <article class="finance-card">

                                <div>

                                    <strong>
                                        ${this.escapeHtml(
                                            transaction.description
                                        )}
                                    </strong>

                                    <span>
                                        ${this.escapeHtml(
                                            transaction.category ||
                                            "Sem categoria"
                                        )}
                                    </span>

                                </div>


                                <strong>
                                    ${
                                        transaction.transaction_type ===
                                        "expense"
                                            ? "-"
                                            : "+"
                                    }

                                    ${this.formatCurrency(
                                        transaction.amount
                                    )}
                                </strong>

                            </article>

                        `)
                        .join("");

            }


            this.updateFinanceMetrics(
                transactions
            );


        } catch (error) {

            console.error(
                "Erro ao carregar financeiro:",
                error
            );

        }

    },


    updateFinanceMetrics(transactions) {

        const income =
            transactions
                .filter(
                    (item) =>
                        item.transaction_type ===
                        "income"
                )
                .reduce(
                    (total, item) =>
                        total +
                        Number(item.amount || 0),
                    0
                );


        const expenses =
            transactions
                .filter(
                    (item) =>
                        item.transaction_type ===
                        "expense"
                )
                .reduce(
                    (total, item) =>
                        total +
                        Number(item.amount || 0),
                    0
                );


        const balance =
            income - expenses;


        const incomeElement =
            document.getElementById(
                "financeIncome"
            );


        const expensesElement =
            document.getElementById(
                "financeExpenses"
            );


        const balanceElement =
            document.getElementById(
                "financeBalance"
            );


        if (incomeElement) {

            incomeElement.textContent =
                this.formatCurrency(
                    income
                );

        }


        if (expensesElement) {

            expensesElement.textContent =
                this.formatCurrency(
                    expenses
                );

        }


        if (balanceElement) {

            balanceElement.textContent =
                this.formatCurrency(
                    balance
                );

        }

    },


    resetTransactionForm() {

        const form =
            document.getElementById(
                "transactionForm"
            );


        if (!form) {
            return;
        }


        form.reset();


        this.setDefaultTransactionDate();


        const message =
            document.getElementById(
                "transactionFormMessage"
            );


        if (message) {

            message.textContent = "";

            message.className =
                "form-message";

        }

    },


    setDefaultTransactionDate() {

        const input =
            document.getElementById(
                "transactionDate"
            );


        if (!input) {
            return;
        }


        const now =
            new Date();


        const year =
            now.getFullYear();


        const month =
            String(
                now.getMonth() + 1
            ).padStart(2, "0");


        const day =
            String(
                now.getDate()
            ).padStart(2, "0");


        input.value =
            `${year}-${month}-${day}`;

    },


    // =====================================================
    // DASHBOARD
    // =====================================================

    async loadDashboard() {

        if (!this.currentUser) {
            return;
        }


        try {

            const today =
                new Date();


            const year =
                today.getFullYear();


            const month =
                String(
                    today.getMonth() + 1
                ).padStart(2, "0");


            const day =
                String(
                    today.getDate()
                ).padStart(2, "0");


            const startOfDay =
                `${year}-${month}-${day}T00:00:00`;


            const endOfDay =
                `${year}-${month}-${day}T23:59:59`;


            // VENDAS
            const {
                data: sales
            } = await supabaseClient
                .from("sales")
                .select("total")
                .eq("user_id", this.currentUser.id)
                .gte("sale_date", startOfDay)
                .lte("sale_date", endOfDay)
                .neq("status", "cancelled");


            const salesTotal =
                (sales || [])
                    .reduce(
                        (total, sale) =>
                            total +
                            Number(
                                sale.total || 0
                            ),
                        0
                    );


            const metricSales =
                document.getElementById(
                    "metricSales"
                );


            const metricOrders =
                document.getElementById(
                    "metricOrders"
                );


            if (metricSales) {

                metricSales.textContent =
                    this.formatCurrency(
                        salesTotal
                    );

            }


            if (metricOrders) {

                metricOrders.textContent =
                    String(
                        sales?.length || 0
                    );

            }


            // DESPESAS
            const {
                data: expenses
            } = await supabaseClient
                .from("financial_transactions")
                .select("amount")
                .eq("user_id", this.currentUser.id)
                .eq(
                    "transaction_type",
                    "expense"
                )
                .eq(
                    "transaction_date",
                    `${year}-${month}-${day}`
                );


            const expenseTotal =
                (expenses || [])
                    .reduce(
                        (total, item) =>
                            total +
                            Number(
                                item.amount || 0
                            ),
                        0
                    );


            const metricExpenses =
                document.getElementById(
                    "metricExpenses"
                );


            if (metricExpenses) {

                metricExpenses.textContent =
                    this.formatCurrency(
                        expenseTotal
                    );

            }


            // ESTOQUE
            const lowStock =
                this.products.filter(
                    (product) =>
                        Number(
                            product.minimum_stock || 0
                        ) > 0
                ).length;


            const metricLowStock =
                document.getElementById(
                    "metricLowStock"
                );


            if (metricLowStock) {

                metricLowStock.textContent =
                    String(lowStock);

            }


        } catch (error) {

            console.error(
                "Erro ao carregar dashboard:",
                error
            );

        }

    },


    // =====================================================
    // RESET FORMULÁRIO CATEGORIA
    // =====================================================

    resetCategoryForm() {

        const form =
            document.getElementById(
                "categoryForm"
            );


        if (!form) {
            return;
        }


        form.reset();


        const active =
            document.getElementById(
                "categoryActive"
            );


        if (active) {
            active.checked = true;
        }


        const message =
            document.getElementById(
                "categoryFormMessage"
            );


        if (message) {

            message.textContent = "";

            message.className =
                "form-message";

        }

    },


    // =====================================================
    // UTILITÁRIOS
    // =====================================================

    parseNumber(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }


        const normalized =
            String(value)
                .replace(",", ".")
                .trim();


        const number =
            Number(normalized);


        return Number.isFinite(number)
            ? number
            : null;

    },


    formatCurrency(value) {

        const number =
            Number(value || 0);


        return number.toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );

    },


    formatDateTime(value) {

        if (!value) {
            return "";
        }


        const date =
            new Date(value);


        if (Number.isNaN(date.getTime())) {
            return "";
        }


        return date.toLocaleString(
            "pt-BR",
            {
                dateStyle: "short",
                timeStyle: "short"
            }
        );

    },


    showMessage(
        element,
        message,
        type = ""
    ) {

        if (!element) {
            return;
        }


        element.textContent =
            message;


        element.className =
            `form-message ${type}`;

    },


    translateAuthError(error) {

        const message =
            error?.message?.toLowerCase() || "";


        if (
            message.includes(
                "invalid login credentials"
            )
        ) {

            return "E-mail ou senha incorretos.";

        }


        if (
            message.includes(
                "email not confirmed"
            )
        ) {

            return "O e-mail ainda não foi confirmado.";

        }


        return (
            error?.message ||
            "Não foi possível entrar."
        );

    },


    translateDatabaseError(error) {

        const message =
            error?.message || "";


        if (
            message.includes(
                "duplicate key"
            )
        ) {

            return "Já existe um registro com esses dados.";

        }


        if (
            message.includes(
                "row-level security"
            )
        ) {

            return "Acesso bloqueado pelas regras de segurança do banco.";

        }


        if (
            message.includes(
                "violates foreign key"
            )
        ) {

            return "Existe uma informação relacionada que não é válida.";

        }


        return (
            message ||
            "Não foi possível salvar os dados."
        );

    },


    escapeHtml(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }

};


// =========================================================
// INICIAR APLICAÇÃO
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        App.init();

    }
);
