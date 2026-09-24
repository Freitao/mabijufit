const results=[];
const check=(name,ok)=>{results.push({name,passed:!!ok});if(!ok)throw new Error('Estoque agrupado: '+name);};
const pid='stock-fixture',uid=mockUser.id;
mockDB.products.push({id:pid,user_id:uid,name:'Peça agrupada',is_active:true,minimum_stock:3,edit_revision:1});
mockDB.product_colors.push({id:'stock-blue',user_id:uid,product_id:pid,color_id:'blue',is_active:true,display_order:1},{id:'stock-white',user_id:uid,product_id:pid,color_id:'white',is_active:true,display_order:0});
for(const [id,group,size,quantity] of [['stock-g','stock-blue','size-g',0],['stock-m','stock-blue','size-m',5],['stock-p','stock-blue','size-p',1],['stock-w','stock-white','size-p',4]])mockDB.product_variants.push({id,user_id:uid,product_id:pid,product_color_id:group,size_id:size,stock_quantity:quantity,minimum_stock:3,is_active:true});
await loadProductsPage();await loadStock();
const summary=stockProductSummaries().find(s=>s.product.id===pid);
check('um resumo por produto',stockProductSummaries().filter(s=>s.product.id===pid).length===1);
check('total 10 unidades',summary.total===10);
check('duas cores',summary.groups.length===2);
check('baixo e zero separados',summary.low===1&&summary.zero===1);
check('normal preservado',summary.variants.filter(v=>stockItemStatus(v).className==='normal').length===2);
check('tamanho ausente não conta zero',summary.variants.length===4&&summary.zero===1);
check('tamanhos ordenados P M G',summary.sizes.map(s=>s.name).join(',')==='P,M,G');
const priorities=stockProductSummaries().map(s=>s.zero?0:s.low?1:2);
check('atenção antes dos normais',priorities.every((p,i)=>!i||p>=priorities[i-1]));
check('produto de uma cor',stockProductSummaries().some(s=>s.groups.length===1));

const exists=()=>!!document.querySelector(`[data-stock-detail="${pid}"]`);
for(const [filter,expected] of [['all',true],['low',true],['zero',true],['normal',false]]){
 stockFilter=filter;stockSearch.value='';renderStock();check('filtro '+filter,exists()===expected);
}
stockFilter='all';
for(const search of ['Peça agrupada','Azul','P']){
 stockSearch.value=search;renderStock();check('busca '+search,exists());
 check('busca mantém total completo '+search,document.querySelector(`[data-stock-detail="${pid}"]`).closest('.stock-card').querySelector('.stock-card-quantity strong').textContent==='10');
}
stockSearch.value='';renderStock();
check('placeholder sem foto',document.querySelector(`[data-stock-detail="${pid}"]`).closest('.stock-card').querySelector('.product-image-placeholder'));
openStockDetails(pid);
const groups=[...stockDetailContent.querySelectorAll('.stock-color-detail')];
check('detalhe agrupado por cor',groups.length===2);
check('ordem das cores',groups[0].textContent.includes('Branco'));
check('ordem dos tamanhos no detalhe', [...groups[1].querySelectorAll('.stock-size-detail strong')].map(e=>e.textContent).join(',')==='P,M,G');
check('estados no detalhe',groups[1].textContent.includes('Normal')&&groups[1].textContent.includes('Sem estoque')&&groups[1].textContent.includes('Estoque baixo'));
check('swatch real',groups[0].querySelector('.stock-color-dot').style.background!=='');
groups[1].querySelector('[data-adjust-stock]').click();
for(let i=0;i<50&&productModal.hidden;i++)await new Promise(r=>setTimeout(r,20));
check('ajuste abre editor existente',!productModal.hidden);
check('ajuste seleciona cor correta',productColorsDraft.find(g=>g.key===selectedProductColor)?.id==='stock-blue');
check('IDs dos tamanhos preservados',productVariationsDraft.some(v=>v.variantId==='stock-p'));
closeModal('productModal');closeModal('stockDetailModal');
return JSON.stringify(results,null,2);
