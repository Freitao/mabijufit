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
