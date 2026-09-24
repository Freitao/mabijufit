# Verificações locais

O runner usa Firefox com o HTML, CSS e JavaScript reais. Apenas na página `/review`, substitui o cliente Supabase pelo mock de `browser-mock.js`. Login, banco, RPCs e Storage são simulados; nenhuma conta ou dado remoto é acessado. Os testes não comprovam RLS, integração com o Supabase real nem comportamento no Safari/iPhone.

Dependências locais: Python 3, `websockets`, `beautifulsoup4`, `tinycss2`, `Pillow` e Firefox com WebDriver BiDi. Nenhuma dependência foi adicionada ao aplicativo.

```bash
python3 tests/static-review.py
mkdir -p /tmp/mabijufit-firefox-review
firefox --headless --no-remote --profile /tmp/mabijufit-firefox-review --remote-debugging-port 9222
```

Em outro terminal:

```bash
python3 tests/browser-review.py
```

Use perfil temporário, sem sessões pessoais. O servidor atende somente em `127.0.0.1:8766`. Capturas, resultados e expressões que falharem ficam em `/tmp/mabijufit-review`.

O runner atual executa:

- `product-colors-checks.js`: cores persistentes e vazias, ordem e ativação, estoque físico versus disponível, tamanhos ausentes/zero/inativos, preservação de IDs, fotos por cor, capa independente, reassociação sem upload, upload múltiplo, falhas de Storage, revisão/estoque desatualizados, manutenção, resposta perdida, venda e cancelamento idempotentes e exclusão por RPC.
- `finance-delete-checks.js`: lançamentos manuais, confirmação, duplo toque, isolamento, rejeições, resultado incerto e proteção de receitas vinculadas.
- `sale-details-checks.js`: histórico, itens, totais, acesso pelo Financeiro, foco, falhas e respostas fora de ordem.
- `profile-checks.js`: perfil, saudação, falhas e troca de usuário.
- Layout das seis telas e dos modais de cadastro e visualização de produto em 320, 360, 375, 390, 430, 768 e 1280 px; sintaxe do service worker; recarga com sessão, cores, IDs e fotos preservados.

Os arquivos `browser-checks.js`, `ux-checks.js` e `sale-cancel-checks.js` documentam cenários da arquitetura anterior e não fazem parte do runner atual: pressupõem formulários antigos e gravações/compensações diretas. Os cenários da nova arquitetura estão em `product-colors-checks.js`; as RPCs simuladas não reproduzem locks ou policies PostgreSQL.

A verificação estática valida HTML balanceado, IDs/referências/labels, nomes de funções únicos, CSS, manifest e ícones. A execução do navegador também detecta erros JavaScript não tratados. Nenhum SQL de implantação é executado. O modo de manutenção deve permanecer ativo até a revisão e autorização de ativação.


O módulo Divulgação acrescenta `post-generator-checks.js` ao runner: leitura dos caches,
snapshot sem writes, disponibilidade por cor/tamanho, ordenação, visibilidade dos campos,
preço visual, promoção e percentual, três templates, contraste da paleta, enquadramento,
PNG real 1080×1920, Web Share simulado, cancelamento/falha, reset durante exportação,
imagem ausente/com erro, erro de Canvas e renderização offline com imagem já carregada.
Os PNGs `post-editorial.png`, `post-showcase.png` e `post-promotion.png` são gerados em
`/tmp/mabijufit-review` usando uma ilustração vetorial de roupa como fixture local.
São inspecionadas as seis etapas em 375 e 430 px, além das verificações de layout do app.
O gerador usa fontes do sistema, sem CDN de fontes ou serviço de renderização.

Ainda exigem validação em aparelhos reais: exportar fotos reais do bucket (CORS), salvar
em Fotos/Arquivos no Safari/PWA, abrir a folha nativa de compartilhamento no Android/iPhone,
a disponibilidade de Instagram/WhatsApp nessa folha, teclado, memória e comportamento offline.
O usuário conclui a publicação no aplicativo de destino; não há API direta do Instagram.

O seletor RGB é coberto por `color-picker-checks.js` (sincronização, limites, HEX, bloqueio de valores inválidos, gravação e edição com identidade preservada). `stock-grouped-checks.js` cobre resumos por produto, alertas, filtros, buscas, cores/tamanhos ordenados e acesso ao editor existente. Os dois modais também são medidos em 375 e 430 px.
