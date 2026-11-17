// Operações da loja: uma intenção, uma transação e uma confirmação persistente.
const CommerceUI = (() => {
    let capability = null, capabilityUser = null, busy = false, saleEdit = null;
    let entryContext = null, deleteTarget = null, currentDetail = null, modalSubmit = null, saleNewStamp = null;
    let purchases = [], purchaseEdit = null, purchaseDraft = [], purchaseMeta = {}, detailSequence = 0, purchasesReliable = false;
    let financeReliable = false, salesReliable = false;
    function markLoaded(kind, loaded) { if (kind === "finance") financeReliable = loaded; if (kind === "sale") salesReliable = loaded; }
    const el = id => document.getElementById(id);
    const money = value => value === null || !Number.isFinite(Number(value ?? 0)) ? "Conferir valor" : formatCurrency(Number(value || 0));
    const number = value => parseFinanceAmount(String(value ?? "").trim() || "0");
    const cents = value => Math.round((Number(value) + Number.EPSILON) * 100);
    const decimal = value => Number(value || 0).toFixed(2).replace(".", ",");
    const escape = value => escapeHtml(value);
    const revision = state => Number(state?.revision ?? state?.sale?.edit_revision ?? state?.document?.edit_revision ?? 0);
    const missing = error => ["PGRST202", "42883"].includes(error?.code);
    const optionMethods = value => [["", "Selecione"], ["pix", "Pix"], ["cash", "Dinheiro"], ["credit_card", "Cartão de crédito"], ["debit_card", "Cartão de débito"], ["transfer", "Transferência"], ["other", "Outro"]].map(([id,label]) => `<option value="${id}" ${value === id ? "selected" : ""}>${label}</option>`).join("");

    function dateISO(date, original = null) {
        const key = date || todayISO();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error("Informe uma data válida.");
        if (original && localDateKey(original) === key) return original;
        const [year, month, day] = key.split("-").map(Number);
        const clock = original ? new Date(original) : null;
        const result = new Date(year, month - 1, day, clock ? clock.getHours() : 12, clock ? clock.getMinutes() : 0, clock ? clock.getSeconds() : 0, clock ? clock.getMilliseconds() : 0);
        if (localDateKey(result) !== key) throw new Error("Informe uma data válida.");
        return result.toISOString();
    }

    function source(entry) {
        if (entry.source_kind) return entry.source_kind;
        if (!entry.reference_id) return "manual";
        if (salesCache.some(sale => sale.id === entry.reference_id)) return "sale";
        if (purchases.some(document => document.id === entry.reference_id)) return "purchase";
        return "legacy";
    }

    function settlement(kind, document, entries = financeCache) {
        const linked = entries.filter(entry => entry.reference_id === document.id && source(entry) === kind);
        const reliable = Number.isFinite(Number(document.total)) && Number(document.total) >= 0 && linked.every(validEntry);
        if (!reliable) return {document_total: document.total, total:null, received:null, paid:null, pending:null, refund_due:null, reliable:false, warnings:["Há valores antigos que precisam ser conferidos."]};
        const total = document.status === "cancelled" ? 0 : cents(document.total || 0);
        const paid = linked
            .reduce((sum, entry) => sum + cents(entry.amount) * ((entry.transaction_type === "income") === (kind === "sale") ? 1 : -1), 0);
        return { document_total: Number(document.total || 0), total: total / 100, received: paid / 100, paid: paid / 100,
            pending: document.status === "cancelled" ? 0 : Math.max(0, total - paid) / 100, refund_due: Math.max(0, paid - total) / 100, reliable:true };
    }

    function validEntry(entry) { return Number.isFinite(Number(entry.amount)) && Number(entry.amount) > 0 && ["income", "expense"].includes(entry.transaction_type) && Number.isFinite(new Date(entry.transaction_date).getTime()); }
    function renderPendingNotice() {
        const notice = el("commercePendingNotice");
        if (notice) notice.hidden = !currentUser || (!pendingRequests().length && !localStorage.getItem(`mabijufit-pending-sale:${currentUser?.id}`));
    }

    async function ensureReady(required = true) {
        const user = currentUser?.id;
        if (!user) throw new Error("Entre novamente para continuar.");
        if (capabilityUser !== user) { capabilityUser = user; capability = null; purchases = []; }
        if (capability !== true) {
            const generation = sessionGeneration;
            const result = await sessionClient(user, generation).rpc("pc_commerce_info", {});
            if (result.error) {
                if (missing(result.error)) capability = false;
                else throw result.error;
            } else capability = Number(result.data?.version) === 1;
        }
        if (!capability && required) throw new Error("A atualização do sistema ainda está pendente. Seus dados continuam disponíveis para consulta.");
        return capability === true;
    }

    function pendingPrefix() { return `mabijufit-commerce-pending:${currentUser?.id}:`; }
    function pendingRequests() {
        const prefix = pendingPrefix();
        return Object.keys(localStorage).filter(key => key.startsWith(prefix)).map(key => {
            try { return { key, ...JSON.parse(localStorage.getItem(key)) }; } catch { return null; }
        }).filter(Boolean);
    }

    async function mutate(action, payload) {
        await ensureReady();
        const user = currentUser.id, generation = sessionGeneration;
        const identity = payload.id || payload.reference_id || payload.args?.p_product_id || "new";
        const key = `${pendingPrefix()}${action}:${identity}`;
        const saved = localStorage.getItem(key);
        let request = saved ? JSON.parse(saved) : null;
        if (request && JSON.stringify(request.payload) !== JSON.stringify(payload)) {
            throw new Error("Existe uma tentativa anterior sem confirmação. Use Conferir tentativa pendente antes de alterar os campos e salvar outra vez.");
        }
        if (!request) {
            request = { request_id: crypto.randomUUID(), action, payload, created_at: new Date().toISOString() };
            localStorage.setItem(key, JSON.stringify(request));
            renderPendingNotice();
        }
        const { data, error } = await sessionClient(user, generation).rpc("pc_commerce", {
            p_request_id: request.request_id, p_action: action, p_payload: payload
        });
        if (error) {
            if (isConfirmedRpcRejection(error)) { localStorage.removeItem(key); renderPendingNotice(); }
            throw error;
        }
        if (!data || data.request_id !== request.request_id) throw new Error("A operação ficou sem confirmação. Confira a tentativa pendente; ela não será enviada como uma nova operação.");
        localStorage.removeItem(key);
        renderPendingNotice();
        return data;
    }

    async function readState(kind, id) {
        const enabled = await ensureReady(false);
        const client = sessionClient(currentUser.id, sessionGeneration);
        if (enabled) {
            const { data, error } = await client.rpc("pc_commerce_state", { p_kind: kind, p_id: id });
            if (error) throw error;
            if (!data?.sale && !data?.document) throw new Error("Não foi possível encontrar este registro.");
            return data;
        }
        if (kind !== "sale") throw new Error("A atualização das compras ainda está pendente.");
        const [sale, items] = await Promise.all([
            client.from("sales").select("*").eq("user_id", currentUser.id).eq("id", id).single(),
            fetchAllRows(() => client.from("sale_items").select("*").eq("user_id", currentUser.id).eq("sale_id", id))
        ]);
        if (sale.error || items.error || !sale.data) throw sale.error || items.error || new Error("Venda não encontrada.");
        const entries = financeCache.filter(entry => entry.reference_id === id);
        return { kind, id, sale: sale.data, items: items.data, entries, settlement: settlement(kind, sale.data, entries), readOnly: true };
    }

    async function loadPurchases(quiet = true) {
        try {
            if (!await ensureReady(false)) { purchases = []; purchasesReliable = false; renderBalances(); return; }
            const user = currentUser.id, generation = sessionGeneration;
            const result = await fetchAllRows(() => sessionClient(user, generation).from("purchase_documents").select("*").eq("user_id", user).order("document_date", { ascending: false }));
            if (result.error) throw result.error;
            if (currentUser?.id !== user || generation !== sessionGeneration) return;
            purchases = result.data || [];
            purchasesReliable = true;
            renderBalances();
        } catch (error) { purchasesReliable = false; showDataLoadError(); renderBalances(); if (!quiet) throw error; }
    }

    async function refresh() {
        await Promise.all([loadProducts(), loadSales(), loadStock(), loadFinance(), loadPurchases()]);
        renderProducts(); renderStock(); renderSales(); updateFinanceView(); renderBalances(); renderPendingNotice();
        await loadDashboard();
    }

    function report(id, error) {
        const message = error?.code === "40001"
            ? "Este registro mudou em outro aparelho. Seu rascunho foi mantido. Confira o registro atualizado antes de salvar novamente."
            : error?.message || "Não foi possível concluir. Confira a conexão e tente novamente.";
        showMessage(id, message);
    }

    function resetSale() {
        saleEdit = null;
        saleNewStamp = dateISO(todayISO());
        if (!el("saleDate")) return;
        el("saleDate").value = todayISO(); el("saleCustomerName").value = ""; el("saleDueDate").value = "";
        el("saleReceiptMode").value = "full"; el("saleInitialReceived").value = "";
        el("saleReceiptFields").hidden = false; el("saleExistingSettlement").hidden = true;
        el("saleCreditDetails").open = false; delete el("saleCreditDetails").dataset.receiptState;
        el("saleRegisterButton").textContent = "Registrar venda";
        el("salePendingRetry").hidden = !pendingRequests().length && !localStorage.getItem(`mabijufit-pending-sale:${currentUser?.id}`);
        syncSaleReceipt();
    }

    function title(stage = "items") {
        return saleEdit ? `Editar venda #${saleEdit.sale.sale_number}` : stage === "payment" ? "Conferir venda" : "Nova venda";
    }

    function saleStock(variant) {
        return Number(variant.stock_quantity || 0) + (saleEdit?.items || []).filter(item => item.product_variant_id === variant.id).reduce((sum,item) => sum + Number(item.quantity), 0);
    }

    function saleTotals() {
        const subtotalCents = saleDraft.reduce((sum, item) => sum + cents(item.unitPrice) * Number(item.quantity), 0);
        const discount = number(el("saleDiscountInput")?.value || 0);
        const valid = Number.isFinite(subtotalCents) && Number.isFinite(discount) && discount >= 0 && cents(discount) <= subtotalCents;
        return { subtotal: subtotalCents / 100, discount, total: valid ? (subtotalCents - cents(discount)) / 100 : 0, valid };
    }

    function syncSaleReceipt() {
        if (!el("saleReceiptMode")) return;
        const totals = saleTotals(), mode = el("saleReceiptMode").value;
        el("saleInitialReceivedGroup").hidden = mode !== "partial";
        const details = el("saleCreditDetails"), state = saleEdit ? "edit:" + saleEdit.id : mode;
        if (details.dataset.receiptState !== state) {
            details.open = saleEdit ? !!(saleEdit.sale.customer_name || saleEdit.sale.due_date || saleEdit.settlement?.pending > 0) : mode !== "full";
            details.dataset.receiptState = state;
        }
        const methodGroup = el("salePaymentMethod").closest(".sale-payment");
        methodGroup.hidden = el("saleBackToItems").hidden || !!saleEdit || mode === "pending" || totals.total === 0;
        if (saleEdit) {
            if (saleEdit.settlement?.reliable === false) { el("saleExistingSettlement").textContent = "Conferir os pagamentos antigos nos detalhes da venda. O saldo ainda não pode ser calculado."; return; }
            const paid = cents(saleEdit.settlement?.received || 0), total = cents(totals.total);
            el("saleExistingSettlement").innerHTML = `<strong>Já recebido: ${money(paid / 100)}</strong><span>${paid > total ? `A devolver: ${money((paid - total) / 100)}` : `Falta receber: ${money((total - paid) / 100)}`}</span><small>Os recebimentos já registrados são preservados. Corrija um recebimento nos detalhes da venda quando necessário.</small>`;
        }
    }

    async function editSale(id) {
        try {
            await ensureReady();
            const state = await readState("sale", id);
            if (state.sale.status === "cancelled") throw new Error("Uma venda cancelada permanece no histórico. Registre uma nova venda se necessário.");
            await Promise.all([loadProducts(), loadVariants(false)]);
            resetSaleDraft(); saleEdit = state;
            const active = new Set(getOperationalVariants().map(variant => variant.id));
            saleDraft = state.items.map(item => {
                const variant = variantsCache.find(row => row.id === item.product_variant_id);
                const product = productsCache.find(row => row.id === variant?.product_id);
                const original = Number(item.quantity);
                return { variantId: item.product_variant_id, productId: variant?.product_id,
                    productName: item.product_name, productImage: variant ? getProductColorImage(variant.product_id, variant.product_color_id) : null,
                    variantDescription: item.variant_description || "Cor e tamanho do registro original", quantity: original,
                    stock: active.has(item.product_variant_id) ? Number(variant?.stock_quantity || 0) + original : original,
                    originalQuantity: original, inactive: !active.has(item.product_variant_id),
                    unitPrice: Number(item.unit_price), unitCost: Number(item.unit_cost || product?.cost_price || 0) };
            });
            el("saleDiscountInput").value = decimal(state.sale.discount);
            el("saleNotesInput").value = state.sale.notes || ""; el("saleDate").value = localDateKey(state.sale.sale_date);
            el("saleCustomerName").value = state.sale.customer_name || ""; el("saleDueDate").value = state.sale.due_date || "";
            el("salePaymentMethod").value = normalizePaymentMethod(state.sale.payment_method);
            el("saleReceiptFields").hidden = true; el("saleExistingSettlement").hidden = false;
            el("saleRegisterButton").textContent = "Salvar alterações";
            renderSaleItems(); renderSaleSummary(); setSaleStage("items"); openModal("saleModal");
        } catch (error) { showToast(error.message || "Não foi possível abrir a venda."); }
    }

    async function saveSale() {
        if (saleSubmitting || !currentUser) return;
        const generation = sessionGeneration, button = el("saleRegisterButton");
        try {
            const totals = saleTotals();
            if (!saleDraft.length) throw new Error("Adicione ao menos um produto. Para devolver a venda inteira, use Cancelar venda.");
            if (!totals.valid) throw new Error("Confira o desconto. Ele deve ficar entre zero e o subtotal.");
            if (saleDraft.some(item => !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) throw new Error("Confira os preços e as quantidades dos produtos.");
            const mode = el("saleReceiptMode").value;
            const received = saleEdit || mode === "pending" ? 0 : mode === "full" ? totals.total : number(el("saleInitialReceived").value);
            if (!saleEdit && (!Number.isFinite(received) || received < 0 || received > totals.total || (mode === "partial" && received <= 0))) throw new Error("Informe quanto recebeu, até o total da venda.");
            const payment = normalizePaymentMethod(el("salePaymentMethod").value);
            if (received > 0 && !payment) throw new Error("Selecione como recebeu o pagamento.");
            const payload = { id: saleEdit?.id || null, expected_revision: saleEdit ? revision(saleEdit) : null,
                items: saleDraft.map(item => ({ variant_id: item.variantId, quantity: item.quantity, unit_price: item.unitPrice })),
                discount: totals.discount, notes: el("saleNotesInput").value.trim() || null,
                sale_date: dateISO(el("saleDate").value, saleEdit?.sale.sale_date || saleNewStamp), customer_name: el("saleCustomerName").value.trim() || null,
                due_date: el("saleDueDate").value || null, payment_method: payment || null };
            if (!saleEdit) { payload.initial_received = received; payload.payment_date = payload.sale_date; }
            saleSubmitting = true; el("saleManagementWorkspace").inert = true; setLoading(button, true, "Salvando…");
            const result = await mutate("sale_save", payload);
            if (generation !== sessionGeneration) return;
            saleSubmitting = false; closeModal("saleModal"); resetSaleDraft(); await refresh();
            await openDetails("sale", result.id || result.sale?.id);
            showToast(result.replayed ? "Venda já confirmada. Nenhuma duplicação foi feita." : "Venda salva e saldos atualizados.");
        } catch (error) { if (generation === sessionGeneration) { report("saleFormMessage", error); el("salePendingRetry").hidden = !pendingRequests().length; } }
        finally { if (generation === sessionGeneration) { saleSubmitting = false; el("saleManagementWorkspace").inert = false; setLoading(button, false); } }
    }

    function balanceHtml(state) {
        const kind = state.kind, sale = kind === "sale", status = state.sale || state.document, value = state.settlement;
        if (value.reliable === false) return `<div class="form-message error"><strong>Conferir valores e pagamentos</strong><p>${escape((state.warnings || value.warnings || ["Há registros antigos inválidos. Corrija os pagamentos abaixo antes de continuar."]).join(" "))}</p></div>`;
        return `<div class="commerce-settlement"><div><span>${status.status === "cancelled" ? "Total cancelado" : "Total"}</span><strong>${money(value.document_total ?? status.total)}</strong></div><div><span>${sale ? "Recebido" : "Pago"}</span><strong>${money(sale ? value.received : value.paid)}</strong></div><div class="${value.refund_due > 0 ? "expense" : "income"}"><span>${value.refund_due > 0 ? (sale ? "A devolver à cliente" : "A receber do fornecedor") : sale ? "Falta receber" : "Falta pagar"}</span><strong>${money(value.refund_due > 0 ? value.refund_due : value.pending)}</strong></div></div>`;
    }

    async function openDetails(kind, id) {
        const sequence = ++detailSequence, generation = sessionGeneration;
        el("saleDetailsTitle").textContent = kind === "sale" ? "Detalhes da venda" : "Detalhes da compra";
        el("saleDetailsContent").replaceChildren(); showMessage("saleDetailsMessage", "Carregando…", "info");
        openModal("saleDetailsModal");
        try {
            const state = await readState(kind, id);
            if (sequence !== detailSequence || generation !== sessionGeneration || el("saleDetailsModal").hidden) return;
            currentDetail = state;
            const sale = kind === "sale", document = state.sale || state.document, cancelled = document.status === "cancelled";
            const name = sale ? `Venda #${document.sale_number}` : "Compra de produtos";
            el("saleDetailsTitle").textContent = name;
            const party = sale ? document.customer_name : document.supplier_name;
            el("saleDetailsContent").innerHTML = `<span class="status-badge ${cancelled ? "zero" : state.settlement.pending > 0 ? "low" : "normal"}">${state.settlement.reliable === false ? "Conferir valores" : cancelled ? "Cancelada" : state.settlement.refund_due > 0 ? "Há valor a devolver" : state.settlement.pending > 0 ? sale ? "A receber" : "A pagar" : sale ? "Paga" : "Paga"}</span>
                <dl class="sale-details-summary"><div><dt>Data</dt><dd>${escape(formatLocalDateTime(sale ? document.sale_date : document.document_date))}</dd></div>${party ? `<div><dt>${sale ? "Cliente" : "Fornecedor"}</dt><dd>${escape(party)}</dd></div>` : ""}${document.due_date ? `<div><dt>Vencimento</dt><dd>${escape(formatLocalDate(document.due_date))}</dd></div>` : ""}</dl>
                ${balanceHtml(state)}<h3>Produtos</h3><ul class="sale-details-items">${state.items.map(item => `<li><strong>${escape(item.product_name)}</strong><span>${escape(item.variant_description || "")}</span><span>${Number(item.quantity)} un. × ${money(sale ? item.unit_price : item.unit_cost)}</span><strong>${money(item.total)}</strong></li>`).join("")}</ul>
                ${sale && Number(document.discount) ? `<p>Desconto: ${money(document.discount)}</p>` : ""}${!sale && Number(document.extra_cost) ? `<p>Frete e outros custos: ${money(document.extra_cost)}</p>` : ""}
                ${document.notes ? `<h3>Observações</h3><p class="sale-details-text">${escape(document.notes)}</p>` : ""}
                ${state.readOnly ? '<p class="form-message info">Atualização pendente. Este registro está disponível para consulta.</p>' : `<div class="commerce-action-grid">${!cancelled ? `<button type="button" class="secondary-button" data-commerce-edit="${kind}" data-commerce-id="${escape(id)}">Editar ${sale ? "venda" : "compra"}</button>` : ""}${!cancelled && state.settlement.pending > 0 ? `<button type="button" class="primary-button" data-commerce-payment="${kind}" data-commerce-id="${escape(id)}">${sale ? "Receber pagamento" : "Registrar pagamento"}</button>` : ""}${state.settlement.refund_due > 0 ? `<button type="button" class="secondary-button" data-commerce-refund="${kind}" data-commerce-id="${escape(id)}">${sale ? "Registrar devolução do valor" : "Receber reembolso"}</button>` : ""}${!cancelled ? `<button type="button" class="text-button danger" data-commerce-cancel="${kind}" data-commerce-id="${escape(id)}">Cancelar ${sale ? "venda" : "compra"}</button>` : ""}</div>`}
                <h3>${sale ? "Recebimentos e devoluções" : "Pagamentos e reembolsos"}</h3><p class="field-hint">Corrigir um pagamento altera o saldo em aberto. Os produtos e o total são corrigidos em Editar ${sale ? "venda" : "compra"}.</p>
                ${state.entries.length ? `<div class="commerce-entry-list">${state.entries.map(entry => `<article><div><strong class="${entry.transaction_type === "income" ? "income" : "expense"}">${entry.transaction_type === "income" ? "+" : "−"} ${money(entry.amount)}</strong><small>${escape(formatLocalDate(entry.transaction_date))} · ${escape(formatPaymentMethod(entry.payment_method))}</small></div>${state.readOnly ? "" : `<div class="commerce-action-grid"><button type="button" class="secondary-button" data-commerce-edit-entry="${escape(entry.id)}">Corrigir pagamento</button><button type="button" class="text-button danger" data-commerce-delete-entry="${escape(entry.id)}">Excluir registro</button></div>`}</article>`).join("")}</div>` : '<p class="muted">Nenhum pagamento registrado.</p>'}
                ${cancelled ? `<p>Cancelada em ${escape(formatLocalDateTime(document.cancelled_at))}. ${escape(document.cancellation_reason || "")}</p>` : ""}`;
            showMessage("saleDetailsMessage", "");
        } catch (error) { if (sequence === detailSequence && generation === sessionGeneration) report("saleDetailsMessage", error); }
    }

    function resetEntry() { entryContext = { source_kind: "manual", reference_id: null, entry: null, seedDate: dateISO(todayISO()) }; }

    async function openEntry(kind, id, direction, entry = null) {
        try {
            await ensureReady();
            let state = null;
            if (kind !== "manual" && kind !== "legacy") state = await readState(kind, id);
            openTransactionModal(direction || entry?.transaction_type || "income");
            entryContext = { source_kind: kind, reference_id: id || null, entry, state, seedDate: dateISO(todayISO()) };
            transactionEditTarget = entry ? { id: entry.id, original: entry, userId: currentUser.id, generation: sessionGeneration } : null;
            el("transactionModalTitle").textContent = entry ? "Corrigir pagamento" : kind === "sale" ? direction === "income" ? "Receber pagamento" : "Devolver valor à cliente" : kind === "purchase" ? direction === "expense" ? "Pagar fornecedor" : "Receber reembolso" : "Novo lançamento";
            el("transactionType").disabled = !["manual", "legacy"].includes(kind) && ["income", "expense"].includes(direction || entry?.transaction_type);
            el("transactionType").value = direction || entry?.transaction_type || "income";
            el("transactionAmount").value = entry ? Number.isFinite(Number(entry.amount)) ? decimal(entry.amount) : "" : state ? decimal((direction === "income") === (kind === "sale") ? state.settlement.pending : state.settlement.refund_due) : "";
            el("transactionDescription").value = entry?.description || ""; el("transactionCategory").value = entry?.category || "";
            el("transactionDate").value = entry ? localDateKey(entry.transaction_date) : todayISO();
            el("transactionPaymentMethod").value = normalizePaymentMethod(entry?.payment_method || "");
            el("transactionNotes").value = entry?.notes || "";
            el("transactionEditHint").hidden = kind === "manual";
            el("transactionEditHint").textContent = kind === "sale" ? "Este registro informa quanto foi recebido ou devolvido. O saldo da venda será recalculado, sem alterar os produtos." : "Este registro informa quanto foi pago ou reembolsado. O saldo da compra será recalculado, sem alterar o estoque.";
            el("transactionForm").querySelector('[type="submit"]').textContent = entry ? "Salvar correção" : "Salvar pagamento";
            if (kind === "legacy") {
                el("transactionModalTitle").textContent = "Conferir lançamento antigo";
                el("transactionEditHint").hidden = false;
                el("transactionEditHint").textContent = "A origem deste registro antigo não foi identificada. Ao salvar, ele será convertido em lançamento manual com os valores que você conferir aqui. Isso altera somente o caixa; o estoque permanece igual. A referência antiga será preservada no histórico da correção.";
                el("transactionForm").querySelector('[type="submit"]').textContent = "Salvar como lançamento manual";
            }
        } catch (error) { showToast(error.message); }
    }

    async function editEntry(id) {
        const entry = financeCache.find(row => row.id === id) || currentDetail?.entries?.find(row => row.id === id);
        if (!entry || entry.user_id !== currentUser?.id) return showToast("Pagamento não encontrado nesta conta.");
        const kind = source(entry);
        return openEntry(kind, entry.reference_id, entry.transaction_type, entry);
    }

    async function saveEntry(event) {
        event.preventDefault();
        if (transactionSaving || !currentUser) return;
        const generation = sessionGeneration, context = entryContext || { source_kind: "manual", reference_id: null, entry: null };
        const button = event.submitter || el("transactionForm").querySelector('[type="submit"]');
        try {
            const amount = number(el("transactionAmount").value), type = el("transactionType").value;
            if (!Number.isFinite(amount) || amount <= 0) throw new Error("Informe um valor maior que zero.");
            if (!["income", "expense"].includes(type)) throw new Error("Selecione Entrada ou Saída.");
            const payload = { id: context.entry?.id || null, expected_revision: context.entry ? Number(context.entry.edit_revision || 0) : null,
                source_kind: context.source_kind, reference_id: context.reference_id, transaction_type: type, amount,
                transaction_date: dateISO(el("transactionDate").value, context.entry?.transaction_date || context.seedDate),
                payment_method: normalizePaymentMethod(el("transactionPaymentMethod").value) || null,
                category: el("transactionCategory").value.trim() || null, description: el("transactionDescription").value.trim() || null,
                notes: el("transactionNotes").value.trim() || null };
            transactionSaving = true; el("transactionForm").inert = true; setLoading(button, true, "Salvando…");
            const legacy = context.source_kind === "legacy";
            if (legacy) { delete payload.source_kind; delete payload.reference_id; }
            const result = await mutate(legacy ? "entry_detach_legacy" : "entry_save", payload);
            if (generation !== sessionGeneration) return;
            transactionSaving = false; closeModal("transactionModal"); await refresh();
            if (["sale", "purchase"].includes(context.source_kind)) await openDetails(context.source_kind, context.reference_id);
            showToast(result.replayed ? "Pagamento já confirmado. Nenhuma duplicação foi feita." : "Lançamento salvo e saldo atualizado.");
        } catch (error) { if (generation === sessionGeneration) report("transactionFormMessage", error); }
        finally { if (generation === sessionGeneration) { transactionSaving = false; el("transactionForm").inert = false; setLoading(button, false); } }
    }

    function openDeleteEntry(id) {
        const entry = financeCache.find(row => row.id === id) || currentDetail?.entries?.find(row => row.id === id);
        if (!entry || entry.user_id !== currentUser?.id || source(entry) === "legacy") return showToast("Não foi possível encontrar a origem deste lançamento.");
        deleteTarget = entry;
        el("deleteFinanceSummary").textContent = `${entry.description || "Pagamento"} · ${money(entry.amount)}`;
        el("deleteFinanceExplanation").textContent = source(entry) === "manual" ? "O lançamento será retirado do caixa e o saldo será recalculado." : "Use esta opção para um pagamento registrado por engano. O saldo em aberto será recalculado; produtos e estoque permanecem iguais. Para registrar dinheiro que foi devolvido, use a ação de devolução na origem.";
        el("deleteFinanceConfirm").hidden = false; showMessage("deleteFinanceMessage", ""); openModal("deleteFinanceModal");
    }

    async function deleteEntry(event) {
        event.preventDefault();
        if (financeDeleting || !deleteTarget) return;
        const entry = deleteTarget, generation = sessionGeneration, button = el("deleteFinanceConfirm");
        try {
            financeDeleting = true; el("deleteFinanceForm").inert = true; setLoading(button, true, "Excluindo…");
            await mutate("entry_delete", { id: entry.id, expected_revision: Number(entry.edit_revision || 0) });
            if (generation !== sessionGeneration) return;
            financeDeleting = false; closeModal("deleteFinanceModal"); await refresh();
            if (source(entry) === "sale" || source(entry) === "purchase") await openDetails(source(entry), entry.reference_id);
            showToast("Registro excluído e saldo recalculado."); deleteTarget = null;
        } catch (error) { if (generation === sessionGeneration) report("deleteFinanceMessage", error); }
        finally { if (generation === sessionGeneration) { financeDeleting = false; el("deleteFinanceForm").inert = false; setLoading(button, false); } }
    }

    function showModal(titleText, content, submit, label = "Salvar") {
        el("commerceTitle").textContent = titleText; el("commerceContent").innerHTML = content;
        el("commerceSubmit").hidden = !submit; el("commerceSubmit").textContent = label;
        modalSubmit = submit; showMessage("commerceMessage", ""); openModal("commerceModal");
    }

    async function cancelDocument(kind, id) {
        try {
            const state = await readState(kind, id); await ensureReady();
            const sale = kind === "sale", document = state.sale || state.document;
            if (document.status === "cancelled") return openDetails(kind, id);
            if (state.settlement.reliable === false) throw new Error("Confira e corrija os pagamentos deste registro antes de cancelar.");
            const paid = Number(sale ? state.settlement.received : state.settlement.paid), createdAt = dateISO(todayISO());
            showModal(`Cancelar ${sale ? "venda" : "compra"}`, `${balanceHtml(state)}<p>${sale ? "Todas as peças desta venda voltarão ao estoque." : "As peças desta compra serão retiradas do estoque. Deve haver quantidade suficiente disponível."}</p>
                <div class="form-group"><label for="commerceCancelMode">O que aconteceu?</label><select id="commerceCancelMode"><option value="refund">${sale ? "Cliente devolveu a compra" : "Produtos devolvidos ao fornecedor"}</option><option value="void">Este registro foi lançado por engano</option></select></div>
                <p class="field-hint" id="commerceCancelHint">O histórico dos pagamentos será mantido. Registre abaixo o dinheiro devolvido ${sale ? "à cliente" : "pelo fornecedor"} agora.</p>
                <div id="commerceCancelPayment"><div class="form-group"><label for="commerceRefundAmount">Valor ${sale ? "devolvido agora" : "reembolsado agora"}</label><input id="commerceRefundAmount" type="text" inputmode="decimal" value="${decimal(Math.max(0, paid))}"/></div><p class="field-hint">Se ainda não houve devolução do dinheiro, informe 0. O valor continuará aparecendo em aberto.</p><div class="form-row"><div class="form-group"><label for="commerceCancelDate">Data</label><input id="commerceCancelDate" type="date" value="${todayISO()}"/></div><div class="form-group"><label for="commerceCancelMethod">Pagamento</label><select id="commerceCancelMethod">${optionMethods(document.payment_method)}</select></div></div></div>
                <div class="form-group"><label for="commerceCancelReason">Motivo (opcional)</label><textarea id="commerceCancelReason" rows="2"></textarea></div>`, async () => {
                    const mode = el("commerceCancelMode").value, refund = number(el("commerceRefundAmount").value);
                    if (mode === "refund" && (!Number.isFinite(refund) || refund < 0 || cents(refund) > cents(Math.max(0, paid)))) throw new Error("Confira o valor devolvido. Ele pode ficar entre zero e o valor recebido.");
                    const method = el("commerceCancelMethod").value;
                    if (mode === "refund" && refund > 0 && !method) throw new Error("Selecione como o dinheiro foi devolvido.");
                    const payload = { id, expected_revision: revision(state), mode, reason: el("commerceCancelReason").value.trim() || null,
                        payment_date: dateISO(el("commerceCancelDate").value, createdAt), payment_method: method || null };
                    if (mode === "refund") payload.refund_amount = refund;
                    const result = await mutate(sale ? "sale_cancel" : "purchase_cancel", payload);
                    await refresh(); return { kind, id: result.id || id };
                }, "Confirmar cancelamento");
        } catch (error) { showToast(error.message); }
    }

    function variantName(variant) {
        const product = productsCache.find(row => row.id === variant.product_id) || variant.products;
        const color = productColorsCache.find(row => row.id === variant.product_color_id)?.colors?.name || variant.colors?.name || "Sem cor";
        return `${product?.name || "Produto"} · ${color} / ${variant.sizes?.name || sizesCache.find(row => row.id === variant.size_id)?.name || "Único"}`;
    }

    function capturePurchaseMeta() {
        if (!el("purchaseSupplier")) return;
        purchaseMeta = { ...purchaseMeta, supplier_name: el("purchaseSupplier").value,
            date: el("purchaseDate").value, due_date: el("purchaseDueDate").value, notes: el("purchaseNotes").value,
            extra_cost: el("purchaseExtraCost").value, mode: el("purchaseReceiptMode").value,
            paid: el("purchaseInitialPaid").value, method: el("purchasePaymentMethod").value };
    }

    function purchaseTotals() {
        const items = purchaseDraft.reduce((sum, row) => sum + cents(row.unitCost) * row.quantity, 0);
        const extra = number(el("purchaseExtraCost")?.value ?? purchaseMeta.extra_cost ?? 0);
        const valid = Number.isFinite(items) && Number.isFinite(extra) && extra >= 0;
        return { subtotal: items / 100, extra, total: valid ? (items + cents(extra)) / 100 : 0, valid };
    }

    function updatePurchaseSummary() {
        if (!el("purchaseTotal")) return;
        const totals = purchaseTotals(), mode = el("purchaseReceiptMode").value;
        el("purchaseTotal").textContent = money(totals.total);
        el("purchasePaidGroup").hidden = mode !== "partial" || !!purchaseEdit;
        el("purchaseMethodGroup").hidden = mode === "pending" || !!purchaseEdit || totals.total === 0;
        el("purchaseReceiptFields").hidden = !!purchaseEdit;
        if (purchaseEdit) {
            if (purchaseEdit.settlement.reliable === false) { el("purchaseExistingSettlement").textContent = "Confira os pagamentos antigos nos detalhes da compra. O saldo ainda não pode ser calculado."; return; }
            const paid = cents(purchaseEdit.settlement.paid), total = cents(totals.total);
            el("purchaseExistingSettlement").textContent = `Já pago: ${money(paid / 100)} · ${paid > total ? "Reembolso a receber" : "Falta pagar"}: ${money(Math.abs(total - paid) / 100)}`;
        }
    }

    function purchaseOptions(query = "") {
        const search = query.trim().toLocaleLowerCase("pt-BR");
        return getOperationalVariants().filter(variant => variantName(variant).toLocaleLowerCase("pt-BR").includes(search))
            .sort((a,b) => variantName(a).localeCompare(variantName(b), "pt-BR"))
            .map(variant => `<option value="${escape(variant.id)}">${escape(variantName(variant))}</option>`).join("");
    }

    function renderPurchaseForm() {
        const meta = purchaseMeta;
        showModal(purchaseEdit ? "Editar compra" : "Receber peças", `<p class="field-hint">As quantidades serão adicionadas ao estoque. O pagamento pode ser registrado agora ou depois.</p>
            <div class="form-group"><label for="purchaseSearch">Buscar peça, cor ou tamanho</label><input id="purchaseSearch" type="search" placeholder="Nome da peça, cor ou tamanho"/></div>
            <div class="commerce-add-row"><div class="form-group"><label for="purchaseVariant">Peça para receber</label><select id="purchaseVariant"><option value="">Selecione a combinação</option>${purchaseOptions()}</select></div><button type="button" class="secondary-button" data-commerce-add-purchase>+ Adicionar</button></div>
            <div class="commerce-purchase-items">${purchaseDraft.length ? purchaseDraft.map((row,index) => `<article><strong>${escape(row.name)}</strong><div class="form-row"><div class="form-group"><label for="purchaseQuantity${index}">Quantidade</label><input id="purchaseQuantity${index}" type="number" inputmode="numeric" min="1" step="1" value="${row.quantity}" data-purchase-quantity="${index}"/></div><div class="form-group"><label for="purchaseCost${index}">Custo por peça</label><input id="purchaseCost${index}" type="text" inputmode="decimal" value="${decimal(row.unitCost)}" data-purchase-cost="${index}"/></div></div><button type="button" class="text-button danger" data-commerce-remove-purchase="${index}">Remover peça</button></article>`).join("") : '<p class="muted">Adicione as peças recebidas, com suas cores e tamanhos.</p>'}</div>
            <div class="form-group"><label for="purchaseSupplier">Fornecedor (opcional)</label><input id="purchaseSupplier" value="${escape(meta.supplier_name || "")}" type="text"/></div>
            <div class="form-row"><div class="form-group"><label for="purchaseDate">Data da compra</label><input id="purchaseDate" type="date" value="${escape(meta.date || todayISO())}"/></div><div class="form-group"><label for="purchaseDueDate">Vencimento (opcional)</label><input id="purchaseDueDate" type="date" value="${escape(meta.due_date || "")}"/></div></div>
            <div class="form-group"><label for="purchaseExtraCost">Frete e outros custos (opcional)</label><input id="purchaseExtraCost" type="text" inputmode="decimal" value="${escape(meta.extra_cost || "0,00")}"/></div>
            <div class="commerce-total"><span>Total da compra</span><strong id="purchaseTotal">${money(0)}</strong></div>
            <div id="purchaseReceiptFields"><div class="form-group"><label for="purchaseReceiptMode">Pagamento</label><select id="purchaseReceiptMode"><option value="full" ${meta.mode === "full" ? "selected" : ""}>Paguei tudo</option><option value="partial" ${meta.mode === "partial" ? "selected" : ""}>Paguei uma parte</option><option value="pending" ${meta.mode === "pending" ? "selected" : ""}>Ainda não paguei</option></select></div><div class="form-group" id="purchasePaidGroup"><label for="purchaseInitialPaid">Valor pago agora</label><input id="purchaseInitialPaid" type="text" inputmode="decimal" value="${escape(meta.paid || "")}"/></div><div class="form-group" id="purchaseMethodGroup"><label for="purchasePaymentMethod">Como pagou?</label><select id="purchasePaymentMethod">${optionMethods(meta.method || "")}</select></div></div>
            <p class="transaction-edit-hint" id="purchaseExistingSettlement" ${purchaseEdit ? "" : "hidden"}></p>
            <div class="form-group"><label for="purchaseNotes">Observações (opcional)</label><textarea id="purchaseNotes" rows="2">${escape(meta.notes || "")}</textarea></div>`, savePurchase, purchaseEdit ? "Salvar alterações" : "Salvar compra e estoque");
        updatePurchaseSummary();
    }

    async function openPurchase(id = null) {
        try {
            await ensureReady(); await Promise.all([loadProducts(), loadVariants(false)]);
            purchaseEdit = id ? await readState("purchase", id) : null;
            if (purchaseEdit?.document.status === "cancelled") throw new Error("Uma compra cancelada permanece no histórico.");
            const document = purchaseEdit?.document;
            purchaseDraft = purchaseEdit ? purchaseEdit.items.map(item => ({ variantId: item.product_variant_id,
                name: `${item.product_name} · ${item.variant_description || ""}`, quantity: Number(item.quantity), unitCost: Number(item.unit_cost) })) : [];
            purchaseMeta = { supplier_name: document?.supplier_name || "", date: document ? localDateKey(document.document_date) : todayISO(),
                original_date: document?.document_date || dateISO(todayISO()), due_date: document?.due_date || "", notes: document?.notes || "",
                extra_cost: decimal(document?.extra_cost || 0), mode: "full", paid: "", method: "" };
            renderPurchaseForm();
        } catch (error) { showToast(error.message); }
    }

    async function savePurchase() {
        capturePurchaseMeta();
        const totals = purchaseTotals(), mode = purchaseMeta.mode;
        if (!purchaseDraft.length || purchaseDraft.some(row => !Number.isInteger(row.quantity) || row.quantity <= 0 || !Number.isFinite(row.unitCost) || row.unitCost < 0)) throw new Error("Confira as peças, quantidades e custos da compra.");
        if (!totals.valid) throw new Error("Confira os custos da compra.");
        const paid = purchaseEdit || mode === "pending" ? 0 : mode === "full" ? totals.total : number(purchaseMeta.paid);
        if (!purchaseEdit && (!Number.isFinite(paid) || paid < 0 || paid > totals.total || (mode === "partial" && paid <= 0))) throw new Error("Informe quanto pagou, até o total da compra.");
        if (paid > 0 && !purchaseMeta.method) throw new Error("Selecione como pagou a compra.");
        const payload = { id: purchaseEdit?.id || null, expected_revision: purchaseEdit ? revision(purchaseEdit) : null,
            items: purchaseDraft.map(row => ({ variant_id: row.variantId, quantity: row.quantity, unit_cost: row.unitCost })),
            extra_cost: totals.extra, supplier_name: purchaseMeta.supplier_name.trim() || null,
            document_date: dateISO(purchaseMeta.date, purchaseMeta.original_date), notes: purchaseMeta.notes.trim() || null,
            due_date: purchaseMeta.due_date || null, payment_method: purchaseMeta.method || null };
        if (!purchaseEdit) { payload.initial_paid = paid; payload.payment_date = payload.document_date; }
        const result = await mutate("purchase_save", payload); await refresh();
        return { kind: "purchase", id: result.id || result.document?.id };
    }

    async function showPurchases() {
        try {
            await loadPurchases(false);
            showModal("Compras e reposições", `<button type="button" class="primary-button" data-commerce-new-purchase>+ Receber peças</button><p class="field-hint">Abra uma compra para corrigir as peças, conferir pagamentos ou registrar um reembolso.</p>${purchases.length ? purchases.map(document => {
                const value = settlement("purchase", document);
                return `<button type="button" class="commerce-document-row" data-commerce-open="purchase" data-commerce-id="${escape(document.id)}"><span><strong>${escape(document.supplier_name || "Compra de produtos")}</strong><small>${escape(formatLocalDate(document.document_date))} · ${value.reliable === false ? "Conferir valores" : document.status === "cancelled" ? "Cancelada" : value.refund_due > 0 ? "Reembolso a receber" : value.pending > 0 ? "Falta pagar " + money(value.pending) : "Paga"}</small></span><strong>${money(document.total)}</strong></button>`;
            }).join("") : '<p class="muted">Nenhuma compra registrada ainda.</p>'}`, null);
        } catch (error) { showToast(error.message); }
    }

    async function openStockAdjust(productId = null) {
        try {
            await ensureReady(); await Promise.all([loadProducts(), loadVariants(false)]);
            const product = productsCache.find(row => row.id === productId);
            const variants = variantsCache.filter(row => row.product_id === productId).sort((a,b) => variantName(a).localeCompare(variantName(b), "pt-BR"));
            showModal(product ? `Conferir ${product.name}` : "Conferir estoque", `<p>Informe a quantidade que existe fisicamente. Esta conferência ajusta o estoque e mantém o histórico, sem criar entrada ou saída de dinheiro.</p>
                <div class="form-group"><label for="stockCountProduct">Produto</label><select id="stockCountProduct"><option value="">Selecione o produto</option>${productsCache.map(row => `<option value="${escape(row.id)}" ${row.id === productId ? "selected" : ""}>${escape(row.name)}</option>`).join("")}</select></div>
                ${variants.map((variant,index) => `<div class="commerce-count-row"><label for="stockCount${index}">${escape(variantName(variant))}<small>Registrado: ${Number(variant.stock_quantity || 0)} un.</small></label><input id="stockCount${index}" type="number" inputmode="numeric" min="0" step="1" value="${Number(variant.stock_quantity || 0)}" data-commerce-count="${escape(variant.id)}" data-count-expected="${Number(variant.stock_quantity || 0)}"/></div>`).join("")}
                <div class="form-group"><label for="stockCountReason">Motivo (opcional)</label><input id="stockCountReason" type="text" placeholder="Ex.: Conferência, perda, avaria"/></div>`, product ? async () => {
                    const items = [...el("commerceContent").querySelectorAll("[data-commerce-count]")].map(input => ({ variant_id: input.dataset.commerceCount,
                        expected_quantity: Number(input.dataset.countExpected), new_quantity: input.value.trim() === "" ? NaN : Number(input.value) }));
                    if (items.some(item => !Number.isInteger(item.new_quantity) || item.new_quantity < 0)) throw new Error("Informe quantidades inteiras, a partir de zero.");
                    const changed = items.filter(item => item.new_quantity !== item.expected_quantity);
                    if (!changed.length) throw new Error("As quantidades continuam iguais. Altere a contagem ou toque em Voltar.");
                    await mutate("stock_adjust", { items: changed, reason: el("stockCountReason").value.trim() || "Conferência de estoque" });
                    await refresh(); return { stock: true };
                } : null, "Salvar contagem");
        } catch (error) { showToast(error.message); }
    }

    function renderBalances() {
        const container = el("commerceBalances");
        if (!container || !currentUser) return;
        renderPendingNotice();
        const saleValues = salesCache.map(document => settlement("sale", document));
        const purchaseValues = purchases.map(document => settlement("purchase", document));
        const salesOK = financeReliable && salesReliable && saleValues.every(value => value.reliable);
        const purchasesOK = financeReliable && purchasesReliable && purchaseValues.every(value => value.reliable);
        const sum = (values,field) => values.reduce((total,value) => total + cents(value[field]),0)/100;
        const receivable = salesOK ? sum(saleValues,"pending") : null;
        const payable = purchasesOK ? sum(purchaseValues,"pending") : null;
        const refunds = salesOK ? sum(saleValues,"refund_due") : null;
        const supplierRefunds = purchasesOK ? sum(purchaseValues,"refund_due") : null;
        const warning = el("commerceLedgerWarning");
        if (warning) {
            warning.hidden = financeReliable && salesOK && purchasesOK && financeCache.every(validEntry) && !financeCache.some(entry => source(entry) === "legacy");
            warning.textContent = "Há dados que precisam ser carregados ou registros antigos a conferir. Abra os detalhes e confira os valores antes de usar os saldos.";
        }
        container.innerHTML = '<div class="commerce-balance-heading"><strong>Saldos em aberto</strong><small>Todo o histórico</small></div><div class="commerce-balance-grid">'
            + '<button type="button" data-commerce-balances="sale"><span>A receber de clientes</span><strong>'+money(receivable)+'</strong></button>'
            + '<button type="button" data-commerce-balances="purchase"><span>A pagar a fornecedores</span><strong>'+money(payable)+'</strong></button>'
            + (refunds === null || refunds > 0 ? '<button type="button" data-commerce-balances="refund"><span>A devolver a clientes</span><strong>'+money(refunds)+'</strong></button>' : "")
            + (supplierRefunds === null || supplierRefunds > 0 ? '<button type="button" data-commerce-balances="supplier-refund"><span>Reembolso do fornecedor</span><strong>'+money(supplierRefunds)+'</strong></button>' : "")
            + '</div>';
    }


    async function showBalances(kind) {
        try {
            await Promise.all([loadFinance(), loadSales(), loadPurchases(false)]);
            const purchase = ["purchase","supplier-refund"].includes(kind), refund = ["refund","supplier-refund"].includes(kind);
            if (!financeReliable || (!purchase && !salesReliable) || (purchase && !purchasesReliable)) throw new Error("Não foi possível atualizar todos os dados. Confira a conexão e tente novamente.");
            const rows = purchase ? purchases : salesCache, sourceKind = purchase ? "purchase" : "sale";
            const filtered = rows.map(document => ({ document, value: settlement(sourceKind, document) })).filter(row => row.value.reliable === false || (refund ? row.value.refund_due > 0 : row.value.pending > 0));
            const title = kind === "purchase" ? "A pagar a fornecedores" : kind === "supplier-refund" ? "Reembolsos de fornecedores" : kind === "refund" ? "Valores a devolver" : "A receber de clientes";
            showModal(title, filtered.length ? filtered.map(({document,value}) => '<button type="button" class="commerce-document-row" data-commerce-open="'+sourceKind+'" data-commerce-id="'+escape(document.id)+'"><span><strong>'+escape(purchase ? document.supplier_name || "Compra de produtos" : document.customer_name || "Venda #"+document.sale_number)+'</strong><small>'+escape(formatLocalDate(purchase ? document.document_date : document.sale_date))+(document.due_date ? " · Vence "+escape(formatLocalDate(document.due_date)) : "")+'</small></span><strong>'+money(value.reliable === false ? null : refund ? value.refund_due : value.pending)+'</strong></button>').join("") : '<p>Nenhum saldo em aberto nesta lista.</p>', null);
        } catch (error) { showToast(error.message); }
    }


    function showPending() {
        const requests = pendingRequests();
        const legacy = localStorage.getItem(`mabijufit-pending-sale:${currentUser?.id}`);
        showModal("Conferir tentativas pendentes", `<p>Uma conexão interrompida pode esconder a confirmação. Conferir reutiliza a mesma identificação e evita duplicar a operação.</p>${requests.map(request => `<article class="commerce-pending-row"><strong>${escape(({ sale_save: "Salvar venda", sale_cancel: "Cancelar venda", entry_save: "Salvar pagamento", entry_delete: "Excluir registro", purchase_save: "Salvar compra", purchase_cancel: "Cancelar compra", stock_adjust: "Conferir estoque" })[request.action] || "Operação da loja")}</strong><small>${escape(formatLocalDateTime(request.created_at))}</small><button type="button" class="secondary-button" data-commerce-retry="${escape(encodeURIComponent(request.key))}">Conferir esta tentativa</button></article>`).join("")}${legacy ? '<p>Tentativa de venda anterior à atualização.</p><button type="button" class="secondary-button" data-commerce-retry-legacy>Conferir venda anterior</button>' : ""}${!requests.length && !legacy ? '<p>Nenhuma tentativa pendente.</p>' : ""}`, null);
    }

    async function retryPending(key) {
        if (busy) return;
        const request = JSON.parse(localStorage.getItem(key) || "null");
        if (!request) return showPending();
        try {
            busy = true; el("commerceForm").inert = true;
            const result = await mutate(request.action, request.payload);
            busy = false; closeModal("commerceModal"); await refresh();
            if (request.action === "product_save") { localStorage.removeItem(`mabijufit-pending-product:${currentUser.id}`); productSaveUncertain = false; showToast("Produto confirmado. Abra o cadastro na lista para conferir os dados e as fotos."); }
            if (["sale", "purchase"].includes(result.kind)) await openDetails(result.kind, result.id);
            showToast("Operação conferida. Nenhuma duplicação foi feita.");
        } catch (error) { report("commerceMessage", error); }
        finally { busy = false; el("commerceForm").inert = false; }
    }

    async function submitCommerce(event) {
        event.preventDefault();
        if (busy || !modalSubmit) return;
        const callback = modalSubmit, generation = sessionGeneration, button = el("commerceSubmit");
        try {
            busy = true; el("commerceForm").inert = true; setLoading(button, true, "Salvando…");
            const result = await callback();
            if (generation !== sessionGeneration) return;
            busy = false; closeModal("commerceModal");
            if (result?.kind && result.id) await openDetails(result.kind, result.id);
            showToast("Operação salva e saldos atualizados.");
        } catch (error) { if (generation === sessionGeneration) report("commerceMessage", error); }
        finally { if (generation === sessionGeneration) { busy = false; el("commerceForm").inert = false; setLoading(button, false); } }
    }

    function init() {
        el("commerceForm").addEventListener("submit", submitCommerce);
        el("saleReceiptMode").addEventListener("change", syncSaleReceipt);
        document.addEventListener("input", event => {
            const input = event.target;
            if (input.matches("[data-sale-unit-price]")) { const item = saleDraft[Number(input.dataset.saleUnitPrice)]; if (item) { item.unitPrice = number(input.value); renderSaleSummary(); } }
            if (input.id === "purchaseSearch") el("purchaseVariant").innerHTML = '<option value="">Selecione a combinação</option>' + purchaseOptions(input.value);
            if (input.matches("[data-purchase-quantity]")) { purchaseDraft[Number(input.dataset.purchaseQuantity)].quantity = Number(input.value); updatePurchaseSummary(); }
            if (input.matches("[data-purchase-cost]")) { purchaseDraft[Number(input.dataset.purchaseCost)].unitCost = number(input.value); updatePurchaseSummary(); }
            if (input.id === "purchaseExtraCost") updatePurchaseSummary();
        });
        document.addEventListener("change", event => {
            const input = event.target;
            if (input.id === "stockCountProduct") openStockAdjust(input.value || null);
            if (input.id === "purchaseReceiptMode") updatePurchaseSummary();
            if (input.id === "commerceCancelMode") {
                const wrong = input.value === "void"; el("commerceCancelPayment").hidden = wrong;
                el("commerceCancelHint").textContent = wrong ? "O registro incorreto e seus pagamentos serão anulados. O histórico da correção será preservado." : "O histórico dos pagamentos será mantido. Informe o dinheiro devolvido agora; o restante continua em aberto.";
            }
        });
        document.addEventListener("click", async event => {
            const button = event.target.closest("button");
            if (!button || busy) return;
            const data = button.dataset;
            if (data.commerceEdit) return data.commerceEdit === "sale" ? editSale(data.commerceId) : openPurchase(data.commerceId);
            if (data.commerceOpen) return openDetails(data.commerceOpen, data.commerceId);
            if (data.commercePayment) return openEntry(data.commercePayment, data.commerceId, data.commercePayment === "sale" ? "income" : "expense");
            if (data.commerceRefund) return openEntry(data.commerceRefund, data.commerceId, data.commerceRefund === "sale" ? "expense" : "income");
            if (data.commerceCancel) return cancelDocument(data.commerceCancel, data.commerceId);
            if (data.commerceEditEntry) return editEntry(data.commerceEditEntry);
            if (data.commerceDeleteEntry) return openDeleteEntry(data.commerceDeleteEntry);
            if (data.commerceNewPurchase !== undefined) return openPurchase();
            if (data.commercePurchases !== undefined) return showPurchases();
            if (data.commerceCount !== undefined) return openStockAdjust();
            if (data.commerceBalances) return showBalances(data.commerceBalances);
            if (data.commercePending !== undefined) return showPending();
            if (data.commerceRetry) return retryPending(decodeURIComponent(data.commerceRetry));
            if (data.commerceRetryLegacy !== undefined) {
                try {
                    await ensureReady(); const key = `mabijufit-pending-sale:${currentUser.id}`, payload = JSON.parse(localStorage.getItem(key) || "null");
                    if (!payload) return showPending();
                    busy = true; el("commerceForm").inert = true;
                    const result = await sessionClient(currentUser.id, sessionGeneration).rpc("pc_register_sale", payload);
                    if (result.error) throw result.error;
                    if (!result.data?.sale) throw new Error("Venda anterior ainda sem confirmação.");
                    localStorage.removeItem(key); busy = false; closeModal("commerceModal"); await refresh(); await openDetails("sale", result.data.sale.id);
                } catch (error) { report("commerceMessage", error); } finally { busy = false; el("commerceForm").inert = false; }
                return;
            }
            if (data.commerceAddPurchase !== undefined) {
                const variant = variantsCache.find(row => row.id === el("purchaseVariant").value);
                if (!variant) return showMessage("commerceMessage", "Selecione a peça, cor e tamanho para adicionar.");
                capturePurchaseMeta(); const existing = purchaseDraft.find(row => row.variantId === variant.id);
                if (existing) existing.quantity++;
                else purchaseDraft.push({ variantId: variant.id, name: variantName(variant), quantity: 1,
                    unitCost: Number(productsCache.find(row => row.id === variant.product_id)?.cost_price || 0) });
                renderPurchaseForm(); return;
            }
            if (data.commerceRemovePurchase !== undefined) { capturePurchaseMeta(); purchaseDraft.splice(Number(data.commerceRemovePurchase), 1); renderPurchaseForm(); }
        });
    }
    function reset() { capability = null; capabilityUser = null; saleEdit = null; entryContext = null; purchases = []; purchasesReliable = false; financeReliable = false; salesReliable = false; purchaseEdit = null; currentDetail = null; modalSubmit = null; busy = false; if (el("commercePendingNotice")) el("commercePendingNotice").hidden = true; detailSequence++; }
    return { dateISO, number, cents, decimal, source, settlement, validEntry, markLoaded, get financeReliable() { return financeReliable; }, ensureReady, mutate, readState, refresh, loadPurchases,
        resetSale, title, saleStock, saleTotals, syncSaleReceipt, editSale, saveSale, openDetails, resetEntry, openEntry, editEntry,
        saveEntry, openDeleteEntry, deleteEntry, cancelDocument, reset, init, openPurchase, showPurchases,
        openStockAdjust, renderBalances, showPending,
        get saleEdit() { return saleEdit; }, get busy() { return busy; }, get purchases() { return purchases; } };
})();
