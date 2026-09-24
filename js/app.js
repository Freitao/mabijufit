// =========================================================
// MABIJUFIT — APP.JS
// Versão consolidada
// Produtos + Fotos + Estoque + Vendas + Financeiro
// =========================================================

"use strict";


// =========================================================
// ESTADO
// =========================================================

let currentUser = null;
let appInitialized = false;
let sessionGeneration = 0;
let authRevision = 0;
let initializationPromise = null;
let currentSection = "home";

let categoriesCache = [];
let colorsCache = [];
let sizesCache = [];
let productsCache = [];
let variantsCache = [];
let productColorsCache = [];
let productColorsDraft = [];
let selectedProductColor = null;
let productEditRevision = null;
let productSaveUncertain = false;
let removedProductImageIds = [];
let salesCache = [];
let financeCache = [];

let productImagesCache = {};

let productVariationsDraft = [];
let productPhotosDraft = [];
let productPhotoPreviewUrls = [];

let editingProductId = null;

let saleDraft = [];
let saleProductPickerOpen = false;
let saleVariantSelectionProductId = null;

let currentFinancePeriod = "month";
let stockFilter = "all";
let productFilter = "all";
let financeFilter = "all";
let toastTimer;
let lastFocusedElement = null;
let saleSubmitting = false;
let productSaving = false;
let transactionSaving = false;
let financeDeleting = false;
let financeDeleteTarget = null;
let saleDetailsRevision = 0;
let currentProfile = null;
let profileLoadPromise = null;
let saleCancelling = false;
let saleCancellationTarget = null;


// =========================================================
// CONFIGURAÇÃO DE FOTOS
// =========================================================

const PRODUCT_IMAGE_MAX_SIZE =
    8 * 1024 * 1024;

const PRODUCT_IMAGE_MAX_DIMENSION =
    1600;

const PRODUCT_IMAGE_INITIAL_QUALITY =
    0.82;


// =========================================================
// HELPERS
// =========================================================

async function fetchAllRows(createQuery) {
    const rows = [];
    const pageSize = 500;
    for (let offset = 0; ;) {
        const { data, error } = await createQuery().order("id").range(offset, offset + pageSize - 1);
        if (error) return { data: null, error };
        rows.push(...(data || []));
        if (!data?.length) return { data: rows, error: null };
        offset += data.length;
    }
}

function sessionClient(userId, generation) {
    const assertSession = () => {
        if (generation !== sessionGeneration || currentUser?.id !== userId) {
            throw new Error("A sessão mudou durante a operação. Confira os registros antes de tentar novamente.");
        }
    };
    return {
        from(table) { assertSession(); return supabaseClient.from(table); },
        async rpc(name, args) { assertSession(); const result = await supabaseClient.rpc(name, args); assertSession(); return result; },
        storage: { from(bucket) { assertSession(); return supabaseClient.storage.from(bucket); } }
    };
}

function showToast(message) {
    const toast = $("appToast");
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);
}

function selectFilter(containerId, attribute, value) {
    $(containerId).querySelectorAll("button").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset[attribute] === value));
    });
}

function setProductPanel(panel) {
    document.querySelectorAll("[data-product-panel]").forEach(element => {
        element.hidden = element.dataset.productPanel !== panel;
    });
    selectFilter("productFormTabs", "productPanelTarget", panel);
    $("productForm").scrollTop = 0;
}

function setSaleStage(stage) {
    document.querySelectorAll("[data-sale-stage]").forEach(element => {
        element.hidden = element.dataset.saleStage !== stage;
    });
    $("saleModalTitle").textContent = stage === "payment" ? "Pagamento da venda" : "Nova venda";
    $("saleModal").querySelector(".modal-body").scrollTop = 0;
    if (stage === "payment") {
        if ($("saleFormMessage").classList.contains("success")) showMessage("saleFormMessage", "");
        $("saleBackToItems").focus({ preventScroll: true });
    }
}

function syncSalePickerView() {
    $("saleAddProductButton").setAttribute("aria-expanded", String(saleProductPickerOpen));
    $("saleManagementWorkspace").classList.toggle("picking", saleProductPickerOpen);
    $("saleModalTitle").textContent = saleProductPickerOpen ? "Adicionar à venda" : "Nova venda";
    $("saleProductSearchInput").hidden = !!saleVariantSelectionProductId;
    $("salePickerTitle").textContent = saleVariantSelectionProductId ? "Escolha cor e tamanho" : "Selecione o produto";
    if (saleProductPickerOpen) $("saleClosePickerButton").focus({ preventScroll: true });
}

function emptyState(title, detail, action, label) {
    return `<div class="empty-state compact"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p>${action ? `<button type="button" class="secondary-button small" data-action="${action}">${escapeHtml(label)}</button>` : ""}</div>`;
}

async function submitAuxiliaryForm(event, save) {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.getAttribute("aria-busy") === "true") return;
    const button = event.submitter || form.querySelector('[type="submit"]');
    form.setAttribute("aria-busy", "true");
    form.inert = true;
    setLoading(button, true);
    try { await save(event); }
    finally { form.removeAttribute("aria-busy"); form.inert = false; setLoading(button, false); }
}

function showRegistration(name) {
    document.querySelectorAll("[data-registration-panel]").forEach(panel => {
        panel.hidden = panel.dataset.registrationPanel !== name;
    });
    selectFilter("registrationFilters", "registration", name);
}

function showDataLoadError() {
    let notice = document.getElementById("dataLoadError");
    if (!notice) {
        notice = document.createElement("p");
        notice.id = "dataLoadError";
        notice.setAttribute("role", "alert");
        document.getElementById("appScreen").prepend(notice);
    }
    notice.textContent = "Não foi possível atualizar todos os dados. Os valores podem estar desatualizados. Verifique sua conexão e atualize a página.";
}

function $(id) {
    return document.getElementById(id);
}


function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function iconSvg(name) {
    const paths = {
        bag: '<path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
        camera: '<path d="M4 6h4l2-3h4l2 3h4v15H4Z"/><circle cx="12" cy="13" r="4"/>',
        trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
        receipt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2ZM9 8h6M9 12h6"/>',
        chart: '<path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7"/>'
    };
    return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.bag}</svg>`;
}


function formatCurrency(value) {

    const number =
        Number(value || 0);

    return number.toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );
}


function todayISO() {
    return localDateKey(new Date());
}


function localDateKey(
    value
) {

    if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(
            value
        )
    ) {
        return value;
    }

    if (value === null || value === undefined || value === "") return "";

    const date =
        value instanceof Date
            ? value
            : new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function parseLocalDate(
    value
) {

    const key =
        localDateKey(value);

    if (!key) {
        return null;
    }

    const [
        year,
        month,
        day
    ] = key
        .split("-")
        .map(Number);

    return new Date(
        year,
        month - 1,
        day
    );
}


function formatLocalDate(
    value
) {

    const date =
        parseLocalDate(value);

    return date
        ? date.toLocaleDateString(
            "pt-BR"
        )
        : "Data não informada";
}


const paymentMethodLabels = {
    pix: "Pix",
    cash: "Dinheiro",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    transfer: "Transferência",
    boleto: "Boleto",
    other: "Outro"
};


function formatLocalDateTime(value) {
    if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatLocalDate(value);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Data não informada" : date.toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
}


function normalizePaymentMethod(
    value
) {

    const original =
        String(value || "")
            .trim();

    const normalized =
        original
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .toLowerCase();

    const aliases = {
        pix: "pix",
        dinheiro: "cash",
        cash: "cash",
        "cartao de credito": "credit_card",
        credit_card: "credit_card",
        "cartao de debito": "debit_card",
        debit_card: "debit_card",
        transferencia: "transfer",
        transfer: "transfer",
        boleto: "boleto",
        outro: "other",
        other: "other"
    };

    return aliases[normalized] ||
        original;
}


function formatPaymentMethod(
    value
) {

    const normalized =
        normalizePaymentMethod(value);

    return paymentMethodLabels[
        normalized
    ] || normalized ||
        "Pagamento não informado";
}


function showMessage(
    elementId,
    message,
    type = "error"
) {

    const element =
        $(elementId);

    if (!element) {
        return;
    }

    element.textContent =
        message || "";

    element.setAttribute(
        "aria-live",
        type === "error"
            ? "assertive"
            : "polite"
    );

    element.className =
        message
            ? `form-message ${type}`
            : "form-message";
}


function setLoading(
    button,
    loading,
    text = "Salvando..."
) {

    if (!button) {
        return;
    }

    if (loading) {

        if (
            !button.dataset.originalText
        ) {
            button.dataset.originalText =
                button.textContent;
        }

        button.disabled =
            true;

        button.textContent =
            text;

    } else {

        button.disabled =
            false;

        if (
            button.dataset.originalText
        ) {

            button.textContent =
                button.dataset.originalText;

            delete button.dataset.originalText;
        }
    }
}


function getAuthErrorMessage(error) {

    const message =
        String(
            error?.message || ""
        ).toLowerCase();

    if (
        message.includes(
            "invalid login credentials"
        ) ||
        message.includes(
            "invalid credentials"
        )
    ) {
        return "E-mail ou senha incorretos.";
    }

    if (
        message.includes(
            "email not confirmed"
        )
    ) {
        return "O e-mail desta conta ainda não foi confirmado.";
    }

    if (
        message.includes(
            "too many requests"
        )
    ) {
        return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    }

    return (
        "Não foi possível entrar. Verifique sua conexão e tente novamente."
    );
}


function getProductColorImage(productId, groupId) {
    const images = (productImagesCache[productId] || []).filter(i => i.product_color_id === groupId);
    return images.find(i => i.is_color_primary)?.public_url || images[0]?.public_url || "";
}
function getProductMainImage(
    productId
) {

    const images =
        productImagesCache[
            productId
        ] || [];

    const primary =
        images.find(
            image =>
                image.is_primary === true
        );

    return (
        primary?.public_url ||
        images[0]?.public_url ||
        ""
    );
}


function productImageHtml(
    productId,
    className = "product-thumbnail",
    productColorId = undefined
) {

    const groupImages = (productImagesCache[productId] || []).filter(p => p.product_color_id === productColorId);
    const image = productColorId === undefined ? getProductMainImage(productId) :
        (groupImages.find(p => p.is_color_primary)?.public_url || groupImages[0]?.public_url || "");

    if (image) {

        return `
            <img
                class="${className}"
                src="${escapeHtml(image)}"
                alt="Foto do produto"
                loading="lazy"
            >
        `;
    }

    return `
        <span
            class="${className} product-image-placeholder"
            aria-hidden="true"
        >
            <span>${iconSvg("camera")}</span>
        </span>
    `;
}


function getProductVariants(productId) {
    return getOperationalVariants().filter(v => v.product_id === productId);
}
function getProductTotalStock(productId) {
    return variantsCache.filter(v => v.product_id === productId).reduce((n, v) => n + Number(v.stock_quantity || 0), 0);
}
function getProductColorNames(productId) {
    return productColorsCache.filter(c => c.product_id === productId).map(c => c.colors?.name || "Sem cor");
}

function getProductSizeNames(
    productId
) {

    const names = [];

    getProductVariants(
        productId
    ).forEach(
        variant => {

            const name =
                variant.sizes?.name;

            if (
                name &&
                !names.includes(name)
            ) {
                names.push(name);
            }
        }
    );

    return names;
}


function getStockStatus(
    stock,
    minimum
) {

    stock =
        Number(stock || 0);

    minimum =
        Number(minimum || 0);

    if (
        stock === 0
    ) {

        return {
            className: "zero",
            label: "Sem estoque"
        };
    }

    if (
        minimum > 0 &&
        stock <= minimum
    ) {

        return {
            className: "low",
            label: "Estoque baixo"
        };
    }

    return {
        className: "normal",
        label: "Normal"
    };
}


// =========================================================
// FOTOS DOS PRODUTOS
// =========================================================

function revokeProductPhotoPreviewUrls() {

    productPhotoPreviewUrls.forEach(
        url => {

            try {
                URL.revokeObjectURL(url);
            } catch (error) { console.warn("Falha ao liberar recurso de imagem:", error); }
        }
    );

    productPhotoPreviewUrls = [];
}


function clearProductPhotosDraft() {
    if ($("productCameraInput")) $("productCameraInput").value = "";

    revokeProductPhotoPreviewUrls();

    productPhotosDraft = [];

    const input =
        $("productPhotoInput");

    if (input) {
        input.value = "";
    }

    const preview =
        $("productPhotoPreview");

    if (preview) {
        preview.innerHTML = "";
    }
}


function normalizePhotoPrincipals() {
    if (productPhotosDraft.length && !productPhotosDraft.some(p => p.is_primary)) productPhotosDraft[0].is_primary = true;
    for (const group of productColorsDraft) {
        const photos = productPhotosDraft.filter(p => p.groupKey === group.key);
        if (photos.length && !photos.some(p => p.is_color_primary)) photos[0].is_color_primary = true;
    }
}
function renderProductPhotoPreview() {
    const photos = productPhotosDraft.filter(p => p.groupKey === selectedProductColor);
    $("productPhotoPreview").innerHTML = photos.map(p => `<div class="pc-photo">
        <img src="${escapeHtml(p.public_url || p.preview)}" alt="Foto ${escapeHtml(colorDraftName(p.groupKey))}"/>
        <button type="button" data-pc-photo="cover" data-key="${p.key}" aria-pressed="${!!p.is_primary}">${p.is_primary ? "★ Capa do produto" : "Usar como capa"}</button>
        ${p.groupKey ? `<button type="button" data-pc-photo="primary" data-key="${p.key}" aria-pressed="${!!p.is_color_primary}">${p.is_color_primary ? "★ Principal da cor" : "Principal da cor"}</button>` : ""}
        <label>Associar à cor<select data-pc-photo-group="${p.key}"><option value="">Fotos gerais</option>${productColorsDraft.map(c => `<option value="${c.key}" ${p.groupKey === c.key ? "selected" : ""}>${escapeHtml(colorDraftName(c.key))}</option>`).join("")}</select></label>
        <div class="pc-actions"><button type="button" data-pc-photo="up" data-key="${p.key}" aria-label="Mover foto para antes">↑</button><button type="button" data-pc-photo="down" data-key="${p.key}" aria-label="Mover foto para depois">↓</button><button type="button" data-pc-photo="remove" data-key="${p.key}">Remover</button></div>
    </div>`).join("") || '<p class="field-hint">Nenhuma foto neste grupo.</p>';
}
function handleProductPhotoSelection(event) {
    for (const file of Array.from(event.target.files || [])) {
        if (!file.type.startsWith("image/")) { showMessage("productFormMessage", "Selecione somente imagens."); continue; }
        const preview = URL.createObjectURL(file);
        productPhotoPreviewUrls.push(preview);
        productPhotosDraft.push({ key: crypto.randomUUID(), file, preview, groupKey: selectedProductColor,
            is_primary: !productPhotosDraft.length,
            is_color_primary: !!selectedProductColor && !productPhotosDraft.some(p => p.groupKey === selectedProductColor) });
    }
    event.target.value = "";
    renderProductColorEditor();
}

async function loadImageForOptimization(
    file
) {

    if (
        typeof createImageBitmap ===
        "function"
    ) {

        try {

            const bitmap =
                await createImageBitmap(
                    file,
                    {
                        imageOrientation:
                            "from-image"
                    }
                );

            return {
                source:
                    bitmap,
                width:
                    bitmap.width,
                height:
                    bitmap.height,
                close: () => {

                    try {
                        bitmap.close();
                    } catch (error) { console.warn("Falha ao liberar recurso de imagem:", error); }
                }
            };

        } catch (error) {

            console.warn(
                "createImageBitmap falhou. Tentando Image:",
                error
            );
        }
    }

    const objectUrl =
        URL.createObjectURL(
            file
        );

    try {

        const image =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    const img =
                        new Image();

                    img.onload =
                        () =>
                            resolve(
                                img
                            );

                    img.onerror =
                        () =>
                            reject(
                                new Error(
                                    "O navegador não conseguiu decodificar esta imagem."
                                )
                            );

                    img.src =
                        objectUrl;
                }
            );

        return {
            source:
                image,
            width:
                image.naturalWidth,
            height:
                image.naturalHeight,
            close:
                () => {}
        };

    } finally {

        URL.revokeObjectURL(
            objectUrl
        );
    }
}


function canvasToBlob(
    canvas,
    quality
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            canvas.toBlob(
                blob => {

                    if (!blob) {

                        reject(
                            new Error(
                                "Não foi possível gerar a imagem otimizada."
                            )
                        );

                        return;
                    }

                    resolve(blob);
                },
                "image/jpeg",
                quality
            );
        }
    );
}


async function optimizeProductImage(
    file
) {

    if (!file) {

        throw new Error(
            "Arquivo de imagem inválido."
        );
    }

    if (
        !file.type ||
        !file.type.startsWith(
            "image/"
        )
    ) {

        throw new Error(
            "O arquivo selecionado não é uma imagem válida."
        );
    }

    const image =
        await loadImageForOptimization(
            file
        );

    try {

        const originalWidth =
            Number(
                image.width || 0
            );

        const originalHeight =
            Number(
                image.height || 0
            );

        if (
            !originalWidth ||
            !originalHeight
        ) {

            throw new Error(
                "Não foi possível identificar as dimensões da imagem."
            );
        }

        const qualityAttempts = [
            PRODUCT_IMAGE_INITIAL_QUALITY,
            0.76,
            0.70,
            0.64,
            0.58,
            0.52,
            0.46,
            0.40,
            0.34,
            0.28
        ];

        const dimensionAttempts = [
            1600,
            1400,
            1200,
            1000,
            900,
            800
        ];

        let lastBlob = null;

        for (
            let dimensionIndex = 0;
            dimensionIndex <
                dimensionAttempts.length;
            dimensionIndex++
        ) {

            const maxDimension =
                dimensionAttempts[
                    dimensionIndex
                ];

            const scale =
                Math.min(
                    1,
                    maxDimension /
                    Math.max(
                        originalWidth,
                        originalHeight
                    )
                );

            const dimensions = {

                width:
                    Math.max(
                        1,
                        Math.round(
                            originalWidth *
                            scale
                        )
                    ),

                height:
                    Math.max(
                        1,
                        Math.round(
                            originalHeight *
                            scale
                        )
                    )
            };

            const canvas =
                document.createElement(
                    "canvas"
                );

            canvas.width =
                dimensions.width;

            canvas.height =
                dimensions.height;

            const context =
                canvas.getContext(
                    "2d",
                    {
                        alpha: false
                    }
                );

            if (!context) {

                throw new Error(
                    "O navegador não conseguiu preparar o processamento da imagem."
                );
            }

            context.imageSmoothingEnabled =
                true;

            context.imageSmoothingQuality =
                "high";

            context.drawImage(
                image.source,
                0,
                0,
                dimensions.width,
                dimensions.height
            );

            for (
                let qualityIndex = 0;
                qualityIndex <
                    qualityAttempts.length;
                qualityIndex++
            ) {

                const blob =
                    await canvasToBlob(
                        canvas,
                        qualityAttempts[
                            qualityIndex
                        ]
                    );

                lastBlob =
                    blob;

                if (
                    blob.size <=
                    PRODUCT_IMAGE_MAX_SIZE
                ) {

                    return new File(
                        [blob],
                        createOptimizedImageName(
                            file.name
                        ),
                        {
                            type:
                                "image/jpeg",
                            lastModified:
                                Date.now()
                        }
                    );
                }
            }
        }

        if (
            lastBlob &&
            lastBlob.size <=
            PRODUCT_IMAGE_MAX_SIZE
        ) {

            return new File(
                [lastBlob],
                createOptimizedImageName(
                    file.name
                ),
                {
                    type:
                        "image/jpeg",
                    lastModified:
                        Date.now()
                }
            );
        }

        throw new Error(
            "Não foi possível reduzir esta imagem para menos de 8 MB."
        );

    } finally {

        if (
            image?.close
        ) {
            image.close();
        }
    }
}


function createOptimizedImageName(
    originalName
) {

    const baseName =
        String(
            originalName ||
            "produto"
        )
            .replace(
                /\.[^/.]+$/,
                ""
            )
            .replace(
                /[^a-zA-Z0-9_-]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            );

    const safeBaseName =
        baseName ||
        "produto";

    return (
        `${safeBaseName}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 10)}.jpg`
    );
}


function createProductImageStoragePath(
    productId,
    file,
    index,
    userId = currentUser?.id
) {

    const safeName =
        createOptimizedImageName(
            file?.name ||
            `foto-${index + 1}`
        );

    return [
        userId,
        "products",
        productId,
        `${Date.now()}-${index}-${safeName}`
    ].join("/");
}


async function loadProductImages(
    productIds = []
) {
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId) return;
    const client = sessionClient(userId, generation);

    const requestedUserId = currentUser?.id;

    if (
        !currentUser ||
        !productIds.length
    ) {
        return;
    }

    const uniqueProductIds =
        [
            ...new Set(
                productIds.filter(
                    Boolean
                )
            )
        ];

    if (
        !uniqueProductIds.length
    ) {
        return;
    }

    try {
        const {
            data,
            error
        } =
            await fetchAllRows(() => client
                .from(
                    "product_images"
                )
                .select(`
                    id,
                    product_id,
                    storage_path,
                    public_url,
                    is_primary,
                    product_color_id,
                    is_color_primary,
                    display_order
                `)
                .eq(
                    "user_id",
                    userId
                )
                .in(
                    "product_id",
                    uniqueProductIds
                )
                .order(
                    "display_order"
                ));

        if (generation !== sessionGeneration) return;
        if (error) throw error;

        if (currentUser?.id !== requestedUserId) return;
        const loadedImages = Object.fromEntries(uniqueProductIds.map(id => [id, []]));
        (
            data || []
        ).forEach(
            image => {

                if (
                    !loadedImages[
                        image.product_id
                    ]
                ) {

                    loadedImages[
                        image.product_id
                    ] = [];
                }

                loadedImages[
                    image.product_id
                ].push(
                    image
                );
            }
        );
        productImagesCache = { ...productImagesCache, ...loadedImages };
    } catch (error) {
        if (generation !== sessionGeneration) return;
        console.error("Falha em loadProductImages", error);
        showDataLoadError();
    }
}


async function uploadProductImages(client, userId, generation, productId) {
    for (const photo of productPhotosDraft) {
        if (!photo.file || photo.storage_path) continue;
        const file = await optimizeProductImage(photo.file);
        if (generation !== sessionGeneration) throw new Error("A sessão mudou.");
        if (file.size > PRODUCT_IMAGE_MAX_SIZE) throw new Error("A imagem excede 8 MB após otimização.");
        const path = createProductImageStoragePath(productId, file, 0, userId);
        const { error } = await client.storage.from("product-images").upload(path, file, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        if (generation !== sessionGeneration) throw new Error("A sessão mudou.");
        photo.storage_path = path;
        photo.public_url = client.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    }
}
function isConfirmedRpcRejection(error) {
    return /^(22|23|28|42|P0)[0-9A-Z]{3}$/.test(error.code || "") || ["40001","40P01"].includes(error.code);
}
function productOperationError(error) {
    if (error.code === "42501") return "Operação bloqueada pelas permissões do banco. O modo de manutenção pode estar ativo. Seu rascunho foi mantido.";
    if (error.code === "40001") return "O produto ou estoque mudou. Seu rascunho foi mantido; reabra o produto para conferir os dados atuais antes de salvar.";
    return error.message || "Não foi possível confirmar a operação. Confira sua conexão.";
}
async function productRpc(client, args) {
    const { data, error } = await client.rpc("pc_save_product", args);
    if (error) throw error;
    if (!data?.product) throw new Error("Resposta do produto não confirmada.");
    return data;
}
async function removeConfirmedProductFiles(client, paths, userId) {
    // A transação já confirmou a remoção dos metadados. Storage não participa dela.
    // Guarda o manifesto para tentar novamente em uma próxima gravação confirmada.
    const key = `mabijufit-storage-cleanup:${userId}`;
    try {
        const queued = JSON.parse(localStorage.getItem(key) || "[]");
        const safe = [...new Set([...queued, ...(paths || [])])].filter(path => typeof path === "string" && path.startsWith(`${userId}/products/`));
        if (!safe.length) return true;
        localStorage.setItem(key, JSON.stringify(safe));
        for (let offset = 0; offset < safe.length; offset += 100) {
            const batch = safe.slice(offset, offset + 100);
            const {data, error: readError} = await client.from("product_images").select("storage_path").eq("user_id", userId).in("storage_path", batch);
            if (readError) return false;
            const unreferenced = batch.filter(path => !data.some(image => image.storage_path === path));
            if (unreferenced.length) {
                const {error} = await client.storage.from("product-images").remove(unreferenced);
                if (error) return false;
            }
            const remaining = JSON.parse(localStorage.getItem(key) || "[]").filter(path => !batch.includes(path));
            localStorage.setItem(key, JSON.stringify(remaining));
        }
        return true;
    } catch (error) {
        console.warn("Limpeza de arquivos pendente após confirmação dos metadados", error);
        return false;
    }
}

// =========================================================
// NAVEGAÇÃO
// =========================================================

const sectionMap = {

    home:
        "homeScreen",

    products:
        "productsScreen",

    settings:
        "settingsScreen",

    stock:
        "stockScreen",

    sales:
        "salesScreen",

    finance:
        "financeScreen"
};


function showSection(
    sectionName
) {

    if (
        !sectionMap[
            sectionName
        ]
    ) {

        sectionName =
            "home";
    }

    currentSection =
        sectionName;

    Object.entries(
        sectionMap
    ).forEach(
        (
            [
                name,
                elementId
            ]
        ) => {

            const section =
                $(elementId);

            if (!section) {
                return;
            }

            section.hidden =
                name !==
                sectionName;
        }
    );

    document
        .querySelectorAll(
            ".nav-item"
        )
        .forEach(
            button => {

                button.setAttribute("aria-current", button.dataset.section === sectionName ? "page" : "false");
                button.classList.toggle(
                    "active",
                    button.dataset.section ===
                    sectionName
                );
            }
        );

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    if (
        sectionName ===
        "home"
    ) {

        loadDashboard();
    }

    if (
        sectionName ===
        "products"
    ) {

        loadProductsPage();
    }

    if (
        sectionName ===
        "settings"
    ) {

        Promise.all([
            loadCategories(),
            loadColors(),
            loadSizes()
        ]);
    }

    if (
        sectionName ===
        "stock"
    ) {

        loadStock();
    }

    if (
        sectionName ===
        "sales"
    ) {

        loadSales();
        loadVariants();
    }

    if (
        sectionName ===
        "finance"
    ) {

        loadFinance();
    }
}


// =========================================================
// MODAIS — CONTROLE CENTRAL
// =========================================================

function initializeModals() {

    document
        .querySelectorAll(
            ".modal"
        )
        .forEach(
            modal => {

                /*
                 * Nenhum modal pode nascer aberto.
                 *
                 * A abertura somente acontece através
                 * de openModal().
                 */

                modal.hidden =
                    true;

                modal.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }
        );

    document.body.classList.remove(
        "modal-open"
    );
}


function openModal(
    id
) {
    $("appToast").hidden = true;

    const modal =
        $(id);

    if (!modal) {

        console.warn(
            `Modal não encontrado: ${id}`
        );

        return false;
    }

    if (!document.querySelector(".modal:not([hidden])")) lastFocusedElement =
        document.activeElement instanceof
            HTMLElement
            ? document.activeElement
            : null;

    /*
     * Fecha somente outros modais.
     * Isso evita que dois formulários fiquem
     * visíveis ao mesmo tempo.
     */

    document
        .querySelectorAll(
            ".modal"
        )
        .forEach(
            otherModal => {

                if (
                    otherModal !==
                    modal
                ) {

                    otherModal.hidden =
                        true;

                    otherModal.setAttribute(
                        "aria-hidden",
                        "true"
                    );
                }
            }
        );

    modal.hidden =
        false;
    modal.querySelectorAll(".modal-body, .modal-content > form").forEach(element => { element.scrollTop = 0; });
    $("appScreen").inert = true;
    $("loginScreen").inert = true;

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );

    window.requestAnimationFrame(
        () => {

            const closeButton =
                modal.querySelector(
                    ".modal-close"
                );

            closeButton?.focus();
        }
    );

    return true;
}


function closeModal(
    id
) {

    if ((id === "saleModal" && saleSubmitting) ||
        (id === "productModal" && productSaving) ||
        (id === "transactionModal" && transactionSaving) ||
        (id === "deleteFinanceModal" && financeDeleting) ||
        (id === "cancelSaleModal" && saleCancelling)) return;
    const modal =
        $(id);

    if (!modal) {
        return;
    }

    if (id === "deleteFinanceModal") financeDeleteTarget = null;
    if (id === "saleDetailsModal") saleDetailsRevision++;
    if (id === "cancelSaleModal") saleCancellationTarget = null;
    modal.hidden =
        true;

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    const visibleModal =
        document.querySelector(
            ".modal:not([hidden])"
        );

    if (!visibleModal) {
        $("appScreen").inert = false;
        $("loginScreen").inert = false;

        document.body.classList.remove(
            "modal-open"
        );

        if (
            lastFocusedElement &&
            document.contains(
                lastFocusedElement
            )
        ) {
            lastFocusedElement.focus();
        } else if (lastFocusedElement?.dataset.openSale) {
            // A recarga da lista pode ter substituído o card durante a consulta.
            [...document.querySelectorAll("[data-open-sale]")].find(element =>
                element.dataset.openSale === lastFocusedElement.dataset.openSale && element.getClientRects().length
            )?.focus();
        }

        lastFocusedElement = null;
    }

    if (
        id ===
        "saleModal"
    ) {

        closeSaleProductPicker();
    }
}


// =========================================================
// LOGIN
// =========================================================

async function handleLogin(
    event
) {
    event.preventDefault();

    event.stopPropagation();

    const emailInput =
        $("email");

    const passwordInput =
        $("password");

    const button =
        $("loginButton");

    const email =
        emailInput?.value.trim() ||
        "";

    const password =
        passwordInput?.value ||
        "";

    showMessage(
        "loginMessage",
        ""
    );

    if (
        !email ||
        !password
    ) {

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
        } =
            await supabaseClient
                .auth
                .signInWithPassword({
                    email,
                    password
                });

        if (error) {
            throw error;
        }

        if (
            !data?.session
        ) {

            showMessage(
                "loginMessage",
                "Login realizado, mas nenhuma sessão foi criada."
            );

            return;
        }

        await showApplication(
            data.user
        );

    } catch (
        error
    ) {

        console.error(
            "Erro no login:",
            error
        );

        showMessage(
            "loginMessage",
            getAuthErrorMessage(
                error
            )
        );

    } finally {

        setLoading(
            button,
            false
        );
    }
}


async function handleLogout() {
    if (saleSubmitting || productSaving || transactionSaving || financeDeleting || saleCancelling) {
        alert("Aguarde a operação terminar antes de sair.");
        return;
    }
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        resetSessionState();
    } catch (error) {
        console.error("Erro ao sair:", error);
        alert("Não foi possível encerrar a sessão. Tente novamente.");
    }
}

function resetSessionState() {
    productColorsCache = []; productColorsDraft = []; selectedProductColor = null;
    $("productForm").inert = false;
    saleCancellationTarget = null;
    currentProfile = null;
    profileLoadPromise = null;
    renderUserGreeting();
    saleDetailsRevision++;
    financeDeleteTarget = null;
    clearTimeout(toastTimer);
    $("appToast").hidden = true;
    stockFilter = "all"; productFilter = "all"; financeFilter = "all";
    selectFilter("stockFilters", "stockFilter", "all");
    selectFilter("productFilters", "productFilter", "all");
    selectFilter("financeFilters", "financeFilter", "all");
    ["productSearch", "stockSearch", "salesSearch", "financeSearch"].forEach(id => { $(id).value = ""; });
    currentFinancePeriod = "month";
    $("financePeriod").value = "month";
    showRegistration("categories");
    document.getElementById("dataLoadError")?.remove();
    sessionGeneration++;
    initializationPromise = null;
    categoriesCache = []; colorsCache = []; sizesCache = [];
    productsCache = []; variantsCache = []; salesCache = []; financeCache = [];
    productImagesCache = {};
    productVariationsDraft = []; editingProductId = null;
    saleDraft = []; productEditRevision = null; productSaveUncertain = false; removedProductImageIds = [];
    saleProductPickerOpen = false; saleVariantSelectionProductId = null;
    currentUser =
        null;

    appInitialized =
        false;
    $("appScreen").inert = false;
    $("loginScreen").inert = false;

    currentSection =
        "home";

    clearProductPhotosDraft();

    document
        .querySelectorAll(
            ".modal"
        )
        .forEach(
            modal => {

                modal.hidden =
                    true;

                modal.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }
        );

    document.body.classList.remove(
        "modal-open"
    );

    const appScreen =
        $("appScreen");

    const loginScreen =
        $("loginScreen");

    if (appScreen) {
        appScreen.hidden =
            true;
    }

    if (loginScreen) {
        loginScreen.hidden =
            false;
    }
}

async function showApplication(
    user
) {

    if (!user?.id) return;
    if (currentUser?.id !== user.id) resetSessionState();
    const generation = sessionGeneration;
    currentUser =
        user;

    const loginScreen =
        $("loginScreen");

    const appScreen =
        $("appScreen");

    const wasVisible =
        appScreen &&
        !appScreen.hidden;

    if (loginScreen) {
        loginScreen.hidden =
            true;
    }

    if (appScreen) {
        appScreen.hidden = !appInitialized;
    }

    renderUserGreeting();

    if (
        !appInitialized
    ) {

        appInitialized =
            true;

        initializationPromise = loadInitialData();
        await initializationPromise;
        if (generation !== sessionGeneration) return;
        if (appScreen) appScreen.hidden = false;

        showSection(
            "home"
        );

        return;
    }

    if (initializationPromise) await initializationPromise;
    if (generation !== sessionGeneration) return;

    if (!wasVisible) {

        showSection(
            currentSection ||
            "home"
        );
    }
}


// =========================================================
// CATEGORIAS
// =========================================================

function renderUserGreeting() {
    const fullName = typeof currentProfile?.full_name === "string"
        ? currentProfile.full_name.trim().replace(/\s+/g, " ") : "";
    $("userName").textContent = fullName ? `Olá, ${fullName}` : "Olá";
    $("userName").title = $("userName").textContent;
}

function loadUserProfile() {
    if (!currentUser) return Promise.resolve();
    if (profileLoadPromise) return profileLoadPromise;
    const userId = currentUser.id;
    const generation = sessionGeneration;
    const client = sessionClient(userId, generation);
    profileLoadPromise = (async () => {
        try {
            const { data, error } = await client.from("profiles").select("full_name").eq("id", userId).maybeSingle();
            if (error) throw error;
            if (generation !== sessionGeneration || currentUser?.id !== userId) return;
            currentProfile = data;
            renderUserGreeting();
        } catch (error) {
            if (generation !== sessionGeneration || currentUser?.id !== userId) return;
            currentProfile = null;
            renderUserGreeting();
            console.warn("Não foi possível carregar o nome do perfil.");
        }
    })();
    return profileLoadPromise;
}

async function loadCategories() {
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId) return;
    const client = sessionClient(userId, generation);


    try {
        const {
            data,
            error
        } =
            await fetchAllRows(() => client
                .from(
                    "categories"
                )
                .select("*")
                .eq(
                    "user_id",
                    userId
                )
                .order("name"));

        if (generation !== sessionGeneration) return;
        if (error) throw error;

        categoriesCache =
            data || [];

        renderCategories();
        populateCategorySelect();
    } catch (error) {
        if (generation !== sessionGeneration) return;
        console.error("Falha em loadCategories", error);
        showDataLoadError();
    }
}


function renderCategories() {

    const container =
        $("categoriesList");

    if (!container) {
        return;
    }

    if (
        !categoriesCache.length
    ) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${iconSvg("bag")}</div>
                <strong>Nenhuma categoria cadastrada</strong>
                <p>Crie categorias para organizar seus produtos.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        categoriesCache
            .map(
                category => `

                <div class="category-card">

                    <div class="category-card-info">
                    ${category.is_active === false ? '<small class="status-badge">Inativa</small>' : ''}

                        <strong>
                            ${escapeHtml(
                                category.name
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                category.description ||
                                "Sem descrição"
                            )}
                        </span>

                    </div>

                    <div class="category-card-actions">

                        <button
                            type="button"
                            class="icon-button"
                            data-edit-category="${category.id}"
                            aria-label="Editar categoria ${escapeHtml(category.name)}"
                        >
                            ✎
                        </button>

                        <button
                            type="button"
                            class="icon-button danger"
                            data-delete-category="${category.id}"
                            aria-label="Excluir categoria ${escapeHtml(category.name)}"
                        >
                            ×
                        </button>

                    </div>

                </div>
            `
            )
            .join("");
}


function populateCategorySelect(preservedCategoryId = null) {

    const select =
        $("productCategory");

    if (!select) {
        return;
    }

    const current =
        select.value;

    select.innerHTML = `
        <option value="">
            Selecione
        </option>
    `;

    categoriesCache
        .filter(
            category =>
                category.is_active !== false ||
                category.id === (preservedCategoryId || productsCache.find(product => product.id === editingProductId)?.category_id)
        )
        .forEach(
            category => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    category.id;

                option.textContent =
                    category.name;

                select.appendChild(
                    option
                );
            }
        );

    if (
        [
            ...select.options
        ].some(
            option =>
                option.value ===
                current
        )
    ) {

        select.value =
            current;
    }
}


function openCategoryModal(
    category = null
) {

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
        category?.is_active !==
        false;

    showMessage(
        "categoryFormMessage",
        ""
    );

    openModal(
        "categoryModal"
    );
}


async function saveCategory(
    event
) {
    event.preventDefault();
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId) return;
    const client = sessionClient(userId, generation);


    const id =
        $("categoryId")
            .value
            .trim();

    const name =
        $("categoryName")
            .value
            .trim();

    const description =
        $("categoryDescription")
            .value
            .trim();

    const isActive =
        $("categoryActive")
            .checked;

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
        is_active:
            isActive
    };

    try {

        let query;

        if (id) {

            query =
                await client
                    .from(
                        "categories"
                    )
                    .update(
                        payload
                    )
                    .eq(
                        "id",
                        id
                    )
                    .eq(
                        "user_id",
                        userId
                    ).select("id").single();

        } else {

            query =
                await client
                    .from(
                        "categories"
                    )
                    .insert({
                        ...payload,
                        user_id:
                            userId
                    });
        }

        if (query.error) {
            throw query.error;
        }

        closeModal(
            "categoryModal"
        );
        showToast("Categoria salva.");

        await loadCategories();

    } catch (
        error
    ) {

        console.error(
            "Erro ao salvar categoria:",
            error
        );

        showMessage(
            "categoryFormMessage",
            "Não foi possível salvar a categoria. Verifique a conexão e tente novamente."
        );
    }
}


async function deleteCategory(
    id
) {
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId) return;
    const client = sessionClient(userId, generation);


    if (
        !confirm(
            "Excluir esta categoria?"
        )
    ) {
        return;
    }

    const {
        error
    } =
        await client
            .from(
                "categories"
            )
            .delete()
            .eq(
                "id",
                id
            )
            .eq(
                "user_id",
                userId
            ).select("id").single();

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
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId) return;
    const client = sessionClient(userId, generation);


    try {
        const {
            data,
            error
        } =
            await fetchAllRows(() => client
                .from(
                    "colors"
                )
                .select("*")
                .eq(
                    "user_id",
                    userId
                )
                .order("name"));

        if (generation !== sessionGeneration) return;
        if (error) throw error;

        colorsCache =
            data || [];

        renderColors();
        renderProductVariationOptions();
    } catch (error) {
        if (generation !== sessionGeneration) return;
        console.error("Falha em loadColors", error);
        showDataLoadError();
    }
}


function renderColors() {

    const container =
        $("colorsList");

    if (!container) {
        return;
    }

    if (
        !colorsCache.length
    ) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${iconSvg("bag")}</div>
                <strong>Nenhuma cor cadastrada</strong>
                <p>Cadastre cores para utilizar nos produtos.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        colorsCache
            .map(
                color => {

                    const hex =
                        color.hex_code ||
                        "#cccccc";

                    return `

                    <div class="color-card">

                        <div class="color-card-info">

                            <span
                                class="color-card-swatch"
                                style="background:${escapeHtml(
                                    hex
                                )}"
                            ></span>

                            <div class="color-card-text">
                        ${color.is_active === false ? '<small class="status-badge">Inativa</small>' : ''}

                                <strong class="color-card-name">
                                    ${escapeHtml(
                                        color.name
                                    )}
                                </strong>

                                <small class="color-card-code">
                                    ${escapeHtml(
                                        hex
                                    )}
                                </small>

                            </div>

                        </div>

                        <div class="color-card-actions">

                            <button
                                type="button"
                                class="icon-button"
                                data-edit-color="${color.id}"
                                aria-label="Editar cor ${escapeHtml(color.name)}"
                            >
                                ✎
                            </button>

                            <button
                                type="button"
                                class="icon-button danger"
                                data-delete-color="${color.id}"
                                aria-label="Excluir cor ${escapeHtml(color.name)}"
                            >
                                ×
                            </button>

                        </div>

                    </div>
                `;
                }
            )
            .join("");
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


function openColorModal(
    color = null
) {

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
        color?.hex_code ||
        "#E8A0B8";

    $("colorHexText").value =
        color?.hex_code ||
        "#E8A0B8";

    $("colorActive").checked =
        color?.is_active !==
        false;

    syncColorPreview();

    showMessage(
        "colorFormMessage",
        ""
    );

    openModal(
        "colorModal"
    );
}


async function saveColor(
    event
) {
    event.preventDefault();
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId) return;
    const client = sessionClient(userId, generation);


    const id =
        $("colorId")
            .value
            .trim();

    const name =
        $("colorName")
            .value
            .trim();

    const hex =
        $("colorHexText")
            .value
            .trim();

    const isActive =
        $("colorActive")
            .checked;

    if (!name) {

        showMessage(
            "colorFormMessage",
            "Informe o nome da cor."
        );

        return;
    }

    if (
        !/^#[0-9A-Fa-f]{6}$/
            .test(hex)
    ) {

        showMessage(
            "colorFormMessage",
            "Informe uma cor hexadecimal válida, por exemplo #E8A0B8."
        );

        return;
    }

    const payload = {
        name,
        hex_code:
            hex.toUpperCase(),
        is_active:
            isActive
    };

    try {

        let query;

        if (id) {

            query =
                await client
                    .from(
                        "colors"
                    )
                    .update(
                        payload
                    )
                    .eq(
                        "id",
                        id
                    )
                    .eq(
                        "user_id",
                        userId
                    ).select("id").single();

        } else {

            query =
                await client
                    .from(
                        "colors"
                    )
                    .insert({
                        ...payload,
                        user_id:
                            userId
                    });
        }

        if (query.error) {
            throw query.error;
        }

        closeModal(
            "colorModal"
        );
        showToast("Cor salva.");

        await loadColors();

    } catch (
        error
    ) {

        console.error(
            "Erro ao salvar cor:",
            error
        );

        showMessage(
            "colorFormMessage",
            "Não foi possível salvar a cor. Verifique a conexão e tente novamente."
        );
    }
}


async function deleteColor(
    id
) {
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId) return;
    const client = sessionClient(userId, generation);


    if (
        !confirm(
            "Excluir esta cor?"
        )
    ) {
        return;
    }

    const {
        error
    } =
        await client
            .from(
                "colors"
            )
            .delete()
            .eq(
                "id",
                id
            )
            .eq(
                "user_id",
                userId
            ).select("id").single();

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
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId) return;
    const client = sessionClient(userId, generation);


    try {
        const {
            data,
            error
        } =
            await fetchAllRows(() => client
                .from(
                    "sizes"
                )
                .select("*")
                .eq(
                    "user_id",
                    userId
                )
                .order(
                    "display_order"
                )
                .order("name"));

        if (generation !== sessionGeneration) return;
        if (error) throw error;

        sizesCache =
            data || [];

        renderSizes();
        renderProductVariationOptions();
    } catch (error) {
        if (generation !== sessionGeneration) return;
        console.error("Falha em loadSizes", error);
        showDataLoadError();
    }
}


function renderSizes() {

    const container =
        $("sizesList");

    if (!container) {
        return;
    }

    if (
        !sizesCache.length
    ) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${iconSvg("bag")}</div>
                <strong>Nenhum tamanho cadastrado</strong>
                <p>Cadastre tamanhos para utilizar nos produtos.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        sizesCache
            .map(
                size => `

                <div class="size-card">

                    <div class="size-card-info">

                        <span class="size-badge">
                            ${escapeHtml(
                                size.name
                            )}
                        </span>

                        <div>

                            <strong class="size-card-name">
                                Tamanho
                                ${escapeHtml(
                                    size.name
                                )}
                            </strong>

                            ${size.is_active === false ? '<small class="status-badge">Inativo</small>' : ''}
                            <small class="size-card-order">
                                Ordem:
                                ${Number(
                                    size.display_order ||
                                    0
                                )}
                            </small>

                        </div>

                    </div>

                    <div class="size-card-actions">

                        <button
                            type="button"
                            class="icon-button"
                            data-edit-size="${size.id}"
                            aria-label="Editar tamanho ${escapeHtml(size.name)}"
                        >
                            ✎
                        </button>

                        <button
                            type="button"
                            class="icon-button danger"
                            data-delete-size="${size.id}"
                            aria-label="Excluir tamanho ${escapeHtml(size.name)}"
                        >
                            ×
                        </button>

                    </div>

                </div>
            `
            )
            .join("");
}


function openSizeModal(
    size = null
) {

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
        size?.display_order ??
        0;

    $("sizeActive").checked =
        size?.is_active !==
        false;

    showMessage(
        "sizeFormMessage",
        ""
    );

    openModal(
        "sizeModal"
    );
}


async function saveSize(
    event
) {
    event.preventDefault();
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId) return;
    const client = sessionClient(userId, generation);


    const id =
        $("sizeId")
            .value
            .trim();

    const name =
        $("sizeName")
            .value
            .trim();

    const displayOrder =
        Number(
            $("sizeDisplayOrder")
                .value ||
            0
        );

    const isActive =
        $("sizeActive")
            .checked;

    if (!name) {

        showMessage(
            "sizeFormMessage",
            "Informe o tamanho."
        );

        return;
    }

    const payload = {
        name,
        display_order:
            displayOrder,
        is_active:
            isActive
    };

    try {

        let query;

        if (id) {

            query =
                await client
                    .from(
                        "sizes"
                    )
                    .update(
                        payload
                    )
                    .eq(
                        "id",
                        id
                    )
                    .eq(
                        "user_id",
                        userId
                    ).select("id").single();

        } else {

            query =
                await client
                    .from(
                        "sizes"
                    )
                    .insert({
                        ...payload,
                        user_id:
                            userId
                    });
        }

        if (query.error) {
            throw query.error;
        }

        closeModal(
            "sizeModal"
        );
        showToast("Tamanho salvo.");

        await loadSizes();

    } catch (
        error
    ) {

        console.error(
            "Erro ao salvar tamanho:",
            error
        );

        showMessage(
            "sizeFormMessage",
            "Não foi possível salvar o tamanho. Verifique a conexão e tente novamente."
        );
    }
}


async function deleteSize(
    id
) {
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId) return;
    const client = sessionClient(userId, generation);


    if (
        !confirm(
            "Excluir este tamanho?"
        )
    ) {
        return;
    }

    const {
        error
    } =
        await client
            .from(
                "sizes"
            )
            .delete()
            .eq(
                "id",
                id
            )
            .eq(
                "user_id",
                userId
            ).select("id").single();

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
// CORES E TAMANHOS
// =========================================================

function colorSwatch(colorId) {
    const hex = colorsCache.find(c => c.id === colorId)?.hex_code || "#cccccc";
    return `<span class="pc-swatch" aria-hidden="true" style="background:${/^#[a-f0-9]{6}$/i.test(hex) ? hex : "#cccccc"}"></span>`;
}
function colorDraftName(key) {
    if (!key) return "Fotos gerais";
    const group = productColorsDraft.find(c => c.key === key);
    return colorsCache.find(c => c.id === group?.color_id)?.name || "Sem cor";
}
function renderProductVariationOptions() { renderProductColorEditor(); }
function renderProductVariationsList() { renderProductColorEditor(); }
function renderProductColorEditor() {
    if (!$("productColorChoices")) return;
    normalizePhotoPrincipals();
    $("productColorChoices").innerHTML = [...colorsCache.filter(c => c.is_active !== false), { id: null, name: "Sem cor" }].filter(c => !productColorsDraft.some(g => g.color_id === c.id)).map(c => `<button type="button" data-pc-add="${c.id || "none"}">+ ${colorSwatch(c.id)} ${escapeHtml(c.name)}</button>`).join("");
    $("productColorTabs").innerHTML = productColorsDraft.map(c => {
        const rows = productVariationsDraft.filter(v => v.groupKey === c.key);
        const total = rows.reduce((n,v) => n + Number(v.quantity),0);
        return `<button type="button" data-pc-select="${c.key}" aria-pressed="${selectedProductColor === c.key}">${colorSwatch(c.color_id)}${escapeHtml(colorDraftName(c.key))}${c.is_active ? "" : " · Inativa"}<small>${rows.filter(v => v.is_active).length} tamanhos · ${total} un. · ${productPhotosDraft.filter(p => p.groupKey === c.key).length} fotos</small></button>`;
    }).join("") + `<button type="button" data-pc-select="" aria-pressed="${selectedProductColor === null}">Fotos gerais</button>`;
    $("productColorTitle").textContent = colorDraftName(selectedProductColor);
    const group = productColorsDraft.find(c => c.key === selectedProductColor);
    $("productColorSettings").hidden = !group;
    $("productColorActive").checked = group?.is_active !== false;
    $("productColorStock").textContent = `Estoque total do produto: ${productVariationsDraft.reduce((n,v) => n + Number(v.quantity), 0)} unidades`;
    $("productVariantsList").innerHTML = group ? sizesCache.filter(z => z.is_active !== false || productVariationsDraft.some(v => v.groupKey === group.key && v.sizeId === z.id)).map(size => {
        const v = productVariationsDraft.find(v => v.groupKey === group.key && v.sizeId === size.id);
        return `<div class="pc-size"><label><input type="checkbox" data-pc-size="${size.id}" ${v?.is_active ? "checked" : ""}/> ${escapeHtml(size.name)}</label><label>Quantidade<input type="number" inputmode="numeric" min="0" max="2147483647" step="1" data-pc-quantity="${size.id}" value="${v?.quantity || 0}" ${v?.is_active ? "" : "disabled"}/></label>${v && !v.is_active ? '<small>Indisponível · estoque preservado</small>' : ""}</div>`;
    }).join("") : "";
    renderProductPhotoPreview();
}
function openProductDetails(productId, colorId = undefined) {
    const product = productsCache.find(p => p.id === productId); if (!product) return;
    const groups = productColorsCache.filter(c => c.product_id === productId);
    if (colorId === undefined) colorId = groups.find(c => c.is_active)?.id || groups[0]?.id || null;
    const images = (productImagesCache[productId] || []).filter(p => p.product_color_id === colorId).sort((a,b) => Number(b.is_color_primary)-Number(a.is_color_primary) || a.display_order-b.display_order);
    const group = groups.find(c => c.id === colorId);
    const stock = variantsCache.filter(v => v.product_id === productId && v.product_color_id === colorId);
    $("productDetailsTitle").textContent = product.name;
    $("productDetailsContent").innerHTML = `<p>${formatCurrency(product.sale_price)} · Estoque total: ${getProductTotalStock(productId)}</p>
        <div class="filter-chips pc-tabs">${groups.map(c => `<button type="button" data-view-product="${productId}" data-view-color="${c.id}" aria-pressed="${c.id === colorId}">${escapeHtml(c.colors?.name || "Sem cor")}${c.is_active ? "" : " · Inativa"}</button>`).join("")}<button type="button" data-view-product="${productId}" data-view-color="" aria-pressed="${colorId === null}">Fotos gerais</button></div>
        <h3>${escapeHtml(group?.colors?.name || (group ? "Sem cor" : "Fotos gerais"))}</h3>
        <div class="pc-gallery">${images.map(p => `<img src="${escapeHtml(p.public_url)}" alt="${escapeHtml(group?.colors?.name || "Foto geral")}${p.is_color_primary ? " · Principal" : ""}"/>`).join("") || '<p>Sem fotos neste grupo.</p>'}</div>
        ${stock.map(v => `<p>${escapeHtml(v.sizes?.name || "Tamanho")} · ${v.stock_quantity} unidades${v.is_active ? "" : " · Indisponível"}</p>`).join("") || (group ? '<p>Nenhum tamanho cadastrado.</p>' : "")}`;
    if ($("productDetailsModal").hidden) openModal("productDetailsModal");
}
function bindProductColorEvents() {
    $("productForm").addEventListener("click", event => {
        const b = event.target.closest("button"); if (!b || productSaving) return;
        if (b.hasAttribute("data-pc-add")) {
            const color_id = b.dataset.pcAdd === "none" ? null : b.dataset.pcAdd;
            const group = { key: crypto.randomUUID(), color_id, is_active: true };
            productColorsDraft.push(group); selectedProductColor = group.key;
        } else if (b.hasAttribute("data-pc-select")) selectedProductColor = b.dataset.pcSelect || null;
        else if (b.dataset.pcOrder) {
            const i = productColorsDraft.findIndex(c => c.key === selectedProductColor), j = i + Number(b.dataset.pcOrder);
            if (i >= 0 && j >= 0 && j < productColorsDraft.length) [productColorsDraft[i],productColorsDraft[j]] = [productColorsDraft[j],productColorsDraft[i]];
        } else if (b.dataset.pcPhoto) {
            const p = productPhotosDraft.find(p => p.key === b.dataset.key); if (!p) return;
            if (b.dataset.pcPhoto === "cover") productPhotosDraft.forEach(x => x.is_primary = x === p);
            if (b.dataset.pcPhoto === "primary") productPhotosDraft.filter(x => x.groupKey === p.groupKey).forEach(x => x.is_color_primary = x === p);
            if (b.dataset.pcPhoto === "remove") {
                if (p.id) removedProductImageIds.push(p.id);
                productPhotosDraft = productPhotosDraft.filter(x => x !== p);
            }
            if (["up","down"].includes(b.dataset.pcPhoto)) {
                const group = productPhotosDraft.filter(x => x.groupKey === p.groupKey);
                const other = group[group.indexOf(p) + (b.dataset.pcPhoto === "up" ? -1 : 1)];
                if (other) { const i = productPhotosDraft.indexOf(p), j = productPhotosDraft.indexOf(other); [productPhotosDraft[i],productPhotosDraft[j]] = [other,p]; }
            }
        } else return;
        renderProductColorEditor();
    });
    $("productForm").addEventListener("change", event => {
        const el = event.target;
        if (el.id === "productColorActive") productColorsDraft.find(c => c.key === selectedProductColor).is_active = el.checked;
        else if (el.dataset.pcSize) {
            let v = productVariationsDraft.find(v => v.groupKey === selectedProductColor && v.sizeId === el.dataset.pcSize);
            if (v) v.is_active = el.checked;
            else productVariationsDraft.push({ groupKey: selectedProductColor, sizeId: el.dataset.pcSize, quantity: 0, is_active: true });
        } else if (el.dataset.pcQuantity) {
            const n = Number(el.value);
            if (!Number.isInteger(n) || n < 0 || n > 2147483647) { el.reportValidity(); return; }
            productVariationsDraft.find(v => v.groupKey === selectedProductColor && v.sizeId === el.dataset.pcQuantity).quantity = n;
            $("productColorStock").textContent = `Estoque total do produto: ${productVariationsDraft.reduce((sum,v) => sum + Number(v.quantity),0)} unidades`;
            const rows = productVariationsDraft.filter(v => v.groupKey === selectedProductColor);
            const label = document.querySelector(`[data-pc-select="${CSS.escape(selectedProductColor)}"] small`);
            if (label) label.textContent = `${rows.filter(v => v.is_active).length} tamanhos · ${rows.reduce((sum,v) => sum + Number(v.quantity),0)} un. · ${productPhotosDraft.filter(p => p.groupKey === selectedProductColor).length} fotos`;
            return;
        } else if (el.dataset.pcPhotoGroup) {
            const p = productPhotosDraft.find(p => p.key === el.dataset.pcPhotoGroup);
            p.groupKey = el.value || null; p.is_color_primary = false;
        } else return;
        renderProductColorEditor();
        if (el.dataset.pcSize) document.querySelector(`[data-pc-size="${CSS.escape(el.dataset.pcSize)}"]`)?.focus({preventScroll:true});
    });
}

// =========================================================
// PRODUTOS
// =========================================================

async function loadProducts() {
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId) return;
    const client = sessionClient(userId, generation);


    try {
        const {
            data,
            error
        } =
            await fetchAllRows(() => client
                .from(
                    "products"
                )
                .select(`
                    *,
                    categories (
                        id,
                        name
                    )
                `)
                .eq(
                    "user_id",
                    userId
                )
                .order("name"));

        if (generation !== sessionGeneration) return;
        if (error) throw error;

        productsCache =
            data || [];

        await loadProductImages(
            productsCache.map(
                product =>
                    product.id
            )
        );

        renderProducts();
    } catch (error) {
        if (generation !== sessionGeneration) return;
        console.error("Falha em loadProducts", error);
        showDataLoadError();
    }
}


function renderProductCard(
    product
) {

    const colors =
        getProductColorNames(
            product.id
        );

    const sizes =
        getProductSizeNames(
            product.id
        );

    const totalStock =
        getProductTotalStock(
            product.id
        );

    const minimum =
        Number(
            product.minimum_stock ||
            0
        );

    const status =
        getStockStatus(
            totalStock,
            minimum
        );

    const inactive = product.is_active === false;
    return `
        <article class="product-card">
            <div class="product-card-image-wrapper">
                ${productImageHtml(product.id, "product-card-image")}
            </div>
            <div class="product-card-info">
                <strong class="product-card-name">${escapeHtml(product.name)}</strong>
                <span class="product-card-sku">SKU: ${escapeHtml(product.sku || "Sem SKU")}</span>
                <small class="product-card-category">${escapeHtml(product.categories?.name || "Sem categoria")}</small>
                <div class="product-card-price">${formatCurrency(product.sale_price)}</div>
                <div class="product-card-stock">
                    <span>Estoque: <strong>${totalStock}</strong></span>
                    <span class="product-stock-status ${inactive ? "inactive" : status.className}">${inactive ? "Inativo" : status.label}</span>
                </div>
                <div class="product-card-details" title="${escapeHtml(colors.join(", "))}">
                    ${colors.length} ${colors.length === 1 ? "cor" : "cores"} · ${escapeHtml(sizes.join(", ") || "Sem tamanhos")}
                </div>
                <button type="button" class="text-button" data-view-product="${product.id}">Ver cores e fotos</button>
                <div class="product-card-actions">
                    <button type="button" class="product-card-edit-button" data-edit-product-button="${product.id}">Editar</button>
                    <button type="button" class="product-card-sell-button" data-quick-sell-product="${product.id}" ${inactive || !getProductVariants(product.id).some(v => v.stock_quantity > 0) ? "disabled" : ""}>Vender</button>
                    <details class="product-more"><summary aria-label="Mais ações de ${escapeHtml(product.name)}">Mais</summary><div>
                    <button type="button" class="product-card-toggle-button" data-toggle-product="${product.id}">${inactive ? "Ativar" : "Desativar"}</button>
                    <button type="button" class="product-card-delete-button" data-delete-product="${product.id}">Excluir</button>
                    </div></details>
                </div>
            </div>
        </article>
    `;
}


function renderProducts() {

    filterProducts({ target: $("productSearch") });
}


function resetProductForm() {
    productColorsDraft = []; selectedProductColor = null; productEditRevision = null; productSaveUncertain = false; removedProductImageIds = [];
    setProductPanel("details");
    $("productForm").querySelectorAll("details").forEach(element => { element.open = false; });

    const form =
        $("productForm");

    if (!form) {
        return;
    }

    clearProductPhotosDraft();

    form.reset();

    $("productId").value =
        "";

    $("productMinimumStock").value =
        "0";

    $("productActive").checked =
        true;

    productVariationsDraft =
        [];

    editingProductId =
        null;


    const title =
        document.querySelector(
            "#productModal [data-modal-title]"
        );

    if (title) {

        title.textContent =
            "Novo produto";
    }

    const existingPhotos =
        $("productExistingPhotos");

    if (existingPhotos) {
        existingPhotos.innerHTML =
            "";
    }

    showMessage(
        "productFormMessage",
        ""
    );

    renderProductVariationOptions();
    renderProductVariationsList();
    populateCategorySelect();
}


async function loadProductForEdit(product) {
    const userId = currentUser?.id, generation = sessionGeneration;
    const client = sessionClient(userId, generation);
    resetProductForm();
    const results = await Promise.all([
        client.from("products").select("*").eq("user_id",userId).eq("id",product.id).single(),
        fetchAllRows(() => client.from("product_colors").select("*").eq("user_id",userId).eq("product_id",product.id)),
        fetchAllRows(() => client.from("product_variants").select("*").eq("user_id",userId).eq("product_id",product.id)),
        fetchAllRows(() => client.from("product_images").select("*").eq("user_id",userId).eq("product_id",product.id))
    ]);
    if (generation !== sessionGeneration) return;
    for (const r of results) if (r.error) throw r.error;
    product = results[0].data;
    editingProductId = product.id; productEditRevision = product.edit_revision;
    populateCategorySelect(product.category_id);
    for (const [field,key] of Object.entries({productId:"id",productName:"name",productSku:"sku",productCategory:"category_id",productDescription:"description",productCostPrice:"cost_price",productSalePrice:"sale_price",productMinimumStock:"minimum_stock"})) $(field).value = product[key] ?? "";
    $("productActive").checked = product.is_active !== false;
    productColorsDraft = results[1].data.sort((a,b) => a.display_order-b.display_order || a.id.localeCompare(b.id)).map(c => ({...c,key:c.id}));
    productVariationsDraft = results[2].data.map(v => ({ variantId:v.id, groupKey:v.product_color_id, sizeId:v.size_id, quantity:Number(v.stock_quantity), expectedQuantity:Number(v.stock_quantity), minimum_stock:v.minimum_stock, is_active:v.is_active }));
    productPhotosDraft = results[3].data.sort((a,b) => a.display_order-b.display_order || a.id.localeCompare(b.id)).map(p => ({...p,key:p.id,groupKey:p.product_color_id}));
    selectedProductColor = productColorsDraft[0]?.key || null;
    $("productModalTitle").textContent = "Editar produto";
    renderProductColorEditor(); openModal("productModal");
}

function openProductModal(
    product = null
) {

    /*
     * IMPORTANTE:
     * sem produto = novo produto.
     * com produto = edição.
     *
     * Nenhuma outra rotina chama esta função
     * durante a inicialização.
     */

    if (product) {

        loadProductForEdit(
            product
        ).catch(
            error => {

                console.error(
                    "Erro ao abrir produto para edição:",
                    error
                );

                alert(
                    "Não foi possível carregar os dados do produto."
                );
            }
        );

        return;
    }

    const pendingKey = `mabijufit-pending-product:${currentUser?.id}`;
    if (localStorage.getItem(pendingKey)) {
        showToast("Um cadastro anterior ficou sem confirmação. Atualize a lista e confira se o produto já existe antes de cadastrar novamente.");
        if (!confirm("Você já atualizou a lista e confirmou que o cadastro anterior não existe? Só confirme após conferir para evitar duplicação.")) return;
        localStorage.removeItem(pendingKey);
    }
    resetProductForm();

    openModal(
        "productModal"
    );
}


async function saveProduct(event) {
    event.preventDefault();
    if (productSaving || !currentUser) return;
    if (productSaveUncertain) { showMessage("productFormMessage", "A última gravação ficou sem confirmação. Reabra o produto na lista antes de tentar novamente; não duplique o cadastro."); return; }
    const userId = currentUser.id, generation = sessionGeneration, client = sessionClient(userId,generation);
    const button = event.submitter || $("productForm").querySelector('[type="submit"]');
    productSaving = true; $("productForm").inert = true; setLoading(button,true,"Salvando…");
    let rpcPending = false;
    let filesCleaned = true;
    try {
        const data = { name:$("productName").value.trim(), sku:$("productSku").value.trim() || null,
            category_id:$("productCategory").value || null, description:$("productDescription").value.trim() || null,
            cost_price:Number($("productCostPrice").value || 0), sale_price:Number($("productSalePrice").value || 0),
            minimum_stock:Number($("productMinimumStock").value || 0), is_active:$("productActive").checked };
        if (!data.name || ![data.cost_price,data.sale_price].every(n => Number.isFinite(n) && n >= 0) || !Number.isInteger(data.minimum_stock) || data.minimum_stock < 0 || productVariationsDraft.some(v => !Number.isInteger(v.quantity) || v.quantity < 0)) throw new Error("Confira o nome, os preços e as quantidades do produto.");
        const colors = productColorsDraft.map((c,i) => ({...(c.id ? {id:c.id}:{}), key:c.key,color_id:c.color_id,is_active:c.is_active,display_order:i}));
        const variants = productVariationsDraft.filter(v => v.variantId || v.is_active).map(v => ({
            ...(v.variantId ? {id:v.variantId,expected_stock_quantity:v.expectedQuantity}:{}),color_key:v.groupKey,size_id:v.sizeId,
            stock_quantity:v.quantity,minimum_stock:data.minimum_stock,is_active:v.is_active }));
        if (!editingProductId) localStorage.setItem(`mabijufit-pending-product:${userId}`, JSON.stringify({name:data.name,at:new Date().toISOString()}));
        rpcPending = true;
        const result = await productRpc(client,{p_product_id:editingProductId,p_expected_revision:productEditRevision,p_product:data,p_colors:colors,p_variants:variants});
        rpcPending = false;
        localStorage.removeItem(`mabijufit-pending-product:${userId}`);
        editingProductId = result.product.id; productEditRevision = result.product.edit_revision; $("productId").value = editingProductId;
        for (const c of productColorsDraft) c.id = result.color_keys[c.key];
        for (const v of productVariationsDraft) {
            const group = productColorsDraft.find(c => c.key === v.groupKey);
            const row = result.variants.find(x => x.product_color_id === group.id && x.size_id === v.sizeId);
            if (row) { v.variantId = row.id; v.expectedQuantity = Number(row.stock_quantity); }
        }
        await uploadProductImages(client,userId,generation,editingProductId);
        const images = productPhotosDraft.map((p,i) => ({...(p.id ? {id:p.id}:{storage_path:p.storage_path,public_url:p.public_url}),
            product_color_id:productColorsDraft.find(c => c.key === p.groupKey)?.id || null,display_order:i,is_primary:!!p.is_primary,is_color_primary:!!p.is_color_primary }));
        if (images.length || removedProductImageIds.length) {
            rpcPending = true;
            const saved = await productRpc(client,{p_product_id:editingProductId,p_expected_revision:productEditRevision,p_product:{},p_images:images,p_remove_image_ids:removedProductImageIds});
            rpcPending = false; productEditRevision = saved.product.edit_revision;
            for (const photo of productPhotosDraft) photo.id = saved.images.find(p => p.storage_path === photo.storage_path)?.id;
            removedProductImageIds = [];
            filesCleaned = await removeConfirmedProductFiles(client,saved.removed_storage_paths,userId);
        }
        if (generation !== sessionGeneration) return;
        productSaving = false; closeModal("productModal"); resetProductForm();
        await Promise.all([loadProducts(),loadVariants()]); await loadStock(); await loadDashboard(); showToast(filesCleaned ? "Produto salvo." : "Produto salvo. Alguns arquivos aguardam limpeza no Storage; tentaremos novamente ao salvar fotos.");
    } catch(error) {
        if (generation !== sessionGeneration) return;
        if (rpcPending && !isConfirmedRpcRejection(error)) productSaveUncertain = true;
        if (isConfirmedRpcRejection(error)) localStorage.removeItem(`mabijufit-pending-product:${userId}`);
        showMessage("productFormMessage", productOperationError(error) + (editingProductId ? " Dados já confirmados foram preservados." : ""));
    } finally {
        if (generation === sessionGeneration) { productSaving = false; $("productForm").inert = false; setLoading(button,false); }
    }
}

// =========================================================
// VENDA RÁPIDA A PARTIR DO PRODUTO
// =========================================================

async function openQuickSale(
    productId
) {

    const product =
        productsCache.find(
            item =>
                item.id ===
                productId
        );

    if (!product) {

        alert(
            "Produto não encontrado."
        );

        return;
    }

    await openNewSaleModal({
        productId
    });
}


// =========================================================
// EXCLUSÃO DE PRODUTO
// =========================================================

async function toggleProductActive(productId) {
    const product = productsCache.find(p => p.id === productId); if (!product || !currentUser) return;
    try {
        await productRpc(sessionClient(currentUser.id,sessionGeneration),{p_product_id:product.id,p_expected_revision:product.edit_revision,p_product:{is_active:!product.is_active}});
        await loadProducts(); await loadVariants(); await loadDashboard();
    } catch(error) { showToast(productOperationError(error)); }
}
async function deleteProduct(productId) {
    const product = productsCache.find(p => p.id === productId);
    if (!product || !currentUser || !confirm(`Excluir ${product.name}? Produtos com estoque ou histórico devem ser desativados.`)) return;
    const userId=currentUser.id, generation=sessionGeneration, client=sessionClient(userId,generation);
    try {
        const {data,error} = await client.rpc("pc_delete_product",{p_product_id:productId,p_expected_revision:product.edit_revision});
        if (error) throw error;
        if (data?.product_id !== productId) throw new Error("Exclusão não confirmada. Atualize a lista antes de tentar novamente.");
        const filesCleaned = await removeConfirmedProductFiles(client,data.removed_storage_paths,userId);
        await loadProducts(); await loadVariants(); await loadDashboard(); showToast(filesCleaned ? "Produto excluído." : "Produto excluído. Alguns arquivos aguardam limpeza no Storage.");
    } catch(error) { if (generation === sessionGeneration) showToast(productOperationError(error)); }
}

// =========================================================
// ESTOQUE
// =========================================================

async function loadVariants(includeImages = true) {
    const userId=currentUser?.id, generation=sessionGeneration; if (!userId) return;
    const client=sessionClient(userId,generation);
    try {
        const [groups,variants] = await Promise.all([
            fetchAllRows(() => client.from("product_colors").select("*,colors(id,name,hex_code)").eq("user_id",userId)),
            fetchAllRows(() => client.from("product_variants").select("*,products(id,name,sale_price,cost_price,minimum_stock,is_active),sizes(id,name)").eq("user_id",userId))
        ]);
        if (generation !== sessionGeneration) return;
        if (groups.error || variants.error) throw groups.error || variants.error;
        productColorsCache=groups.data.sort((a,b) => a.display_order-b.display_order || a.id.localeCompare(b.id));
        variantsCache=variants.data.map(v => ({...v,colors:productColorsCache.find(c => c.id === v.product_color_id)?.colors}));
        if (includeImages) await loadProductImages([...new Set([...productsCache.map(p=>p.id),...variantsCache.map(v=>v.product_id)])]);
        renderProducts();
    } catch(error) { if (generation === sessionGeneration) { console.error(error); showDataLoadError(); } }
}
function getOperationalVariants() {
    return variantsCache.filter(v => v.is_active !== false && productColorsCache.find(c => c.id === v.product_color_id)?.is_active === true && (productsCache.find(p => p.id === v.product_id) || v.products)?.is_active !== false);
}

async function loadStock() {

    await loadVariants();

    const activeVariants =
        getOperationalVariants();

    const total =
        activeVariants.reduce(
            (
                sum,
                variant
            ) =>
                sum +
                Number(
                    variant.stock_quantity ||
                    0
                ),
            0
        );

    const low =
        activeVariants.filter(
            variant => {

                const stock =
                    Number(
                        variant.stock_quantity ||
                        0
                    );

                const minimum =
                    Number(
                        variant.minimum_stock ??
                        variant.products
                            ?.minimum_stock ??
                        0
                    );

                return (
                    stock > 0 &&
                    minimum > 0 &&
                    stock <= minimum
                );
            }
        ).length;

    const zero =
        activeVariants.filter(
            variant =>
                Number(
                    variant.stock_quantity ||
                    0
                ) === 0
        ).length;

    if (
        $("stockTotal")
    ) {

        $("stockTotal")
            .textContent =
            total;
    }

    if (
        $("stockLow")
    ) {

        $("stockLow")
            .textContent =
            low;
    }

    if (
        $("stockZero")
    ) {

        $("stockZero")
            .textContent =
            zero;
    }

    renderStock();
}


function renderStockCard(
    variant
) {

    const productId =
        variant.products?.id;

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
            variant.stock_quantity ||
            0
        );

    const minimum =
        Number(
            variant.minimum_stock ??
            variant.products
                ?.minimum_stock ??
            0
        );

    const status =
        getStockStatus(
            stock,
            minimum
        );

    return `

        <div class="stock-card">

            <div class="stock-card-image-wrapper">

                ${productImageHtml(
                    productId,
                    "stock-card-image",
                    variant.product_color_id
                )}

            </div>

            <div class="stock-card-info">

                <strong>
                    ${escapeHtml(
                        productName
                    )}
                </strong>

                <span>
                    ${escapeHtml(
                        colorName
                    )}
                    /
                    ${escapeHtml(
                        sizeName
                    )}
                </span>

                <small>
                    Mínimo:
                    ${minimum}
                </small>

                <span class="status-text ${status.className}">${escapeHtml(status.label)}</span>
                <button type="button" class="text-button" data-adjust-stock="${escapeHtml(productId)}">Ajustar estoque</button>

            </div>

            <div
                class="stock-card-quantity ${status.className}"
            >

                <strong>
                    ${stock}
                </strong>

                <small>
                    ${stock === 1 ? "unidade" : "unidades"}
                </small>

            </div>

        </div>
    `;
}


function renderStock() {
    filterStock({ target: $("stockSearch") });
}


// =========================================================
// VENDAS — INTERFACE
// =========================================================

function resetSaleDraft() {
    setSaleStage("items");

    saleDraft = [];

    saleProductPickerOpen =
        false;

    saleVariantSelectionProductId =
        null;


    const discount =
        $("saleDiscountInput");

    if (discount) {
        discount.value =
            "0";
    }

    const payment =
        $("salePaymentMethod");

    if (payment) {
        payment.value =
            "";
    }

    const notes =
        $("saleNotesInput");

    if (notes) {
        notes.value =
            "";
    }

    showMessage(
        "saleFormMessage",
        ""
    );

    closeSaleProductPicker();

    renderSaleItems();
    renderSaleSummary();
}


async function openNewSaleModal(
    options = {}
) {
    if (!currentUser) return;
    const generation = sessionGeneration;


    resetSaleDraft();

    await Promise.all([
        loadProducts(),
        loadVariants(false)
    ]);

    if (generation !== sessionGeneration) return;

    if (
        options.productId
    ) {

        const product =
            productsCache.find(
                item =>
                    item.id ===
                    options.productId
            );

        if (
            product &&
            product.is_active !==
                false
        ) {

            saleProductPickerOpen =
                true;

            const picker =
                $("saleProductPicker");

            if (picker) {
                picker.hidden =
                    false;
            }

            const search =
                $("saleProductSearchInput");

            if (search) {
                search.value =
                    "";
            }

            renderSaleProductPicker();

            saleVariantSelectionProductId =
                product.id;

            const list =
                $("saleProductPickerList");

            if (list) {
                list.hidden =
                    true;
            }

            renderSaleVariantPicker(
                product.id
            );
        }
    }

    $("salePendingRetry").hidden = !localStorage.getItem(`mabijufit-pending-sale:${currentUser?.id}`);
    openModal(
        "saleModal"
    );
}


function toggleSaleProductPicker() {

    saleProductPickerOpen =
        !saleProductPickerOpen;

    saleVariantSelectionProductId =
        null;

    const picker =
        $("saleProductPicker");

    if (picker) {

        picker.hidden =
            !saleProductPickerOpen;
        $("saleAddProductButton").setAttribute("aria-expanded", String(saleProductPickerOpen));
    }

    if (
        saleProductPickerOpen
    ) {

        const search =
            $("saleProductSearchInput");

        if (search) {

            search.value =
                "";
        }

        const variantPicker =
            $("saleVariantPicker");

        if (variantPicker) {
            variantPicker.hidden =
                true;
        }

        const list =
            $("saleProductPickerList");

        if (list) {
            list.hidden =
                false;
        }

        renderSaleProductPicker();
    }
    syncSalePickerView();

}


function closeSaleProductPicker() {

    $("saleAddProductButton").setAttribute("aria-expanded", "false");
    saleProductPickerOpen =
        false;

    saleVariantSelectionProductId =
        null;

    const picker =
        $("saleProductPicker");

    if (picker) {
        picker.hidden =
            true;
    }

    const variantPicker =
        $("saleVariantPicker");

    if (variantPicker) {
        variantPicker.hidden =
            true;
    }

    const list =
        $("saleProductPickerList");

    if (list) {
        list.hidden =
            false;
    }
    syncSalePickerView();
    if (!$("saleModal").hidden) $("saleAddProductButton").focus({ preventScroll: true });

}


function renderSaleProductPicker() {

    const container =
        $("saleProductPickerList");

    if (!container) {
        return;
    }

    const search =
        (
            $("saleProductSearchInput")
                ?.value ||
            ""
        )
            .toLowerCase()
            .trim();

    const productsWithStock =
        productsCache.filter(
            product => {

                if (
                    product.is_active ===
                    false
                ) {
                    return false;
                }

                const variants =
                    getProductVariants(
                        product.id
                    );

                const available =
                    variants.some(
                        variant =>
                            variant.is_active !==
                                false &&
                            Number(
                                variant.stock_quantity ||
                                0
                            ) > 0
                    );

                const text =
                    [
                        product.name,
                        product.sku
                    ]
                        .filter(
                            Boolean
                        )
                        .join(" ")
                        .toLowerCase();

                return (
                    available &&
                    text.includes(
                        search
                    )
                );
            }
        );

    if (
        !productsWithStock.length
    ) {

        container.innerHTML = `
            <div class="empty-state">
                <strong>Nenhum produto disponível</strong>
                <p>Não existem produtos com estoque para adicionar.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        productsWithStock
            .map(
                product => {

                    const variants =
                        getProductVariants(
                            product.id
                        ).filter(
                            variant =>
                                variant.is_active !==
                                    false &&
                                Number(
                                    variant.stock_quantity ||
                                    0
                                ) > 0
                        );

                    const totalStock =
                        variants.reduce(
                            (
                                sum,
                                variant
                            ) =>
                                sum +
                                Number(
                                    variant.stock_quantity ||
                                    0
                                ),
                            0
                        );

                    return `

                    <button
                        type="button"
                        class="sale-product-picker-item"
                        data-sale-select-product="${product.id}"
                    >

                        ${productImageHtml(
                            product.id,
                            "sale-product-picker-image"
                        )}

                        <span>

                            <strong>
                                ${escapeHtml(
                                    product.name
                                )}
                            </strong>

                            <small>
                                ${escapeHtml(
                                    product.sku ||
                                    "Sem SKU"
                                )}
                            </small>

                            <small>
                                Estoque:
                                ${totalStock}
                            </small>

                        </span>

                        <strong>
                            ${formatCurrency(
                                product.sale_price
                            )}
                        </strong>

                    </button>
                `;
                }
            )
            .join("");
}


function renderSaleVariantPicker(productId) {
    const container = $("saleVariantPicker");
    const product = productsCache.find(item => item.id === productId);
    if (!product) return;
    saleVariantSelectionProductId = productId;
    saleProductPickerOpen = true;
    $("saleProductPicker").hidden = false;
    $("saleProductPickerList").hidden = true;
    container.hidden = false;
    const groups = new Map();
    getProductVariants(productId).forEach(variant => {
        const group = variant.product_color_id;
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(variant);
    });
    container.innerHTML = `<div class="variant-product-heading"><strong>${escapeHtml(product.name)}</strong><button type="button" class="text-button" data-sale-back-picker>‹ Produtos</button></div>
        <p class="field-hint">${formatCurrency(product.sale_price)} · Toque no tamanho para adicionar.</p>
        <div class="variant-color-groups">${[...groups].sort(([a],[b]) => productColorsCache.findIndex(c=>c.id===a)-productColorsCache.findIndex(c=>c.id===b)).map(([group, variants]) => `<section class="variant-color-group"><h3>${productImageHtml(productId,"pc-picker-image",group)} ${escapeHtml(variants[0].colors?.name || "Sem cor")}</h3><div class="variant-size-options">${variants.map(variant => {
            const stock = Number(variant.stock_quantity || 0);
            const reserved = saleDraft.find(item => item.variantId === variant.id)?.quantity || 0;
            const available = Math.max(0, stock - reserved);
            return `<button type="button" class="sale-variant-picker-item" data-sale-select-variant="${variant.id}" ${available <= 0 ? "disabled" : ""}><strong>${escapeHtml(variant.sizes?.name || "Único")}</strong><span>${available > 0 ? `${available} disponíveis` : "Indisponível"}</span></button>`;
        }).join("")}</div></section>`).join("") || emptyState("Sem tamanhos disponíveis", "Cadastre cores e tamanhos no produto.")}</div>`;
    syncSalePickerView();
}


function addSaleVariant(
    variantId
) {

    const variant =
        variantsCache.find(
            item =>
                item.id ===
                variantId
        );

    if (!variant || !getOperationalVariants().some(v => v.id === variant.id)) {
        return;
    }

    const product =
        productsCache.find(
            item =>
                item.id ===
                variant.product_id
        );

    if (!product || product.is_active === false) {
        return;
    }

    const stock =
        Number(
            variant.stock_quantity ||
            0
        );

    if (
        stock <= 0
    ) {

        showMessage(
            "saleFormMessage",
            "Este tamanho está sem estoque."
        );

        return;
    }

    const existing =
        saleDraft.find(
            item =>
                item.variantId ===
                variantId
        );

    if (existing) {

        if (
            existing.quantity + 1 >
            stock
        ) {

            showMessage(
                "saleFormMessage",
                "A quantidade solicitada ultrapassa o estoque disponível."
            );

            return;
        }

        existing.quantity +=
            1;

    } else {

        saleDraft.push({

            variantId:
                variant.id,

            productId:
                product.id,

            productName:
                product.name,

            productImage:
                getProductColorImage(product.id, variant.product_color_id),

            variantDescription:
                `${variant.colors?.name || "Sem cor"} / ${variant.sizes?.name || "Sem tamanho"}`,

            colorName:
                variant.colors?.name ||
                "Sem cor",

            sizeName:
                variant.sizes?.name ||
                "Sem tamanho",

            quantity:
                1,

            stock,

            unitPrice:
                Number(
                    product.sale_price ||
                    0
                ),

            unitCost:
                Number(
                    product.cost_price ||
                    0
                )
        });
    }

    closeSaleProductPicker();

    renderSaleItems();
    renderSaleSummary();

    showMessage(
        "saleFormMessage",
        "Produto adicionado à venda.",
        "success"
    );
}


function renderSaleItems() {

    const container =
        $("saleItemsList");

    if (!container) {
        return;
    }

    if (
        !saleDraft.length
    ) {

        container.innerHTML = `
            <div class="empty-state compact">
                <strong>Nenhum produto adicionado</strong>
                <p>Use "+ Adicionar produto" para começar.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        saleDraft
            .map(
                (
                    item,
                    index
                ) => {

                    const subtotal =
                        item.quantity *
                        item.unitPrice;

                    return `

                    <div class="sale-draft-item">

                        ${
                            item.productImage
                                ? `
                                <img
                                    src="${escapeHtml(
                                        item.productImage
                                    )}"
                                    alt="Produto"
                                    loading="lazy"
                                >
                                `
                                : `
                                <div>
                                    ${iconSvg("camera")}
                                </div>
                                `
                        }

                        <div>

                            <strong>
                                ${escapeHtml(
                                    item.productName
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    item.variantDescription
                                )}
                            </span>

                            <small>
                                ${formatCurrency(
                                    item.unitPrice
                                )}
                                cada
                            </small>

                        </div>

                        <div>

                            <button
                                type="button"
                                aria-label="Diminuir quantidade de ${escapeHtml(item.productName)}"
                                data-sale-decrease="${index}"
                            >
                                −
                            </button>

                            <input
                                type="number"
                                min="1"
                                max="${item.stock}"
                                step="1"
                                value="${item.quantity}"
                                aria-label="Quantidade de ${escapeHtml(item.productName)}"
                                inputmode="numeric"
                                data-sale-quantity="${index}"
                            >

                            <button
                                type="button"
                                aria-label="Aumentar quantidade de ${escapeHtml(item.productName)}"
                                data-sale-increase="${index}"
                            >
                                +
                            </button>

                        </div>

                        <strong>
                            ${formatCurrency(
                                subtotal
                            )}
                        </strong>

                        <button
                            type="button"
                            class="icon-button danger"
                            data-sale-remove="${index}"
                            aria-label="Remover ${escapeHtml(item.productName)} da venda"
                        >
                            ${iconSvg("trash")}
                        </button>

                    </div>
                `;
                }
            )
            .join("");
}


function updateSaleItemQuantity(
    index,
    value
) {

    const item =
        saleDraft[index];

    if (!item) {
        return;
    }

    let quantity =
        Number(value);

    if (
        !Number.isInteger(
            quantity
        )
    ) {
        showMessage("saleFormMessage", "Informe uma quantidade inteira.");
        quantity = item.quantity;
    }

    if (
        quantity < 1
    ) {
        quantity =
            1;
    }

    if (
        quantity >
        item.stock
    ) {

        quantity =
            item.stock;

        showMessage(
            "saleFormMessage",
            `A quantidade máxima disponível é ${item.stock}.`
        );
    }

    const focused = document.activeElement;
    const action = ["data-sale-increase", "data-sale-decrease", "data-sale-quantity"].find(name => focused?.hasAttribute(name));
    item.quantity =
        quantity;

    renderSaleItems();
    renderSaleSummary();
    if (action) document.querySelector(`[${action}="${index}"]`)?.focus({ preventScroll: true });
}


function removeSaleItem(
    index
) {

    if (
        index < 0 ||
        index >= saleDraft.length
    ) {
        return;
    }

    saleDraft.splice(
        index,
        1
    );

    renderSaleItems();
    renderSaleSummary();
}


function renderSaleSummary() {

    const subtotal =
        saleDraft.reduce(
            (
                sum,
                item
            ) =>
                sum +
                (
                    item.quantity *
                    item.unitPrice
                ),
            0
        );

    const discount =
        Math.max(
            0,
            Number(
                $("saleDiscountInput")
                    ?.value ||
                0
            )
        );

    const safeDiscount =
        Math.min(
            discount,
            subtotal
        );

    const total =
        Math.max(
            0,
            subtotal -
            safeDiscount
        );

    if (
        $("saleSubtotalValue")
    ) {

        $("saleSubtotalValue")
            .textContent =
            formatCurrency(
                subtotal
            );
    }

    if (
        $("saleTotalValue")
    ) {

        $("saleTotalValue")
            .textContent =
            formatCurrency(
                total
            );
    }

    $("saleCartTotal").textContent = formatCurrency(subtotal);
    $("saleContinueButton").disabled = !saleDraft.length;

    return {
        subtotal,
        discount:
            safeDiscount,
        total
    };
}


// =========================================================
// VENDAS — BANCO
// =========================================================

async function loadSales() {
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId) return;
    const client = sessionClient(userId, generation);


    try {
        const {
            data,
            error
        } =
            await fetchAllRows(() => client
                .from(
                    "sales"
                )
                .select("*")
                .eq(
                    "user_id",
                    userId
                )
                .order(
                    "sale_date",
                    {
                        ascending:
                            false
                    }
                ));

        if (generation !== sessionGeneration) return;
        if (error) throw error;

        salesCache =
            data || [];

        renderSales();
        updateSalesMetrics();
    } catch (error) {
        if (generation !== sessionGeneration) return;
        console.error("Falha em loadSales", error);
        showDataLoadError();
    }
}


function updateSalesMetrics() {

    const today =
        todayISO();

    const todaySales =
        salesCache.filter(
            sale =>
                sale.status !==
                    "cancelled" && !sale.cancelled_at &&
                localDateKey(
                    sale.sale_date
                ) === today
        );

    const total =
        todaySales.reduce(
            (
                sum,
                sale
            ) =>
                sum +
                Number(
                    sale.total ||
                    0
                ),
            0
        );

    if (
        $("salesToday")
    ) {

        $("salesToday")
            .textContent =
            formatCurrency(
                total
            );
    }

    if (
        $("salesOrdersToday")
    ) {

        $("salesOrdersToday")
            .textContent =
            todaySales.length;
    }
}


function renderSaleHistoryCard(
    sale
) {

    const cancelled =
        sale.status ===
        "cancelled";

    return `

        <button type="button" class="sale-card" data-open-sale="${escapeHtml(sale.id)}" aria-label="Ver detalhes da venda #${escapeHtml(sale.sale_number)}">

            <span class="sale-card-info">

                <strong>
                    Venda #${escapeHtml(
                        sale.sale_number
                    )}
                </strong>

                <span>
                    ${formatLocalDateTime(
                        sale.sale_date
                    )}
                </span>

                <small>${escapeHtml(formatPaymentMethod(sale.payment_method))}</small>
                <span class="status-badge ${cancelled || sale.cancelled_at ? "zero" : "normal"}">${cancelled ? "CANCELADA" : sale.cancelled_at ? "Cancelamento pendente" : sale.status === "completed" ? "Concluída" : "Status não informado"}</span>
                ${cancelled && sale.cancelled_at ? `<small>Cancelada em ${escapeHtml(formatLocalDateTime(sale.cancelled_at))}</small>` : ""}
                ${cancelled && sale.cancellation_reason ? `<small>Motivo: ${escapeHtml(sale.cancellation_reason)}</small>` : ""}
                <small class="sale-details-hint">Ver detalhes →</small>
            </span>

            <strong>
                ${formatCurrency(
                    sale.total
                )}
            </strong>

        </button>
    `;
}


function renderSales() {
    filterSales({ target: $("salesSearch") });
}

async function openSaleDetails(id) {
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId || financeDeleting || saleSubmitting || saleCancelling) return;
    const revision = ++saleDetailsRevision;
    const client = sessionClient(userId, generation);
    const modal = $("saleDetailsModal");
    $("saleDetailsTitle").textContent = "Detalhes da venda";
    $("saleDetailsContent").replaceChildren();
    showMessage("saleDetailsMessage", "Carregando venda…", "info");
    modal.setAttribute("aria-busy", "true");
    openModal("saleDetailsModal");
    const isCurrent = () => revision === saleDetailsRevision && generation === sessionGeneration && currentUser?.id === userId && !modal.hidden;
    try {
        const [saleResult, itemsResult] = await Promise.all([
            client.from("sales").select("*").eq("id", id).eq("user_id", userId).single(),
            fetchAllRows(() => client.from("sale_items").select("*").eq("sale_id", id).eq("user_id", userId))
        ]);
        if (!isCurrent()) return;
        if (saleResult.error || itemsResult.error || !saleResult.data) throw saleResult.error || itemsResult.error || new Error("Venda não encontrada");
        const sale = saleResult.data;
        const items = itemsResult.data || [];
        const cancelled = sale.status === "cancelled";
        const money = value => value == null ? "Não informado" : formatCurrency(value);
        $("saleDetailsTitle").textContent = `Venda #${sale.sale_number}`;
        $("saleDetailsContent").innerHTML = `
            <span class="status-badge ${cancelled || sale.cancelled_at ? "zero" : "normal"}">${cancelled ? "CANCELADA" : sale.cancelled_at ? "Cancelamento pendente" : sale.status === "completed" ? "Concluída" : "Status não informado"}</span>
            <dl class="sale-details-summary">
                <div><dt>Data</dt><dd>${escapeHtml(formatLocalDateTime(sale.sale_date))}</dd></div>
                <div><dt>Forma de pagamento</dt><dd>${escapeHtml(formatPaymentMethod(sale.payment_method))}</dd></div>
            </dl>
            <h3>Produtos</h3>
            ${items.length ? `<ul class="sale-details-items">${items.map(item => `
                <li><strong>${escapeHtml(item.product_name || "Produto não informado")}</strong>
                    <span>${escapeHtml(item.variant_description || "Cor e tamanho não informados")}</span>
                    <span>${escapeHtml(item.quantity)} un. × ${money(item.unit_price)}</span>
                    <strong>Total do item: ${money(item.total)}</strong></li>`).join("")}</ul>`
                : '<p>Nenhum item encontrado para esta venda.</p>'}
            <dl class="sale-details-summary">
                <div><dt>Subtotal</dt><dd>${money(sale.subtotal)}</dd></div>
                <div><dt>Desconto</dt><dd>${money(sale.discount)}</dd></div>
                <div><dt>Total</dt><dd><strong>${money(sale.total)}</strong></dd></div>
            </dl>
            ${sale.notes ? `<h3>Observações</h3><p class="sale-details-text">${escapeHtml(sale.notes)}</p>` : ""}
            ${cancelled ? `<h3>Cancelamento</h3>
                <p>Cancelada em: ${sale.cancelled_at ? escapeHtml(formatLocalDateTime(sale.cancelled_at)) : "Data não informada"}</p>
                ${sale.cancellation_reason ? `<p class="sale-details-text">Motivo: ${escapeHtml(sale.cancellation_reason)}</p>` : ""}`
                : sale.cancelled_at ? '<p class="form-message error">Cancelamento pendente de conferência. Não repita a operação; confira estoque e financeiro com o suporte.</p>'
                : sale.status === "completed" ? `<div class="sale-details-actions"><h3>Ações da venda</h3><button type="button" class="secondary-button danger" data-cancel-sale="${escapeHtml(sale.id)}" data-sale-number="${escapeHtml(sale.sale_number)}">Cancelar venda</button></div>` : ""}
        `;
        showMessage("saleDetailsMessage", "");
    } catch (error) {
        if (!isCurrent()) return;
        console.error("Erro ao carregar detalhes da venda:", error);
        showMessage("saleDetailsMessage", "Não foi possível carregar a venda e seus itens. Feche e tente abrir novamente.");
    } finally {
        if (revision === saleDetailsRevision) modal.removeAttribute("aria-busy");
    }
}


function openSaleCancellation(id, number) {
    if (!currentUser || saleCancelling) return;
    saleCancellationTarget = { id, userId: currentUser.id, generation: sessionGeneration };
    $("cancelSaleTitle").textContent = `Cancelar venda #${number}?`;
    $("cancelSaleReason").value = "";
    $("cancelSaleConfirm").disabled = false;
    showMessage("cancelSaleMessage", "");
    openModal("cancelSaleModal");
}

// Cada escrita é confirmada antes de prosseguir. Uma resposta perdida não é
// confundida com rollback: a marca persistida mantém novas tentativas bloqueadas.
async function performSaleCancellation(client, userId, id, reason) {
    const {data,error}=await client.rpc("pc_cancel_sale",{p_sale_id:id,p_reason:reason || null});
    if (error) throw new Error(productOperationError(error));
    if (!data?.sale) throw new Error("Cancelamento não confirmado. Reabra a venda para conferir ou repetir com segurança.");
    return {alreadyCancelled:data.already_cancelled};
}

async function cancelSale(event) {
    event.preventDefault();
    if (saleCancelling || !saleCancellationTarget) return;
    const { id, userId, generation } = saleCancellationTarget;
    if (currentUser?.id !== userId || sessionGeneration !== generation) return;
    saleCancelling = true;
    $("cancelSaleForm").inert = true;
    $("cancelSaleModal").setAttribute("aria-busy", "true");
    setLoading($("cancelSaleConfirm"), true, "Cancelando…");
    let result;
    let failure;
    try {
        result = await performSaleCancellation(sessionClient(userId, generation), userId, id, $("cancelSaleReason").value.trim());
    } catch (error) {
        failure = error;
        console.error("Não foi possível cancelar venda", { saleId: id, error });
    } finally {
        try {
            if (currentUser?.id === userId && sessionGeneration === generation) {
                await Promise.all([loadSales(), loadProducts(), loadStock(), loadFinance()]);
                await loadDashboard();
            }
        } catch (refreshError) {
            console.error("Falha ao atualizar dados após cancelamento", { saleId: id, error: refreshError });
            failure = failure || new Error("A operação terminou, mas a atualização da tela falhou. Recarregue a página para conferir esta venda antes de qualquer nova tentativa.");
        } finally {
            saleCancelling = false;
            $("cancelSaleForm").inert = false;
            $("cancelSaleModal").removeAttribute("aria-busy");
            setLoading($("cancelSaleConfirm"), false);
        }
    }
    if (currentUser?.id !== userId || sessionGeneration !== generation) return;
    if (failure) {
        showMessage("cancelSaleMessage", failure.message);
        $("cancelSaleConfirm").disabled = true;
    } else {
        closeModal("cancelSaleModal");
        await openSaleDetails(id);
        showToast(result.alreadyCancelled ? "Esta venda já estava cancelada. Nenhuma alteração foi feita." : "Venda cancelada.");
    }
}

async function registerSale() {
    if (saleSubmitting || !currentUser) return;
    const userId=currentUser.id,generation=sessionGeneration,client=sessionClient(userId,generation);
    const storageKey=`mabijufit-pending-sale:${userId}`;
    let payload;
    try {
        payload=JSON.parse(localStorage.getItem(storageKey) || "null");
        if (!payload) {
            const payment=normalizePaymentMethod($("salePaymentMethod").value);
            if (!saleDraft.length || !payment) throw new Error("Adicione produtos e selecione a forma de pagamento.");
            payload={p_client_request_id:crypto.randomUUID(),p_items:saleDraft.map(i=>({variant_id:i.variantId,quantity:i.quantity})),p_discount:renderSaleSummary().discount,p_payment_method:payment,p_notes:$("saleNotesInput").value.trim() || null};
            localStorage.setItem(storageKey,JSON.stringify(payload));
        } else if (!confirm("Existe uma venda aguardando confirmação. Conferir a tentativa anterior usando os mesmos itens e pagamento? A venda atual não será enviada.")) return;
        saleSubmitting=true; $("saleManagementWorkspace").inert=true; setLoading($("saleRegisterButton"),true,"Registrando…");
        const {data,error}=await client.rpc("pc_register_sale",payload);
        if (error) {
            if (isConfirmedRpcRejection(error)) localStorage.removeItem(storageKey);
            throw error;
        }
        if (!data?.sale) throw new Error("Venda sem confirmação. Tente novamente para conferir a mesma venda.");
        localStorage.removeItem(storageKey);
        saleSubmitting=false; closeModal("saleModal"); resetSaleDraft();
        await Promise.all([loadSales(),loadVariants(),loadProducts(),loadFinance()]); await loadDashboard();
        showToast(data.replayed ? "Venda anterior confirmada. Não houve duplicação." : "Venda registrada.");
    } catch(error) { if (generation===sessionGeneration) {
        showMessage("saleFormMessage",productOperationError(error));
        $("salePendingRetry").hidden = !localStorage.getItem(storageKey);
    } }
    finally { if (generation===sessionGeneration) { saleSubmitting=false; $("saleManagementWorkspace").inert=false; setLoading($("saleRegisterButton"),false); } }
}

// =========================================================
// FINANCEIRO
// =========================================================

const financePeriodLabels = {
    today: "Hoje",
    "7days": "Últimos 7 dias",
    "30days": "Últimos 30 dias",
    month: "Este mês",
    all: "Todo o histórico"
};


function getFinanceTransactionsForPeriod() {

    if (
        currentFinancePeriod ===
        "all"
    ) {
        return [...financeCache];
    }

    const today =
        parseLocalDate(
            todayISO()
        );

    const start =
        new Date(today);

    if (
        currentFinancePeriod ===
        "today"
    ) {
        // A data inicial já representa hoje.
    } else if (
        currentFinancePeriod ===
        "7days"
    ) {
        start.setDate(
            start.getDate() - 6
        );
    } else if (
        currentFinancePeriod ===
        "30days"
    ) {
        start.setDate(
            start.getDate() - 29
        );
    } else {
        start.setDate(1);
    }

    return financeCache.filter(
        transaction => {

            const date =
                parseLocalDate(
                    transaction
                        .transaction_date
                );

            return date &&
                date >= start &&
                date <= today;
        }
    );
}


function updateFinanceView() {

    renderFinance();
    updateFinanceMetrics();
}

async function loadFinance() {
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId) return;
    const client = sessionClient(userId, generation);


    try {
        const {
            data,
            error
        } =
            await fetchAllRows(() => client
                .from(
                    "financial_transactions"
                )
                .select("*")
                .eq(
                    "user_id",
                    userId
                )
                .order(
                    "transaction_date",
                    {
                        ascending:
                            false
                    }
                ));

        if (generation !== sessionGeneration) return;
        if (error) throw error;

        financeCache =
            data || [];

        updateFinanceView();
    } catch (error) {
        if (generation !== sessionGeneration) return;
        console.error("Falha em loadFinance", error);
        showDataLoadError();
    }
}


function updateFinanceMetrics() {

    const transactions =
        getFinanceTransactionsForPeriod();

    const income =
        transactions
            .filter(
                transaction =>
                    transaction.transaction_type ===
                    "income"
            )
            .reduce(
                (
                    sum,
                    transaction
                ) =>
                    sum +
                    Number(
                        transaction.amount ||
                        0
                    ),
                0
            );

    const expenses =
        transactions
            .filter(
                transaction =>
                    transaction.transaction_type ===
                    "expense"
            )
            .reduce(
                (
                    sum,
                    transaction
                ) =>
                    sum +
                    Number(
                        transaction.amount ||
                        0
                    ),
                0
            );

    const balance =
        income -
        expenses;

    if (
        $("financeIncome")
    ) {

        $("financeIncome")
            .textContent =
            formatCurrency(
                income
            );
    }

    if (
        $("financeExpenses")
    ) {

        $("financeExpenses")
            .textContent =
            formatCurrency(
                expenses
            );
    }

    if (
        $("financeBalance")
    ) {

        $("financeBalance")
            .textContent =
            formatCurrency(
                balance
            );
    }

    $("financeBalance").className = balance < 0 ? "expense" : "income";

    const periodLabel =
        financePeriodLabels[
            currentFinancePeriod
        ] || "Período selecionado";

    [
        "financeIncomePeriod",
        "financeExpensesPeriod",
        "financeBalancePeriod"
    ].forEach(
        id => {

            if ($(id)) {
                $(id).textContent =
                    periodLabel;
            }
        }
    );
}


function renderFinanceCard(transaction) {
    const income = transaction.transaction_type === "income";
    return `
        <article class="finance-card">
            <div>
                <strong>${escapeHtml(transaction.description)}</strong>
                <span>${escapeHtml(transaction.category || "Sem categoria")}</span>
                <small>${formatLocalDate(transaction.transaction_date)} · ${escapeHtml(formatPaymentMethod(transaction.payment_method))}</small>
                <details class="finance-actions">
                    <summary>Opções do lançamento</summary>
                    ${transaction.reference_id === null
                        ? `<small>Lançamento manual</small><button type="button" class="secondary-button danger" data-delete-finance="${escapeHtml(transaction.id)}">Excluir lançamento</button>`
                        : `<small>${transaction.reference_id ? "Lançamento vinculado. Para desfazer uma receita de venda, cancele a venda de origem. A exclusão isolada não é permitida." : "Origem não confirmada. Exclusão indisponível."}</small>
                        ${transaction.reference_id && salesCache.some(sale => sale.id === transaction.reference_id) ? `<button type="button" class="secondary-button" data-open-sale="${escapeHtml(transaction.reference_id)}">Ver venda de origem</button>` : ""}`}
                </details>
            </div>
            <strong class="${income ? "income" : "expense"}">${income ? "+" : "−"} ${formatCurrency(transaction.amount)}</strong>
        </article>
    `;
}


function renderFinance() {
    filterFinance({ target: $("financeSearch") });
}

function openDeleteFinanceModal(id) {
    if (financeDeleting || !currentUser) return;
    const transaction = financeCache.find(item => item.id === id);
    if (!transaction) return;
    financeDeleteTarget = null;
    showMessage("deleteFinanceMessage", "");
    $("deleteFinanceSummary").textContent = [
        transaction.transaction_type === "income" ? "Receita" : "Despesa",
        transaction.description, transaction.category,
        formatCurrency(transaction.amount), formatLocalDate(transaction.transaction_date)
    ].filter(Boolean).join(" · ");
    const manual = transaction.reference_id === null;
    $("deleteFinanceConfirm").hidden = !manual;
    $("deleteFinanceExplanation").textContent = manual
        ? "Esta ação removerá o lançamento financeiro."
        : "Este lançamento não pode ser excluído isoladamente. Para desfazer uma receita de venda, cancele a venda de origem.";
    if (manual) financeDeleteTarget = { id, userId: currentUser.id, generation: sessionGeneration };
    openModal("deleteFinanceModal");
}

async function deleteManualTransaction(event) {
    event.preventDefault();
    if (financeDeleting || !financeDeleteTarget) return;
    const { id, userId, generation } = financeDeleteTarget;
    if (currentUser?.id !== userId || generation !== sessionGeneration) return;
    const client = sessionClient(userId, generation);
    const button = $("deleteFinanceConfirm");
    financeDeleting = true;
    $("deleteFinanceForm").inert = true;
    $("deleteFinanceModal").setAttribute("aria-busy", "true");
    setLoading(button, true, "Excluindo...");
    showMessage("deleteFinanceMessage", "");
    try {
        // O filtro é aplicado no DELETE, inclusive se a origem mudou após abrir o modal.
        // Repetir a requisição para o mesmo ID não remove outros lançamentos.
        const { data, error } = await client.from("financial_transactions")
            .delete().eq("id", id).eq("user_id", userId).is("reference_id", null).select("id");
        if (error) throw error;
        if (generation !== sessionGeneration || currentUser?.id !== userId) return;
        if (!data?.some(row => row.id === id)) {
            showMessage("deleteFinanceMessage", "Nenhuma exclusão foi confirmada. O lançamento pode ter sido removido, estar vinculado a uma venda ou você pode não ter permissão. Volte e confira a lista atualizada.");
            await loadFinance();
            await loadDashboard();
            return;
        }
        financeCache = financeCache.filter(item => item.id !== id);
        updateFinanceView();
        await loadDashboard();
        financeDeleteTarget = null;
        financeDeleting = false;
        closeModal("deleteFinanceModal");
        showToast("Lançamento excluído.");
    } catch (error) {
        console.error("Erro ao excluir lançamento manual:", error);
        if (generation !== sessionGeneration || currentUser?.id !== userId) return;
        showMessage("deleteFinanceMessage", "Não foi possível confirmar a exclusão. Confira sua conexão e atualize a lista antes de tentar novamente.");
        await loadFinance();
        await loadDashboard();
    } finally {
        financeDeleting = false;
        $("deleteFinanceForm").inert = false;
        $("deleteFinanceModal").removeAttribute("aria-busy");
        setLoading(button, false);
    }
}


function openTransactionModal(type = "expense") {

    const form =
        $("transactionForm");

    if (!form) {
        return;
    }

    form.reset();
    $("transactionType").value = type;
    form.querySelectorAll("details").forEach(element => { element.open = false; });

    if (
        $("transactionDate")
    ) {

        $("transactionDate")
            .value =
            todayISO();
    }

    showMessage(
        "transactionFormMessage",
        ""
    );

    openModal(
        "transactionModal"
    );
}


async function saveTransaction(
    event
) {
    event.preventDefault();
    const userId = currentUser?.id;
    const generation = sessionGeneration;
    if (!userId) return;
    const client = sessionClient(userId, generation);

    if (transactionSaving) return;
    if (!currentUser) {
        return;
    }

    const type =
        $("transactionType")
            .value;

    const category =
        $("transactionCategory")
            .value
            .trim();

    const description =
        $("transactionDescription")
            .value
            .trim();

    const amount =
        Number(
            $("transactionAmount")
                .value ||
            0
        );

    const date =
        $("transactionDate")
            .value;

    const paymentMethod =
        normalizePaymentMethod(
            $("transactionPaymentMethod")
                .value
        );

    const notes =
        $("transactionNotes")
            .value
            .trim();

    if (!["income", "expense"].includes(type)) {

        showMessage(
            "transactionFormMessage",
            "Selecione o tipo do lançamento."
        );

        return;
    }

    if (!category) {
        showMessage("transactionFormMessage", "Informe a categoria do lançamento.");
        $("transactionCategory").focus();
        return;
    }

    if (!description) {

        showMessage(
            "transactionFormMessage",
            "Informe a descrição."
        );

        return;
    }

    if (
        !Number.isFinite(amount) || amount <= 0
    ) {

        showMessage(
            "transactionFormMessage",
            "Informe um valor maior que zero."
        );

        return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        showMessage("transactionFormMessage", "Informe a data do lançamento.");
        return;
    }
    const button = event.submitter || $("transactionForm").querySelector('[type="submit"]');
    transactionSaving = true;
    $("transactionForm").inert = true;
    $("transactionModal").setAttribute("aria-busy", "true");
    setLoading(button, true);
    try {

        const {
            error
        } =
            await client
                .from(
                    "financial_transactions"
                )
                .insert({
                    user_id:
                        userId,

                    transaction_type:
                        type,

                    category,

                    description,

                    amount,

                    transaction_date:
                        date,

                    payment_method:
                        paymentMethod ||
                        null,

                    reference_id: null,

                    notes:
                        notes ||
                        null
                });

        if (error) {
            throw error;
        }

        transactionSaving = false;
        closeModal(
            "transactionModal"
        );
        showToast("Lançamento salvo.");

        await loadFinance();
        await loadDashboard();

    } catch (
        error
    ) {

        console.error(
            "Erro ao salvar lançamento financeiro:",
            {
                operation: "INSERT public.financial_transactions",
                message: error?.message ?? String(error),
                code: error?.code ?? null,
                details: error?.details ?? null,
                hint: error?.hint ?? null
            }
        );

        showMessage(
            "transactionFormMessage",
            "Não foi possível salvar o lançamento. Seus dados foram mantidos. Confira o motivo com o suporte antes de tentar novamente."
        );
    } finally {
        transactionSaving = false;
        $("transactionForm").inert = false;
        $("transactionModal").removeAttribute("aria-busy");
        setLoading(button, false);
    }
}


// =========================================================
// DASHBOARD
// =========================================================

function getActivityTimestamp(
    value
) {

    if (!value) {
        return 0;
    }

    if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(
            value
        )
    ) {
        return parseLocalDate(
            value
        )?.getTime() || 0;
    }

    const timestamp =
        new Date(value)
            .getTime();

    return Number.isNaN(timestamp)
        ? 0
        : timestamp;
}


function renderRecentActivity() {

    const container =
        $("recentActivity");

    if (!container) {
        return;
    }

    const saleActivities =
        salesCache.filter(sale => sale.status !== "cancelled" && !sale.cancelled_at).map(
            sale => ({
                type: "sale",
                icon: "receipt",
                title:
                    `${sale.status === "cancelled" ? "Venda cancelada" : "Venda"} #${sale.sale_number}`,
                detail:
                    `${formatCurrency(sale.total)} · ${formatPaymentMethod(sale.payment_method)}`,
                date:
                    sale.sale_date,
                timestamp:
                    getActivityTimestamp(
                        sale.sale_date
                    )
            })
        );

    const financeActivities =
        financeCache
            .filter(
                transaction =>
                    !(
                        transaction.reference_id &&
                        String(
                            transaction.category ||
                            ""
                        ).toLowerCase() ===
                            "venda"
                    )
            )
            .map(
                transaction => ({
                    type:
                        transaction.transaction_type,
                    icon:
                        transaction.transaction_type ===
                        "income"
                            ? "chart"
                            : "receipt",
                    title:
                        transaction.description ||
                        "Lançamento financeiro",
                    detail:
                        `${transaction.transaction_type === "income" ? "+" : "−"}${formatCurrency(transaction.amount)}`,
                    date:
                        transaction.transaction_date,
                    timestamp:
                        getActivityTimestamp(
                            localDateKey(transaction.created_at) === localDateKey(transaction.transaction_date)
                                ? transaction.created_at
                                : transaction.transaction_date
                        )
                })
            );

    const productActivities =
        productsCache
            .filter(
                product =>
                    product.created_at
            )
            .map(
                product => ({
                    type: "product",
                    icon: "bag",
                    title:
                        product.name,
                    detail:
                        "Produto cadastrado",
                    date:
                        product.created_at,
                    timestamp:
                        getActivityTimestamp(
                            product.created_at
                        )
                })
            );

    const activities = [
        ...saleActivities,
        ...financeActivities,
        ...productActivities
    ]
        .filter(
            activity =>
                activity.timestamp > 0
        )
        .sort(
            (a, b) =>
                b.timestamp -
                a.timestamp
        )
        .slice(0, 6);

    if (!activities.length) {

        container.className =
            "empty-state";

        container.innerHTML = `
            <div class="empty-state-icon">${iconSvg("receipt")}</div>
            <strong>Nenhuma atividade ainda</strong>
            <p>As vendas e movimentações aparecerão aqui.</p>
        `;

        return;
    }

    container.className =
        "activity-list";

    container.innerHTML =
        activities
            .map(
                activity => `
                    <article class="activity-item">
                        <span class="activity-icon ${escapeHtml(activity.type)}" aria-hidden="true">
                            ${iconSvg(activity.icon)}
                        </span>
                        <div class="activity-content">
                            <strong>${escapeHtml(activity.title)}</strong>
                            <span>${escapeHtml(activity.detail)}</span>
                        </div>
                        <time datetime="${escapeHtml(localDateKey(activity.date))}">
                            ${formatLocalDate(activity.date)}
                        </time>
                    </article>
                `
            )
            .join("");
}

async function loadDashboard() {
    if (!currentUser) return;

    const today =
        todayISO();

    const todaySales =
        salesCache.filter(
            sale =>
                sale.status !==
                    "cancelled" && !sale.cancelled_at &&
                localDateKey(
                    sale.sale_date
                ) === today
        );

    const todayRevenue =
        todaySales.reduce(
            (
                sum,
                sale
            ) =>
                sum +
                Number(
                    sale.total ||
                    0
                ),
            0
        );

    const todayExpenses =
        financeCache
            .filter(
                transaction =>
                    transaction.transaction_type ===
                        "expense" &&
                    localDateKey(
                        transaction.transaction_date
                    ) === today
            )
            .reduce(
                (
                    sum,
                    transaction
                ) =>
                    sum +
                    Number(
                        transaction.amount ||
                        0
                    ),
                0
            );

    const lowStock =
        getOperationalVariants().filter(
            variant => {

const stock =
                    Number(
                        variant.stock_quantity ||
                        0
                    );

                const minimum =
                    Number(
                        variant.minimum_stock ??
                        variant.products
                            ?.minimum_stock ??
                        0
                    );

                return (
                    minimum > 0 &&
                    stock <= minimum
                );
            }
        ).length;

    if (
        $("metricSales")
    ) {

        $("metricSales")
            .textContent =
            formatCurrency(
                todayRevenue
            );
    }

    if (
        $("metricOrders")
    ) {

        $("metricOrders")
            .textContent =
            todaySales.length;
    }

    if (
        $("metricLowStock")
    ) {

        $("metricLowStock")
            .textContent =
            lowStock;
    }

    if (
        $("metricExpenses")
    ) {

        $("metricExpenses")
            .textContent =
            formatCurrency(
                todayExpenses
            );
    }

    const todayIncome = financeCache.filter(item => item.transaction_type === "income" && localDateKey(item.transaction_date) === today)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    $("metricResult").textContent = formatCurrency(todayIncome - todayExpenses);
    $("metricResult").className = todayIncome - todayExpenses < 0 ? "expense" : "income";
    const attention = getOperationalVariants().filter(item => getStockStatus(item.stock_quantity, item.minimum_stock ?? item.products?.minimum_stock).className !== "normal")
        .sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity));
    $("metricLowStock").textContent = attention.length;
    $("dashboardStockAlerts").innerHTML = attention.length ? attention.slice(0, 3).map(item => `
        <button type="button" class="stock-alert-row" data-adjust-stock="${escapeHtml(item.product_id)}">
            <span><strong>${escapeHtml(item.products?.name || "Produto")}</strong><small>${escapeHtml(item.colors?.name || "Sem cor")} · ${escapeHtml(item.sizes?.name || "Sem tamanho")}</small></span>
            <span class="status-badge ${Number(item.stock_quantity) === 0 ? "zero" : "low"}">${Number(item.stock_quantity) === 0 ? "Sem estoque" : `${Number(item.stock_quantity)} un.`}</span>
        </button>`).join("") : (getOperationalVariants().length ? emptyState("Estoque em dia", "Nenhum tamanho disponível precisa de reposição.") : emptyState("Estoque ainda não cadastrado", "Adicione as peças e suas quantidades para acompanhar a reposição.", "new-product", "+ Cadastrar produto"));

    renderRecentActivity();
}


// =========================================================
// EVENTOS
// =========================================================

function bindEvents() {
    bindProductColorEvents();
    $("salePendingRetry").addEventListener("click", registerSale);
    $("togglePassword").addEventListener("click", () => {
        const show = $("password").type === "password";
        $("password").type = show ? "text" : "password";
        $("togglePassword").textContent = show ? "Ocultar" : "Mostrar";
        $("togglePassword").setAttribute("aria-pressed", String(show));
        $("togglePassword").setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
    });
    $("productCameraInput").addEventListener("change", handleProductPhotoSelection);
    $("productForm").addEventListener("invalid", event => {
        const panel = event.target.closest("[data-product-panel]");
        if (panel) setProductPanel(panel.dataset.productPanel);
        const details = event.target.closest("details");
        if (details) details.open = true;
    }, true);
    $("saleContinueButton").addEventListener("click", () => {
        if (saleDraft.length) { renderSaleSummary(); setSaleStage("payment"); }
    });
    $("saleBackToItems").addEventListener("click", () => { setSaleStage("items"); $("saleContinueButton").focus(); });
    document.addEventListener("click", async event => {
        const button = event.target.closest("button");
        if (!button) return;
        if (button.dataset.viewProduct) openProductDetails(button.dataset.viewProduct, button.hasAttribute("data-view-color") ? button.dataset.viewColor || null : undefined);
        if (button.dataset.productPanelTarget) setProductPanel(button.dataset.productPanelTarget);
        if (button.dataset.registration) showRegistration(button.dataset.registration);
        if (button.dataset.productFilter) { productFilter = button.dataset.productFilter; selectFilter("productFilters", "productFilter", productFilter); renderProducts(); }
        if (button.dataset.stockFilter) { stockFilter = button.dataset.stockFilter; selectFilter("stockFilters", "stockFilter", stockFilter); renderStock(); }
        if (button.dataset.financeFilter) { financeFilter = button.dataset.financeFilter; selectFilter("financeFilters", "financeFilter", financeFilter); renderFinance(); }
        if (button.dataset.removePhoto !== undefined) { productPhotosDraft.splice(Number(button.dataset.removePhoto), 1); renderProductPhotoPreview(); }
        if (button.dataset.adjustStock) {
            const product = productsCache.find(item => item.id === button.dataset.adjustStock);
            if (product) {
                try { await loadProductForEdit(product); setProductPanel("colors"); }
                catch (error) { console.error("Erro ao abrir estoque:", error); showToast("Não foi possível abrir o estoque. Tente novamente."); }
            }
        }
        const action = button.dataset.action;
        if (action === "new-product") openProductModal();
        if (action === "new-sale") await openNewSaleModal();
        if (action === "new-expense") openTransactionModal("expense");
        if (action === "products") showSection("products");
        if (action === "stock" || action === "stock-alerts") {
            stockFilter = "all";
            selectFilter("stockFilters", "stockFilter", stockFilter); showSection("stock");
        }
    });


    // =================================================
    // LOGIN
    // =================================================

    $("loginForm")
        ?.addEventListener(
            "submit",
            handleLogin
        );


    // =================================================
    // LOGOUT
    // =================================================

    $("logoutButton")
        ?.addEventListener(
            "click",
            handleLogout
        );


    // =================================================
    // NAVEGAÇÃO
    // =================================================

    document
        .querySelectorAll(
            "[data-section]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const section =
                            button.dataset
                                .section;

                        if (
                            section
                        ) {

                            showSection(
                                section
                            );
                        }
                    }
                );
            }
        );


    // =================================================
    // BOTÕES NOVOS
    // =================================================

    $("newProductButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                openProductModal();
            }
        );


    $("newSaleButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                openNewSaleModal();
            }
        );


    $("newTransactionButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                openTransactionModal();
            }
        );


    $("newCategoryButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                openCategoryModal();
            }
        );


    $("newColorButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                openColorModal();
            }
        );


    $("newSizeButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                openSizeModal();
            }
        );

    // =================================================
    // INTERFACE DE VENDA (ESTRUTURA ÚNICA NO HTML)
    // =================================================

    $("saleAddProductButton")
        ?.addEventListener(
            "click",
            toggleSaleProductPicker
        );

    $("saleClosePickerButton")
        ?.addEventListener(
            "click",
            closeSaleProductPicker
        );

    $("saleProductSearchInput")
        ?.addEventListener(
            "input",
            renderSaleProductPicker
        );

    $("saleDiscountInput")
        ?.addEventListener(
            "input",
            renderSaleSummary
        );

    $("saleRegisterButton")
        ?.addEventListener(
            "click",
            registerSale
        );


    // =================================================
    // FORMULÁRIOS
    // =================================================

    $("productForm")
        ?.addEventListener(
            "submit",
            saveProduct
        );

    $("categoryForm")
        ?.addEventListener(
            "submit",
            event => submitAuxiliaryForm(event, saveCategory)
        );

    $("colorForm")
        ?.addEventListener(
            "submit",
            event => submitAuxiliaryForm(event, saveColor)
        );

    $("sizeForm")
        ?.addEventListener(
            "submit",
            event => submitAuxiliaryForm(event, saveSize)
        );

    $("transactionForm")
        ?.addEventListener(
            "submit",
            saveTransaction
        );


    // =================================================
    // FOTOS
    // =================================================

    $("productPhotoInput")
        ?.addEventListener(
            "change",
            handleProductPhotoSelection
        );


    // =================================================
    // COLOR PICKER
    // =================================================

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
                    event.target.value
                        .trim();

                if (
                    !value.startsWith(
                        "#"
                    )
                ) {

                    value =
                        "#" +
                        value;
                }

                if (
                    /^#[0-9A-Fa-f]{6}$/
                        .test(value)
                ) {

                    $("colorHex").value =
                        value;

                    syncColorPreview();
                }
            }
        );


    // =================================================
    // CORES E TAMANHOS
    // =================================================

    // =================================================
    // FECHAMENTO DE MODAIS
    // =================================================

    document.addEventListener(
        "click",
        event => {

            const closeButton =
                event.target.closest(
                    "[data-close-modal]"
                );

            if (
                closeButton
            ) {
                if ($(closeButton.dataset.closeModal)?.querySelector('form[aria-busy="true"]')) return;

                event.preventDefault();
                event.stopPropagation();

                closeModal(
                    closeButton
                        .dataset
                        .closeModal
                );

                return;
            }

            const modal =
                event.target.closest(
                    ".modal"
                );

            if (
                modal &&
                event.target ===
                    modal
            ) {

                closeModal(
                    modal.id
                );
            }
        }
    );


    // =================================================
    // CATEGORIAS / CORES / TAMANHOS
    // =================================================

    document.addEventListener(
        "click",
        event => {

            const editCategory =
                event.target.closest(
                    "[data-edit-category]"
                );

            if (
                editCategory
            ) {

                const category =
                    categoriesCache.find(
                        item =>
                            item.id ===
                            editCategory
                                .dataset
                                .editCategory
                    );

                if (
                    category
                ) {

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

            if (
                deleteCategoryButton
            ) {

                deleteCategory(
                    deleteCategoryButton
                        .dataset
                        .deleteCategory
                );

                return;
            }

            const editColor =
                event.target.closest(
                    "[data-edit-color]"
                );

            if (
                editColor
            ) {

                const color =
                    colorsCache.find(
                        item =>
                            item.id ===
                            editColor
                                .dataset
                                .editColor
                    );

                if (
                    color
                ) {

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

            if (
                deleteColorButton
            ) {

                deleteColor(
                    deleteColorButton
                        .dataset
                        .deleteColor
                );

                return;
            }

            const editSize =
                event.target.closest(
                    "[data-edit-size]"
                );

            if (
                editSize
            ) {

                const size =
                    sizesCache.find(
                        item =>
                            item.id ===
                            editSize
                                .dataset
                                .editSize
                    );

                if (
                    size
                ) {

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

            if (
                deleteSizeButton
            ) {

                deleteSize(
                    deleteSizeButton
                        .dataset
                        .deleteSize
                );

                return;
            }


            // =================================================
            // VENDA RÁPIDA
            // =================================================

            const quickSellButton =
                event.target.closest(
                    "[data-quick-sell-product]"
                );

            if (
                quickSellButton
            ) {

                event.preventDefault();
                event.stopPropagation();

                openQuickSale(
                    quickSellButton
                        .dataset
                        .quickSellProduct
                );

                return;
            }


            // =================================================
            // EDIÇÃO PELO BOTÃO
            // =================================================

            const editProductButton =
                event.target.closest(
                    "[data-edit-product-button]"
                );

            if (
                editProductButton
            ) {

                event.preventDefault();
                event.stopPropagation();

                const product =
                    productsCache.find(
                        item =>
                            item.id ===
                            editProductButton
                                .dataset
                                .editProductButton
                    );

                if (
                    product
                ) {

                    openProductModal(
                        product
                    );
                }

                return;
            }


            const toggleProductButton =
                event.target.closest(
                    "[data-toggle-product]"
                );

            if (
                toggleProductButton
            ) {

                toggleProductActive(
                    toggleProductButton
                        .dataset
                        .toggleProduct
                );

                return;
            }


            const deleteProductButton =
                event.target.closest(
                    "[data-delete-product]"
                );

            if (
                deleteProductButton
            ) {

                deleteProduct(
                    deleteProductButton
                        .dataset
                        .deleteProduct
                );

                return;
            }


            // =================================================
            // VENDAS
            // =================================================

            const selectProduct =
                event.target.closest(
                    "[data-sale-select-product]"
                );

            if (
                selectProduct
            ) {

                const productId =
                    selectProduct
                        .dataset
                        .saleSelectProduct;

                saleVariantSelectionProductId =
                    productId;

                const list =
                    $("saleProductPickerList");

                if (list) {
                    list.hidden =
                        true;
                }

                renderSaleVariantPicker(
                    productId
                );

                return;
            }

            const selectVariant =
                event.target.closest(
                    "[data-sale-select-variant]"
                );

            if (
                selectVariant
            ) {

                addSaleVariant(
                    selectVariant
                        .dataset
                        .saleSelectVariant
                );

                return;
            }

            const backPicker =
                event.target.closest(
                    "[data-sale-back-picker]"
                );

            if (
                backPicker
            ) {
                saleVariantSelectionProductId = null;
                syncSalePickerView();

                const list =
                    $("saleProductPickerList");

                if (list) {
                    list.hidden =
                        false;
                }

                const variantPicker =
                    $("saleVariantPicker");

                if (
                    variantPicker
                ) {

                    variantPicker.hidden =
                        true;
                }

                return;
            }

            const decrease =
                event.target.closest(
                    "[data-sale-decrease]"
                );

            if (
                decrease
            ) {

                const index =
                    Number(
                        decrease.dataset
                            .saleDecrease
                    );

                const item =
                    saleDraft[index];

                if (
                    item
                ) {

                    updateSaleItemQuantity(
                        index,
                        item.quantity -
                        1
                    );
                }

                return;
            }

            const increase =
                event.target.closest(
                    "[data-sale-increase]"
                );

            if (
                increase
            ) {

                const index =
                    Number(
                        increase.dataset
                            .saleIncrease
                    );

                const item =
                    saleDraft[index];

                if (
                    item
                ) {

                    updateSaleItemQuantity(
                        index,
                        item.quantity +
                        1
                    );
                }

                return;
            }

            const removeSale =
                event.target.closest(
                    "[data-sale-remove]"
                );

            if (
                removeSale
            ) {

                removeSaleItem(
                    Number(
                        removeSale.dataset
                            .saleRemove
                    )
                );

                return;
            }
        }
    );


    // =================================================
    // QUANTIDADE DA VENDA
    // =================================================

    document.addEventListener(
        "change",
        event => {

            const input =
                event.target.closest(
                    "[data-sale-quantity]"
                );

            if (!input) {
                return;
            }

            updateSaleItemQuantity(
                Number(
                    input.dataset
                        .saleQuantity
                ),
                input.value
            );
        }
    );


    // =================================================
    // BUSCAS
    // =================================================

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

    $("financePeriod")
        ?.addEventListener(
            "change",
            event => {

                currentFinancePeriod =
                    event.target.value ||
                    "month";


                updateFinanceView();
            }
        );

    $("deleteFinanceForm").addEventListener("submit", deleteManualTransaction);
    $("cancelSaleForm").addEventListener("submit", cancelSale);
    $("saleDetailsContent").addEventListener("click", event => {
        const button = event.target.closest("[data-cancel-sale]");
        if (button) openSaleCancellation(button.dataset.cancelSale, button.dataset.saleNumber);
    });
    $("cancelSaleBack").addEventListener("click", () => {
        if (saleCancelling) return;
        const id = saleCancellationTarget?.id;
        closeModal("cancelSaleModal");
        if (id) openSaleDetails(id);
    });
    for (const list of [$("salesList"), $("financeList")]) {
        list.addEventListener("click", event => {
            const button = event.target.closest("[data-open-sale]");
            if (button) openSaleDetails(button.dataset.openSale);
        });
    }
    $("financeList").addEventListener("click", event => {
        const button = event.target.closest("[data-delete-finance]");
        if (button) openDeleteFinanceModal(button.dataset.deleteFinance);
    });

    document.addEventListener("keydown", event => {
        const modal = document.querySelector(".modal:not([hidden])");
        if (!modal) return;
        if (event.key === "Escape") {
            event.preventDefault();
            if (modal.querySelector('form[aria-busy="true"]')) return;
            if (modal.id === "saleModal" && saleProductPickerOpen) { closeSaleProductPicker(); $("saleAddProductButton").focus(); return; }
            closeModal(modal.id);
        }
        if (event.key !== "Tab") return;
        const elements = [...modal.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"], summary'
        )].filter(element => element.getClientRects().length && !element.closest("[inert]") && (!element.closest("details:not([open])") || element.matches("summary")));
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
            event.preventDefault(); first.focus();
        }
    });
}


// =========================================================
// FILTROS
// =========================================================

function filterProducts(
    event
) {

    const search =
        event.target.value
            .toLowerCase()
            .trim();

    const filtered =
        productsCache.filter(
            product => {
                if (productFilter === "active" && product.is_active === false) return false;
                if (productFilter === "inactive" && product.is_active !== false) return false;

                const name =
                    String(
                        product.name ||
                        ""
                    )
                        .toLowerCase();

                const sku =
                    String(
                        product.sku ||
                        ""
                    )
                        .toLowerCase();

                return (
                    name.includes(
                        search
                    ) ||
                    sku.includes(
                        search
                    )
                );
            }
        );

    renderProductCollection(
        filtered
    );
}


function renderProductCollection(
    products
) {

    const container =
        $("productsList");

    if (!container) {
        return;
    }

    if (
        !products.length
    ) {

        container.innerHTML = emptyState("Nenhum produto encontrado", "Cadastre uma peça ou ajuste a busca e os filtros.", "new-product", "+ Cadastrar produto");

        return;
    }

    container.innerHTML =
        products
            .map(
                renderProductCard
            )
            .join("");
}


function filterStock(
    event
) {

    const search =
        event.target.value
            .toLowerCase()
            .trim();

    const filtered =
        getOperationalVariants()
            .filter(
            variant => {
                const status = getStockStatus(variant.stock_quantity, variant.minimum_stock ?? variant.products?.minimum_stock).className;
                if (stockFilter !== "all" && status !== stockFilter) return false;

                const text =
                    [
                        variant.products?.name,
                        variant.colors?.name,
                        variant.sizes?.name
                    ]
                        .filter(
                            Boolean
                        )
                        .join(" ")
                        .toLowerCase();

                return text.includes(
                    search
                );
            }
        );

    filtered.sort((a, b) => Number(a.stock_quantity || 0) - Number(b.stock_quantity || 0));
    renderStockCollection(filtered);
}


function renderStockCollection(
    variants
) {

    const container =
        $("stockList");

    if (!container) {
        return;
    }

    if (
        !variants.length
    ) {

        container.innerHTML = emptyState("Nenhum tamanho encontrado", "Ajuste os filtros ou cadastre o estoque de uma peça.", "products", "Ver produtos");

        return;
    }

    container.innerHTML =
        variants
            .map(
                renderStockCard
            )
            .join("");
}


function filterSales(
    event
) {

    const search =
        event.target.value
            .toLowerCase()
            .trim();

    const filtered =
        salesCache.filter(
            sale =>
                String(
                    [sale.sale_number, formatPaymentMethod(sale.payment_method), formatLocalDate(sale.sale_date)].join(" ")
                )
                    .toLowerCase()
                    .includes(
                        search
                    )
        );

    const container =
        $("salesList");

    if (!container) {
        return;
    }

    if (
        !filtered.length
    ) {

        container.innerHTML = emptyState("Nenhuma venda encontrada", "Registre uma venda ou altere sua busca.", "new-sale", "+ Nova venda");

        return;
    }

    container.innerHTML =
        filtered
            .map(
                renderSaleHistoryCard
            )
            .join("");
}


function filterFinance(
    event
) {

    const search =
        event.target.value
            .toLowerCase()
            .trim();

    const filtered =
        getFinanceTransactionsForPeriod()
            .filter(
            transaction => {
                if (financeFilter !== "all" && transaction.transaction_type !== financeFilter) return false;

                const text =
                    [
                        transaction.description,
                        transaction.category
                    ]
                        .filter(
                            Boolean
                        )
                        .join(" ")
                        .toLowerCase();

                return text.includes(
                    search
                );
            }
        );

    const container =
        $("financeList");

    if (!container) {
        return;
    }

    if (
        !filtered.length
    ) {

        container.innerHTML = emptyState("Nenhum lançamento encontrado", "Confira o período ou registre uma receita ou despesa.", "new-expense", "+ Lançamento");

        return;
    }

    container.innerHTML =
        filtered
            .map(
                renderFinanceCard
            )
            .join("");
}


// =========================================================
// CARREGAMENTO
// =========================================================

async function loadProductsPage() {

    await Promise.all([
        loadCategories(),
        loadColors(),
        loadSizes(),
        loadProducts(),
        loadVariants(false)
    ]);

    renderProducts();
}


async function loadInitialData() {

    await Promise.all([
        loadUserProfile(),
        loadCategories(),
        loadColors(),
        loadSizes(),
        loadProducts(),
        loadVariants(false),
        loadSales(),
        loadFinance()
    ]);

    await loadDashboard();
}


// =========================================================
// SESSÃO
// =========================================================

async function checkSession() {
    const revision = authRevision;

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .auth
                .getSession();

        if (revision !== authRevision) return;

        if (error) {
            throw error;
        }

        if (
            data?.session?.user
        ) {

            await showApplication(
                data.session.user
            );

        } else {

            const loginScreen =
                $("loginScreen");

            const appScreen =
                $("appScreen");

            if (loginScreen) {
                loginScreen.hidden =
                    false;
            }

            if (appScreen) {
                appScreen.hidden =
                    true;
            }
        }

    } catch (
        error
    ) {

        console.error(
            "Erro ao verificar sessão:",
            error
        );

        showMessage("loginMessage", "Não foi possível recuperar a sessão. Verifique a conexão e entre novamente.");
        const loginScreen =
            $("loginScreen");

        const appScreen =
            $("appScreen");

        if (loginScreen) {
            loginScreen.hidden =
                false;
        }

        if (appScreen) {
            appScreen.hidden =
                true;
        }
    }
}


// =========================================================
// INICIALIZAÇÃO
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "MabijuFit iniciando..."
        );

        if (
            typeof supabaseClient === "undefined" || !supabaseClient
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

        /*
         * PRIMEIRO:
         * todos os modais começam fechados.
         *
         * Isso corrige o problema em que o productModal
         * aparecia indevidamente ao navegar para Financeiro.
         */

        initializeModals();

        /*
         * SEGUNDO:
         * somente agora registramos os listeners.
         */

        bindEvents();

        /*
         * Listener de autenticação.
         */

        supabaseClient.auth.onAuthStateChange((event, session) => {
            const revision = ++authRevision;
            if (event === "SIGNED_OUT") {
                resetSessionState();
                return;
            }
            if (session?.user) {
                // O callback deve liberar o lock do Auth antes de consultar dados.
                setTimeout(() => {
                    if (revision !== authRevision) return;
                    showApplication(session.user).catch(error => {
                        console.error("Erro ao iniciar sessão:", error);
                        alert("Não foi possível carregar os dados. Atualize a página.");
                    });
                }, 0);
            }
        });

        /*
         * Finalmente verifica a sessão existente.
         */

        await checkSession();
    }
);
