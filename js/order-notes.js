(function () {
    "use strict";

    const TABLE = "customer_order_notes";
    let rows = [];
    let filter = "all";
    let editingId = null;
    let loading = false;
    let loadRevision = 0;

    const $ = id => document.getElementById(id);
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
    const dateLabel = value => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(" de ", " ");
    };
    const client = () => typeof supabaseClient === "undefined" ? null : supabaseClient;

    function message(text, kind = "") {
        const el = $("orderNoteFormMessage");
        if (!el) return;
        el.textContent = text;
        el.className = `form-message${kind ? ` ${kind}` : ""}`;
    }

    function showListMessage(text, isError = false) {
        const list = $("orderNotesList");
        if (!list) return;
        list.innerHTML = `<div class="empty-state order-notes-empty${isError ? " is-error" : ""}"><span class="empty-state-icon" aria-hidden="true">${isError ? "!" : "♡"}</span><h3>${escapeHtml(isError ? "Não foi possível carregar" : text)}</h3><p>${escapeHtml(isError ? text : "Quando uma cliente pedir uma peça, anote aqui para consultar depois.")}</p>${isError ? '<button class="secondary-button" type="button" data-order-notes-retry>Tentar novamente</button>' : '<button class="primary-button" type="button" data-order-note-create>+ Anotar pedido</button>'}</div>`;
    }

    function render() {
        const query = ($("orderNotesSearch")?.value || "").trim().toLocaleLowerCase("pt-BR");
        const pending = rows.filter(row => row.status === "pending").length;
        const ordered = rows.length - pending;
        $("orderNotesAllCount").textContent = String(rows.length);
        $("orderNotesPendingCount").textContent = String(pending);
        $("orderNotesOrderedCount").textContent = String(ordered);
        const visible = rows.filter(row => (filter === "all" || row.status === filter) && (!query || [row.customer_name, row.item_name, row.item_details, row.note].some(value => String(value || "").toLocaleLowerCase("pt-BR").includes(query))));
        if (loading) { $("orderNotesList").innerHTML = '<div class="empty-state compact"><p>Carregando anotações…</p></div>'; return; }
        if (!rows.length) { showListMessage("Nenhum pedido anotado ainda"); return; }
        if (!visible.length) { showListMessage("Nenhum pedido encontrado"); return; }
        $("orderNotesList").innerHTML = visible.map(row => `
            <article class="order-note-card ${row.status === "ordered" ? "is-ordered" : ""}">
             <div class="order-note-top"><div class="order-note-client"><span class="order-note-avatar" aria-hidden="true">${escapeHtml((row.customer_name || "?").trim().charAt(0).toLocaleUpperCase("pt-BR"))}</span><div><h3>${escapeHtml(row.customer_name)}</h3><time datetime="${escapeHtml(row.created_at)}">${escapeHtml(dateLabel(row.created_at))}</time></div></div><span class="order-note-status ${row.status === "ordered" ? "ordered" : "pending"}">${row.status === "ordered" ? "Pedido feito" : "Pendente"}</span></div>
             <div class="order-note-product"><strong>${escapeHtml(row.item_name)}</strong>${row.item_details ? `<span>${escapeHtml(row.item_details)}</span>` : ""}</div>
             ${row.note ? `<p class="order-note-message"><span aria-hidden="true">♡</span>${escapeHtml(row.note)}</p>` : ""}
             <div class="order-note-actions"><button type="button" class="text-button" data-edit-order-note="${escapeHtml(row.id)}">Editar</button><button type="button" class="${row.status === "ordered" ? "secondary-button" : "primary-button"} small" data-toggle-order-note="${escapeHtml(row.id)}">${row.status === "ordered" ? "Voltar para pendente" : "Marcar pedido feito"}</button></div>
            </article>`).join("");
    }

    async function load() {
        if (!client() || loading) return;
        const revision = ++loadRevision;
        loading = true;
        render();
        try {
            const { data, error } = await client().from(TABLE).select("id,customer_name,item_name,item_details,note,status,created_at,updated_at").order("created_at", { ascending: false });
            if (error) throw error;
            if (revision !== loadRevision) return;
            rows = data || [];
            render();
        } catch (error) {
            if (revision !== loadRevision) return;
            console.error("Falha ao carregar anotações de pedidos:", error);
            showListMessage(error?.code === "42P01" || error?.code === "PGRST205" ? "A tabela das anotações ainda não existe. Execute supabase/pedidos-clientes-migration.sql no SQL Editor." : (error?.message || "Confira sua conexão e tente novamente."), true);
        } finally {
            if (revision === loadRevision) loading = false;
        }
    }

    function open(id = null) {
        editingId = id;
        const row = rows.find(item => item.id === id);
        $("orderNoteForm").reset();
        message("");
        $("orderNoteModalTitle").textContent = row ? "Editar anotação" : "Novo pedido";
        $("saveOrderNoteButton").textContent = row ? "Salvar alterações" : "Salvar anotação";
        if (row) {
            $("orderNoteCustomer").value = row.customer_name || "";
            $("orderNoteItem").value = row.item_name || "";
            $("orderNoteDetails").value = row.item_details || "";
            $("orderNoteText").value = row.note || "";
        }
        openModal("orderNoteModal");
        $("orderNoteCustomer").focus();
    }

    async function save(event) {
        event.preventDefault();
        const submit = $("saveOrderNoteButton");
        const userResult = await client().auth.getUser();
        if (userResult.error || !userResult.data.user) { message("Sua sessão expirou. Entre novamente para salvar.", "error"); return; }
        const userId = userResult.data.user.id;
        const payload = {
            customer_name: $("orderNoteCustomer").value.trim(),
            item_name: $("orderNoteItem").value.trim(),
            item_details: $("orderNoteDetails").value.trim() || null,
            note: $("orderNoteText").value.trim() || null,
            updated_at: new Date().toISOString()
        };
        if (!payload.customer_name || !payload.item_name) { message("Informe o nome da cliente e o que ela pediu.", "error"); return; }
        submit.disabled = true;
        message("Salvando anotação…");
        try {
            let request = client().from(TABLE);
            if (editingId) request = request.update(payload).eq("id", editingId).eq("user_id", userId);
            else request = request.insert({ ...payload, user_id: userId, status: "pending" });
            const { error } = await request.select("id").single();
            if (error) throw error;
            closeModal("orderNoteModal");
            await load();
        } catch (error) {
            console.error("Falha ao salvar anotação de pedido:", error);
            message(error?.code === "42P01" || error?.code === "PGRST205" ? "Execute primeiro o SQL supabase/pedidos-clientes-migration.sql no Supabase." : (error?.message || "Não foi possível salvar. Verifique sua conexão e tente novamente."), "error");
        } finally {
            submit.disabled = false;
        }
    }

    async function toggle(id) {
        const row = rows.find(item => item.id === id);
        if (!row) return;
        const userResult = await client().auth.getUser();
        const userId = userResult.data?.user?.id;
        if (!userId) return;
        const next = row.status === "ordered" ? "pending" : "ordered";
        try {
            const { error } = await client().from(TABLE).update({ status: next, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
            if (error) throw error;
            rows = rows.map(item => item.id === id ? { ...item, status: next, updated_at: new Date().toISOString() } : item);
            render();
        } catch (error) {
            console.error("Falha ao atualizar status da anotação:", error);
            showListMessage(error?.message || "Não foi possível atualizar o status. Tente novamente.", true);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        $("newOrderNoteButton")?.addEventListener("click", () => open());
        $("orderNoteForm")?.addEventListener("submit", save);
        $("orderNotesSearch")?.addEventListener("input", render);
        $("orderNotesFilters")?.addEventListener("click", event => {
            const button = event.target.closest("[data-order-note-filter]");
            if (!button) return;
            filter = button.dataset.orderNoteFilter;
            $("orderNotesFilters").querySelectorAll("[data-order-note-filter]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
            render();
        });
        $("orderNotesList")?.addEventListener("click", event => {
            const edit = event.target.closest("[data-edit-order-note]");
            const toggleButton = event.target.closest("[data-toggle-order-note]");
            const create = event.target.closest("[data-order-note-create]");
            const retry = event.target.closest("[data-order-notes-retry]");
            if (edit) open(edit.dataset.editOrderNote);
            else if (toggleButton) toggle(toggleButton.dataset.toggleOrderNote);
            else if (create) open();
            else if (retry) load();
        });
    });

    window.OrderNotes = { load, reset() { loadRevision++; rows = []; filter = "all"; loading = false; if ($("orderNotesSearch")) $("orderNotesSearch").value = ""; render(); } };
})();
