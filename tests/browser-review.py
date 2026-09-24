"""Revisão local com Firefox BiDi, sem acesso ao Supabase.
Inicie Firefox --headless --remote-debugging-port 9222 -remote-allow-system-access com perfil temporário.
Execute: python3 tests/browser-review.py (requer websockets).
Capturas e resultados ficam em /tmp/mabijufit-review.
"""
import asyncio, base64, json, re, threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import websockets

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path('/tmp/mabijufit-review')
OUTPUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def do_GET(self):
        if self.path == '/review':
            html = (ROOT/'index.html').read_text()
            html = re.sub(r'<script\s+src="https://[^\"]+"\s*></script>', '', html)
            html = html.replace('src="js/supabase.js"', 'src="tests/browser-mock.js"')
            html = re.sub(r'<script>.*?</script>', '', html, flags=re.S)
            html = re.sub(r'(src|href)="((?:js/|tests/|css/)[^"]+)"', lambda m: f'{m[1]}="{m[2]}?audit={__import__("time").time_ns()}"', html)
            body = html.encode()
            self.send_response(200); self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
        else: super().do_GET()

async def main():
    server=ThreadingHTTPServer(('127.0.0.1',8766), partial(Handler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    async with websockets.connect('ws://127.0.0.1:9222/session', max_size=20_000_000) as ws:
        seq=0
        async def call(method,params):
            nonlocal seq
            seq+=1
            await ws.send(json.dumps({'id':seq,'method':method,'params':params}))
            while True:
                result=json.loads(await ws.recv())
                if result.get('id')==seq:
                    if result.get('type')=='error': raise RuntimeError(result)
                    return result['result']
        await call('session.new', {'capabilities':{}})
        try:
            created=await call('browsingContext.create',{'type':'tab'})
            ctx=created['context']
            async def evaluate(expression):
                result=await call('script.evaluate',{'expression':expression,'target':{'context':ctx},'awaitPromise':True})
                if result['type']=='exception':
                    (OUTPUT/'failed-expression.js').write_text(expression)
                    raise RuntimeError({'source':'Expressão do teste (failed-expression.js)', 'details':result.get('exceptionDetails')})
                return result.get('result',{}).get('value')
            await call('browsingContext.navigate',{'context':ctx,'url':'http://127.0.0.1:8766/review','wait':'complete'})
            await call('browsingContext.setViewport',{'context':ctx,'viewport':{'width':360,'height':800},'devicePixelRatio':1})
            await evaluate('new Promise(resolve=>setTimeout(resolve,100))')
            print('BOOT',await evaluate('JSON.stringify({errors:reviewErrors,app:typeof showApplication,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone})'),flush=True)
            async def screenshot(name):
                await evaluate('new Promise(r=>setTimeout(r,230))')
                result=await call('browsingContext.captureScreenshot',{'context':ctx})
                (OUTPUT/f'{name}.png').write_bytes(base64.b64decode(result['data']))
            await screenshot('login-360')
            # Seed only local portrait fixtures to inspect image proportions.
            await evaluate('''const portrait = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="280" viewBox="0 0 180 280"><rect width="180" height="280" fill="#f3e8e9"/><path d="M55 50 70 40l10 30h20l10-30 15 10-5 75 16 100H44l16-100Z" fill="#c96f8c"/><path d="M65 100q25 15 50 0" fill="none" stroke="#b45774" stroke-width="3"/></svg>');
                mockDB.product_images = ['p1','p2'].map((id,i)=>({id:'photo'+i,user_id:mockUser.id,product_id:id,public_url:portrait,is_primary:true,display_order:0}));
            ''')
            for suite in ['product-colors-checks','finance-delete-checks','sale-details-checks','profile-checks','product-editor-ui-checks','color-picker-checks','post-generator-checks','stock-grouped-checks']:
                results=await evaluate('(async()=>{'+(ROOT/f'tests/{suite}.js').read_text()+'})()')
                print(suite,len(json.loads(results)),'passed',flush=True)
                (OUTPUT/f'{suite}.json').write_text(results)
            assert await evaluate("fetch('/service-worker.js').then(r=>r.text()).then(code=>{new Function(code);return true})"), 'Sintaxe service worker'
            # PNGs saem do Canvas real; fixtures de roupa são SVGs locais.
            await evaluate('showSection("divulgacao");document.querySelector("[data-post-next]").click();document.querySelector("[data-post-next]").click()')
            for template in ['editorial','showcase','promotion']:
                if template=='promotion':
                    await evaluate("""document.querySelector('[data-post-step="2"]').click();const t=document.querySelector('[data-post-field="type"]');t.value='promotion';t.dispatchEvent(new Event('change',{bubbles:true}));const o=document.querySelector('[data-post-field="original"]');o.value='119.90';o.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-post-next]').click()""")
                await evaluate(f"document.querySelector('[data-post-template=\"{template}\"]').click()")
                await evaluate('new Promise(r=>setTimeout(r,180))')
                await evaluate('PostGenerator.generate()')
                encoded=await evaluate('fetch(document.querySelector("[data-post-download]").href).then(r=>r.blob()).then(b=>new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(",")[1]);reader.readAsDataURL(b)}))')
                (OUTPUT/f'post-{template}.png').write_bytes(base64.b64decode(encoded))
                await evaluate('document.querySelector("[data-post-back]").click();document.querySelector("[data-post-back]").click()')
            layouts=[]
            for width in [320,360,375,390,430,768,1280]:
                await call('browsingContext.setViewport',{'context':ctx,'viewport':{'width':width,'height':800},'devicePixelRatio':1})
                for section in ['home','products','stock','sales','finance','settings','divulgacao']:
                    await evaluate(f'showSection({json.dumps(section)}); new Promise(r=>setTimeout(r,50))')
                    overflow=await evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                    layouts.append({'width':width,'section':section,'overflow':overflow})
                    if section=='divulgacao' and width in [375,390,430,1280]: await screenshot(f'divulgacao-{width}')
                await evaluate('loadProductForEdit(productsCache.find(p=>p.id===reviewProductId))')
                await evaluate('setProductPanel("colors")')
                overflow=await evaluate('document.querySelector("#productModal .modal-content").scrollWidth>innerWidth+1')
                layouts.append({'width':width,'modal':'productModal','overflow':overflow})
                await evaluate('document.querySelectorAll("#productColorTabs button").forEach(b=>{if(b.scrollWidth>b.clientWidth+1)throw new Error("Chip transbordando")})')
                for index in [0,1,2]:
                    await evaluate(f'document.querySelectorAll("#productPhotoPreview details").forEach((d,i)=>d.open=i=={index})')
                    overflow=await evaluate('[...document.querySelectorAll("#productPhotoPreview details[open] > div")].some(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth})')
                    layouts.append({'width':width,'photoMenu':index,'overflow':overflow})
                await evaluate('document.querySelectorAll("#productPhotoPreview details").forEach(d=>d.open=false)')
                await evaluate('$("productForm").scrollTop=$("productForm").scrollHeight')
                assert await evaluate('$("productColorStock").getBoundingClientRect().bottom <= document.querySelector("#productForm .modal-actions").getBoundingClientRect().top-8'), 'Total oculto pelo footer'
                await evaluate('$("productForm").scrollTop=0')
                if width in [320,390,1280]: await screenshot(f'product-colors-{width}')
                if width==390:
                    await evaluate('$("productSizeSection").scrollIntoView({block:"center"})')
                    await screenshot('product-sizes-390')
                    await evaluate("document.querySelector('[data-pc-select=\"\"]').click()")
                    await screenshot('product-cover-390')
                await evaluate('closeModal("productModal");openProductDetails(reviewProductId)')
                overflow=await evaluate('document.querySelector("#productDetailsModal .modal-content").scrollWidth>innerWidth+1')
                layouts.append({'width':width,'modal':'productDetailsModal','overflow':overflow})
                if width==390: await screenshot('product-gallery-390')
                await evaluate('closeModal("productDetailsModal")')
            for width in [375,430]:
                await call('browsingContext.setViewport',{'context':ctx,'viewport':{'width':width,'height':800},'devicePixelRatio':1})
                for modal,opening in [('colorModal','openColorModal()'),('stockDetailModal','openStockDetails("stock-fixture")')]:
                    await evaluate(opening)
                    overflow=await evaluate(f'document.querySelector("#{modal} .modal-content").scrollWidth>innerWidth+1')
                    layouts.append({'width':width,'modal':modal,'overflow':overflow})
                    await screenshot(f'{modal}-{width}')
                    await evaluate(f'closeModal("{modal}")')
            # Cada etapa do módulo em larguras típicas de iPhone.
            for width in [375,430]:
                await call('browsingContext.setViewport',{'context':ctx,'viewport':{'width':width,'height':800},'devicePixelRatio':1})
                await evaluate('showSection("divulgacao");PostGenerator.generate()')
                for post_step in [5,4,3,2,1,0]:
                    await evaluate(f"document.querySelector('[data-post-step=\"{post_step}\"]').click()")
                    await evaluate('new Promise(r=>setTimeout(r,140))')
                    overflow=await evaluate('document.documentElement.scrollWidth>innerWidth+1')
                    layouts.append({'width':width,'postStep':post_step,'overflow':overflow})
                    if width==375: await screenshot(f'divulgacao-step-{post_step+1}-375')
            await call('browsingContext.setViewport',{'context':ctx,'viewport':{'width':390,'height':420},'devicePixelRatio':1})
            await evaluate('loadProductForEdit(productsCache.find(p=>p.id===reviewProductId))')
            await evaluate('setProductPanel("colors");const qty=document.querySelector("[data-pc-quantity]");qty.focus();qty.scrollIntoView({block:"center"})')
            assert await evaluate('(()=>{const f=document.querySelector("#productForm .modal-actions").getBoundingClientRect();const q=document.querySelector("[data-pc-quantity]").getBoundingClientRect();return f.bottom<=innerHeight+1&&q.top>=0&&q.bottom<=f.top;})()'), 'Controles/rodapé na viewport baixa'
            await screenshot('product-keyboard-height-390')
            await evaluate('closeModal("productModal")')
            (OUTPUT/'layouts.json').write_text(json.dumps(layouts,indent=2))
            assert not [r for r in layouts if r['overflow']], layouts
            print('LAYOUT',len(layouts),'passed',flush=True)
            errors=json.loads(await evaluate('JSON.stringify(reviewErrors)'))
            assert not errors,errors
            await evaluate("mockSession={user:mockUser};sessionStorage.setItem('review-session','1');sessionStorage.setItem('review-db-reload',JSON.stringify(mockDB));sessionStorage.setItem('review-product-id',reviewProductId)")
            await call('browsingContext.reload',{'context':ctx,'wait':'complete'})
            await evaluate('new Promise(r=>setTimeout(r,250))')
            assert await evaluate('currentUser?.id===mockUser.id && productColorsCache.length>0 && reviewErrors.length===0'), 'Reload'
            await evaluate('loadProductForEdit(productsCache.find(p=>p.id===sessionStorage.getItem("review-product-id")))')
            assert await evaluate('productColorsDraft.length===3 && productVariationsDraft.every(v=>!!v.variantId) && productPhotosDraft.length>=3'), 'IDs/fotos no reload'
            print('RELOAD sessão, grupos, IDs e fotos preservados',flush=True)
            await evaluate('closeModal("productModal");showSection("divulgacao")')
            assert await evaluate('!PostGenerator.inspect().draft && !!document.querySelector("[data-post-product]")'), 'Divulgação após reload'
            print('RELOAD Divulgação disponível; rascunhos não persistem',flush=True)
            print('OUTPUT',OUTPUT,flush=True)
        finally:
            await call('session.end',{})
            server.shutdown()

asyncio.run(main())
