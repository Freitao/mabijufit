// Exclusivo do servidor de testes: nenhuma chamada alcança o Supabase.
window.reviewErrors = [];
window.addEventListener('error', e => reviewErrors.push(e.message));
window.addEventListener('unhandledrejection', e => reviewErrors.push(String(e.reason)));
window.alert = message => { window.lastAlert = message; };
window.confirm = () => true;
const day = new Date();
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const oldDay = new Date(day); oldDay.setDate(day.getDate()-45);
const mockUser = {id:'review-user', email:'marcela.email.muito.longo@exemplo.com', user_metadata:{}};
window.mockDB = {
 profiles:[{id:mockUser.id,full_name:'Marcela'}],
 categories:[{id:'cat',name:'Moda fitness',description:'Peças para acompanhar você',is_active:true}],
 colors:[{id:'pink',name:'Rosa',hex_code:'#c96f8c',is_active:true},{id:'black',name:'Preto',hex_code:'#242424',is_active:true}],
 sizes:[{id:'size-p',name:'P',display_order:1,is_active:true},{id:'size-m',name:'M',display_order:2,is_active:true}],
 products:[{id:'p1',name:'Top Fitness',sku:'TOP001',category_id:'cat',sale_price:89.9,cost_price:40,minimum_stock:2,is_active:true,created_at:day.toISOString()},
 {id:'p2',name:'Legging Cintura Alta',sku:'LEG001',category_id:'cat',sale_price:129.9,cost_price:60,minimum_stock:2,is_active:true,created_at:oldDay.toISOString()},
 {id:'p3',name:'Produto desativado',sku:'OLD001',sale_price:79.9,minimum_stock:1,is_active:false}],
 product_colors:[{id:'pc-pink',product_id:'p1',color_id:'pink',is_active:true,display_order:0},{id:'pc-black',product_id:'p1',color_id:'black',is_active:true,display_order:1},{id:'pc-p2',product_id:'p2',color_id:'pink',is_active:true,display_order:0},{id:'pc-p3',product_id:'p3',color_id:'black',is_active:true,display_order:0}],
 product_variants:[{id:'v1',product_id:'p1',product_color_id:'pc-pink',size_id:'size-p',stock_quantity:8,minimum_stock:2,is_active:true},
 {id:'v2',product_id:'p1',product_color_id:'pc-black',size_id:'size-m',stock_quantity:1,minimum_stock:2,is_active:true},
 {id:'v3',product_id:'p2',product_color_id:'pc-p2',size_id:'size-m',stock_quantity:0,minimum_stock:2,is_active:true},
 {id:'v4',product_id:'p1',product_color_id:'pc-pink',size_id:'size-m',stock_quantity:99,is_active:false},
 {id:'v5',product_id:'p3',product_color_id:'pc-p3',size_id:'size-p',stock_quantity:99,is_active:true}],
 product_images:[],
 sales:[{id:'s1',sale_number:1,total:89.9,status:'completed',cancelled_at:null,cancellation_reason:null,payment_method:'Pix',sale_date:day.toISOString()}],
 sale_items:[], inventory_movements:[],
 financial_transactions:[{id:'f1',transaction_type:'income',amount:89.9,category:'Venda',reference_id:'s1',description:'Venda #1',transaction_date:dateKey(day),payment_method:'Pix'},
 {id:'f2',transaction_type:'expense',amount:30,category:'Loja',description:'Embalagens',transaction_date:dateKey(day),payment_method:'Dinheiro'},
 {id:'f3',transaction_type:'income',amount:500,description:'Receita antiga',transaction_date:dateKey(oldDay)}]
};
for(const product of mockDB.products) product.edit_revision=1;
for(const rows of Object.values(mockDB)) for(const row of rows) row.user_id = mockUser.id;
const persistedReviewDB=sessionStorage.getItem('review-db-reload');
if(persistedReviewDB) { Object.assign(mockDB,JSON.parse(persistedReviewDB));sessionStorage.removeItem('review-db-reload'); }
window.mockCalls = [];
window.mockFailure = null;
window.mockAuthListener = null;
window.mockSession = sessionStorage.getItem('review-session') ? {user:mockUser} : null;
window.mockLogoutError = null;
window.mockDelay = null;
window.mockBeforeRun = null;
window.mockStorageFailure = false;
window.mockStorageRemoveFailure = false;
let counter = 100;
// Sequência independente dos IDs e das vendas existentes, como uma identity.
let saleIdentity = 7000;
const relate = (table,row) => {
 const copy = {...row};
 if(table === 'product_colors') copy.colors=mockDB.colors.find(x=>x.id===row.color_id);
 if(table === 'products') copy.categories = mockDB.categories.find(x=>x.id===row.category_id);
 if(table === 'product_variants') {
  copy.products = mockDB.products.find(x=>x.id===row.product_id);

  copy.sizes = mockDB.sizes.find(x=>x.id===row.size_id);
 }
 return copy;
};
class Query {
 constructor(table){this.table=table;this.filters=[];this.action='select';this.orders=[];}
 select(){return this;} eq(k,v){this.filters.push(x=>x[k]===v);return this;}
 is(k,v){this.filters.push(x=>x[k]===v);return this;}
 in(k,values){this.filters.push(x=>values.includes(x[k]));return this;}
 order(k,options={}){this.orders.push([k,options.ascending!==false]);return this;}
 range(start,end){this.start=start;this.end=end;return this;}
 limit(n){this.count=n;return this;} single(){this.one=true;return this;} maybeSingle(){this.one=true;this.optional=true;return this;}
 insert(value){this.action='insert';this.value=value;return this;}
 update(value){this.action='update';this.value=value;return this;}
 delete(){this.action='delete';return this;}
 then(resolve,reject){return Promise.resolve().then(async()=>{
  const result=this.run();
  if(mockDelay?.table===this.table){const wait=mockDelay;mockDelay=null;await wait.promise;}
  return result;
 }).then(resolve,reject);}
 run(){
  mockBeforeRun?.(this);
  mockCalls.push({table:this.table,action:this.action,value:structuredClone(this.value)});
  if(mockFailure?.table===this.table && mockFailure.action===this.action){const error=mockFailure.error||{message:'Falha simulada'};mockFailure=null;return {data:null,error};}
  if(this.table==='sales' && ['insert','update'].includes(this.action) &&
     (Array.isArray(this.value)?this.value:[this.value]).some(value=>Object.hasOwn(value,'sale_number'))){
   return {data:null,error:{code:'428C9',message:'cannot insert a non-DEFAULT value into column "sale_number"'}};
  }
  // Constraint confirmada pela resposta real fornecida pelo usuário.
  if(this.table==='financial_transactions' && this.action==='insert' &&
     (Array.isArray(this.value)?this.value:[this.value]).some(value=>value.category==null)){
   return {data:null,error:{code:'23502',details:null,hint:null,message:'null value in column "category" of relation "financial_transactions" violates not-null constraint'}};
  }
  let rows=mockDB[this.table].filter(x=>this.filters.every(f=>f(x)));
  if(this.action==='insert'){
   rows=(Array.isArray(this.value)?this.value:[this.value]).map(x=>({...x,id:`new-${++counter}`,created_at:new Date().toISOString()}));
   if(this.table==='sales') for(const row of rows) {row.sale_number=++saleIdentity;row.cancelled_at??=null;row.cancellation_reason??=null;}
   mockDB[this.table].push(...rows);
  }
  if(this.action==='update') for(const row of rows) Object.assign(row,this.value);
  if(this.action==='delete') mockDB[this.table]=mockDB[this.table].filter(x=>!rows.includes(x));
  for(const [k,asc] of [...this.orders].reverse()) rows.sort((a,b)=>(a[k]>b[k]?1:a[k]<b[k]?-1:0)*(asc?1:-1));
  if(this.count) rows=rows.slice(0,this.count);
  if(this.start!==undefined) rows=rows.slice(this.start,this.end+1);
  const data=rows.map(x=>relate(this.table,x));
  return {data:this.one?(data[0]||null):data,error:this.one&&data.length!==1&&!(this.optional&&data.length===0)?{code:'PGRST116',message:'Esperado um registro'}:null};
 }
}
const supabaseClient = {
 from: table=>new Query(table),
 rpc:(name,args)=>mockRpc(name,args),
 auth:{getSession:async()=>({data:{session:mockSession},error:null}),
 signInWithPassword:async()=>{
  mockSession={user:mockUser};sessionStorage.setItem('review-session','1');
  await mockAuthListener?.('SIGNED_IN',mockSession);
  return {data:{session:mockSession,user:mockUser},error:null};
 },
 signOut:async()=>{
  if(mockLogoutError)return {error:mockLogoutError};
  mockSession=null;sessionStorage.removeItem('review-session');mockAuthListener?.('SIGNED_OUT',null);return {error:null};
 },onAuthStateChange:fn=>{mockAuthListener=fn;return {data:{subscription:{unsubscribe(){}}}};}},
 storage:{from:()=>({upload:async path=>{
  mockCalls.push({table:"storage",action:"upload",path});
  if(mockStorageFailure){mockStorageFailure=false;return {error:{message:'Falha Storage simulada'}};}
  return {data:{path},error:null};
 },remove:async paths=>{mockCalls.push({table:"storage",action:"remove",paths});if(mockStorageRemoveFailure){mockStorageRemoveFailure=false;return {error:{message:"Falha ao remover"}};}return {error:null};},getPublicUrl:path=>({data:{publicUrl:'/assets/icons/icon-192.png'}})})}
};

// Contratos RPC simulados. Testam o frontend, não substituem testes SQL/RLS reais.
window.mockRpcFailure = null;
window.mockRpcLostResponse = null;
window.mockMaintenance = false;
async function mockRpc(name,args) {
 mockCalls.push({table:name,action:'rpc',value:structuredClone(args)});
 if(mockMaintenance) return {data:null,error:{code:'42501',message:'row-level security'}};
 if(mockRpcFailure?.afterCalls>0) mockRpcFailure.afterCalls--;
 else if(mockRpcFailure) {const error=mockRpcFailure;mockRpcFailure=null;return {data:null,error};}
 const before=structuredClone(mockDB);
 const uid=currentUser.id;
 const make=(values)=>({id:crypto.randomUUID(),user_id:uid,created_at:new Date().toISOString(),...values});
 const fail=(message,code='P0001')=>{throw {message,code};};
 try {
 let data;
 if(name==='pc_save_product') {
  let product=mockDB.products.find(p=>p.id===args.p_product_id&&p.user_id===uid);
  if(args.p_product_id && (!product || product.edit_revision!==args.p_expected_revision)) fail('Produto desatualizado','40001');
  if(!product) {product=make({is_active:true,edit_revision:0});mockDB.products.push(product);}
  const keys={};
  for(const g of args.p_colors||[]) {
   let row=mockDB.product_colors.find(c=>c.id===g.id);
   if(!row){row=make({product_id:product.id});mockDB.product_colors.push(row);}
   Object.assign(row,{color_id:g.color_id,is_active:g.is_active,display_order:g.display_order});keys[g.key]=row.id;
  }
  for(const v of args.p_variants||[]) {
   const gid=v.color_key?keys[v.color_key]:v.product_color_id;
   let row=mockDB.product_variants.find(x=>x.id===v.id);
   if(row && row.stock_quantity!==v.expected_stock_quantity) fail('Estoque alterado','40001');
   if(!row) {
    if(mockDB.product_variants.some(x=>x.product_color_id===gid&&x.size_id===v.size_id)) fail('Identidade duplicada','23505');
    row=make({product_id:product.id,product_color_id:gid,size_id:v.size_id});mockDB.product_variants.push(row);
   }
   Object.assign(row,{stock_quantity:v.stock_quantity,is_active:v.is_active,minimum_stock:v.minimum_stock});
  }
  const removed=mockDB.product_images.filter(i=>(args.p_remove_image_ids||[]).includes(i.id));
  mockDB.product_images=mockDB.product_images.filter(i=>!removed.includes(i));
  for(const img of args.p_images||[]) {
   let row=mockDB.product_images.find(i=>i.id===img.id||(img.storage_path&&i.storage_path===img.storage_path));
   if(!row) {row=make({product_id:product.id});mockDB.product_images.push(row);}
   Object.assign(row,img);
  }
  Object.assign(product,args.p_product);product.edit_revision++;
  data={product,color_keys:keys,variants:mockDB.product_variants.filter(v=>v.product_id===product.id),images:mockDB.product_images.filter(i=>i.product_id===product.id),removed_storage_paths:removed.map(i=>i.storage_path)};
 } else if(name==='pc_register_sale') {
  let sale=mockDB.sales.find(s=>s.client_request_id===args.p_client_request_id&&s.user_id===uid);
  if(sale) data={sale,replayed:true};
  else {
   let subtotal=0;
   for(const item of args.p_items){
    const v=mockDB.product_variants.find(v=>v.id===item.variant_id),g=mockDB.product_colors.find(g=>g.id===v?.product_color_id),p=mockDB.products.find(p=>p.id===v?.product_id);
    if(!v?.is_active||!g?.is_active||!p?.is_active||v.stock_quantity<item.quantity) fail('Estoque indisponível');
    subtotal+=p.sale_price*item.quantity;
   }
   sale=make({client_request_id:args.p_client_request_id,sale_number:++saleIdentity,subtotal,discount:args.p_discount,total:subtotal-args.p_discount,status:'completed',payment_method:args.p_payment_method,notes:args.p_notes,sale_date:new Date().toISOString(),cancelled_at:null});mockDB.sales.push(sale);
   for(const item of args.p_items){
    const v=mockDB.product_variants.find(v=>v.id===item.variant_id),p=mockDB.products.find(p=>p.id===v.product_id),g=mockDB.product_colors.find(g=>g.id===v.product_color_id);
    v.stock_quantity-=item.quantity;
    mockDB.sale_items.push(make({sale_id:sale.id,product_variant_id:v.id,product_name:p.name,variant_description:(mockDB.colors.find(c=>c.id===g.color_id)?.name||'Sem cor')+' / '+mockDB.sizes.find(s=>s.id===v.size_id).name,quantity:item.quantity,unit_price:p.sale_price,total:p.sale_price*item.quantity}));
    mockDB.inventory_movements.push(make({product_variant_id:v.id,reference_id:sale.id,movement_type:'sale',quantity:item.quantity}));
   }
   mockDB.financial_transactions.push(make({reference_id:sale.id,transaction_type:'income',category:'Venda',amount:sale.total,description:'Venda #'+sale.sale_number,transaction_date:dateKey(new Date()),payment_method:sale.payment_method}));
   data={sale,replayed:false};
  }
 } else if(name==='pc_cancel_sale') {
  const sale=mockDB.sales.find(s=>s.id===args.p_sale_id&&s.user_id===uid);if(!sale)fail('Venda ausente');
  const already=sale.status==='cancelled';
  if(!already){
   for(const item of mockDB.sale_items.filter(i=>i.sale_id===sale.id)) {
    mockDB.product_variants.find(v=>v.id===item.product_variant_id).stock_quantity+=item.quantity;
    mockDB.inventory_movements.push(make({reference_id:sale.id,product_variant_id:item.product_variant_id,movement_type:'sale_cancel',quantity:item.quantity}));
   }
   mockDB.financial_transactions=mockDB.financial_transactions.filter(f=>f.reference_id!==sale.id);
   sale.status='cancelled';sale.cancelled_at=new Date().toISOString();sale.cancellation_reason=args.p_reason;
  }
  data={sale,already_cancelled:already};
 } else if(name==='pc_delete_product') {
  const p=mockDB.products.find(p=>p.id===args.p_product_id&&p.user_id===uid);
  if(!p||p.edit_revision!==args.p_expected_revision)fail('Revisão desatualizada','40001');
  const variants=mockDB.product_variants.filter(v=>v.product_id===p.id);
  if(variants.some(v=>v.stock_quantity>0)||mockDB.sale_items.some(i=>variants.some(v=>v.id===i.product_variant_id)))fail('Produto possui estoque ou histórico; desative');
  data={product_id:p.id,removed_storage_paths:mockDB.product_images.filter(i=>i.product_id===p.id).map(i=>i.storage_path)};
  for(const table of ['product_images','product_variants','product_colors'])mockDB[table]=mockDB[table].filter(r=>r.product_id!==p.id);
  mockDB.products=mockDB.products.filter(r=>r.id!==p.id);
 } else fail('RPC desconhecida');
 if(mockRpcLostResponse===name){mockRpcLostResponse=null;return {data:null,error:{message:'Resposta perdida'}};}
 return {data:structuredClone(data),error:null};
 } catch(error) {Object.assign(mockDB,before);return {data:null,error};}
}
