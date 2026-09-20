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
            results=await evaluate('(async()=>{'+(ROOT/'tests/browser-checks.js').read_text()+'})()')
            print('CHECKS',len(json.loads(results)),'passed',flush=True)
            (OUTPUT/'checks.json').write_text(results)
            ux=await evaluate('(async()=>{'+(ROOT/'tests/ux-checks.js').read_text()+'})()')
            print('UX',len(json.loads(ux)),'passed',flush=True)
            (OUTPUT/'ux-checks.json').write_text(ux)
            finance=await evaluate('(async()=>{'+(ROOT/'tests/finance-delete-checks.js').read_text()+'})()')
            print('FINANCE',len(json.loads(finance)),'passed',flush=True)
            (OUTPUT/'finance-delete-checks.json').write_text(finance)
            details=await evaluate('(async()=>{'+(ROOT/'tests/sale-details-checks.js').read_text()+'})()')
            print('SALE DETAILS',len(json.loads(details)),'passed',flush=True)
            (OUTPUT/'sale-details-checks.json').write_text(details)
            profile=await evaluate('(async()=>{'+(ROOT/'tests/profile-checks.js').read_text()+'})()')
            print('PROFILE',len(json.loads(profile)),'passed',flush=True)
            (OUTPUT/'profile-checks.json').write_text(profile)
            cancellation=await evaluate('(async()=>{'+(ROOT/'tests/sale-cancel-checks.js').read_text()+'})()')
            print('CANCELLATION',len(json.loads(cancellation)),'passed',flush=True)
            (OUTPUT/'sale-cancel-checks.json').write_text(cancellation)
            # Every screen and modal must fit mobile and desktop widths with long labels.
            layouts=[]
            for width in [320,360,375,390,412,430,768,1280]:
                await call('browsingContext.setViewport',{'context':ctx,'viewport':{'width':width,'height':850},'devicePixelRatio':1})
                for section in ['home','products','stock','sales','finance','settings']:
                    await evaluate(f'showSection({json.dumps(section)}); new Promise(r=>setTimeout(r,80))')
                    if section=='finance':
                        await evaluate('document.querySelectorAll(".finance-actions").forEach(element=>element.open=true)')
                    overflow=await evaluate('JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll("#appScreen *")].filter(e=>e.getClientRects().length && (e.getBoundingClientRect().right>innerWidth+1 || e.getBoundingClientRect().left < -1)).map(e=>e.id||e.className).slice(0,12)})')
                    layouts.append({'width':width,'section':section,**json.loads(overflow)})
                    if width in [360,390,430,1280]: await screenshot(f'{section}-{width}')
                for modal in ['productModal','saleModal','categoryModal','colorModal','sizeModal','transactionModal','deleteFinanceModal','saleDetailsModal','cancelSaleModal']:
                    if modal=='saleDetailsModal':
                        await evaluate('openSaleDetails(saleDetailsReviewId)')
                    if modal=='cancelSaleModal':
                        await evaluate('openSaleCancellation(saleDetailsReviewId, salesCache.find(row=>row.id===saleDetailsReviewId).sale_number)')
                    await evaluate(('openProductModal();' if modal=='productModal' else 'openDeleteFinanceModal(financeCache.find(item=>item.reference_id===null).id);' if modal=='deleteFinanceModal' else f'openModal({json.dumps(modal)});')+'new Promise(r=>setTimeout(r,40))')
                    overflow=await evaluate(f'JSON.stringify({{scroll:document.getElementById({json.dumps(modal)}).querySelector(".modal-content").scrollWidth,client:document.getElementById({json.dumps(modal)}).querySelector(".modal-content").clientWidth}})')
                    layouts.append({'width':width,'modal':modal,**json.loads(overflow)})
                    if width in [360,390,430]:
                        await screenshot(f'{modal}-{width}')
                        if modal=='saleModal':
                            await evaluate('toggleSaleProductPicker()')
                            await screenshot(f'sale-product-picker-{width}')
                            await evaluate("document.querySelector('[data-sale-select-product=\"p1\"]').click()")
                            await screenshot(f'sale-variant-picker-{width}')
                            await evaluate("document.querySelector('[data-sale-select-variant=\"v1\"]').click(); $('saleContinueButton').click()")
                            await screenshot(f'sale-payment-{width}')
                            await evaluate('setSaleStage("items"); closeSaleProductPicker()')
                        if modal=='productModal':
                            await evaluate('setProductPanel("photos")')
                            await screenshot(f'product-photos-{width}')
                            await evaluate('setProductPanel("stock")')
                            await screenshot(f'product-variations-{width}')
                    await evaluate(f'closeModal({json.dumps(modal)})')
            (OUTPUT/'layouts.json').write_text(json.dumps(layouts,indent=2))
            failures=[x for x in layouts if x.get('overflow') or x.get('scroll',0)>x.get('client',x['width'])+1]
            print('LAYOUT',json.dumps(failures),flush=True)
            errors=json.loads(await evaluate('JSON.stringify(reviewErrors)'))
            print('ERRORS',errors,flush=True)
            assert not failures, failures
            assert not errors, errors
            await evaluate("mockSession={user:mockUser}; sessionStorage.setItem('review-session','1')")
            await evaluate("sessionStorage.setItem('review-db-reload',JSON.stringify(mockDB));sessionStorage.setItem('review-deleted-ids',JSON.stringify(financeDeletionReloadExpected))")
            await evaluate("sessionStorage.setItem('review-cancelled-id',cancelledSaleReviewId)")
            await call('browsingContext.reload',{'context':ctx,'wait':'complete'})
            await evaluate('new Promise(r=>setTimeout(r,300))')
            restored=await evaluate('!!currentUser && productsCache.length>0 && !document.getElementById("appScreen").hidden && reviewErrors.length===0')
            assert restored, 'Falha ao restaurar sessão após reload'
            print('RELOAD sessão e dados restaurados',flush=True)
            assert await evaluate('$("userName").textContent==="Olá, Marcela"'), 'Perfil após reload'
            persisted=await evaluate("JSON.parse(sessionStorage.getItem('review-deleted-ids')).every(id=>!financeCache.some(x=>x.id===id)) && salesCache.some(x=>x.id==='cancelled-history'&&x.status==='cancelled')")
            assert persisted, 'Exclusões e histórico cancelado não persistiram no backend simulado'
            print('RELOAD exclusões e histórico cancelado preservados no backend simulado',flush=True)
            await evaluate('openSaleDetails("cancelled-history")')
            assert await evaluate('$("saleDetailsContent").textContent.includes("CANCELADA") && !$("saleDetailsContent").querySelector("button")'), 'Detalhes da cancelada após reload'
            await evaluate('closeModal("saleDetailsModal")')
            await evaluate('openSaleDetails(sessionStorage.getItem("review-cancelled-id"))')
            assert await evaluate('$("saleDetailsContent").textContent.includes("CANCELADA") && !$("saleDetailsContent").querySelector("[data-cancel-sale]") && !financeCache.some(row=>row.reference_id===sessionStorage.getItem("review-cancelled-id"))'), 'Cancelamento real no mock após reload'
            repeated=await evaluate('(async()=>{const before=JSON.stringify(mockDB);await performSaleCancellation(sessionClient(currentUser.id,sessionGeneration),currentUser.id,sessionStorage.getItem("review-cancelled-id"),"",SALE_RETURN_MOVEMENT_TYPE);return before===JSON.stringify(mockDB)})()')
            assert repeated, 'Cancelamento repetido após reload alterou dados'
            assert await evaluate('["v1","v2","v3"].every(id=>mockDB.product_variants.find(row=>row.id===id).stock_quantity===({v1:3,v2:4,v3:2})[id]) && mockDB.inventory_movements.filter(row=>row.reference_id===sessionStorage.getItem("review-cancelled-id")&&row.movement_type==="sale_cancel").length===3 && mockDB.sale_items.filter(row=>row.sale_id===sessionStorage.getItem("review-cancelled-id")).length===3'), 'Estoque, devoluções ou itens divergiram após reload'
            print('RELOAD cancelamento preservado e repetição bloqueada',flush=True)
            await evaluate('closeModal("saleDetailsModal")')
            await call('browsingContext.setViewport',{'context':ctx,'viewport':{'width':360,'height':420},'devicePixelRatio':1})
            for modal in ['productModal','transactionModal','saleModal','deleteFinanceModal','saleDetailsModal','cancelSaleModal']:
                opener = {
                    'productModal':'openProductModal()',
                    'transactionModal':'openTransactionModal()',
                    'saleModal':'openNewSaleModal()',
                    'deleteFinanceModal':'openDeleteFinanceModal(financeCache.find(item=>item.reference_id===null).id)',
                    'saleDetailsModal':'openSaleDetails("cancelled-history")',
                    'cancelSaleModal':'openSaleCancellation("s1", 1)'
                }[modal]
                await evaluate(opener)
                await evaluate('new Promise(r=>setTimeout(r,250))')
                contained=await evaluate(f'(()=>{{const r=document.querySelector("#{modal} .modal-content").getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight+1;}})()')
                if not contained:
                    print('MODAL RECT',await evaluate(f'JSON.stringify({{rect:document.querySelector("#{modal} .modal-content").getBoundingClientRect().toJSON(),height:innerHeight}})'),flush=True)
                assert contained, ('Modal excede viewport baixa',modal)
                await evaluate(f'closeModal({json.dumps(modal)})')
            print('VIEWPORT BAIXA 360x420: seis modais contidos',flush=True)
            print('OUTPUT',OUTPUT,flush=True)
        finally:
            await call('session.end',{})
            server.shutdown()

asyncio.run(main())
