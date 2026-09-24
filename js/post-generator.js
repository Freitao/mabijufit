/* Divulgação — consumidor dos caches. Sem banco, uploads ou publicação automática. */
"use strict";
const PostGenerator = (() => {
    const FORMATS = Object.freeze({story: {width:1080, height:1920, safe:{x:80, top:160, bottom:240}}});
    const STEPS = ['Produto','Cor e fotos','Informações','Template','Prévia','Exportar'];
    const TYPES = {product:'Produto',new:'Novidade',promotion:'Promoção',last:'Últimas unidades'};
    const CTAS = ['Chame no WhatsApp','Chame no Direct','Eu quero','Garanta já','Consulte disponibilidade'];
    const $ = selector => root.querySelector(selector);
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
    const validHex = hex => /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#c96f8c';
    function hexToRgb(hex) { return validHex(hex).slice(1).match(/../g).map(c=>parseInt(c,16)); }
    function rgbToHex(rgb) { return '#'+rgb.map(n=>Math.round(Math.max(0,Math.min(255,n))).toString(16).padStart(2,'0')).join(''); }
    function mix(a,b,amount) {const aa=hexToRgb(a),bb=hexToRgb(b);return rgbToHex(aa.map((n,i)=>n+(bb[i]-n)*amount));}
    function luminance(hex) {const rgb=hexToRgb(hex).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
    function textColor(hex) {return (luminance(hex)+.05)/.05 > 1.05/(luminance(hex)+.05) ? '#171217' : '#ffffff';}
    function palette(hex) {
        const base=validHex(hex);
        const accent=mix(base,'#3e1527',.5);
        return {base,background:mix(base,'#fffaf6',.94),soft:mix(base,'#fff4f7',.8),accent,ink:'#281f24',onAccent:textColor(accent)};
    }
    function discount(original,price) {return original>price && price>=0 && original>0 ? Math.round((original-price)/original*100) : 0;}
    function available(snapshot,groupId) {
        const groups=snapshot.groups.filter(g=>g.is_active!==false);
        const rows=snapshot.variants.filter(v=>v.is_active!==false && Number(v.stock_quantity)>0 && groups.some(g=>g.id===v.product_color_id));
        const selected=groupId===null?rows:rows.filter(v=>v.product_color_id===groupId);
        const sizes=snapshot.sizes.filter(s=>selected.some(v=>v.size_id===s.id)).sort((a,b)=>(a.display_order??0)-(b.display_order??0)||a.name.localeCompare(b.name));
        return {stock:selected.reduce((sum,v)=>sum+Number(v.stock_quantity),0),sizes,
            colors:groups.filter(g=>g.color_id && rows.some(v=>v.product_color_id===g.id)).sort((a,b)=>a.display_order-b.display_order)};
    }
    function colorFor(snapshot,group) {return snapshot.colors.find(c=>c.id===group?.color_id);}
    function groupName(snapshot,group) {return colorFor(snapshot,group)?.name || 'Sem cor';}
    function photosFor(snapshot,groupId) {
        return snapshot.images.filter(p=>groupId===null ? p.product_color_id===null || p.is_primary : p.product_color_id===groupId)
            .sort((a,b)=>Number(b.is_color_primary)-Number(a.is_color_primary)||a.display_order-b.display_order);
    }
    function imagePlacement(iw,ih,box,fit,focus) {
        const scale=(fit==='contain'?Math.min:Math.max)(box.w/iw,box.h/ih),w=iw*scale,h=ih*scale;
        return {x:box.x+(box.w-w)*focus.x/100,y:box.y+(box.h-h)*focus.y/100,w,h};
    }
    function roundRect(ctx,x,y,w,h,r=24) {
        ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
        ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
    }
    function panel(ctx,box,color,r=24) {ctx.fillStyle=color;roundRect(ctx,box.x,box.y,box.w,box.h,r);ctx.fill();}
    function photo(ctx,image,box,draft,p) {
        panel(ctx,box,p.soft,24);ctx.save();roundRect(ctx,box.x,box.y,box.w,box.h,24);ctx.clip();
        const r=imagePlacement(image.width,image.height,box,draft.fit,draft.focus);ctx.drawImage(image,r.x,r.y,r.w,r.h);ctx.restore();
    }
    function text(ctx,value,x,y,width,size=42,color='#281f24',font='Arial',weight='400') {
        font=font==='Georgia'?'Georgia, serif':font==='Arial'?'Arial, sans-serif':font;
        let actual=size;ctx.font=`${weight} ${actual}px ${font}`;
        while(ctx.measureText(value).width>width&&actual>20){actual-=1;ctx.font=`${weight} ${actual}px ${font}`;}
        ctx.fillStyle=color;ctx.textBaseline='top';ctx.fillText(value,x,y,width);
    }
    function title(ctx,value,box,color,font='Georgia') {
        let size=box.size||70,lines=[];
        const wrap=()=>{
            ctx.font=`${size}px ${font}`;lines=[];let line='';
            for(const word of value.split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>box.w&&line){lines.push(line);line=word;}else line=next;}
            if(line)lines.push(line);
        };
        wrap();while(lines.length>2&&size>32){size-=2;wrap();}
        lines.slice(0,2).forEach((line,i)=>text(ctx,line,box.x,box.y+i*(size+8),box.w,size,color,font));
    }
    function brand(ctx,color){text(ctx,'M A B I J U F I T',80,170,920,30,color,'Arial','500');}
    function swatches(ctx,data,p,x,y,color) {
        if(!data.draft.showColors)return;
        const groups=data.availability.colors.slice(0,14);
        groups.forEach((g,i)=>{const hex=validHex(colorFor(data.snapshot,g)?.hex_code);ctx.beginPath();ctx.arc(x+18+i*53,y+18,17,0,Math.PI*2);ctx.fillStyle=hex;ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=color==='#ffffff'?'#ffffff':'#a7989e';ctx.stroke();});
        if(data.availability.colors.length>14)text(ctx,`+${data.availability.colors.length-14}`,x+14*53,y,80,26,color);
    }
    function sizesLine(ctx,data,x,y,w,color) {
        if(!data.draft.showSizes)return;
        const names=data.availability.sizes.map(s=>s.name).join(' • ');
        text(ctx,names?`Disponível em  ${names}`:'Consulte disponibilidade',x,y,w,32,color);
    }
    function cta(ctx,draft,box,p) {
        if(!draft.showCta)return;
        panel(ctx,box,p.accent,28);text(ctx,draft.cta,box.x+30,box.y+27,box.w-60,34,p.onAccent,'Arial','700');
    }
    function badge(ctx,draft,box,p) {
        if(!draft.showBadge||!draft.badge.trim())return;
        panel(ctx,box,p.accent,18);text(ctx,draft.badge.toUpperCase(),box.x+24,box.y+18,box.w-48,34,p.onAccent,'Arial','700');
    }
    // Coordenadas pertencem aos templates, sempre na resolução do formato Story.
    const TEMPLATES = {
        editorial:{name:'Editorial',description:'Foto protagonista, elegante e minimalista.',render(ctx,image,data,p){
            photo(ctx,image,{x:0,y:0,w:1080,h:1920},data.draft,p);
            const gradient=ctx.createLinearGradient(0,700,0,1920);gradient.addColorStop(0,'rgba(12,8,12,0)');gradient.addColorStop(.43,'rgba(12,8,12,.78)');gradient.addColorStop(1,'rgba(12,8,12,.96)');ctx.fillStyle=gradient;ctx.fillRect(0,700,1080,1220);
            ctx.fillStyle='rgba(12,8,12,.55)';ctx.fillRect(0,145,1080,85);brand(ctx,'#ffffff');
            badge(ctx,data.draft,{x:80,y:1080,w:500,h:76},p);
            if(data.draft.showTitle)title(ctx,data.draft.title,{x:80,y:1190,w:920,size:82},'#ffffff');
            if(data.draft.showPrice)text(ctx,money(data.draft.price),80,1390,920,70,'#ffffff','Arial','700');
            swatches(ctx,data,p,80,1490,'#ffffff');sizesLine(ctx,data,80,1550,920,'#ffffff');
            cta(ctx,data.draft,{x:80,y:1590,w:920,h:90},p);
        }},
        showcase:{name:'Vitrine',description:'Organiza fotos de cabide, arara ou do dia a dia.',render(ctx,image,data,p){
            brand(ctx,p.ink);badge(ctx,data.draft,{x:600,y:155,w:400,h:74},p);
            photo(ctx,image,{x:80,y:280,w:920,h:860},data.draft,p);
            if(data.draft.showTitle)title(ctx,data.draft.title,{x:80,y:1170,w:920,size:64},p.ink);
            if(data.draft.showPrice){panel(ctx,{x:80,y:1320,w:920,h:100},p.soft,40);text(ctx,money(data.draft.price),115,1335,850,64,p.accent,'Arial','700');}
            swatches(ctx,data,p,80,1450,p.ink);sizesLine(ctx,data,80,1520,920,p.ink);
            cta(ctx,data.draft,{x:80,y:1580,w:920,h:100},p);
        }},
        promotion:{name:'Promoção',description:'Preço e chamada em destaque, sem excessos.',render(ctx,image,data,p){
            brand(ctx,p.ink);badge(ctx,data.draft,{x:80,y:250,w:920,h:82},p);
            photo(ctx,image,{x:80,y:360,w:920,h:750},data.draft,p);
            if(data.draft.showTitle)title(ctx,data.draft.title,{x:80,y:1140,w:920,size:60},p.ink);
            const promotion=data.draft.type==='promotion';
            if(data.draft.showPrice){
                if(promotion&&data.draft.showOriginal){const original=`DE ${money(data.draft.original)}`;text(ctx,original,80,1290,620,32,p.ink);ctx.strokeStyle=p.accent;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(80,1309);ctx.lineTo(80+ctx.measureText(original).width,1309);ctx.stroke();}
                text(ctx,(promotion?'POR ':'')+money(data.draft.price),80,1350,690,64,p.accent,'Arial','700');
                if(promotion&&data.draft.showDiscount){panel(ctx,{x:785,y:1330,w:215,h:100},p.accent,24);text(ctx,`${discount(data.draft.original,data.draft.price)}% OFF`,800,1360,185,38,p.onAccent,'Arial','700');}
            }
            swatches(ctx,data,p,80,1460,p.ink);sizesLine(ctx,data,80,1530,920,p.ink);cta(ctx,data.draft,{x:80,y:1580,w:920,h:100},p);
        }}
    };
    let root,adapter,owner=null,draft=null,snapshot=null,step=0,maxStep=0,version=0,rendered=-1,timer=null;
    let imageCache=null,abortController=null,file=null,fileUrl=null,renderPromise=null,exporting=false;
    function invalidateFile(){file=null;if(fileUrl){URL.revokeObjectURL(fileUrl);fileUrl=null;}if(root){$('[data-post-download]').removeAttribute('href');$('[data-post-share]').disabled=true;$('[data-post-export-image]').removeAttribute('src');}}
    function reset(){version++;clearTimeout(timer);abortController?.abort();imageCache?.image?.close?.();imageCache=null;invalidateFile();draft=null;snapshot=null;owner=null;step=0;maxStep=0;rendered=-1;exporting=false;if(root){const canvas=$('[data-post-canvas]');canvas.width=1;canvas.height=1;$('[data-post-content]').replaceChildren();$('[data-post-progress]').replaceChildren();message('');root.hidden=true;}}
    function message(value,error=false){const el=$('[data-post-message]');el.textContent=value;el.classList.toggle('error',error);}
    function readData(){return adapter.data();}
    function newDraft(product){
        const data=readData();snapshot=structuredClone({product,groups:data.groups.filter(g=>g.product_id===product.id),variants:data.variants.filter(v=>v.product_id===product.id),images:data.images[product.id]||[],colors:data.colors,sizes:data.sizes});
        const groups=snapshot.groups.filter(g=>g.is_active!==false).sort((a,b)=>a.display_order-b.display_order);
        const selected=groups.find(g=>available(snapshot,g.id).stock>0&&photosFor(snapshot,g.id).length)||groups[0];
        draft={format:'story',productId:product.id,groupId:selected?.id||null,photoIds:[],type:'product',title:String(product.name||'').slice(0,80),price:Number(product.sale_price),original:Number(product.sale_price),
            visibilityCustomized:false,showTitle:true,showPrice:true,showOriginal:true,showDiscount:true,showSizes:true,showColors:true,showBadge:false,badge:'',showCta:true,cta:CTAS[0],template:'showcase',fit:'contain',focus:{x:50,y:50}};
        const first=photosFor(snapshot,draft.groupId)[0];if(first)draft.photoIds=[first.id];
        step=1;maxStep=1;renderUI();schedule();
    }
    function swatch(hex){return `<span class="post-swatch" style="background:${validHex(hex)}" aria-hidden="true"></span>`;}
    function productsList(search='') {
        const data=readData();const products=data.products.filter(p=>p.is_active!==false&&`${p.name} ${p.sku||''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
        return products.map(p=>{const images=data.images[p.id]||[],cover=images.find(i=>i.is_primary)||images[0];const stock=data.variants.filter(v=>v.product_id===p.id&&v.is_active!==false&&data.groups.some(g=>g.id===v.product_color_id&&g.is_active!==false)).reduce((n,v)=>n+Number(v.stock_quantity||0),0);
            return `<button class="post-product" type="button" data-post-product="${p.id}" aria-pressed="${draft?.productId===p.id}">${cover?`<img src="${escape(cover.public_url)}" alt="" loading="lazy"/>`:'<span class="post-no-photo">Sem foto</span>'}<span><strong>${escape(p.name)}</strong><small>${money(p.sale_price)} · ${stock} un.</small>${!stock?'<small>Sem estoque · consulte disponibilidade</small>':''}</span><span aria-hidden="true">›</span></button>`;
        }).join('')||'<p class="post-empty">Nenhum produto ativo encontrado. Cadastre um produto e suas fotos para começar.</p>';
    }
    function cropControls(){return `<details class="post-crop"><summary>Ajustar enquadramento</summary><label>Encaixe<select data-post-field="fit"><option value="contain" ${draft.fit==='contain'?'selected':''}>Foto inteira (sem cortes)</option><option value="cover" ${draft.fit==='cover'?'selected':''}>Preencher o espaço</option></select></label><label>Posição horizontal<input type="range" min="0" max="100" value="${draft.focus.x}" data-post-focus="x"/></label><label>Posição vertical<input type="range" min="0" max="100" value="${draft.focus.y}" data-post-focus="y"/></label><p>Este ajuste vale só para a arte. A foto original permanece intacta.</p></details>`;}
    function toggle(key,label){return `<label class="post-toggle"><span>${label}</span><input type="checkbox" data-post-field="${key}" ${draft[key]?'checked':''}/></label>`;}
    function information(){const a=available(snapshot,draft.groupId);return `<label>Tipo de postagem<select data-post-field="type">${Object.entries(TYPES).map(([key,label])=>`<option value="${key}" ${key===draft.type?'selected':''}>${label}</option>`).join('')}</select></label>
        ${a.stock>0&&a.stock<=3?'<p class="post-hint">Poucas peças disponíveis. Você pode usar “Últimas unidades”.</p>':''}
        ${!a.stock?'<p class="post-warning">Sem estoque nesta seleção. Não há tamanhos disponíveis para anunciar.</p>':''}
        ${toggle('showTitle','Mostrar título')}<label data-post-visible="showTitle">Texto principal<input data-post-field="title" value="${escape(draft.title)}" maxlength="80"/></label>
        ${toggle('showPrice','Mostrar preço')}<label data-post-visible="showPrice">Preço na arte (R$)<input type="number" inputmode="decimal" min="0" max="9999999" step="0.01" data-post-field="price" value="${draft.price}"/></label>
        <div data-post-promotion ${draft.type==='promotion'?'':'hidden'}><label>Preço original (R$)<input type="number" inputmode="decimal" min="0" max="9999999" step="0.01" data-post-field="original" value="${draft.original}"/></label>${toggle('showOriginal','Mostrar preço anterior')}${toggle('showDiscount','Mostrar desconto')}<p data-post-discount>${discount(draft.original,draft.price)}% OFF · no template Promoção</p></div>
        <details class="post-options"><summary>Disponibilidade e chamadas</summary>${toggle('showSizes','Mostrar tamanhos disponíveis')}<p class="post-hint">${escape(a.sizes.map(s=>s.name).join(' • ')||'Nenhum tamanho com estoque')}</p>
        ${toggle('showColors','Mostrar cores disponíveis')}<div class="post-available-colors">${a.colors.map(g=>`<span>${swatch(colorFor(snapshot,g)?.hex_code)}${escape(groupName(snapshot,g))}</span>`).join('')||'Nenhuma cor com estoque'}</div>
        ${toggle('showBadge','Mostrar chamada')}<label data-post-visible="showBadge">Selo ou chamada<input data-post-field="badge" maxlength="32" value="${escape(draft.badge)}" placeholder="Ex.: Nova coleção"/></label>
        ${toggle('showCta','Mostrar chamada para ação')}<label data-post-visible="showCta">Chamada para ação<select data-post-field="cta">${CTAS.map(c=>`<option ${c===draft.cta?'selected':''}>${c}</option>`).join('')}</select></label></details><p class="post-hint">Texto e preços são apenas desta arte; o cadastro não será alterado.</p>`;}
    function renderUI(){
        root.hidden=false;
        $('[data-post-progress]').innerHTML=STEPS.map((label,i)=>`<button type="button" data-post-step="${i}" ${i>maxStep?'disabled':''} aria-current="${i===step?'step':'false'}"><span>${i+1}</span>${label}</button>`).join('');
        $('[data-post-heading]').textContent=STEPS[step];
        const content=$('[data-post-content]');
        if(step===0)content.innerHTML=`<label class="post-search">Buscar produto<input type="search" data-post-search placeholder="Nome ou código"/></label><div data-post-products>${productsList()}</div>`;
        if(step===1){const a=available(snapshot,draft.groupId);const groups=snapshot.groups.filter(g=>g.is_active!==false).sort((a,b)=>a.display_order-b.display_order);const photos=photosFor(snapshot,draft.groupId);
            content.innerHTML=`<p class="post-selected-product">${escape(snapshot.product.name)}</p><div class="post-color-list">${groups.map(g=>`<button type="button" data-post-group="${g.id}" aria-pressed="${draft.groupId===g.id}">${g.color_id?swatch(colorFor(snapshot,g)?.hex_code):'<span class="post-swatch post-neutral" aria-hidden="true"></span>'}<strong>${escape(groupName(snapshot,g))}</strong><small>${available(snapshot,g.id).stock} un.</small></button>`).join('')}</div>
            <button type="button" class="text-button" data-post-group="" aria-pressed="${draft.groupId===null}">Capa e fotos do produto</button>
            <p class="post-hint">${draft.groupId===null?'Fotos do produto · disponibilidade de todas as cores':escape(groupName(snapshot,groups.find(g=>g.id===draft.groupId)))}${!a.stock?' · Sem estoque':''}</p>
            <div class="post-photo-list">${photos.map(p=>`<button type="button" data-post-photo="${p.id}" aria-pressed="${draft.photoIds[0]===p.id}"><img loading="lazy" decoding="async" src="${escape(p.public_url)}" alt="Selecionar ${p.is_color_primary?'foto principal':'foto'}"/><span>${draft.photoIds[0]===p.id?'✓ Selecionada':p.is_color_primary?'Principal':'Escolher'}</span></button>`).join('')||'<p class="post-empty">Sem foto nesta seleção. Escolha outra cor ou a capa do produto. Para adicionar fotos, use o cadastro do produto.</p>'}</div>${photos.length?cropControls():''}`;
        }
        if(step===2)content.innerHTML=information();
        if(step===3)content.innerHTML=`<div class="post-template-list">${Object.entries(TEMPLATES).map(([key,t])=>`<button type="button" data-post-template="${key}" aria-pressed="${draft.template===key}"><span class="post-template-icon ${key}" aria-hidden="true"><img src="${escape(snapshot.images.find(p=>p.id===draft.photoIds[0])?.public_url || '')}" alt="" loading="lazy"/><b></b></span><span><strong>${t.name}</strong><small>${t.description}</small>${key==='promotion'&&draft.type==='promotion'?'<small>Sugerido para esta postagem</small>':''}</span><span aria-hidden="true">›</span></button>`).join('')}</div>`;
        if(step===4)content.innerHTML=`<p>Instagram Story · 1080 × 1920</p><p class="post-hint">Confira foto, preço e disponibilidade antes de gerar.</p>${cropControls()}`;
        if(step===5)content.innerHTML='<p>Sua imagem está pronta. Salve ou abra o compartilhamento do aparelho; a publicação final é feita no Instagram ou WhatsApp.</p><p class="post-hint">Se o navegador abrir a imagem em vez de baixar, mantenha-a pressionada e escolha salvar.</p>';
        $('[data-post-preview]').hidden=step===0||!draft||!draft.photoIds.length;
        $('[data-post-preview]').classList.toggle('large',step>=4);
        $('[data-post-canvas]').hidden=step===5;
        $('[data-post-export-image]').hidden=step!==5;
        $('[data-post-back]').hidden=step===0;
        $('[data-post-next]').hidden=step>=4;
        $('[data-post-next]').disabled=step===0?!draft:step===1?!draft.photoIds.length:false;
        $('[data-post-generate]').hidden=step!==4;
        $('[data-post-export-actions]').hidden=step!==5;
        syncOptions();message('');
    }
    function syncOptions(){if(!draft)return;root.querySelectorAll('[data-post-visible]').forEach(el=>{el.hidden=!draft[el.dataset.postVisible];});}
    function mount(){
        root=document.getElementById('divulgacaoScreen');
        root.innerHTML=`<header class="post-header"><button type="button" class="text-button" data-post-home>‹ Início</button><span class="section-eyebrow">MABIJUFIT</span><h2>Divulgação</h2><p>Suas peças, prontas para compartilhar.</p></header>
            <nav class="post-progress" data-post-progress aria-label="Etapas da divulgação"></nav>
            <div class="post-workspace"><section class="post-controls"><h3 data-post-heading></h3><div data-post-content></div></section>
            <aside class="post-preview" data-post-preview hidden><span>PRÉVIA DO STORY</span><canvas width="1080" height="1920" data-post-canvas role="img" aria-label="Prévia da arte para Story"></canvas><img data-post-export-image alt="PNG gerado para compartilhar" hidden/></aside></div>
            <p class="post-message" data-post-message role="status" aria-live="polite"></p>
            <div class="post-footer"><button type="button" class="secondary-button" data-post-back>Voltar</button><button type="button" class="primary-button" data-post-next>Continuar</button><button type="button" class="primary-button" data-post-generate hidden>Gerar imagem PNG</button></div>
            <div class="post-export-actions" data-post-export-actions hidden><a class="primary-button" data-post-download download="mabijufit-story.png">Baixar / Salvar imagem</a><button type="button" class="secondary-button" data-post-share>Compartilhar</button><p data-post-share-hint class="post-hint"></p><button type="button" class="text-button" data-post-new>+ Nova postagem</button></div>`;
        root.addEventListener('click',onClick);root.addEventListener('input',onInput);root.addEventListener('change',onChange);
    }
    function open(config){adapter=config;if(!root)mount();if(owner!==config.userId){reset();owner=config.userId;}root.hidden=false;if(step===5&&!file)step=4;renderUI();if(draft&&step!==5)schedule();}
    function schedule(){maxStep=Math.min(maxStep,4);version++;invalidateFile();rendered=-1;clearTimeout(timer);if(!root)return;$('[data-post-generate]').disabled=true;timer=setTimeout(()=>{renderPromise=renderPreview(version);},100);}
    async function loadImage(url){
        if(imageCache?.url===url)return imageCache.promise;
        abortController?.abort();imageCache?.image?.close?.();const controller=new AbortController();abortController=controller;
        const cache={url,image:null,promise:null};imageCache=cache;
        cache.promise=(async()=>{
            const response=await fetch(url,{mode:'cors',credentials:'omit',signal:controller.signal});if(!response.ok)throw new Error('Não foi possível carregar a foto. Confira a conexão ou escolha outra imagem.');
            const blob=await response.blob();let source;
            if(typeof createImageBitmap==='function') {
                try {source=await createImageBitmap(blob,{imageOrientation:'from-image'});} catch { /* Safari: fallback com Image. */ }
            }
            if(!source){const url=URL.createObjectURL(blob);try{source=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Esta imagem não pôde ser aberta. Escolha outra foto.'));img.src=url;});}finally{URL.revokeObjectURL(url);}}
            if(controller.signal.aborted){source.close?.();throw new DOMException('Cancelado','AbortError');}
            const w=source.width||source.naturalWidth,h=source.height||source.naturalHeight;if(!w||!h)throw new Error('Foto inválida.');
            if(Math.max(w,h)>2560){const canvas=document.createElement('canvas');const scale=2560/Math.max(w,h);canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);source.close?.();source=canvas;}
            cache.image=source;return source;
        })();
        try{return await cache.promise;}catch(error){if(imageCache===cache)imageCache=null;throw error;}
    }
    function validate(){if(!draft?.photoIds.length)return 'Selecione uma foto para gerar a arte.';
        if(draft.showPrice&&(!Number.isFinite(draft.price)||draft.price<0||draft.price>9999999))return 'Confira o preço da arte.';
        if(draft.showPrice&&Math.abs(draft.price*100-Math.round(draft.price*100))>0.000001)return 'Use um preço com até duas casas decimais.';
        if(draft.type==='promotion'&&draft.showPrice&&(!Number.isFinite(draft.original)||draft.original<=draft.price||draft.original>9999999))return 'Na promoção, informe um preço original maior que o promocional.';
        return '';}
    async function renderPreview(request){
        if(!draft||!draft.photoIds.length)return;
        const error=validate();if(error){message(error,true);return;}
        const photoRow=snapshot.images.find(p=>p.id===draft.photoIds[0]);if(!photoRow){message('Foto não encontrada. Selecione outra.',true);return;}
        const renderData=structuredClone({draft,snapshot,availability:available(snapshot,draft.groupId)});
        message('Preparando prévia…');
        try {
            if(imageCache?.url!==photoRow.public_url)$('[data-post-canvas]').getContext('2d')?.clearRect(0,0,1080,1920);
            const image=await loadImage(photoRow.public_url);await document.fonts?.ready;
            if(request!==version||!owner)return;
            const canvas=$('[data-post-canvas]'),format=FORMATS[draft.format];canvas.width=format.width;canvas.height=format.height;
            const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Este navegador não conseguiu preparar a imagem.');
            const group=snapshot.groups.find(g=>g.id===draft.groupId),p=palette(colorFor(snapshot,group)?.hex_code);
            ctx.fillStyle=p.background;ctx.fillRect(0,0,canvas.width,canvas.height);
            TEMPLATES[draft.template].render(ctx,image,renderData,p);rendered=request;$('[data-post-generate]').disabled=false;message('');
        }catch(error){if(request!==version)return;rendered=-1;message(error.name==='SecurityError'?'A foto não permite exportação neste navegador. Escolha outra imagem.':error.name==='TypeError'?'Não foi possível carregar a foto. Confira a conexão ou escolha outra imagem.':error.message||'Não foi possível preparar a prévia.',true);}
    }
    async function generate(){
        if(exporting)return;const error=validate();if(error){message(error,true);return;}exporting=true;
        const request=version;$('[data-post-generate]').disabled=true;message('Gerando PNG em alta resolução…');
        try {
            clearTimeout(timer);if(rendered!==request)await renderPreview(request);
            if(rendered!==request||request!==version)return;
            const blob=await new Promise((resolve,reject)=>{$('[data-post-canvas]').toBlob(b=>b?resolve(b):reject(new Error('Falha ao gerar PNG. Tente novamente.')),'image/png');});
            if(request!==version||!owner)return;
            invalidateFile();file=new File([blob],'mabijufit-story.png',{type:'image/png'});fileUrl=URL.createObjectURL(file);step=5;maxStep=5;renderUI();
            $('[data-post-export-image]').src=fileUrl;$('[data-post-download]').href=fileUrl;
            const supported=canShareFile(file);$('[data-post-share]').disabled=!supported;
            $('[data-post-share-hint]').textContent=supported?'Escolha o aplicativo no compartilhamento do aparelho.':'Compartilhamento de arquivos indisponível neste navegador. Baixe a imagem para usar no Instagram ou WhatsApp.';
        }catch(error){if(request===version)message(error.name==='SecurityError'?'Não foi possível exportar esta foto por restrição de acesso. Escolha outra foto.':error.message||'Não foi possível gerar a imagem.',true);}
        finally{exporting=false;if(root)$('[data-post-generate]').disabled=rendered!==version;}
    }
    function canShareFile(candidate,nav=navigator){try{return !!nav.share&&(!nav.canShare||nav.canShare({files:[candidate]}));}catch{return false;}}
    async function share(){if(!file)return;const request=version;
        try{await navigator.share({files:[file],title:'MabijuFit'});if(request===version)message('Imagem enviada ao compartilhamento do aparelho.');}
        catch(error){if(request!==version)return;message(error.name==='AbortError'?'Compartilhamento cancelado. Sua imagem continua disponível.':'Não foi possível compartilhar. Use Baixar / Salvar imagem.',error.name!=='AbortError');}
    }
    function onClick(event){const b=event.target.closest('button');if(!b||b.disabled)return;
        if(b.hasAttribute('data-post-home')){adapter.navigate('home');return;}
        if(b.hasAttribute('data-post-new')){reset();owner=adapter.userId;renderUI();return;}
        if(b.dataset.postProduct){const p=readData().products.find(p=>p.id===b.dataset.postProduct&&p.is_active!==false);if(p)newDraft(p);return;}
        if(b.hasAttribute('data-post-group')){draft.groupId=b.dataset.postGroup||null;draft.photoIds=photosFor(snapshot,draft.groupId).slice(0,1).map(p=>p.id);draft.focus={x:50,y:50};renderUI();schedule();return;}
        if(b.dataset.postPhoto){draft.photoIds=[b.dataset.postPhoto];renderUI();schedule();return;}
        if(b.dataset.postTemplate){draft.template=b.dataset.postTemplate;if(!draft.visibilityCustomized){draft.showSizes=draft.showColors=draft.showCta=draft.template!=='editorial';}renderUI();schedule();return;}
        if(b.hasAttribute('data-post-generate')){generate();return;}
        if(b.hasAttribute('data-post-share')){share();return;}
        let next=step;
        if(b.hasAttribute('data-post-back'))next=Math.max(0,step-1);
        if(b.hasAttribute('data-post-next')){if(step===0&&!draft||step===1&&!draft.photoIds.length)return;if(step===2&&validate()){message(validate(),true);return;}next=Math.min(4,step+1);}
        if(b.hasAttribute('data-post-step'))next=Number(b.dataset.postStep);
        if(next<=Math.max(maxStep,step+1)&&next!==step){step=next;maxStep=Math.max(maxStep,step);renderUI();if(draft&&step<5)schedule();root.scrollIntoView({block:'start'});}
    }
    function updateField(el){const key=el.dataset.postField;
        if(!draft)return;
        if(el.dataset.postFocus)draft.focus[el.dataset.postFocus]=Number(el.value);
        else if(key){if(el.type==='checkbox')draft.visibilityCustomized=true;draft[key]=el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?NaN:Number(el.value)):el.value;
            if(key==='type'){draft.badge=draft.type==='product'?'':TYPES[draft.type];draft.showBadge=draft.type!=='product';if(draft.type==='promotion')draft.template='promotion';renderUI();}
        }else return;
        syncOptions();const d=$('[data-post-discount]');if(d)d.textContent=`${discount(draft.original,draft.price)}% OFF · no template Promoção`;
        schedule();
    }
    function onInput(event){if(event.target.hasAttribute('data-post-search')){$('[data-post-products]').innerHTML=productsList(event.target.value);return;}if(event.target.tagName!=='SELECT'&&event.target.type!=='checkbox')updateField(event.target);}
    function onChange(event){if(event.target.tagName==='SELECT'||event.target.type==='checkbox')updateField(event.target);}
    return {open,reset,generate,share,helpers:{hexToRgb,rgbToHex,mix,luminance,textColor,palette,discount,available,photosFor,imagePlacement,canShareFile},formats:FORMATS,templates:TEMPLATES,
        // Read-only snapshots are also useful to integration tests; never expose mutable cache references.
        inspect:()=>structuredClone({draft,snapshot,step,rendered,version,hasFile:!!file})};
})();
