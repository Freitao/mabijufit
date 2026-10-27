// Execute in the browser mock harness, wrapped in an async function.
const results = [];
const check = (name, condition) => {
  results.push({ name, passed: !!condition });
  if (!condition) throw new Error('Financeiro edição: ' + name);
};
const tick = () => new Promise(resolve => setTimeout(resolve, 100));
const field = id => document.getElementById(id);
const submit = () => document.querySelector('#transactionForm [type="submit"]');
const save = () => saveTransaction({ preventDefault() {}, submitter: submit() });
const updates = () => mockCalls.filter(call => call.table === 'financial_transactions' && call.action === 'update');
const inserts = () => mockCalls.filter(call => call.table === 'financial_transactions' && call.action === 'insert');
const isUpdate = query => (query.table || query.tableName) === 'financial_transactions' && query.action === 'update';
let fixtureNumber = 0;
const fixture = (extra = {}) => {
  const row = {
    id: 'finance-edit-fixture-' + ++fixtureNumber,
    user_id: mockUser.id,
    reference_id: null,
    transaction_type: 'expense',
    category: 'Compra de produtos / estoque',
    description: 'Compra da loja',
    amount: 120,
    transaction_date: todayISO(),
    payment_method: 'pix',
    notes: 'Nota original',
    ...extra,
  };
  mockDB.financial_transactions.push(row);
  return row;
};
const refresh = async () => {
  await loadFinance();
  currentFinancePeriod = 'all';
  field('financePeriod').value = 'all';
  field('financeSearch').value = '';
  financeFilter = 'all';
  updateFinanceView();
};
const edit = async row => {
  closeModal('transactionModal');
  await refresh();
  openEditTransactionModal(row.id);
};
const summaryIsCurrent = () => {
  const income = financeCache.filter(row => row.transaction_type === 'income').reduce((total, row) => total + Number(row.amount), 0);
  const expenses = financeCache.filter(row => row.transaction_type === 'expense').reduce((total, row) => total + Number(row.amount), 0);
  return field('financeIncome').textContent === formatCurrency(income)
    && field('financeExpenses').textContent === formatCurrency(expenses)
    && field('financeBalance').textContent === formatCurrency(income - expenses);
};

await showApplication(mockUser);

const original = fixture();
await refresh();
const editButton = document.querySelector(`[data-edit-finance="${original.id}"]`);
const deleteButton = document.querySelector(`[data-delete-finance="${original.id}"]`);
check('lançamento manual oferece Editar e Excluir', editButton && deleteButton);
editButton.closest('article').querySelector('details').open = true;
editButton.click();
check('Editar usa o ID do lançamento selecionado', transactionEditTarget && transactionEditTarget.id === original.id);
check('Editar preenche tipo, categoria e descrição', field('transactionType').value === original.transaction_type && field('transactionCategory').value === original.category && field('transactionDescription').value === original.description);
check('Editar preenche valor, data, pagamento e observação', Number(field('transactionAmount').value.replace(',', '.')) === original.amount && field('transactionDate').value === original.transaction_date && field('transactionPaymentMethod').value === original.payment_method && field('transactionNotes').value === original.notes);

const insertsBeforeEdit = inserts().length;
const updatesBeforeEdit = updates().length;
field('transactionType').value = 'income';
field('transactionType').dispatchEvent(new Event('change', { bubbles: true }));
field('transactionCategory').value = 'Outras entradas';
field('transactionDescription').value = 'Valor corrigido';
field('transactionAmount').value = '250.50';
field('transactionPaymentMethod').value = 'cash';
field('transactionNotes').value = 'Nota corrigida';
await save();
check('edição atualiza uma vez sem inserir outro lançamento', updates().length === updatesBeforeEdit + 1 && inserts().length === insertsBeforeEdit);
check('edição preserva o ID e altera valor e tipo', original.id === 'finance-edit-fixture-1' && original.amount === 250.5 && original.transaction_type === 'income');
check('edição salva os demais campos', original.category === 'Outras entradas' && original.description === 'Valor corrigido' && original.payment_method === 'cash' && original.notes === 'Nota corrigida');
check('edição confirmada limpa o alvo e a trava', !transactionEditTarget && !transactionSaving);
check('resumo financeiro acompanha a troca de saída para entrada', summaryIsCurrent());

await edit(original);
const writesBeforeCancel = updates().length + inserts().length;
field('transactionAmount').value = '999';
closeModal('transactionModal');
check('cancelar limpa o alvo sem alterar o registro', !transactionEditTarget && original.amount === 250.5 && updates().length + inserts().length === writesBeforeCancel);
openTransactionModal('expense');
check('Novo não herda ID, valor ou observação da edição', !transactionEditTarget && field('transactionType').value === 'expense' && !field('transactionAmount').value && !field('transactionNotes').value);
closeModal('transactionModal');

const nullable = fixture({ payment_method: null, notes: null });
await edit(nullable);
check('campos nulos abrem vazios', !field('transactionPaymentMethod').value && !field('transactionNotes').value);
field('transactionAmount').value = '130';
await save();
check('comparação otimista permite editar campos originais nulos', nullable.amount === 130 && !transactionEditTarget);

const linked = fixture({ reference_id: 'sale-edit-fixture', transaction_type: 'income' });
const missingReference = fixture();
delete missingReference.reference_id;
const otherUser = fixture({ user_id: 'finance-edit-other-owner' });
await refresh();
check('receita de venda não oferece Editar ou Excluir', !document.querySelector(`[data-edit-finance="${linked.id}"]`) && !document.querySelector(`[data-delete-finance="${linked.id}"]`));
check('origem ausente não é tratada como lançamento manual', !document.querySelector(`[data-edit-finance="${missingReference.id}"]`) && !document.querySelector(`[data-delete-finance="${missingReference.id}"]`));
const blockedWrites = updates().length + inserts().length;
for (const row of [linked, missingReference, otherUser]) {
  openEditTransactionModal(row.id);
  check('acesso direto não edita origem protegida: ' + row.id, !transactionEditTarget);
}
check('tentativas de editar origens protegidas não escrevem dados', updates().length + inserts().length === blockedWrites);

const concurrent = fixture();
await edit(concurrent);
field('transactionAmount').value = '140';
mockBeforeRun = query => {
  if (isUpdate(query)) {
    concurrent.description = 'Atualizado em outra aba';
    mockBeforeRun = null;
  }
};
try {
  await save();
} finally {
  mockBeforeRun = null;
}
check('concorrência não sobrescreve os dados do outro cliente', concurrent.amount === 120 && concurrent.description === 'Atualizado em outra aba');
check('zero linhas preserva o rascunho e bloqueia nova tentativa', transactionEditTarget && transactionEditTarget.blocked && field('transactionAmount').value === '140');
const callsAfterConflict = updates().length;
await save();
check('conflito não repete o UPDATE ao clicar novamente', updates().length === callsAfterConflict);
await edit(concurrent);
check('reabrir após conflito captura o registro atualizado', transactionEditTarget && !transactionEditTarget.blocked && field('transactionDescription').value === 'Atualizado em outra aba');
field('transactionAmount').value = '145';
await save();
check('edição reaberta pode salvar a correção', concurrent.amount === 145);

const becameSale = fixture();
await edit(becameSale);
field('transactionAmount').value = '150';
mockBeforeRun = query => {
  if (isUpdate(query)) {
    becameSale.reference_id = 'sale-created-during-edit';
    mockBeforeRun = null;
  }
};
try {
  await save();
} finally {
  mockBeforeRun = null;
}
check('vínculo com venda criado durante a edição impede UPDATE', becameSale.amount === 120 && becameSale.reference_id === 'sale-created-during-edit' && transactionEditTarget && transactionEditTarget.blocked);
closeModal('transactionModal');

const permission = fixture();
await edit(permission);
field('transactionAmount').value = '160';
mockFailure = { table: 'financial_transactions', action: 'update', error: { message: 'permission denied', code: '42501' } };
try {
  await save();
} finally {
  mockFailure = null;
}
check('erro de permissão preserva dados e rascunho', permission.amount === 120 && field('transactionAmount').value === '160' && transactionEditTarget && transactionEditTarget.blocked);
const callsAfterPermission = updates().length;
await save();
check('erro de permissão bloqueia repetição da atualização', updates().length === callsAfterPermission);
closeModal('transactionModal');

const lostResponse = fixture();
await edit(lostResponse);
field('transactionAmount').value = '170';
const originalRun = Query.prototype.run;
let responseLost = false;
Query.prototype.run = async function (...args) {
  const result = await originalRun.apply(this, args);
  if (isUpdate(this) && !responseLost) {
    responseLost = true;
    throw new Error('Failed to fetch: resposta perdida no teste');
  }
  return result;
};
try {
  await save();
} finally {
  Query.prototype.run = originalRun;
}
check('resposta perdida simula write aplicado e não confirmado', responseLost && lostResponse.amount === 170);
check('resposta perdida mantém rascunho e bloqueia retry', transactionEditTarget && transactionEditTarget.blocked && field('transactionAmount').value === '170');
const callsAfterLostResponse = updates().length;
await save();
check('resposta perdida não duplica atualização nem insere', updates().length === callsAfterLostResponse && inserts().length === insertsBeforeEdit);
await edit(lostResponse);
check('reabrir após resposta perdida usa o valor confirmado pela recarga', transactionEditTarget && !transactionEditTarget.blocked && Number(field('transactionAmount').value.replace(',', '.')) === 170);
closeModal('transactionModal');

const delayed = fixture();
await edit(delayed);
field('transactionAmount').value = '180';
let releaseDelay;
const delayPromise = new Promise(resolve => { releaseDelay = resolve; });
mockDelay = { table: 'financial_transactions', promise: delayPromise };
const updatesBeforePending = updates().length;
const pendingSave = save();
await tick();
check('atualização pendente mantém formulário ocupado', transactionSaving && submit().disabled);
await save();
closeModal('transactionModal');
check('duplo envio e fechar durante write preservam o alvo', updates().length === updatesBeforePending + 1 && transactionEditTarget && transactionEditTarget.id === delayed.id);
mockDelay = null;
releaseDelay();
await pendingSave;
check('write pendente conclui uma vez e libera o formulário', delayed.amount === 180 && updates().length === updatesBeforePending + 1 && !transactionSaving && !transactionEditTarget);

const staleSession = fixture();
await edit(staleSession);
field('transactionAmount').value = '190';
let releaseSessionDelay;
const sessionDelayPromise = new Promise(resolve => { releaseSessionDelay = resolve; });
mockDelay = { table: 'financial_transactions', promise: sessionDelayPromise };
const staleSave = save();
await tick();
check('teste de sessão parte de uma gravação pendente', transactionSaving);
resetSessionState();
mockDelay = null;
await showApplication({ id: 'finance-edit-next-user', email: 'finance-edit-next@example.test' });
check('nova sessão limpa alvo, trava e estado ocupado do modal', !transactionEditTarget && !transactionSaving && !field('transactionForm').inert && field('transactionForm').getAttribute('aria-busy') !== 'true');
releaseSessionDelay();
await staleSave;
check('retorno antigo não repõe dados ou alvo na nova sessão', currentUser.id === 'finance-edit-next-user' && !transactionEditTarget && !transactionSaving && !financeCache.some(row => row.user_id === mockUser.id));
await showApplication(mockUser);
await refresh();
check('restaurar a sessão original mantém o saldo coerente', summaryIsCurrent());

return JSON.stringify(results, null, 2);
