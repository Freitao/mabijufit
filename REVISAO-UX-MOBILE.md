# Revisão UX/UI — gestão mobile MabijuFit

20/09/2026. Escopo: uso interno da responsável pela loja, sem navegação de clientes. Foram relidos `index.html`, `css/style.css`, `js/app.js` e `manifest.json`, analisada `referencias/referencia-visual.png` e percorridas as seis telas e os seis modais existentes antes das alterações. O estado atual, incluindo identity de vendas, exclusão de produtos e correções de integração, foi a base desta revisão.

## Avaliação anterior

A arquitetura já tinha cinco destinos principais, cards com foto à esquerda e cadastros separados. As maiores dificuldades eram operacionais:

- Dashboard com indicadores soltos e atalhos que repetiam a barra inferior; não mostrava quais peças precisavam de reposição nem o resultado financeiro do dia.
- Cards de produto altos, com quatro ações sempre expostas; informações importantes disputavam espaço com ações menos frequentes.
- Cadastro de produto exigia muita rolagem para chegar às fotos e às variações. Descrição opcional tinha tanto destaque quanto preço e nome. Gerar combinações abria um prompt nativo sem contexto visual.
- Cadastros exibiam categorias, cores e tamanhos em sequência, tornando a área longa.
- Estoque sem filtro por situação nem acesso direto ao ajuste; financeiro sem separar receitas e despesas na listagem.
- Venda misturava carrinho, seletor de produtos, variações e pagamento. Abrir o seletor inseria um bloco grande no meio do formulário.
- Formulários tinham espaçamento e alturas pouco proporcionais ao celular. Confirmações de sucesso eram inconsistentes e alguns erros de backend apareciam diretamente.

## Decisões e alterações

| Área | Resultado |
| --- | --- |
| Login | Marca mais compacta, finalidade explícita e botão Mostrar/Ocultar senha. Formulário mantém autenticação existente. |
| Cabeçalho/navegação | Identificação compacta, nome da conta secundário, Cadastros e Sair acessíveis. Barra inferior permanece com cinco destinos. |
| Início | Vendas, número de vendas, variações para reposição, despesas e resultado do dia. Resultado é **receitas menos despesas**, não lucro contábil. Até três alertas reais por produto/cor/tamanho, ordenados por quantidade. Atividade recente preservada. |
| Atalhos | Nova venda, Novo produto, Despesa e Ver estoque executam tarefas ou levam à consulta relevante. Os alertas abrem a edição de estoque. |
| Produtos | Filtros Todos/Ativos/Inativos; foto vertical controlada, nome/SKU/preço/quantidade/status/variações. Editar e Vender visíveis; **Mais** reúne Ativar/Desativar e Excluir, sem remover funções. |
| Cadastro/edição | Três etapas no mesmo formulário: **Dados, Fotos e Estoque**. Estado preservado entre elas; validação revela a etapa de um campo obrigatório. Preços lado a lado. SKU/descrição em detalhe opcional. Rodapé de salvar acessível durante rolagem. |
| Fotos | Acesso separado à câmera e galeria. Novas seleções acumulam no rascunho; cancelar não apaga a seleção. Botão Remover por foto ainda não enviada. Fotos existentes e upload preservados. |
| Variações | Cor/tamanho e quantidade organizados em grade compacta, quantidades editáveis e geração em lote em uma seção expansível com campo numérico, substituindo o prompt. |
| Cadastros | Categorias, Cores e Tamanhos em seletores, mostrando um grupo por vez. Modais compactos. Estado inativo identificado nos cards. Salvamento pela interface tem bloqueio de duplicidade/loading. |
| Estoque | Filtros Todos/Baixo/Sem estoque/Normal, situação com texto e cor, ordem crescente de quantidade e **Ajustar estoque** abre a etapa de estoque do produto. Mantém as mesmas operações de edição. |
| Histórico de vendas | Número, data/hora, total, pagamento e situação explícita. Busca por número, pagamento ou data. Sem aparência de documento fiscal. |
| Nova venda | Itens primeiro; seleção de produto/variação substitui o conteúdo do carrinho temporariamente; pagamento em etapa separada. Voltar mantém itens, desconto e pagamento. |
| Seletor da venda | Fotos compactas e informações de reconhecimento. Busca sem foco automático. Variações agrupadas por cor, com tamanho e quantidade disponível; botões indisponíveis desabilitados. Considera também quantidade já adicionada ao rascunho. |
| Financeiro | Período compacto, receitas/despesas/resultado, filtros da lista Todos/Receitas/Despesas. Resumo continua refletindo o período completo para não confundir filtro da lista com saldo. |
| Lançamento | Despesa como padrão, descrição e categoria obrigatória sempre visíveis, valor/data lado a lado. Apenas observações opcionais recolhidas. Categoria vazia ou só com espaços bloqueada no HTML e no JavaScript. Receita continua disponível no seletor de tipo. |
| Modais | Produto e venda quase ocupam a tela no celular; cadastros/lançamento usam folha inferior com altura conforme o conteúdo. Rolagem interna, safe areas, cabeçalho compacto e ações acessíveis. |
| Vazios/feedback | Estados vazios compactos, com ação quando útil. Sucesso anunciado em componente único; erros técnicos ficam no console, interface orienta a próxima ação. Cores semânticas para receita, despesa, atenção e indisponibilidade. |

## Mobile-first

A revisão priorizou 360/390/430 px e conferiu também 320/375/412/768/1280 px. Controles principais têm alvo de toque de pelo menos 44 px; inputs usam 16 px e teclados decimal/numérico onde apropriado. Preços e campos relacionados usam duas colunas quando cabem. As opções menos frequentes ficam em detalhes expansíveis, sem desaparecer do aplicativo. A seleção de produto não abre o teclado automaticamente. As mudanças de etapa não apagam rascunhos.

O desktop mantém a mesma organização, com cards em colunas e largura de conteúdo controlada. Não foram criados framework, rotas ou dependências.

## Problemas funcionais tratados

- Cancelar uma seleção de fotos podia limpar o rascunho; selecionar mais fotos substituía as anteriores. Agora cancelar preserva e novas seleções acumulam, com remoção explícita de cada foto pendente.
- Uma foto nova de produto já com principal não é mais anunciada indevidamente como a principal no preview.
- Campos obrigatórios em etapa não visível são revelados quando a validação é acionada.
- Navegação de foco exclui campos de detalhes fechados; Escape no seletor da venda retorna ao carrinho antes de fechar a venda inteira.
- Filtros e buscas são limpos no logout para não carregar o contexto da conta anterior.
- Cadastros auxiliares submetidos pela interface impedem submissão duplicada e fechamento durante salvamento.
- Mensagens genéricas de erro não exibem diretamente o texto de erros Supabase/Auth. Validações de negócio compreensíveis continuam aparecendo.

## Preservação da integração

Não houve nova consulta para o dashboard: usa os caches existentes. Comparação com o início desta revisão confirmou **12 inserts, 10 updates e 10 deletes idênticos**. Auth, Storage, baixa de estoque, receita da venda e compensação permanecem no fluxo existente. `sale_number` continua ausente do INSERT e é obtido do registro retornado pelo PostgreSQL.

`manifest.json`, `js/supabase.js` e `service-worker.js` não foram alterados **nesta etapa de UX**. Alguns aparecem modificados no status por alterações autorizadas anteriores, preservadas. Nenhuma alteração remota, schema, policy, trigger, função ou bucket foi feita.

## Testes e evidências

- `python3 tests/static-review.py`: HTML/CSS válidos, 142 IDs únicos, seletores/labels válidos, 126 funções únicas, manifest e ícones válidos.
- `python3 tests/browser-review.py`: 89 verificações de integração simulada e 39 verificações novas de UX. Incluem login, dashboard, busca, produto/edição/fotos/variações, cadastros, estoque/filtros/ajuste, venda por etapas/quantidade/desconto/pagamento/registro, identity automática, rollback, financeiro, lançamento e logout.
- Telas e modais em oito larguras: 320, 360, 375, 390, 412, 430, 768 e 1280 px, sem transbordamento horizontal.
- Modais de produto, lançamento e venda também contidos em viewport de 360×420 px, medidos após a animação de abertura.
- Recarga efetiva da página com restauração da sessão simulada. Console sem erros JavaScript ou promises rejeitadas não tratados. Erros simulados são intencionais e avaliados pelos testes.
- Capturas em `/tmp/mabijufit-review`, incluindo `home-390.png`, `products-390.png`, `stock-390.png`, `finance-390.png`, `product-photos-360.png`, `product-variations-360.png`, `sale-product-picker-360.png`, `sale-variant-picker-360.png`, `sale-payment-360.png` e desktop. Resultados em `checks.json`, `ux-checks.json` e `layouts.json`.
- Os testes usam Firefox e cliente Supabase em memória. Não comprovam policies, câmera física, rede real ou comportamento de Safari/Chrome em dispositivo móvel.

## Ainda validar em celular real

1. Instalação/abertura como PWA em Android/iPhone, safe areas e navegação com uma mão.
2. Câmera traseira, escolha de múltiplas fotos, orientação da imagem, HEIC quando aplicável e envio pela conexão móvel.
3. Teclado virtual em nome/preços/quantidades/desconto, foco e alcance dos botões de salvar. Viewport reduzida no desktop não substitui teclado real.
4. Seletor nativo de datas, vírgula decimal e tamanhos de fonte ampliados.
5. Ciclo completo com Supabase real: salvar/editar produto, ajustar estoque, registrar venda e despesa, conferir resultados e sair/entrar.
6. Confirmar com a responsável pela loja se a ordem dos atalhos e o agrupamento Dados/Fotos/Estoque acompanham seu ritmo de trabalho.

## Arquivos desta etapa

`index.html`, `css/style.css`, `js/app.js`, `tests/browser-checks.js`, `tests/browser-review.py`, novo `tests/ux-checks.js`, `tests/README.md` e este relatório. O HTML também foi reformatado para tornar os componentes reorganizados legíveis.

Sem commit e sem push. Alterações anteriores permanecem no workspace para revisão conjunta.

Verificação final: `git diff --check` passou; `git status` e `git diff --stat` executados. O diff inclui alterações das etapas anteriores da conversa. Os relatórios e o teste UX novos ainda não aparecem no `git diff --stat` padrão porque não foram adicionados ao índice.
