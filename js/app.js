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
let currentSection = "home";

let categoriesCache = [];
let colorsCache = [];
let sizesCache = [];
let productsCache = [];
let variantsCache = [];
let salesCache = [];
let financeCache = [];

let productImagesCache = {};

let productVariationsDraft = [];
let productPhotosDraft = [];
let productPhotoPreviewUrls = [];

let editingProductId = null;
let editingProductActiveVariantIds = [];

let saleDraft = [];
let saleProductPickerOpen = false;
let saleVariantSelectionProductId = null;

let currentFinancePeriod = "month";
let lastFocusedElement = null;
let saleSubmitting = false;
let productSaving = false;
let transactionSaving = false;


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
        error?.message ||
        "Não foi possível entrar. Tente novamente."
    );
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
    className = "product-thumbnail"
) {

    const image =
        getProductMainImage(
            productId
        );

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


function getProductVariants(
    productId
) {

    return variantsCache.filter(
        variant =>
            variant.product_id ===
                productId &&
            variant.is_active !==
                false
    );
}


function getProductTotalStock(
    productId
) {

    return getProductVariants(
        productId
    ).reduce(
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
}


function getProductColorNames(
    productId
) {

    const names = [];

    getProductVariants(
        productId
    ).forEach(
        variant => {

            const name =
                variant.colors?.name;

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
            } catch (error) {}
        }
    );

    productPhotoPreviewUrls = [];
}


function clearProductPhotosDraft() {

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


function renderProductPhotoPreview() {

    const container =
        $("productPhotoPreview");

    if (!container) {
        return;
    }

    revokeProductPhotoPreviewUrls();

    if (
        !productPhotosDraft.length
    ) {

        container.innerHTML = "";

        return;
    }

    const fragment =
        document.createDocumentFragment();

    productPhotosDraft.forEach(
        (
            file,
            index
        ) => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "product-photo-preview-item";

            const image =
                document.createElement(
                    "img"
                );

            image.alt =
                `Pré-visualização da foto ${index + 1}`;

            image.loading =
                "lazy";

            const url =
                URL.createObjectURL(
                    file
                );

            productPhotoPreviewUrls.push(
                url
            );

            image.src =
                url;

            const info =
                document.createElement(
                    "div"
                );

            info.className =
                "product-photo-preview-info";

            const name =
                document.createElement(
                    "span"
                );

            name.className =
                "product-photo-preview-name";

            name.textContent =
                file.name ||
                `Foto ${index + 1}`;

            const order =
                document.createElement(
                    "small"
                );

            order.textContent =
                index === 0
                    ? "Foto principal"
                    : `Foto ${index + 1}`;

            info.appendChild(name);
            info.appendChild(order);

            item.appendChild(image);
            item.appendChild(info);

            fragment.appendChild(item);
        }
    );

    container.innerHTML = "";

    container.appendChild(
        fragment
    );
}


function handleProductPhotoSelection(
    event
) {

    const files =
        Array.from(
            event.target.files || []
        );

    if (!files.length) {

        clearProductPhotosDraft();

        return;
    }

    const invalidFiles =
        files.filter(
            file =>
                !file.type ||
                !file.type.startsWith(
                    "image/"
                )
        );

    const validFiles =
        files.filter(
            file =>
                file.type &&
                file.type.startsWith(
                    "image/"
                )
        );

    productPhotosDraft =
        validFiles;

    renderProductPhotoPreview();

    if (
        invalidFiles.length
    ) {

        showMessage(
            "productFormMessage",
            `${invalidFiles.length} arquivo(s) não são imagens válidas e foram ignorados.`
        );

        return;
    }

    showMessage(
        "productFormMessage",
        validFiles.length === 1
            ? "1 foto selecionada."
            : `${validFiles.length} fotos selecionadas.`,
        "success"
    );
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
                    } catch (error) {}
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
    index
) {

    const safeName =
        createOptimizedImageName(
            file?.name ||
            `foto-${index + 1}`
        );

    return [
        currentUser.id,
        "products",
        productId,
        `${Date.now()}-${index}-${safeName}`
    ].join("/");
}


async function loadProductImages(
    productIds = []
) {

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

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "product_images"
            )
            .select(`
                id,
                product_id,
                storage_path,
                public_url,
                is_primary,
                display_order
            `)
            .eq(
                "user_id",
                currentUser.id
            )
            .in(
                "product_id",
                uniqueProductIds
            )
            .order(
                "display_order"
            );

    if (error) {

        console.error(
            "Erro ao carregar fotos dos produtos:",
            error
        );

        return;
    }

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
}


async function uploadProductImages(
    productId,
    options = {}
) {

    if (
        !currentUser ||
        !productId
    ) {

        return {
            uploaded: [],
            failed: []
        };
    }

    if (
        !productPhotosDraft.length
    ) {

        return {
            uploaded: [],
            failed: []
        };
    }

    const uploaded = [];
    const failed = [];

    const existingImages =
        options.existingImages ||
        [];

    const hasExistingPrimary =
        existingImages.some(
            image =>
                image.is_primary ===
                true
        );

    const existingMaxOrder =
        existingImages.reduce(
            (
                max,
                image
            ) =>
                Math.max(
                    max,
                    Number(
                        image.display_order ||
                        0
                    )
                ),
            -1
        );

    for (
        let index = 0;
        index <
            productPhotosDraft.length;
        index++
    ) {

        const originalFile =
            productPhotosDraft[
                index
            ];

        try {

            showMessage(
                "productFormMessage",
                `Processando foto ${index + 1} de ${productPhotosDraft.length}...`,
                "success"
            );

            const optimizedFile =
                await optimizeProductImage(
                    originalFile
                );

            if (
                optimizedFile.size >
                PRODUCT_IMAGE_MAX_SIZE
            ) {

                throw new Error(
                    "A imagem otimizada ainda ultrapassou o limite de 8 MB."
                );
            }

            const path =
                createProductImageStoragePath(
                    productId,
                    optimizedFile,
                    index
                );

            showMessage(
                "productFormMessage",
                `Enviando foto ${index + 1} de ${productPhotosDraft.length}...`,
                "success"
            );

            const {
                error:
                    uploadError
            } =
                await supabaseClient
                    .storage
                    .from(
                        "product-images"
                    )
                    .upload(
                        path,
                        optimizedFile,
                        {
                            upsert:
                                false,
                            contentType:
                                "image/jpeg",
                            cacheControl:
                                "31536000"
                        }
                    );

            if (
                uploadError
            ) {
                throw uploadError;
            }

            const {
                data:
                    publicUrlData
            } =
                supabaseClient
                    .storage
                    .from(
                        "product-images"
                    )
                    .getPublicUrl(
                        path
                    );

            const publicUrl =
                publicUrlData?.publicUrl ||
                "";

            if (!publicUrl) {

                try {

                    await supabaseClient
                        .storage
                        .from(
                            "product-images"
                        )
                        .remove([
                            path
                        ]);

                } catch (
                    cleanupError
                ) {

                    console.error(
                        "Erro ao limpar arquivo:",
                        cleanupError
                    );
                }

                throw new Error(
                    "A imagem foi enviada, mas não foi possível obter sua URL pública."
                );
            }

            const isPrimary =
                !hasExistingPrimary &&
                index === 0;

            const displayOrder =
                existingMaxOrder +
                index +
                1;

            const {
                error:
                    imageInsertError
            } =
                await supabaseClient
                    .from(
                        "product_images"
                    )
                    .insert({
                        user_id:
                            currentUser.id,
                        product_id:
                            productId,
                        storage_path:
                            path,
                        public_url:
                            publicUrl,
                        is_primary:
                            isPrimary,
                        display_order:
                            displayOrder
                    });

            if (
                imageInsertError
            ) {

                try {

                    await supabaseClient
                        .storage
                        .from(
                            "product-images"
                        )
                        .remove([
                            path
                        ]);

                } catch (
                    cleanupError
                ) {

                    console.error(
                        "Erro ao limpar imagem:",
                        cleanupError
                    );
                }

                throw imageInsertError;
            }

            uploaded.push({
                path,
                publicUrl,
                displayOrder,
                isPrimary
            });

        } catch (
            error
        ) {

            console.error(
                `Erro ao processar a foto ${index + 1}:`,
                error
            );

            failed.push({
                index,
                fileName:
                    originalFile?.name ||
                    `Foto ${index + 1}`,
                error
            });
        }
    }

    return {
        uploaded,
        failed
    };
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
        (id === "transactionModal" && transactionSaving)) return;
    const modal =
        $(id);

    if (!modal) {
        return;
    }

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

        currentUser =
            data.user;

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

    try {

        await supabaseClient
            .auth
            .signOut();

    } catch (
        error
    ) {

        console.error(
            "Erro ao sair:",
            error
        );
    }

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
        appScreen.hidden =
            false;
    }

    const userName =
        $("userName");

    if (userName) {

        const fullName =
            user.user_metadata
                ?.full_name;

        userName.textContent =
            fullName ||
            user.email ||
            "Usuário";
        userName.title = userName.textContent;
    }

    if (
        !appInitialized
    ) {

        appInitialized =
            true;

        await loadInitialData();

        showSection(
            "home"
        );

        return;
    }

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

async function loadCategories() {

    if (!currentUser) {
        return;
    }

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "categories"
            )
            .select("*")
            .eq(
                "user_id",
                currentUser.id
            )
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


function populateCategorySelect() {

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
                category.is_active !==
                false
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

    if (!currentUser) {
        return;
    }

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
                await supabaseClient
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
                        currentUser.id
                    );

        } else {

            query =
                await supabaseClient
                    .from(
                        "categories"
                    )
                    .insert({
                        ...payload,
                        user_id:
                            currentUser.id
                    });
        }

        if (query.error) {
            throw query.error;
        }

        closeModal(
            "categoryModal"
        );

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
            error.message ||
            "Não foi possível salvar a categoria."
        );
    }
}


async function deleteCategory(
    id
) {

    if (!currentUser) {
        return;
    }

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
        await supabaseClient
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
                currentUser.id
            );

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
    } =
        await supabaseClient
            .from(
                "colors"
            )
            .select("*")
            .eq(
                "user_id",
                currentUser.id
            )
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

    if (!currentUser) {
        return;
    }

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
                await supabaseClient
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
                        currentUser.id
                    );

        } else {

            query =
                await supabaseClient
                    .from(
                        "colors"
                    )
                    .insert({
                        ...payload,
                        user_id:
                            currentUser.id
                    });
        }

        if (query.error) {
            throw query.error;
        }

        closeModal(
            "colorModal"
        );

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
            error.message ||
            "Não foi possível salvar a cor."
        );
    }
}


async function deleteColor(
    id
) {

    if (!currentUser) {
        return;
    }

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
        await supabaseClient
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
                currentUser.id
            );

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
    } =
        await supabaseClient
            .from(
                "sizes"
            )
            .select("*")
            .eq(
                "user_id",
                currentUser.id
            )
            .order(
                "display_order"
            )
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

    if (!currentUser) {
        return;
    }

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
                await supabaseClient
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
                        currentUser.id
                    );

        } else {

            query =
                await supabaseClient
                    .from(
                        "sizes"
                    )
                    .insert({
                        ...payload,
                        user_id:
                            currentUser.id
                    });
        }

        if (query.error) {
            throw query.error;
        }

        closeModal(
            "sizeModal"
        );

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
            error.message ||
            "Não foi possível salvar o tamanho."
        );
    }
}


async function deleteSize(
    id
) {

    if (!currentUser) {
        return;
    }

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
        await supabaseClient
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
                currentUser.id
            );

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
// VARIAÇÕES
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
            <option value="">
                Selecione a cor
            </option>
        `;

        colorsCache
            .filter(
                color =>
                    color.is_active !==
                    false
            )
            .forEach(
                color => {

                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        color.id;

                    option.textContent =
                        color.name;

                    option.dataset.colorName =
                        color.name || "";

                    option.dataset.colorHex =
                        color.hex_code ||
                        "#cccccc";

                    colorSelect.appendChild(
                        option
                    );
                }
            );

        if (
            [
                ...colorSelect.options
            ].some(
                option =>
                    option.value ===
                    currentColor
            )
        ) {

            colorSelect.value =
                currentColor;
        }
    }

    if (sizeSelect) {

        const currentSize =
            sizeSelect.value;

        sizeSelect.innerHTML = `
            <option value="">
                Selecione o tamanho
            </option>
        `;

        sizesCache
            .filter(
                size =>
                    size.is_active !==
                    false
            )
            .forEach(
                size => {

                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        size.id;

                    option.textContent =
                        size.name;

                    option.dataset.sizeName =
                        size.name || "";

                    sizeSelect.appendChild(
                        option
                    );
                }
            );

        if (
            [
                ...sizeSelect.options
            ].some(
                option =>
                    option.value ===
                    currentSize
            )
        ) {

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

    if (
        !productVariationsDraft.length
    ) {

        container.innerHTML = `
            <div class="empty-state compact">
                <strong>Nenhuma variação adicionada</strong>
                <p>Selecione cor, tamanho e quantidade acima.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        productVariationsDraft
            .map(
                (
                    variation,
                    index
                ) => {

                    const hex =
                        variation.colorHex ||
                        "#cccccc";

                    return `

                    <div
                        class="product-variant-draft-item"
                        data-variation-index="${index}"
                    >

                        <div class="product-variant-draft-info">

                            <span
                                class="variation-color-dot"
                                style="background:${escapeHtml(
                                    hex
                                )}"
                            ></span>

                            <strong>
                                ${escapeHtml(
                                    variation.colorName ||
                                    "Sem cor"
                                )}
                            </strong>

                            <span class="product-variant-draft-size">
                                ${escapeHtml(
                                    variation.sizeName ||
                                    "Sem tamanho"
                                )}
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
                                    value="${Number(
                                        variation.quantity ||
                                        0
                                    )}"
                                    data-variation-quantity="${index}"
                                >

                            </label>

                            <button
                                type="button"
                                class="icon-button danger"
                                data-remove-variation="${index}"
                                aria-label="Remover variação ${escapeHtml(variation.colorName)} ${escapeHtml(variation.sizeName)}"
                            >
                                ${iconSvg("trash")}
                            </button>

                        </div>

                    </div>
                `;
                }
            )
            .join("");
}


function addProductVariation() {

    const colorSelect =
        $("productVariationColor");

    const sizeSelect =
        $("productVariationSize");

    const quantityInput =
        $("productVariationQuantity");

    if (
        !colorSelect ||
        !sizeSelect ||
        !quantityInput
    ) {
        return;
    }

    const colorId =
        colorSelect.value;

    const sizeId =
        sizeSelect.value;

    const quantity =
        Number(
            quantityInput.value ||
            0
        );

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

    if (
        !Number.isInteger(
            quantity
        ) ||
        quantity < 0
    ) {

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
                variation.colorId ===
                    colorId &&
                variation.sizeId ===
                    sizeId
        );

    if (
        alreadyExists
    ) {

        showMessage(
            "productFormMessage",
            "Essa combinação de cor e tamanho já foi adicionada."
        );

        return;
    }

    const color =
        colorsCache.find(
            item =>
                item.id ===
                colorId
        );

    const size =
        sizesCache.find(
            item =>
                item.id ===
                sizeId
        );

    const existingVariant =
        editingProductId
            ? variantsCache.find(
                variant =>
                    variant.product_id ===
                        editingProductId &&
                    variant.color_id ===
                        colorId &&
                    variant.size_id ===
                        sizeId
            )
            : null;

    productVariationsDraft.push({
        variantId:
            existingVariant?.id ||
            null,
        colorId,
        colorName:
            color?.name ||
            colorSelect
                .selectedOptions[0]
                ?.textContent ||
            "",
        colorHex:
            color?.hex_code ||
            "#cccccc",
        sizeId,
        sizeName:
            size?.name ||
            sizeSelect
                .selectedOptions[0]
                ?.textContent ||
            "",
        quantity
    });

    renderProductVariationsList();

    quantityInput.value =
        "1";

    colorSelect.value =
        "";

    sizeSelect.value =
        "";

    showMessage(
        "productFormMessage",
        "Variação adicionada.",
        "success"
    );
}


function removeProductVariation(
    index
) {

    const numericIndex =
        Number(index);

    if (
        !Number.isInteger(
            numericIndex
        ) ||
        numericIndex < 0 ||
        numericIndex >=
            productVariationsDraft.length
    ) {
        return;
    }

    productVariationsDraft.splice(
        numericIndex,
        1
    );

    renderProductVariationsList();
}


function updateProductVariationQuantity(
    index,
    value
) {

    const numericIndex =
        Number(index);

    if (
        !productVariationsDraft[
            numericIndex
        ]
    ) {
        return;
    }

    const quantity =
        Number(value);

    if (
        !Number.isInteger(
            quantity
        ) ||
        quantity < 0
    ) {
        return;
    }

    productVariationsDraft[
        numericIndex
    ].quantity =
        quantity;
}


function generateBatchVariations() {

    const activeColors =
        colorsCache.filter(
            color =>
                color.is_active !==
                false
        );

    const activeSizes =
        sizesCache.filter(
            size =>
                size.is_active !==
                false
        );

    if (
        !activeColors.length ||
        !activeSizes.length
    ) {

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

    if (
        quantityValue ===
        null
    ) {
        return;
    }

    const quantity =
        Number(
            quantityValue
        );

    if (
        !Number.isInteger(
            quantity
        ) ||
        quantity < 0
    ) {

        showMessage(
            "productFormMessage",
            "Informe uma quantidade inteira igual ou maior que zero."
        );

        return;
    }

    let added = 0;

    activeColors.forEach(
        color => {

            activeSizes.forEach(
                size => {

                    const exists =
                        productVariationsDraft.some(
                            variation =>
                                variation.colorId ===
                                    color.id &&
                                variation.sizeId ===
                                    size.id
                        );

                    if (exists) {
                        return;
                    }

                    productVariationsDraft.push({
                        variantId:
                            variantsCache.find(
                                variant =>
                                    variant.product_id ===
                                        editingProductId &&
                                    variant.color_id ===
                                        color.id &&
                                    variant.size_id ===
                                        size.id
                            )?.id ||
                            null,
                        colorId:
                            color.id,
                        colorName:
                            color.name ||
                            "",
                        colorHex:
                            color.hex_code ||
                            "#cccccc",
                        sizeId:
                            size.id,
                        sizeName:
                            size.name ||
                            "",
                        quantity
                    });

                    added++;
                }
            );
        }
    );

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
    } =
        await supabaseClient
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
                currentUser.id
            )
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

    await loadProductImages(
        productsCache.map(
            product =>
                product.id
        )
    );

    renderProducts();
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
                <div class="product-card-actions">
                    <button type="button" class="product-card-edit-button" data-edit-product-button="${product.id}">Editar</button>
                    <button type="button" class="product-card-sell-button" data-quick-sell-product="${product.id}" ${inactive || totalStock <= 0 ? "disabled" : ""}>Vender</button>
                    <button type="button" class="product-card-toggle-button" data-toggle-product="${product.id}">${inactive ? "Ativar" : "Desativar"}</button>
                    ${inactive ? `<button type="button" class="product-card-delete-button" data-delete-product="${product.id}">Excluir</button>` : ""}
                </div>
            </div>
        </article>
    `;
}


function renderProducts() {

    filterProducts({ target: $("productSearch") });
}


function resetProductForm() {

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

    editingProductActiveVariantIds =
        [];

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


async function loadProductForEdit(
    product
) {

    resetProductForm();

    editingProductId =
        product.id;

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
        product.cost_price ??
        0;

    $("productSalePrice").value =
        product.sale_price ??
        0;

    $("productMinimumStock").value =
        product.minimum_stock ??
        0;

    $("productActive").checked =
        product.is_active !==
        false;

    const {
        data:
            variants,
        error
    } =
        await supabaseClient
            .from(
                "product_variants"
            )
            .select(`
                id,
                product_id,
                color_id,
                size_id,
                stock_quantity,
                minimum_stock,
                is_active,
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
            .eq(
                "user_id",
                currentUser.id
            )
            .eq(
                "product_id",
                product.id
            )
            .order("id");

    if (error) {
        throw error;
    }

    editingProductActiveVariantIds =
        (
            variants || []
        )
            .filter(
                variant =>
                    variant.is_active !==
                    false
            )
            .map(
                variant =>
                    variant.id
            );

    productVariationsDraft =
        (
            variants || []
        )
            .filter(
                variant =>
                    variant.is_active !==
                    false
            )
            .map(
            variant => ({
                variantId:
                    variant.id,
                colorId:
                    variant.color_id,
                colorName:
                    variant.colors?.name ||
                    "Sem cor",
                colorHex:
                    variant.colors?.hex_code ||
                    "#cccccc",
                sizeId:
                    variant.size_id,
                sizeName:
                    variant.sizes?.name ||
                    "Sem tamanho",
                quantity:
                    Number(
                        variant.stock_quantity ||
                        0
                    )
            })
        );

    renderProductVariationOptions();
    renderProductVariationsList();

    renderExistingProductPhotos(
        productImagesCache[
            product.id
        ] || []
    );

    const title =
        document.querySelector(
            "#productModal [data-modal-title]"
        );

    if (title) {

        title.textContent =
            "Editar produto";
    }

    openModal(
        "productModal"
    );
}


function renderExistingProductPhotos(
    images
) {

    const container = $("productExistingPhotos");
    if (!container) return;

    if (
        !images.length
    ) {

        container.innerHTML =
            "";

        return;
    }

    container.innerHTML = `

        <div class="product-existing-photos-title">
            Fotos atuais
        </div>

        <div class="product-existing-photos-grid">

            ${images.map(
                (
                    image,
                    index
                ) => `

                <div class="product-existing-photo">

                    <img
                        src="${escapeHtml(
                            image.public_url
                        )}"
                        alt="Foto atual do produto"
                        loading="lazy"
                    >

                    <small>
                        ${
                            image.is_primary
                                ? "Principal"
                                : `Foto ${index + 1}`
                        }
                    </small>

                </div>
            `
            ).join("")}

        </div>
    `;
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

    resetProductForm();

    openModal(
        "productModal"
    );
}


async function saveProduct(
    event
) {

    event.preventDefault();

    if (productSaving) return;
    if (!currentUser) {
        return;
    }

    const button =
        event.submitter;

    const id =
        $("productId")
            .value
            .trim();

    const name =
        $("productName")
            .value
            .trim();

    const sku =
        $("productSku")
            .value
            .trim();

    const categoryId =
        $("productCategory")
            .value ||
        null;

    const description =
        $("productDescription")
            .value
            .trim();

    const costPrice =
        Number(
            $("productCostPrice")
                .value ||
            0
        );

    const salePrice =
        Number(
            $("productSalePrice")
                .value ||
            0
        );

    const minimumStock =
        Number(
            $("productMinimumStock")
                .value ||
            0
        );

    const isActive =
        $("productActive")
            .checked;

    if (!name) {

        showMessage(
            "productFormMessage",
            "Informe o nome do produto."
        );

        return;
    }

    if (
        costPrice < 0 ||
        salePrice < 0
    ) {

        showMessage(
            "productFormMessage",
            "Os preços não podem ser negativos."
        );

        return;
    }

    if (
        !Number.isInteger(
            minimumStock
        ) ||
        minimumStock < 0
    ) {

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

    productSaving = true;
    $("productForm").inert = true;
    $("productModal").setAttribute("aria-busy", "true");
    let createdProductId =
        null;

    let productAndVariantsCreated =
        false;

    try {

        const payload = {

            category_id:
                categoryId,

            name,

            sku:
                sku || null,

            description:
                description || null,

            cost_price:
                costPrice,

            sale_price:
                salePrice,

            minimum_stock:
                minimumStock,

            is_active:
                isActive
        };

        let product;

        if (!id) {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "products"
                    )
                    .insert({
                        ...payload,
                        user_id:
                            currentUser.id
                    })
                    .select()
                    .single();

            if (error) {
                throw error;
            }

            product =
                data;

            createdProductId =
                product.id;

            if (
                productVariationsDraft.length
            ) {

                const variants =
                    productVariationsDraft.map(
                        variation => ({
                            user_id:
                                currentUser.id,

                            product_id:
                                product.id,

                            color_id:
                                variation.colorId,

                            size_id:
                                variation.sizeId,

                            stock_quantity:
                                Number(
                                    variation.quantity ||
                                    0
                                ),

                            minimum_stock:
                                minimumStock,

                            is_active:
                                true
                        })
                    );

                const {
                    error:
                        variantsError
                } =
                    await supabaseClient
                        .from(
                            "product_variants"
                        )
                        .insert(
                            variants
                        );

                if (
                    variantsError
                ) {

                    throw new Error(
                        "Não foi possível criar as variações do produto. O produto será desfeito."
                    );
                }
            }

            productAndVariantsCreated =
                true;

        } else {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "products"
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
                        currentUser.id
                    )
                    .select()
                    .single();

            if (error) {
                throw error;
            }

            product =
                data;

            createdProductId =
                id;

            for (
                const variation
                of productVariationsDraft
            ) {

                if (
                    variation.variantId
                ) {

                    const {
                        error:
                            variantUpdateError
                    } =
                        await supabaseClient
                            .from(
                                "product_variants"
                            )
                            .update({
                                color_id:
                                    variation.colorId,

                                size_id:
                                    variation.sizeId,

                                stock_quantity:
                                    Number(
                                        variation.quantity ||
                                        0
                                    ),

                                minimum_stock:
                                    minimumStock,

                                is_active:
                                    true
                            })
                            .eq(
                                "id",
                                variation.variantId
                            )
                            .eq(
                                "user_id",
                                currentUser.id
                            )
                            .eq(
                                "product_id",
                                id
                            );

                    if (
                        variantUpdateError
                    ) {

                        throw variantUpdateError;
                    }

                } else {

                    const {
                        error:
                            newVariantError,
                        data: newVariant
                    } =
                        await supabaseClient
                            .from(
                                "product_variants"
                            )
                            .insert({
                                user_id:
                                    currentUser.id,

                                product_id:
                                    id,

                                color_id:
                                    variation.colorId,

                                size_id:
                                    variation.sizeId,

                                stock_quantity:
                                    Number(
                                        variation.quantity ||
                                        0
                                    ),

                                minimum_stock:
                                    minimumStock,

                                is_active:
                                    true
                            })
                            .select("id")
                            .single();

                    if (
                        newVariantError
                    ) {

                        throw newVariantError;
                    }
                    variation.variantId = newVariant.id;
                }
            }

            const retainedVariantIds =
                productVariationsDraft
                    .map(
                        variation =>
                            variation.variantId
                    )
                    .filter(Boolean);

            const removedVariantIds =
                editingProductActiveVariantIds
                    .filter(
                        variantId =>
                            !retainedVariantIds
                                .includes(
                                    variantId
                                )
                    );

            if (
                removedVariantIds.length
            ) {

                const {
                    error:
                        deactivateVariantsError
                } =
                    await supabaseClient
                        .from(
                            "product_variants"
                        )
                        .update({
                            is_active:
                                false
                        })
                        .eq(
                            "user_id",
                            currentUser.id
                        )
                        .eq(
                            "product_id",
                            id
                        )
                        .in(
                            "id",
                            removedVariantIds
                        );

                if (
                    deactivateVariantsError
                ) {
                    throw deactivateVariantsError;
                }
            }

            /*
             * Variações removidas do cadastro são somente
             * desativadas. Os registros permanecem intactos
             * para preservar vendas e movimentações antigas.
             */

            productAndVariantsCreated =
                true;
        }

        let photoResult = {
            uploaded: [],
            failed: []
        };

        if (
            productPhotosDraft.length
        ) {

            photoResult =
                await uploadProductImages(
                    product.id,
                    {
                        existingImages:
                            productImagesCache[
                                product.id
                            ] || []
                    }
                );
        }

        productSaving = false;
        closeModal(
            "productModal"
        );

        productVariationsDraft =
            [];

        clearProductPhotosDraft();

        editingProductId =
            null;

        editingProductActiveVariantIds =
            [];

        await Promise.all([
            loadProducts(),
            loadVariants(false)
        ]);

        renderProducts();
        await loadDashboard();

        if (
            photoResult.failed.length
        ) {

            const failedNames =
                photoResult.failed
                    .map(
                        item =>
                            item.fileName
                    )
                    .join(", ");

            alert(
                `Produto salvo com sucesso, mas ${photoResult.failed.length} foto(s) não puderam ser processadas ou enviadas.\n\nFoto(s): ${failedNames}`
            );
        }

    } catch (
        error
    ) {

        console.error(
            "Erro ao salvar produto:",
            error
        );

        if (
            !id &&
            createdProductId &&
            !productAndVariantsCreated
        ) {

            const {
                error:
                    cleanupError
            } =
                await supabaseClient
                    .from(
                        "products"
                    )
                    .delete()
                    .eq(
                        "id",
                        createdProductId
                    )
                    .eq(
                        "user_id",
                        currentUser.id
                    );

            if (
                cleanupError
            ) {

                console.error(
                    "Erro ao desfazer produto:",
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
        productSaving = false;
        $("productForm").inert = false;
        $("productModal").removeAttribute("aria-busy");
        setLoading(
            button,
            false
        );
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

async function toggleProductActive(
    productId
) {

    if (!currentUser) {
        return;
    }

    const product =
        productsCache.find(
            item =>
                item.id ===
                productId
        );

    if (!product) {
        return;
    }

    const nextActive =
        product.is_active ===
        false;

    const action =
        nextActive
            ? "ativar"
            : "desativar";

    if (
        !confirm(
            `Deseja ${action} o produto "${product.name}"?`
        )
    ) {
        return;
    }

    const {
        error
    } =
        await supabaseClient
            .from(
                "products"
            )
            .update({
                is_active:
                    nextActive
            })
            .eq(
                "id",
                productId
            )
            .eq(
                "user_id",
                currentUser.id
            );

    if (error) {
        console.error(
            "Erro ao alterar produto:",
            error
        );

        alert(
            "Não foi possível alterar o status do produto."
        );

        return;
    }

    await Promise.all([
        loadProducts(),
        loadVariants(false)
    ]);

    renderProducts();
    await loadDashboard();
}

async function deleteProduct(productId) {
    if (!currentUser) return;
    const product = productsCache.find(item => item.id === productId);
    if (!product) return;
    if (product.is_active !== false) {
        alert("Desative o produto antes de excluir. Produtos com variações ou fotos devem ser mantidos para preservar o histórico.");
        return;
    }
    try {
        const results = await Promise.all([
            supabaseClient.from("product_variants").select("id")
                .eq("user_id", currentUser.id).eq("product_id", productId).limit(1),
            supabaseClient.from("product_images").select("id")
                .eq("user_id", currentUser.id).eq("product_id", productId).limit(1)
        ]);
        for (const result of results) {
            if (result.error) throw result.error;
        }
        if (results.some(result => result.data?.length)) {
            alert("Este produto possui variações ou fotos. Mantenha-o desativado para preservar estoque, fotos e histórico.");
            return;
        }
        if (!confirm(`Excluir o cadastro vazio e inativo "${product.name}"? Esta ação não pode ser desfeita.`)) return;
        const { error } = await supabaseClient.from("products").delete()
            .eq("id", productId).eq("user_id", currentUser.id).eq("is_active", false);
        if (error) throw error;
        await loadProductsPage();
        await loadDashboard();
    } catch (error) {
        console.error("Erro ao excluir produto:", error);
        alert("Não foi possível excluir. Mantenha o produto desativado se houver vínculos com o histórico.");
    }
}


// =========================================================
// ESTOQUE
// =========================================================

async function loadVariants(includeImages = true) {

    if (!currentUser) {
        return;
    }

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "product_variants"
            )
            .select(`
                *,
                products (
                    id,
                    name,
                    sale_price,
                    cost_price,
                    minimum_stock,
                    is_active
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
            .eq(
                "user_id",
                currentUser.id
            );

    if (error) {

        console.error(
            "Erro ao carregar variações:",
            error
        );

        variantsCache =
            [];

        return;
    }

    variantsCache =
        data || [];

    const productIds =
        [
            ...new Set(
                variantsCache
                    .map(
                        variant =>
                            variant.products?.id
                    )
                    .filter(
                        Boolean
                    )
            )
        ];

    const allProductIds =
        [
            ...new Set([
                ...productIds,
                ...productsCache.map(
                    product =>
                        product.id
                )
            ])
        ];

    if (
        includeImages && allProductIds.length
    ) {

        await loadProductImages(
            allProductIds
        );
    }
}


function getOperationalVariants() {
    return variantsCache.filter(variant => {
        const product = productsCache.find(item => item.id === variant.product_id);
        return variant.is_active !== false &&
            (product || variant.products)?.is_active !== false;
    });
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
                    "stock-card-image"
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

                <small>
                    Status:
                    ${escapeHtml(
                        status.label
                    )}
                </small>

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


    resetSaleDraft();

    await Promise.all([
        loadProducts(),
        loadVariants(false)
    ]);

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


function renderSaleVariantPicker(
    productId
) {

    const container =
        $("saleVariantPicker");

    if (!container) {
        return;
    }

    const product =
        productsCache.find(
            item =>
                item.id ===
                productId
        );

    if (!product) {

        container.hidden =
            true;

        return;
    }

    const variants =
        getProductVariants(
            productId
        ).filter(
            variant =>
                variant.is_active !==
                    false &&
                Number(
                    variant.stock_quantity ||
                    0
                ) > 0
        );

    if (
        !variants.length
    ) {

        container.hidden =
            false;

        container.innerHTML = `
            <div class="empty-state compact">
                <strong>Sem estoque disponível</strong>
            </div>
        `;

        return;
    }

    container.hidden =
        false;

    container.innerHTML = `

        <div>

            <strong>
                ${escapeHtml(
                    product.name
                )}
            </strong>

            <button
                type="button"
                class="secondary-button small"
                data-sale-back-picker
                aria-label="Voltar para produtos"
            >
                Voltar
            </button>

        </div>

        <div>

            ${variants.map(
                variant => `

                <button
                    type="button"
                    class="sale-variant-picker-item"
                    data-sale-select-variant="${variant.id}"
                >

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

                    <span>
                        Estoque:
                        ${Number(
                            variant.stock_quantity ||
                            0
                        )}
                    </span>

                    <strong>
                        ${formatCurrency(
                            product.sale_price
                        )}
                    </strong>

                </button>
            `
            ).join("")}

        </div>
    `;
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

    if (!variant || variant.is_active === false) {
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
            "Esta variação está sem estoque."
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
                getProductMainImage(
                    product.id
                ),

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

    if (!currentUser) {
        return;
    }

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "sales"
            )
            .select("*")
            .eq(
                "user_id",
                currentUser.id
            )
            .order(
                "sale_date",
                {
                    ascending:
                        false
                }
            );

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
        salesCache.filter(
            sale =>
                sale.status !==
                    "cancelled" &&
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

        <div class="sale-card">

            <div>

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

                ${
                    cancelled
                        ? `
                        <small>
                            Cancelada
                        </small>
                        `
                        : `
                        <small>
                            ${escapeHtml(
                                formatPaymentMethod(
                                    sale.payment_method
                                )
                            )}
                        </small>
                        `
                }

            </div>

            <strong>
                ${formatCurrency(
                    sale.total
                )}
            </strong>

        </div>
    `;
}


function renderSales() {
    filterSales({ target: $("salesSearch") });
}


async function registerSale() {

    if (saleSubmitting) return;
    if (!currentUser) {
        return;
    }

    if (
        !saleDraft.length
    ) {

        showMessage(
            "saleFormMessage",
            "Adicione pelo menos um produto à venda."
        );

        return;
    }

    const paymentMethod =
        normalizePaymentMethod(
            $("salePaymentMethod")
                ?.value ||
            ""
        );

    if (!paymentMethod) {

        showMessage(
            "saleFormMessage",
            "Selecione a forma de pagamento."
        );

        return;
    }

    const summary =
        renderSaleSummary();

    if (
        summary.total <= 0
    ) {

        showMessage(
            "saleFormMessage",
            "O total da venda deve ser maior que zero."
        );

        return;
    }

    const registerButton =
        $("saleRegisterButton");

    setLoading(
        registerButton,
        true,
        "Registrando..."
    );

    saleSubmitting = true;
    $("saleManagementWorkspace").inert = true;
    $("saleModal").setAttribute("aria-busy", "true");
    const saleTimestamp = new Date();

    let saleId =
        null;

    const updatedVariants =
        [];

    let saleItemsInserted =
        false;

    let inventoryMovementsInserted =
        false;

    let financeInserted =
        false;

    try {

        /*
         * Revalida estoque antes de registrar.
         */

        for (
            const item
            of saleDraft
        ) {

            const {
                data:
                    currentVariant,
                error:
                    variantReadError
            } =
                await supabaseClient
                    .from(
                        "product_variants"
                    )
                    .select(`
                        id,
                        product_id,
                        stock_quantity,
                        is_active,
                        products (is_active)
                    `)
                    .eq(
                        "id",
                        item.variantId
                    )
                    .eq(
                        "user_id",
                        currentUser.id
                    )
                    .single();

            if (
                variantReadError ||
                !currentVariant
            ) {

                throw new Error(
                    `Não foi possível verificar o estoque de "${item.productName}".`
                );
            }

            if (currentVariant.is_active === false || currentVariant.products?.is_active === false) {
                throw new Error(`"${item.productName}" ou sua variação foi desativada. Reabra a venda para atualizar os produtos.`);
            }
            const currentStock =
                Number(
                    currentVariant.stock_quantity ||
                    0
                );

            if (
                item.quantity >
                currentStock
            ) {

                throw new Error(
                    `Estoque insuficiente para "${item.productName}" (${item.variantDescription}). Disponível: ${currentStock}.`
                );
            }

            item.currentStock =
                currentStock;
        }

        const saleNumber =
            await getNextSaleNumber();

        const notes =
            $("saleNotesInput")
                ?.value
                ?.trim() ||
            null;

        const {
            data:
                sale,
            error:
                saleError
        } =
            await supabaseClient
                .from(
                    "sales"
                )
                .insert({
                    user_id:
                        currentUser.id,

                    sale_number:
                        saleNumber,

                    sale_date:
                        saleTimestamp.toISOString(),

                    subtotal:
                        summary.subtotal,

                    discount:
                        summary.discount,

                    total:
                        summary.total,

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

        saleId =
            sale.id;

        const saleItems =
            saleDraft.map(
                item => ({

                    user_id:
                        currentUser.id,

                    sale_id:
                        sale.id,

                    product_variant_id:
                        item.variantId,

                    product_name:
                        item.productName,

                    variant_description:
                        item.variantDescription,

                    quantity:
                        item.quantity,

                    unit_price:
                        item.unitPrice,

                    unit_cost:
                        item.unitCost,

                    discount:
                        0,

                    total:
                        item.quantity *
                        item.unitPrice
                })
            );

        const {
            error:
                saleItemsError
        } =
            await supabaseClient
                .from(
                    "sale_items"
                )
                .insert(
                    saleItems
                );

        if (
            saleItemsError
        ) {
            throw saleItemsError;
        }

        saleItemsInserted =
            true;

        const movements =
            [];

        for (
            const item
            of saleDraft
        ) {

            const previousStock =
                Number(
                    item.currentStock ||
                    0
                );

            const newStock =
                previousStock -
                item.quantity;

            const {
                data:
                    updatedVariant,
                error:
                    stockError
            } =
                await supabaseClient
                    .from(
                        "product_variants"
                    )
                    .update({
                        stock_quantity:
                            newStock
                    })
                    .eq(
                        "id",
                        item.variantId
                    )
                    .eq(
                        "user_id",
                        currentUser.id
                    )
                    .eq(
                        "stock_quantity",
                        previousStock
                    )
                    .select()
                    .single();

            if (
                stockError ||
                !updatedVariant
            ) {

                throw new Error(
                    `O estoque de "${item.productName}" mudou enquanto a venda era registrada. A operação será desfeita.`
                );
            }

            updatedVariants.push({
                id:
                    item.variantId,

                previousStock,

                newStock
            });

            movements.push({
                user_id:
                    currentUser.id,

                product_variant_id:
                    item.variantId,

                movement_type:
                    "sale",

                quantity:
                    item.quantity,

                reference_id:
                    sale.id,

                reason:
                    `Venda #${saleNumber}`,

                notes:
                    item.variantDescription
            });
        }

        const {
            error:
                movementError
        } =
            await supabaseClient
                .from(
                    "inventory_movements"
                )
                .insert(
                    movements
                );

        if (
            movementError
        ) {
            throw movementError;
        }

        inventoryMovementsInserted =
            true;

        const {
            error:
                financeError
        } =
            await supabaseClient
                .from(
                    "financial_transactions"
                )
                .insert({
                    user_id:
                        currentUser.id,

                    transaction_type:
                        "income",

                    category:
                        "Venda",

                    description:
                        `Venda #${saleNumber}`,

                    amount:
                        summary.total,

                    transaction_date:
                        localDateKey(saleTimestamp),

                    payment_method:
                        paymentMethod,

                    reference_id:
                        sale.id,

                    notes
                });

        if (
            financeError
        ) {
            throw financeError;
        }

        financeInserted =
            true;

        saleSubmitting = false;
        closeModal(
            "saleModal"
        );

        resetSaleDraft();

        await Promise.all([
            loadProducts(),
            loadStock(),
            loadSales(),
            loadFinance()
        ]);

        await loadDashboard();

    } catch (
        error
    ) {

        console.error(
            "Erro ao registrar venda:",
            error
        );

        if (
            financeInserted &&
            saleId
        ) {

            await supabaseClient
                .from(
                    "financial_transactions"
                )
                .delete()
                .eq(
                    "user_id",
                    currentUser.id
                )
                .eq(
                    "reference_id",
                    saleId
                );
        }

        if (
            inventoryMovementsInserted &&
            saleId
        ) {

            await supabaseClient
                .from(
                    "inventory_movements"
                )
                .delete()
                .eq(
                    "user_id",
                    currentUser.id
                )
                .eq(
                    "reference_id",
                    saleId
                );
        }

        for (
            const variant
            of updatedVariants
        ) {

            await supabaseClient
                .from(
                    "product_variants"
                )
                .update({
                    stock_quantity:
                        variant.previousStock
                })
                .eq(
                    "id",
                    variant.id
                )
                .eq(
                    "user_id",
                    currentUser.id
                )
                .eq(
                    "stock_quantity",
                    variant.newStock
                );
        }

        if (
            saleItemsInserted &&
            saleId
        ) {

            await supabaseClient
                .from(
                    "sale_items"
                )
                .delete()
                .eq(
                    "user_id",
                    currentUser.id
                )
                .eq(
                    "sale_id",
                    saleId
                );
        }

        if (saleId) {

            await supabaseClient
                .from(
                    "sales"
                )
                .delete()
                .eq(
                    "id",
                    saleId
                )
                .eq(
                    "user_id",
                    currentUser.id
                );
        }

        showMessage(
            "saleFormMessage",
            error.message ||
            "Não foi possível registrar a venda. Confira os registros e o estoque antes de tentar novamente."
        );

    } finally {

        saleSubmitting = false;
        $("saleManagementWorkspace").inert = false;
        $("saleModal").removeAttribute("aria-busy");
        setLoading(
            registerButton,
            false
        );
    }
}


async function getNextSaleNumber() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "sales"
            )
            .select(
                "sale_number"
            )
            .eq(
                "user_id",
                currentUser.id
            )
            .order(
                "sale_number",
                {
                    ascending:
                        false
                }
            )
            .limit(1);

    if (error) {
        throw error;
    }

    const last =
        Number(
            data?.[0]
                ?.sale_number ||
            0
        );

    return last + 1;
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

    if (!currentUser) {
        return;
    }

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "financial_transactions"
            )
            .select("*")
            .eq(
                "user_id",
                currentUser.id
            )
            .order(
                "transaction_date",
                {
                    ascending:
                        false
                }
            );

    if (error) {

        console.error(
            "Erro ao carregar financeiro:",
            error
        );

        return;
    }

    financeCache =
        data || [];

    updateFinanceView();
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
            </div>
            <strong class="${income ? "income" : "expense"}">${income ? "+" : "−"} ${formatCurrency(transaction.amount)}</strong>
        </article>
    `;
}


function renderFinance() {
    filterFinance({ target: $("financeSearch") });
}


function openTransactionModal() {

    const form =
        $("transactionForm");

    if (!form) {
        return;
    }

    form.reset();

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

    if (
        !Number.isFinite(amount) || amount <= 0
    ) {

        showMessage(
            "transactionFormMessage",
            "Informe um valor maior que zero."
        );

        return;
    }

    if (!date) {
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
            await supabaseClient
                .from(
                    "financial_transactions"
                )
                .insert({
                    user_id:
                        currentUser.id,

                    transaction_type:
                        type,

                    category:
                        category ||
                        null,

                    description,

                    amount,

                    transaction_date:
                        date,

                    payment_method:
                        paymentMethod ||
                        null,

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

        await loadFinance();
        await loadDashboard();

    } catch (
        error
    ) {

        console.error(
            "Erro ao salvar lançamento:",
            error
        );

        showMessage(
            "transactionFormMessage",
            error.message ||
            "Não foi possível salvar o lançamento."
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
        salesCache.map(
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
                    "cancelled" &&
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

    renderRecentActivity();
}


// =========================================================
// EVENTOS
// =========================================================

function bindEvents() {

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
    // VARIAÇÕES
    // =================================================

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


    // =================================================
    // EVENTOS DE VARIAÇÃO
    // =================================================

    document.addEventListener(
        "click",
        event => {

            const removeVariation =
                event.target.closest(
                    "[data-remove-variation]"
                );

            if (
                removeVariation
            ) {

                removeProductVariation(
                    removeVariation
                        .dataset
                        .removeVariation
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

            if (
                quantityInput
            ) {

                updateProductVariationQuantity(
                    quantityInput
                        .dataset
                        .variationQuantity,
                    quantityInput.value
                );
            }
        }
    );


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

    document.addEventListener("keydown", event => {
        const modal = document.querySelector(".modal:not([hidden])");
        if (!modal) return;
        if (event.key === "Escape") {
            event.preventDefault();
            closeModal(modal.id);
        }
        if (event.key !== "Tab") return;
        const elements = [...modal.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
        )].filter(element => element.getClientRects().length && !element.closest("[inert]"));
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

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${iconSvg("bag")}</div>
                <strong>Nenhum produto encontrado</strong>
                <p>Tente outro termo de busca.</p>
            </div>
        `;

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

    renderStockCollection(
        filtered
    );
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

        container.innerHTML = `
            <div class="empty-state">
                <strong>Nenhum resultado</strong>
                <p>Nenhuma variação corresponde à busca.</p>
            </div>
        `;

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
                    sale.sale_number ||
                    ""
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

        container.innerHTML = `
            <div class="empty-state">
                <strong>Nenhuma venda encontrada</strong>
            </div>
        `;

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

        container.innerHTML = `
            <div class="empty-state">
                <strong>Nenhum lançamento encontrado</strong>
            </div>
        `;

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

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .auth
                .getSession();

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

        supabaseClient.auth
            .onAuthStateChange(
                async (
                    event,
                    session
                ) => {

                    console.log(
                        "Auth:",
                        event
                    );

                    if (
                        event ===
                            "SIGNED_IN" &&
                        session?.user
                    ) {

                        await showApplication(
                            session.user
                        );
                    }

                    if (
                        event ===
                        "SIGNED_OUT"
                    ) {

                        currentUser =
                            null;

                        appInitialized =
                            false;

                        currentSection =
                            "home";

                        $("appScreen").inert = false;
                        $("loginScreen").inert = false;
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

                        if (
                            $("appScreen")
                        ) {

                            $("appScreen")
                                .hidden =
                                true;
                        }

                        if (
                            $("loginScreen")
                        ) {

                            $("loginScreen")
                                .hidden =
                                false;
                        }
                    }
                }
            );

        /*
         * Finalmente verifica a sessão existente.
         */

        await checkSession();
    }
);
