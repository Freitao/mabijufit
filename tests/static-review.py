"""Checagens estruturais locais. Requer beautifulsoup4, tinycss2 e Pillow."""
from pathlib import Path
from collections import Counter
from html.parser import HTMLParser
import json, re
from bs4 import BeautifulSoup
from PIL import Image
import tinycss2

ROOT=Path(__file__).resolve().parents[1]
h=(ROOT/'index.html').read_text();j=(ROOT/'js/app.js').read_text();c=(ROOT/'css/style.css').read_text()
soup=BeautifulSoup(h,'html.parser')
ids=[x['id'] for x in soup.select('[id]')]
assert len(ids)==len(set(ids)), 'IDs duplicados'
assert not (set(re.findall(r'\$\("([^"]+)"\)',j))-set(ids)), 'Referências JS a IDs ausentes'
for element in soup.select('[aria-labelledby], [aria-controls]'):
    for attr in ['aria-labelledby','aria-controls']:
        assert all(id in ids for id in element.get(attr,'').split()), element
for element in soup.select('input,select,textarea'):
    if element.get('type')=='hidden':continue
    assert element.get('aria-label') or soup.find('label',attrs={'for':element.get('id')}) or element.find_parent('label'), element
for label in soup.select('label[for]'): assert label['for'] in ids
for modal in soup.select('.modal'):
    assert modal.get('role')=='dialog' and modal.get('aria-modal')=='true' and modal.get('aria-labelledby')
assert len(soup.select('#saleModal h2'))==1
assert 'ensureSaleModalUI' not in j
assert len(soup.select('.quick-action svg'))==4
assert not soup.select('button button, button a, a button, form form')
functions=re.findall(r'^(?:async )?function (\w+)',j,re.M)
assert len(functions)==len(set(functions))

class Structure(HTMLParser):
    void={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
    def __init__(self):super().__init__();self.stack=[]
    def handle_starttag(self,tag,attrs):
        names=[x[0] for x in attrs]
        assert len(names)==len(set(names)),('Atributo duplicado',tag,attrs)
        if tag not in self.void:self.stack.append(tag)
    def handle_startendtag(self,tag,attrs):pass
    def handle_endtag(self,tag):
        assert self.stack and self.stack[-1]==tag,('Fechamento inválido',tag,self.stack[-4:])
        self.stack.pop()
parser=Structure();parser.feed(h);assert not parser.stack

def validate_css(rules):
    for rule in rules:
        assert rule.type!='error',rule
        if rule.type=='qualified-rule':
            for d in tinycss2.parse_declaration_list(rule.content):assert d.type!='error',d
        elif rule.type=='at-rule' and rule.content and rule.lower_at_keyword in ['media','supports','keyframes']:
            validate_css(tinycss2.parse_rule_list(rule.content))
validate_css(tinycss2.parse_stylesheet(c))
manifest=json.loads((ROOT/'manifest.json').read_text())
assert manifest['theme_color']==soup.find('meta',attrs={'name':'theme-color'})['content']
for icon in manifest['icons']:
    with Image.open(ROOT/icon['src']) as image:
        assert f'{image.width}x{image.height}'==icon['sizes']
assert not re.search(r'(^|[},])\s*main\s*[{,]',c)
print(f'OK: HTML balanceado; {len(ids)} IDs únicos; referências e labels válidos; {len(functions)} funções únicas; CSS válido; manifest e ícones válidos.')

# Contrato frontend da arquitetura product_colors; operações agregadas usam RPCs.
assert not re.search(r"\bvariant\.color_id\b", j)
assert not re.search(r'\.from\(\s*"(?:products|product_colors|product_variants|product_images|sales|sale_items|inventory_movements)"\s*\)\s*\.(?:insert|update|delete)\(', j)
assert not re.search('variante|variação|variações', h, re.I)
for rpc in ['pc_save_product', 'pc_delete_product', 'pc_register_sale', 'pc_cancel_sale']:
    assert rpc in j
print('OK: contrato product_colors; agregados por RPC; terminologia da interface.')
