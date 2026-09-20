# Auditoria da integração MabijuFit / Supabase

Data: 20/09/2026. Revisão dos arquivos atuais do workspace. Nenhum commit, push, migration ou alteração remota foi executado. URL e chave foram preservadas; não são reproduzidas neste relatório.

## Resultado e limites da evidência

Foram encontrados defeitos no código de integração e no frontend, corrigidos localmente. Não foi comprovado defeito no serviço Supabase, PostgreSQL, RLS ou Storage remoto. Os testes utilizam o HTML/CSS/JS reais com um cliente simulado: não substituem testes com uma conta real, schema, constraints e policies do projeto publicado. Não há SQL/schema/migrations no repositório para comparar com o banco implantado, nem credenciais de usuário disponíveis para validar as operações autenticadas.

## Configuração e autenticação

- `index.html` carrega o SDK v2 pelo CDN, depois `js/supabase.js`, depois `js/app.js`, sem `async`/`defer` fora de ordem. Existe uma única chamada de criação do cliente. `app.js` usa esse cliente lexical; ele não depende de `window.supabaseClient`.
- O SDK é externo e sua disponibilidade real depende da rede/CDN. O bootstrap agora verifica `window.supabase?.createClient`; se indisponível, retorna `null` e a aplicação apresenta erro de conexão. Esta é a única alteração em `js/supabase.js`; nenhuma configuração foi trocada.
- `sessionClient` é apenas uma fachada para o mesmo cliente, não cria SDK nem outra sessão. Captura o usuário e a geração da sessão, impedindo novas etapas de uma operação depois de logout/troca de conta.
- O callback assíncrono de `onAuthStateChange` aguardava `showApplication` e consultas. Isso pode bloquear o lock do Auth, conforme a [documentação oficial](https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0). Agora o callback é síncrono e agenda o carregamento fora dele.
- Login, sessão recuperada e eventos do Auth compartilham a inicialização. Eventos ultrapassados são descartados; eventos repetidos do mesmo usuário não reinicializam os caches. A tela aguarda a carga inicial antes de aparecer.
- Logout passa a conferir `{ error }` de `signOut`. Se falhar, avisa e não simula sucesso. Operações críticas em andamento impedem o logout voluntário.
- Logout/troca de usuário limpam caches, fotos, rascunhos, seleção e modais. Respostas de carregamento da sessão anterior não repovoam os caches. Atualizações de estoque e payloads usam o ID capturado no início, evitando `currentUser.id` nulo ou trocado depois de um `await`.
- `getSession` apresenta erro visível quando falha. A restauração após recarga é testada com sessão simulada persistida.

## Inventário das operações revisadas

Todas as tabelas consultadas no código pertencem à lista esperada. Leituras e alterações existentes usam `user_id`; inserts incluem o usuário autenticado. Relacionamentos embutidos dependem das FKs reais e de RLS nas tabelas relacionadas — o filtro do pai não substitui essas policies.

| Recurso | Operações e campos relevantes usados pelo frontend |
| --- | --- |
| `profiles` | Não é consultada. Nome vem de `user_metadata.full_name`/email do Auth. Nenhuma dependência artificial foi criada. |
| `categories` | Listar/criar/editar/excluir; `id`, `user_id`, `name`, `description`, `is_active`. |
| `colors` | Listar/criar/editar/excluir; `id`, `user_id`, `name`, `hex_code`, `is_active`. |
| `sizes` | Listar/criar/editar/excluir; `id`, `user_id`, `name`, `display_order`, `is_active`. |
| `products` | Listar/criar/editar/ativar/desativar/excluir; categoria, nome, SKU, descrição, custo, preço, estoque mínimo, atividade. Select embutido `categories(id,name)`. |
| `product_variants` | Listar/criar/editar/desativar, conferir/baixar/restaurar estoque e excluir somente produto sem histórico; `product_id`, `color_id`, `size_id`, `stock_quantity`, `minimum_stock`, `is_active`. Relações `products`, `colors`, `sizes`. |
| `product_images` | Listar/inserir/excluir junto do produto sem histórico; `product_id`, `storage_path`, `public_url`, `is_primary`, `display_order`. |
| `inventory_movements` | Inserção na venda, compensação da venda falha, consulta de histórico antes de excluir produto; `product_variant_id`, `movement_type`, `quantity`, `reference_id`, `reason`, `notes`. |
| `sales` | Listagem, inserção com número gerado pelo banco e compensação; `sale_number`, `sale_date`, `subtotal`, `discount`, `total`, `payment_method`, `status`, `notes`. |
| `sale_items` | Inserção/compensação e verificação de histórico; `sale_id`, `product_variant_id`, `product_name`, `variant_description`, `quantity`, `unit_price`, `unit_cost`, `discount`, `total`. |
| `financial_transactions` | Listagem e inserção manual/por venda; `transaction_type`, `category`, `description`, `amount`, `transaction_date`, `payment_method`, `reference_id`, `notes`. |
| Storage `product-images` | Upload, URL pública e remoção compensatória/ao excluir produto. `upsert: false`, JPEG otimizado e caminho `<user_id>/products/<product_id>/<nome-gerado>.jpg` preservados. |

Não há `.upsert()` de banco. O `upsert` encontrado é a opção do upload. Não foram inventadas colunas. Nomes/relacionamentos acima foram confirmados no frontend, não no schema remoto.

## Correções por fluxo

### Carregamento e cadastros

- Listas antes dependiam de uma única resposta, sujeita ao limite de linhas da API. Agora buscam páginas com desempate por ID até a resposta vazia; erro de qualquer página não substitui o cache por dados parciais. A edição também pagina as variações.
- Falhas de carregamento preservam os dados anteriores e mostram aviso persistente de possível desatualização; detalhes ficam no console. O aviso pede atualização da página, evitando interpretar lista vazia como ausência real de registros.
- Atualizações/exclusões unitárias solicitam a linha alterada para detectar operações sem correspondência, em vez de anunciar sucesso com zero linhas.
- IDs, labels, handlers e seletores HTML foram verificados. A reorganização visual não desconectou os formulários de produto, cadastros, venda e financeiro.
- Categoria inativa já associada permanece selecionável durante a edição daquele produto. Antes, ela desaparecia do select e salvar poderia apagar a associação.
- Categorias, cores e tamanhos mantêm criação, edição e ativação pelo checkbox do formulário. Cores/tamanhos inativos saem das novas combinações; associações existentes continuam no rascunho/histórico.

### Produtos, variações e estoque

- Carga de produtos → cache → fotos → renderização preservada. Após salvar, produtos/variações e dashboard são atualizados.
- Remover uma variação na edição continua desativando o registro, preservando o histórico. Reativação reutiliza o ID existente.
- Edição de quantidade usa comparação com o estoque lido ao abrir o formulário. Se uma venda alterou o estoque nesse intervalo, a alteração falha em vez de sobrescrever a baixa. Mensagem avisa que uma edição com múltiplas requisições pode ter sido parcialmente salva.
- Preços rejeitam números não finitos. Financeiro e totais continuam convertendo valores com `Number`, sem concatenar strings numéricas.
- O cadastro/ajuste direto de quantidade já não criava movimentação de entrada/ajuste. Esse comportamento foi preservado: introduzir novos tipos de movimento sem conhecer constraints/triggers seria arriscado.

### Exclusão solicitada durante a auditoria

- Botão **Excluir** visível em todos os cards, com confirmação explícita.
- Busca as variações e verifica `sale_items` e `inventory_movements` antes de remover. Se houver histórico ou a consulta falhar, não exclui; com histórico orienta **Desativar**.
- Produto sem histórico pode ser excluído com suas variações e fotos, mesmo ativo. Primeiro desativa o produto; depois remove filhos, cadastro e arquivos do Storage. Confere as linhas removidas dos filhos.
- Se houver falha intermediária, informa possível exclusão parcial e atualiza a tela. Falha no Storage após exclusão do cadastro avisa sobre arquivos remanescentes e registra caminhos para limpeza manual. Não elimina vendas/movimentações para viabilizar uma exclusão.
- Limite importante: múltiplas requisições de frontend não são uma transação. Outra sessão pode registrar uma venda entre a conferência de histórico e a exclusão. A garantia contra remoção concorrente de histórico depende das FKs/regras reais do banco. Não foram verificadas nem modificadas; não se deve configurar cascata que elimine histórico para fazer o botão funcionar.

### Fotos

- Seleção, preview, otimização, upload, metadados e renderização passaram em teste simulado. Fotos existentes permanecem visíveis na edição.
- Se a primeira foto falhar, a primeira que realmente concluir o envio vira principal, quando ainda não existe principal.
- Remoções compensatórias do Storage agora verificam `{ error }`, não apenas exceções. Os catches vazios de liberação de recursos foram substituídos por diagnóstico.
- O caminho captura o usuário original antes da otimização assíncrona.
- `getPublicUrl` monta a URL, não comprova que o bucket é público nem que o objeto pode ser lido. Isso exige teste remoto. Não há interface preexistente de troca de principal ou remoção individual de foto persistida; não foi criada como parte desta auditoria. A remoção de foto do rascunho e a remoção ao excluir produto são fluxos distintos.

### Vendas e financeiro

- Fluxo de selecionar produto/variação → quantidade → desconto → pagamento → registrar permanece conectado e testado. Bloqueio de submissão duplicada preservado.
- Revalidação de atividade e estoque, inserção da venda/itens, baixa condicional, movimentos e receita preservadas. Erros técnicos antes substituídos por mensagens genéricas agora também são registrados.
- Compensações verificam erros individualmente. Restauração do estoque verifica a linha retornada, detectando conflito concorrente. Se não consegue restaurar, preserva registros para conferência e avisa para não repetir a venda.
- Restaura estoque antes de apagar evidências de itens/movimentos. Se a limpeza falhar, preserva o registro pai. Quando o financeiro já confirmou a venda, uma falha posterior de atualização da tela não desfaz a venda concluída.
- Receitas, despesas, lançamento manual, origem em vendas, períodos, busca e conversão numérica foram revisados e testados localmente.

## PWA e cache

- Cache alterado de `mabijufit-v5` para `mabijufit-v6`.
- Estratégia já era rede primeiro com fallback offline, limitada ao shell local. Continua ignorando requisições externas, incluindo Auth/PostgREST/Storage do Supabase.
- Busca dos assets usa `cache: "no-cache"`, revalidando o cache HTTP; registro do worker usa `updateViaCache: "none"`.
- `skipWaiting`, `clients.claim` e limpeza dos caches antigos da aplicação foram preservados. Outros caches não são apagados.
- Uma aba já aberta precisa ser recarregada para executar o novo JavaScript; não foi imposto reload automático que descarte formulários. Publicação/PWA em dispositivo real não foi testada.
- O próprio servidor de testes podia reutilizar assets antigos do navegador. Passou a usar `no-store` e URLs únicas para testar efetivamente o estado atual dos arquivos.

## Validação

- `python3 tests/static-review.py`: HTML balanceado, 127 IDs únicos e referências válidas, 118 funções únicas, CSS, manifest e ícones válidos.
- `python3 tests/browser-review.py`: **89 verificações passaram**, além da recarga real da página. Firefox real, cliente Supabase e banco em memória. Verificações de login/dashboard, produtos/criação/edição, estoque, cadastros, fotos, exclusão sem histórico, bloqueio com histórico, vendas/rollback, financeiro, logout/login, callbacks Auth, paginação, mudança de usuário e concorrência. Inclui teste do bootstrap com SDK ausente e contagem de instâncias.
- Recarga efetiva da página com sessão simulada persistida também validada.
- Telas/modais em 320, 360, 430, 768 e 1280 px; nenhum overflow detectado. Console sem erros JS não tratados. Falhas injetadas são registradas intencionalmente no console e verificadas na interface.
- Resultados/capturas: `/tmp/mabijufit-review/checks.json`, `layouts.json` e PNGs. O mock não valida nomes de colunas, FKs, rede, policies ou comportamento transacional do banco real.
- Inicialmente Firefox/sockets foram bloqueados pelo ambiente; os testes foram executados fora do sandbox com as permissões disponíveis.

## O que falta validar no Supabase real

Nenhum erro real 400/401/403/404, RLS ou policy foi constatado nesta execução, porque não houve acesso autenticado ao backend real. Portanto, não há alteração específica de painel comprovadamente necessária. Não foi criada ou alterada tabela, coluna, policy, trigger, função, bucket ou migration.

Antes da publicação, testar com uma conta real os mesmos fluxos e verificar no Network/console a operação que eventualmente falhar. Para um problema remoto, registrar método/endpoint, tabela/bucket, status e `code/message/details/hint` sem tokens/chaves. Os pontos a conferir são:

1. Permissões de leitura/escrita do próprio `user_id` em todas as tabelas usadas; updates/deletes que retornam linhas também dependem de SELECT permitido.
2. FKs dos relacionamentos embutidos e preservação de histórico na exclusão concorrente de produto. Se o banco permitir cascata destrutiva de histórico, uma revisão das constraints seria necessária antes de garantir esse fluxo em várias sessões.
3. Bucket `product-images`: leitura pública para o modelo atual de URL, upload e remoção permitidos no prefixo do usuário. Uma falha de policy exige ajuste manual específico baseado no erro observado, não uma liberação genérica.
4. Venda é uma sequência de chamadas REST, não uma transação PostgreSQL. A numeração é gerada pela identity do PostgreSQL; perda de resposta após commit pode deixar resultado incerto; aba fechada pode impedir rollback. Garantias completas exigiriam operação transacional/idempotente no servidor. Nenhuma function/trigger foi criada, conforme solicitado.
5. Edição/exclusão também podem concluir parcialmente. As mensagens agora tornam isso explícito; transação de backend continua sendo a solução para atomicidade total.

## Arquivos alterados

`index.html`, `js/app.js`, `js/supabase.js`, `service-worker.js`, `tests/browser-mock.js`, `tests/browser-checks.js`, `tests/browser-review.py`, `tests/README.md` e este relatório. `css/style.css` não precisou mudar.

Verificação final: `git diff --check` passou; `git status` e `git diff --stat` executados. Alterações locais não staged, sem commit/push. O relatório é arquivo novo e por isso não aparece no `git diff --stat` padrão antes de ser adicionado ao índice.

## Correção após teste real: identity de sales

O teste local contra o backend retornou `cannot insert a non-DEFAULT value into column "sale_number"`. Conforme o schema informado pelo usuário, `public.sales.sale_number` é BIGINT IDENTITY. O frontend calculava e enviava esse campo, incompatível com a geração automática.

Removidos o cálculo prévio, o campo do INSERT e a função `getNextSaleNumber`, cuja única finalidade era calcular o número. O INSERT mantém `.select().single()`; `sale.sale_number` retornado pelo banco passa a alimentar as descrições de movimentação/receita. Listagem e atividade já usavam o número do registro. Nenhuma alteração nas etapas restantes ou na compensação.

O mock agora rejeita escrita manual de `sale_number` e gera números por sequência independente, começando longe dos registros de exemplo. Regressões verificam ausência do campo no payload, uso do valor retornado no estoque/financeiro/interface e preservam testes de rollback.

A busca em todo o projeto não encontrou outro payload de produção atribuindo IDs primários, `created_at` ou `updated_at`. `user_id`, `product_id`, `sale_id`, `product_variant_id`, `category_id`, `color_id`, `size_id` e `reference_id` são referências necessárias, não IDs novos gerados pelo frontend. Datas de venda/lançamento são campos de negócio. Sem schema SQL local, não é possível confirmar outras definições DEFAULT/IDENTITY remotas; nenhuma foi presumida ou alterada. Dados explícitos nos fixtures e a geração no mock são exclusivos dos testes.

Validação desta correção: teste estrutural passou (118 funções); 89 verificações de navegador passaram, inclusive rollback, mais reload com sessão restaurada. Nenhum erro JavaScript não tratado ou overflow. `git diff --check` passou. O backend real não foi acessado nesta rodada; repetir a venda localmente contra o Supabase confirma o resultado remoto.
