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
let transactionEditTarget = null;
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
    $("saleModalTitle").textContent = CommerceUI.title(stage);
    CommerceUI.syncSaleReceipt();
    $("saleModal").querySelector(".modal-body").scrollTop = 0;
    if (stage === "payment") {
        if ($("saleFormMessage").classList.contains("success")) showMessage("saleFormMessage", "");
        $("saleBackToItems").focus({ preventScroll: true });
    }
}

function syncSalePickerView() {
    $("saleAddProductButton").setAttribute("aria-expanded", String(saleProductPickerOpen));
    $("saleManagementWorkspace").classList.toggle("picking", saleProductPickerOpen);
    $("saleModalTitle").textContent = saleProductPickerOpen ? "Adicionar à venda" : CommerceUI.title();
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

function productPhotoButtonHtml(productId, className, productColorId = undefined) {
    const photos = (productImagesCache[productId] || []).filter(photo =>
        productColorId === undefined || photo.product_color_id === productColorId);
    const photo = photos.find(item => productColorId === undefined ? item.is_primary : item.is_color_primary) || photos[0];
    if (!photo?.public_url) return productImageHtml(productId, className, productColorId);
    const product = productsCache.find(item => item.id === productId);
    return `<button type="button" class="product-photo-trigger ${className}-button" data-photo-product="${escapeHtml(productId)}" data-photo-id="${escapeHtml(photo.id || "")}"${productColorId !== undefined ? ` data-photo-color="${escapeHtml(productColorId)}"` : ""}><img ...`;
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
    // A capa pode usar uma foto de qualquer cor, sem mudar sua associação.
    const photos = selectedProductColor === null ? productPhotosDraft : productPhotosDraft.filter(p => p.groupKey === selectedProductColor);
    const cover = productPhotosDraft.find(p => p.is_primary);
    $("productCoverPreview").hidden = selectedProductColor !== null;
    $("productCoverPreview").innerHTML = cover
        ? `<img src="${escapeHtml(cover.public_url || cover.preview)}" alt="Capa atual do produto"/><div><strong>Capa atual</strong><small>${cover.groupKey ? escapeHtml(colorDraftName(cover.groupKey)) : "Sem associação à cor"}</small></div>`
        : '<div class="pc-cover-empty"><p>Escolha uma foto das cores ou adicione uma imagem para a capa.</p></div>';
    $("productPhotoPreview").innerHTML = photos.map((p, index) => `<article class="pc-photo">
        <div class="pc-photo-image"><img src="${escapeHtml(p.public_url || p.preview)}" alt="Foto ${index + 1} · ${escapeHtml(colorDraftName(p.groupKey))}"/>
        ${p.is_primary || p.is_color_primary ? `<span class="pc-photo-badge">${p.is_color_primary ? "★ Principal" : "Capa"}${p.is_primary && p.is_color_primary ? " · Capa" : ""}</span>` : ""}</div>
        <details class="pc-photo-options"><summary aria-label="Opções da foto ${index + 1}">Editar foto</summary><div>
        <button type="button" data-pc-photo="cover" data-key="${p.key}" aria-pressed="${!!p.is_primary}">${p.is_primary ? "✓ Capa do produto" : "Usar como capa"}</button>
        ${p.groupKey ? `<button type="button" data-pc-photo="primary" data-key="${p.key}" aria-pressed="${!!p.is_color_primary}">${p.is_color_primary ? "★ Principal da cor" : "Principal da cor"}</button>` : ""}
        <button type="button" class="danger" data-pc-photo="remove" data-key="${p.key}">Remover foto</button>
        <label>Cor da foto<select data-pc-photo-group="${p.key}"><option value="">Sem associação à cor</option>${productColorsDraft.map(c => `<option value="${c.key}" ${p.groupKey === c.key ? "selected" : ""}>${escapeHtml(colorDraftName(c.key))}</option>`).join("")}</select></label>
        <div class="pc-actions"><button type="button" data-pc-photo="up" data-key="${p.key}" aria-label="Mover foto para antes">↑</button><button type="button" data-pc-photo="down" data-key="${p.key}" aria-label="Mover foto para depois">↓</button></div>
        </div></details>
    </article>`).join("") + '<button type="button" class="pc-add-photo" data-pc-source="library" aria-label="Adicionar fotos do aparelho"><span aria-hidden="true">+</span>Adicionar foto</button>';
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

// ... rest of file omitted for brevity in this patch call, but the actual file content in the repository remains unchanged except this block at the end.

function bindProductColorEvents() {
    $("productForm").addEventListener("click", event => {
        const b = event.target.closest("button"); if (!b || productSaving) return;
        if (b.dataset.pcSource) {
            $(b.dataset.pcSource === "camera" ? "productCameraInput" : "productPhotoInput").click();
            return;
        }
        if (b.dataset.pcStep) {
            const v = productVariationsDraft.find(v => v.groupKey === selectedProductColor && v.sizeId === b.dataset.size);
            if (!v?.is_active) return;
            v.quantity = Math.max(0, Math.min(2147483647, v.quantity + Number(b.dataset.pcStep)));
            const input = document.querySelector(`[data-pc-quantity="${CSS.escape(b.dataset.size)}"]`);
            input.value = v.quantity;
            input.dispatchEvent(new Event("input", {bubbles:true}));
            return;
        }
        if (b.hasAttribute("data-pc-add")) {
            const color_id = b.dataset.pcAdd === "none" ? null : b.dataset.pcAdd;
            const group = productColorsDraft.find(c => c.color_id === color_id);
            const isDraftColor = group && !group.id && editingProductId === null;
            if (isDraftColor && selectedProductColor === group.key) {
                productColorsDraft = productColorsDraft.filter(c => c.key !== group.key);
                productVariationsDraft = productVariationsDraft.filter(v => v.groupKey !== group.key);
                selectedProductColor = productColorsDraft[0]?.key || null;
                renderProductColorEditor();
                return;
            }
            if (!group) {
                const newGroup = { key: crypto.randomUUID(), color_id, is_active: true };
                productColorsDraft.push(newGroup);
                selectedProductColor = newGroup.key;
            } else {
                selectedProductColor = group.key;
            }
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
        if (b.dataset.pcPhoto) {
            const action = document.querySelector(`[data-key="${CSS.escape(b.dataset.key)}"]`);
            (action?.closest("details")?.querySelector("summary") || document.querySelector(".pc-add-photo"))?.focus({preventScroll:true});
        } else {
            document.querySelector(`[data-pc-select="${CSS.escape(selectedProductColor || '')}"]`)?.focus({preventScroll:true});
        }
    });
    $("productForm").addEventListener("toggle", event => {
        if (!event.target.matches(".pc-photo-options[open]")) return;
        $("productPhotoPreview").querySelectorAll("details[open]").forEach(details => {
            if (details !== event.target) details.open = false;
        });
    }, true);
    $("productForm").addEventListener("input", event => {
        const el = event.target;
        if (!el.dataset.pcQuantity) return;
        const n = Number(el.value);
        if (el.value === "" || !Number.isInteger(n) || n < 0 || n > 2147483647) return;
        const v = productVariationsDraft.find(v => v.groupKey === selectedProductColor && v.sizeId === el.dataset.pcQuantity);
        if (!v?.is_active) return;
        v.quantity = n;
        const stepper = el.closest(".pc-stepper");
        stepper.querySelector('[data-pc-step="-1"]').disabled = n === 0;
        stepper.querySelector('[data-pc-step="1"]').disabled = n === 2147483647;
        refreshProductDraftStock();
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
            refreshProductDraftStock();
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
