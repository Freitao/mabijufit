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
 product_variants:[{id:'v1',product_id:'p1',color_id:'pink',size_id:'size-p',stock_quantity:8,minimum_stock:2,is_active:true},
 {id:'v2',product_id:'p1',color_id:'black',size_id:'size-m',stock_quantity:1,minimum_stock:2,is_active:true},
 {id:'v3',product_id:'p2',color_id:'pink',size_id:'size-m',stock_quantity:0,minimum_stock:2,is_active:true},
 {id:'v4',product_id:'p1',color_id:'pink',size_id:'size-m',stock_quantity:99,is_active:false},
 {id:'v5',product_id:'p3',color_id:'black',size_id:'size-p',stock_quantity:99,is_active:true}],
 product_images:[],
 sales:[{id:'s1',sale_number:1,total:89.9,status:'completed',cancelled_at:null,cancellation_reason:null,payment_method:'Pix',sale_date:day.toISOString()}],
 sale_items:[], inventory_movements:[],
 financial_transactions:[{id:'f1',transaction_type:'income',amount:89.9,category:'Venda',reference_id:'s1',description:'Venda #1',transaction_date:dateKey(day),payment_method:'Pix'},
 {id:'f2',transaction_type:'expense',amount:30,category:'Loja',description:'Embalagens',transaction_date:dateKey(day),payment_method:'Dinheiro'},
 {id:'f3',transaction_type:'income',amount:500,description:'Receita antiga',transaction_date:dateKey(oldDay)}]
};
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
let counter = 100;
// Sequência independente dos IDs e das vendas existentes, como uma identity.
let saleIdentity = 7000;
const relate = (table,row) => {
 const copy = {...row};
 if(table === 'products') copy.categories = mockDB.categories.find(x=>x.id===row.category_id);
 if(table === 'product_variants') {
  copy.products = mockDB.products.find(x=>x.id===row.product_id);
  copy.colors = mockDB.colors.find(x=>x.id===row.color_id);
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
  if(mockStorageFailure){mockStorageFailure=false;return {error:{message:'Falha Storage simulada'}};}
  return {data:{path},error:null};
 },remove:async()=>({error:null}),getPublicUrl:path=>({data:{publicUrl:'/assets/icons/icon-192.png'}})})}
};
