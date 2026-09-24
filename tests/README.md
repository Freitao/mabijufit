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
