# Revisão MabijuFit — 20/09/2026

## Escopo e arquivos

A imagem `referencias/referencia-visual.png` foi aberta antes das alterações. A referência orientou a paleta suave, hierarquia, ícones de traço, superfícies claras e organização mobile; o código existente orientou os fluxos. Foram preservadas as alterações locais que já existiam no início desta revisão.

Arquivos da aplicação alterados: `index.html`, `css/style.css`, `js/app.js`, `manifest.json` e `service-worker.js`. Foram adicionados este relatório e `tests/browser-review.py`, `tests/browser-checks.js`, `tests/browser-mock.js`, `tests/static-review.py` e `tests/README.md`.

`js/supabase.js`, credenciais, schema, tabelas, RLS, policies, triggers e configuração do Storage não foram alterados. Nenhuma operação foi executada contra dados remotos. Não foi adicionado framework ou dependência de execução à aplicação.

## Estrutura e aparência

- Login e conteúdo da aplicação têm responsabilidades e estilos separados.
- Cabeçalho com saudação, identificação truncada, título completo acessível e botão Sair que mantém sua área de toque.
- Quatro atalhos com SVG inline, sem letras substituindo ícones.
- Produtos focados em catálogo, busca e ações. Categorias, cores e tamanhos ficam em **Cadastros**, acessível por Produtos, com retorno simples.
- Cards de produtos com foto vertical à esquerda, informações e ações à direita; grids adaptados a mobile, tablet e desktop.
- Estoque com estados normal, baixo e zerado; financeiro e vendas com componentes e estados vazios compatíveis com o CSS.
- Rosa suave, contraste reforçado, tipografia e espaçamentos consistentes, previews verticais e ícones sem biblioteca externa.

## Correções funcionais

- Uma única interface de venda, definida no HTML. Removido `ensureSaleModalUI`; listeners vinculados uma única vez. Um título, uma seleção de pagamento e uma mensagem de formulário.
- **Adicionar produto não chama `focus()` na pesquisa**. O foco permanece no botão; o campo recebe foco por ação manual.
- Preservados seleção de produto/variação, quantidades, remoção, subtotal, desconto, pagamento, observações, registro, baixa de estoque, `inventory_movements` e receita financeira.
- Registro de venda protegido contra envio simultâneo e alterações do formulário enquanto salva; revalidação de estoque e de ativação antes de gravar.
- Título de produto alterna entre Novo produto e Editar produto.
- Remover variação na edição desativa `is_active`, sem apagar o registro. Reinserir uma combinação reutiliza seu identificador, inclusive antes de salvar.
- Produtos têm Editar, Vender e Ativar/Desativar. Excluir aparece para inativos; a operação é recusada se houver qualquer variação ou foto. Apenas cadastro vazio e inativo pode ser excluído, com confirmação.
- Uma regra operacional é compartilhada entre estoque, busca e indicadores: variantes e produtos inativos ficam fora das operações.
- Atividade recente usa caches de produtos, vendas e financeiro, ordena por data, limita resultados e evita duplicar a receita vinculada à venda.
- Datas diárias usam o calendário local. Timestamps continuam sendo enviados como instantes ISO; apresentação e agrupamento convertem para o horário local. Venda e receita usam a mesma referência de tempo.
- Financeiro filtra Hoje, 7 dias, 30 dias, Este mês e Todo o histórico. Cards e listagem respeitam o período; a busca refina a listagem.
- Valores canônicos de pagamento e apresentação compatível com valores antigos, como Pix e Dinheiro.
- Múltiplas fotos, compressão, preview, upload e escolha da principal mantidos.

## Acessibilidade e modais

Dialogs com `role`, `aria-modal` e título associado; fechamento por Escape e backdrop; retorno ao elemento de origem, contenção de Tab e fundo `inert`. Cabeçalho permanece visível e o conteúdo longo rola internamente. Safe areas e viewport mobile foram considerados.

Buscas e controles têm nomes acessíveis; mensagens anunciam alterações; ícones decorativos ficam fora da leitura. Cards não são botões que contêm outros botões. Upload é acessível por teclado. Navegação identifica a página atual e o seletor de produtos informa seu estado expandido.

## Problemas adicionais corrigidos

- Uma falha na edição de variações podia entrar na rotina de exclusão do produto existente. A limpeza agora fica restrita à criação que falhou.
- Uma inserção de variação já concluída poderia ser repetida após falha posterior; seu ID passa a ser mantido no draft.
- Carregamentos simultâneos de fotos podiam adicionar as mesmas imagens duas vezes ao cache compartilhado. Cada resposta monta seu conjunto antes de atualizar o cache.
- Mudanças de quantidade na venda recriavam o campo a cada tecla. A quantidade agora é confirmada em `change`; ações de incremento/decremento preservam foco.
- Salvamento de produto e lançamento financeiro protegido contra repetição e interação concorrente; controles são liberados também após falha.
- Filtros visíveis de listagens são respeitados na atualização dos dados.
- Removidas consultas redundantes do dashboard; renderização financeira e helpers de data/pagamento compartilhados.

## PWA

Meta e manifest usam `#c96f8c`; fundo consistente com o aplicativo. Ícones existentes e dimensões preservados, declarados como `any` sem prometer uma máscara segura que não foi desenhada.

Cache atualizado para `mabijufit-v5`. O service worker armazena somente arquivos locais conhecidos, oferece fallback local e limpa apenas caches antigos com prefixo MabijuFit. Não intercepta Supabase, CDN ou autenticação e não implementa sincronização offline de dados.

## Limitações e backend

**Requer alteração no backend/Supabase:** atomicidade integral da venda e da edição com várias gravações, inclusive recuperação garantida diante de queda de rede, falha de compensação e concorrência entre dispositivos. O fluxo atual usa chamadas separadas e compensação no cliente; o controle de estoque compara o valor anterior, mas isso não equivale a uma transação no banco. Uma solução integral exigiria transação/RPC no backend, fora da autorização desta revisão.

A sequência de numeração de vendas também continua baseada no fluxo existente e precisa de garantia no backend para concorrência entre dispositivos. Não foram criadas migrations ou funções remotas.

Não é possível confirmar credenciais, RLS, regras de relacionamento ou comportamento do Storage real com os testes simulados. Esses pontos permanecem sem alterações, conforme o limite solicitado. A autenticação existente foi preservada; sua conexão real não foi exercitada.

## Validação executada

- `python3 tests/static-review.py`: HTML balanceado, 127 IDs únicos, referências estáticas de JS/labels/ARIA válidas, sem funções duplicadas ou interativos aninhados; CSS analisado; manifest e dimensões dos ícones válidos.
- `python3 tests/browser-review.py`: **59 verificações aprovadas**, no Firefox, com fuso `America/Sao_Paulo` e Supabase simulado em memória.
- Fluxos: login/dashboard, produtos/cadastros, novo/editar produto, múltiplas fotos e otimização, variações, busca de estoque, venda completa, remoção de item, desconto, lançamento financeiro e logout.
- Casos de falha: variação desativada durante venda, falha ao editar variações, falha financeira com reversão, envio duplicado, exclusão recusada e reativação sem duplicar variação.
- Escape, Tab, retorno de foco, backdrop, ausência de foco automático na busca, SVGs e IDs dinâmicos verificados.
- Seis telas e seis modais avaliados em **320, 360, 430, 768 e 1280 px**; nenhum transbordamento horizontal detectado. Capturas inspecionadas visualmente, incluindo seletores de venda, fotos e variações.
- Sem erros JavaScript não tratados no ambiente simulado. Service worker testado com cache e rede simulados: pré-cache, limpeza seletiva, fallback offline e exclusão de serviços externos.
- Resultados e capturas: `/tmp/mabijufit-review`. Instruções de reprodução em `tests/README.md`.

## Testes manuais pendentes

- Login/logout reais, sessão persistida e expirada, com Supabase disponível e indisponível.
- Criar/editar produto de teste autorizado e enviar fotos reais, verificando Storage, principal, compressão e persistência após recarregar.
- Efetuar venda controlada e conferir as quatro partes no backend: venda, itens, estoque/movimento e financeiro.
- Validar falhas de rede, permissões e concorrência com dois dispositivos; observar a limitação transacional descrita acima.
- Android/iOS físicos: teclado apenas após tocar na pesquisa, seletor de arquivos/câmera, safe areas, teclado virtual e leitores de tela.
- Instalar/atualizar PWA e abrir sem rede após o primeiro carregamento conectado. Apenas o shell local é esperado offline.

## Git

Executados `git status`, `git diff --stat` e `git diff --check`. **`git diff --check` sem erros.** Nenhum commit, push ou publicação. `referencias/` já estava não rastreado antes desta revisão e foi preservado.
