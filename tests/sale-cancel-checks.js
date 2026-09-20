// Fluxo real do frontend; banco em memória, sem chamadas remotas.
const results=[];
const check=(name,condition)=>{results.push({name,passed:!!condition});if(!condition)throw new Error('Cancelamento: '+name);};
const tick=()=>new Promise(resolve=>setTimeout(resolve,100));
const variantIds=['v1','v2','v3'];
const initialStock={v1:3,v2:4,v3:2};
for(const id of variantIds) mockDB.product_variants.find(row=>row.id===id).stock_quantity=initialStock[id];
await loadStock();await loadDashboard();
const resultBefore=$('metricResult').textContent;
const ordersBefore=Number($('metricOrders').textContent);
const revenueBefore=$('metricSales').textContent;
const lowStockBefore=$('metricLowStock').textContent;
const financeBefore=JSON.stringify(mockDB.financial_transactions);
const makeSale=async()=>{
 await openNewSaleModal();
 for(const [index,id] of variantIds.entries()){addSaleVariant(id);updateSaleItemQuantity(index,[2,3,1][index]);}
 $('salePaymentMethod').value='pix';$('saleDiscountInput').value='10';$('saleNotesInput').value='Teste de cancelamento';
 await registerSale();
 return mockDB.sales.at(-1);
};
const sale=await makeSale();
const items=structuredClone(mockDB.sale_items.filter(row=>row.sale_id===sale.id));
const originals=structuredClone(mockDB.inventory_movements.filter(row=>row.reference_id===sale.id));
check('venda com dois produtos e três variações',items.length===3&&new Set(items.map(row=>row.product_name)).size===2);
check('baixa exata antes do cancelamento',variantIds.every((id,index)=>mockDB.product_variants.find(row=>row.id===id).stock_quantity===initialStock[id]-[2,3,1][index]));
check('venda atualiza alerta de estoque baixo',Number($('metricLowStock').textContent)>Number(lowStockBefore));
check('receita e dashboard da venda',mockDB.financial_transactions.some(row=>row.reference_id===sale.id)&&Number($('metricOrders').textContent)===ordersBefore+1);
showSection('sales');await tick();
document.querySelector(`#salesList [data-open-sale="${sale.id}"]`).click();await tick();
$('saleDetailsContent').querySelector('[data-cancel-sale]').click();
check('confirmação explícita sem alteração',!$('cancelSaleModal').hidden&&$('cancelSaleTitle').textContent.includes(String(sale.sale_number))&&sale.status==='completed');
$('cancelSaleBack').click();await tick();
check('voltar preserva venda',!$('saleDetailsModal').hidden&&sale.cancelled_at===null);
$('saleDetailsContent').querySelector('[data-cancel-sale]').click();$('cancelSaleReason').value='  Venda lançada em duplicidade  ';
let release;
mockDelay={table:'sales',promise:new Promise(resolve=>release=resolve)};
$('cancelSaleForm').requestSubmit();await tick();
await cancelSale({preventDefault(){}});closeModal('cancelSaleModal');
check('processamento bloqueia duplo toque e fechamento',saleCancelling&&$('cancelSaleConfirm').disabled&&!$('cancelSaleModal').hidden);
release();
for(let attempts=0;saleCancelling&&attempts<100;attempts++)await tick();
await tick();
check('status timestamp e motivo persistidos',sale.status==='cancelled'&&!!sale.cancelled_at&&sale.cancellation_reason==='Venda lançada em duplicidade');
check('estoque devolvido exatamente uma vez',variantIds.every(id=>mockDB.product_variants.find(row=>row.id===id).stock_quantity===initialStock[id]));
check('itens e movimentos originais preservados',JSON.stringify(mockDB.sale_items.filter(row=>row.sale_id===sale.id))===JSON.stringify(items)&&originals.every(row=>JSON.stringify(mockDB.inventory_movements.find(item=>item.id===row.id))===JSON.stringify(row)));
const returns=mockDB.inventory_movements.filter(row=>row.reference_id===sale.id&&row.movement_type==='sale_cancel');
check('movimento compensatório por variação',returns.length===3&&items.every(item=>returns.some(row=>row.product_variant_id===item.product_variant_id&&row.quantity===item.quantity)));
check('receita interna removida',!mockDB.financial_transactions.some(row=>row.reference_id===sale.id)&&!financeCache.some(row=>row.reference_id===sale.id));
check('dashboard recomposto',$('metricResult').textContent===resultBefore&&Number($('metricOrders').textContent)===ordersBefore);
check('faturamento e estoque baixo recompostos',$('metricSales').textContent===revenueBefore&&$('metricLowStock').textContent===lowStockBefore);
check('outros lançamentos financeiros preservados',JSON.stringify(mockDB.financial_transactions)===financeBefore);
check('detalhes cancelados sem nova ação',$('saleDetailsContent').textContent.includes('CANCELADA')&&!$('saleDetailsContent').querySelector('[data-cancel-sale]'));
const after=JSON.stringify(mockDB);
const second=await performSaleCancellation(sessionClient(mockUser.id,sessionGeneration),mockUser.id,sale.id,'outra tentativa',SALE_RETURN_MOVEMENT_TYPE);
check('cancelamento duplicado não altera nada',second.alreadyCancelled&&JSON.stringify(mockDB)===after);
closeModal('saleDetailsModal');
window.cancelledSaleReviewId=sale.id;

// A mesma venda-base é restaurada somente no mock entre cenários isolados.
const failureSale=await makeSale();
const baseline=structuredClone(mockDB);
const originalRun=Query.prototype.run;
const invoke=()=>performSaleCancellation(sessionClient(mockUser.id,sessionGeneration),mockUser.id,failureSale.id,'Falha de teste',SALE_RETURN_MOVEMENT_TYPE);
for(const stage of ['stock','movement','finance','final','claim-lost','stock-lost','movement-lost','finance-lost','final-lost','rollback-conflict']) {
 Object.assign(mockDB,structuredClone(baseline));
 let injected=false;
 Query.prototype.run=function(){
  const matching=stage==='stock'?this.table==='product_variants'&&this.action==='update'&&this.value.stock_quantity===initialStock.v2:
   stage==='movement'?this.table==='inventory_movements'&&this.action==='insert':
   ['finance','rollback-conflict','finance-lost'].includes(stage)?this.table==='financial_transactions'&&this.action==='delete':
   ['final','final-lost'].includes(stage)?this.table==='sales'&&this.value?.status==='cancelled':
   stage==='claim-lost'?this.table==='sales'&&this.action==='update':
   stage==='stock-lost'?this.table==='product_variants'&&this.action==='update':
   stage==='movement-lost'?this.table==='inventory_movements'&&this.action==='insert':false;
  if(matching&&!injected){
   injected=true;
   if(stage.endsWith('-lost')) {originalRun.call(this);throw new Error('Resposta perdida após executar');}
   if(stage==='rollback-conflict')mockDB.product_variants.find(row=>row.id==='v1').stock_quantity++;
   return {data:null,error:{code:'23514',message:'Falha PostgreSQL simulada'}};
  }
  return originalRun.call(this);
 };
 let failed=false;
 try{await invoke();}catch{failed=true;}finally{Query.prototype.run=originalRun;}
 check('falha não silenciada '+stage,failed&&injected);
 const current=mockDB.sales.find(row=>row.id===failureSale.id);
 if(['stock','movement','finance'].includes(stage)){
  check('rollback restaura venda estoque e financeiro '+stage,JSON.stringify(mockDB)===JSON.stringify(baseline));
 }else{
  check('tentativa ambígua preserva bloqueio '+stage,!!current.cancelled_at);
  const snapshot=JSON.stringify(mockDB);
  try{await invoke();}catch{}
  check('repetição não devolve novamente '+stage,JSON.stringify(mockDB)===snapshot);
  if(stage==='rollback-conflict')check('rollback não sobrescreve estoque concorrente',mockDB.product_variants.find(row=>row.id==='v1').stock_quantity===initialStock.v1+1);
 }
}
Object.assign(mockDB,structuredClone(baseline));
const concurrent=await Promise.allSettled([invoke(),invoke()]);
check('duas abas: uma única operação vence',concurrent.filter(result=>result.status==='fulfilled').length===1&&concurrent.filter(result=>result.status==='rejected').length===1);
check('duas abas: devolução única',variantIds.every(id=>mockDB.product_variants.find(row=>row.id===id).stock_quantity===initialStock[id])&&mockDB.inventory_movements.filter(row=>row.reference_id===failureSale.id&&row.movement_type==='sale_cancel').length===3);
// Mantém um cancelamento de verdade no snapshot usado pelo teste de reload.
await Promise.all([loadSales(),loadProducts(),loadStock(),loadFinance()]);await loadDashboard();
await openSaleDetails(failureSale.id);
check('segunda venda cancelada sem ação',$('saleDetailsContent').textContent.includes('CANCELADA')&&!$('saleDetailsContent').querySelector('[data-cancel-sale]'));
closeModal('saleDetailsModal');
check('concluída anterior continua normal',salesCache.some(row=>row.status==='completed'&&!row.cancelled_at));
check('sem erros não tratados',reviewErrors.length===0);
return JSON.stringify(results,null,2);
