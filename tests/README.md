# Verificações locais

Os testes de navegador usam o HTML, CSS e JavaScript reais e substituem o cliente Supabase **somente na página `/review` do servidor de teste**. Dados, login, Storage e falhas são simulados em memória; nenhuma conta ou dado remoto é acessado. Esses testes não comprovam RLS, conectividade ou a integração com o backend real.

Dependências disponíveis no ambiente de revisão: Python 3, `websockets`, `beautifulsoup4`, `tinycss2`, `Pillow` e Firefox com WebDriver BiDi. Nenhuma dependência foi adicionada ao aplicativo.

```bash
python3 tests/static-review.py
mkdir -p /tmp/mabijufit-firefox-review
firefox --headless --no-remote --profile /tmp/mabijufit-firefox-review --remote-debugging-port 9222 -remote-allow-system-access
```

Em outro terminal:

```bash
python3 tests/browser-review.py
```

O perfil do Firefox deve ser temporário, sem conta ou sessões pessoais. O servidor de teste atende apenas em `127.0.0.1:8766`. Resultados e capturas ficam em `/tmp/mabijufit-review`. O teste termina com erro se alguma asserção, verificação de largura ou erro JavaScript não tratado falhar. A validação do service worker utiliza cache e rede simulados; instalação PWA e atualização em dispositivo real ainda precisam de teste manual.

A auditoria Supabase ampliou os cenários para callback Auth síncrono, falha de logout,
respostas atrasadas, troca de usuário, recarga com sessão simulada em sessionStorage,
paginação, conflito de estoque na edição/rollback, exclusão sem histórico e cadastros.
O servidor evita reutilizar assets de uma execução anterior. O bootstrap real também
é avaliado com SDK ausente e com uma factory simulada, sem chamadas remotas.

A revisão mobile também executa `tests/ux-checks.js`, cobrindo filtros, etapas de
produto/venda, câmera/galeria, rascunhos, mensagens e atalhos operacionais. As telas
são verificadas em 320, 360, 375, 390, 412, 430, 768 e 1280 px. Capturas incluem
seleção de produto/variação e pagamento; os dados e operações continuam simulados.

O financeiro verifica categoria obrigatória e visível, bloqueio de valores vazios
ou só com espaços antes do INSERT, normalização de espaços nas extremidades e
envio com e sem observações. O mock reproduz o erro 23502 para categoria nula;
aceitar observações nulas no mock não comprova a nulabilidade no banco remoto.
Se uma expressão enviada pelo runner ao Firefox falhar, ela será salva em
`/tmp/mabijufit-review/failed-expression.js`, junto da indicação de origem na
exceção, para distinguir falhas do teste de erros não tratados da aplicação.

`tests/finance-delete-checks.js` cobre exclusão manual de despesas/receitas,
confirmação e desistência, origem vinculada ou desconhecida, mudança concorrente
de origem, isolamento de usuário, duplo toque, modal ocupado, falhas e resposta
perdida após o DELETE. O reload restaura um snapshot do backend simulado e confere
as exclusões. Nenhuma RPC nem operação remota é executada. A estratégia de
compensação e suas limitações estão em `PROPOSTA-CANCELAMENTO.md`.

`tests/sale-details-checks.js` valida abertura pelos cards e pelo Financeiro,
itens históricos, totais, venda já cancelada, foco após recarga da lista, falhas,
respostas fora de ordem e ausência de escritas. Os detalhes são incluídos nas
capturas mobile e nas verificações após reload.

`tests/profile-checks.js` valida saudação de `profiles.full_name`, fallback neutro,
ausência/falha do perfil, reutilização da consulta, troca de usuário, resposta
atrasada, tratamento como texto e preservação do e-mail do Auth. O cabeçalho também
é verificado após reload. Tudo continua usando exclusivamente dados simulados.

`tests/sale-cancel-checks.js` registra e cancela uma venda com dois produtos e três
variações, valida quantidades, movimentos `sale_cancel`, manutenção de itens e
movimentos originais, remoção da receita interna e indicadores. Cobre duplo toque,
chamadas concorrentes, rollback, conflito de estoque, rejeições e respostas perdidas
após escritas. O runner recarrega o backend simulado e repete a tentativa para
confirmar que o estoque não é devolvido duas vezes. A confirmação também entra na
verificação responsiva. Isso não comprova integração nem policies do Supabase real.
