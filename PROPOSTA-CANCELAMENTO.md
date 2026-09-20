# Cancelamento de vendas — implementação e limites

O cancelamento está implementado no frontend. Este documento substitui a proposta
anterior de RPC: o usuário autorizou compensação no navegador e confirmou que
`inventory_movements.movement_type` é texto livre, sem CHECK/enum, autorizando
`sale_cancel` para devoluções. Não foram alterados schema, RLS, policies, triggers,
functions ou qualquer recurso remoto. O financeiro é exclusivamente interno.

## Fluxo e ordem das operações

1. Card tocável no histórico abre os detalhes históricos da venda e seus itens.
   Venda concluída sem tentativa pendente oferece ação secundária “Cancelar venda”.
   Um modal separado informa as consequências e pede confirmação explícita, com
   motivo opcional. “Voltar” retorna aos detalhes sem modificar dados.
2. O handler relê a venda do usuário no Supabase. `cancelled` retorna sem escrita;
   outro status ou `cancelled_at` já preenchido impede prosseguir. Lê todos os
   itens, movimentos e transações vinculadas com paginação e filtro de usuário.
3. Valida quantidades positivas inteiras, movimentos originais `sale` correspondentes
   aos itens e exatamente uma receita `income` com valor igual ao total da venda.
   Divergências são encaminhadas para conferência, sem adivinhar quais dados apagar.
4. Reserva a operação com UPDATE condicional em `sales`: exige `completed` e
   `cancelled_at IS NULL`, grava o timestamp da tentativa e o motivo. A resposta
   deve confirmar uma linha. Isso impede que duas abas reservem a mesma venda.
5. Agrupa `sale_items.quantity` por `product_variant_id`. Para cada variação, lê
   o estoque atual e soma a quantidade vendida usando UPDATE condicional ao estoque
   lido e ao usuário. Variações inativas também podem receber sua devolução.
6. Insere um movimento `sale_cancel` por variação, quantidade positiva,
   `reference_id = sales.id`, motivo “Cancelamento da venda #N” e observação com o
   motivo informado. Mantém todos os movimentos `sale` originais e `sale_items`.
7. Exclui exclusivamente a receita interna validada, filtrando ID, proprietário,
   `reference_id`, tipo `income` e valor. Confirma a linha removida. Não chama
   serviços bancários nem APIs financeiras.
8. Finaliza `sales.status = cancelled` condicionado ao timestamp reservado e ao
   status anterior. Mantém número automático, data original, itens e valores.
9. Recarrega vendas, produtos, estoque, financeiro e dashboard, inclusive em falha.
   Em sucesso, reabre os detalhes mostrando CANCELADA, timestamp e motivo. A ação
   de cancelar desaparece. O motivo é renderizado como texto, sem executar HTML.

## Significado da marca persistida

- `status = completed` e `cancelled_at IS NULL`: venda disponível para cancelar.
- `status = completed` e `cancelled_at` preenchido: tentativa em andamento ou
  pendente de conferência. O frontend mostra “Cancelamento pendente” e bloqueia
  nova tentativa. Nesse estado, o timestamp é da tentativa, não a afirmação de
  que todas as etapas terminaram. Não é um novo status/coluna do banco.
- `status = cancelled`: cancelamento finalizado, sem possibilidade de nova devolução.

A marca persistida é necessária porque um booleano no navegador não protege duas
abas nem sobrevive a um fechamento/reload. Canceladas e pendentes não contam como
vendas válidas nos indicadores de vendas e atividades. O financeiro continua
refletindo os registros internos efetivamente presentes; uma tentativa parcial
exige conferência antes de considerar os totais reconciliados.

## Falhas e compensação

Escritas verificam erros e quantidade retornada. Erros PostgreSQL de validação,
constraints e acesso (classes 22, 23 e 42), ou zero linhas num UPDATE/DELETE,
são tratados como rejeição confirmada. Resposta perdida ou formato inesperado é
resultado desconhecido; não se presume que nada foi escrito.

Antes de remover a receita e sem escrita ambígua, tenta compensar:

1. Restaurar estoques confirmados em ordem inversa, somente se ainda iguais aos
   valores deixados pelo cancelamento. Não sobrescreve estoque concorrente.
2. Se todos os estoques foram restaurados, remover somente os IDs dos movimentos
   compensatórios desta tentativa; nunca os movimentos originais da venda.
3. Limpar a reserva somente após compensação completa, filtrando seu timestamp.

Se a receita já foi removida, uma resposta se perdeu, ou a compensação falhou,
a marca não é liberada por suposição. O console registra venda, timestamp, etapas,
estados anteriores/posteriores e erro. A usuária recebe mensagem para não repetir
a operação e conferir a venda com suporte; os dados reais são recarregados.

Um status final gravado cuja resposta se perdeu pode aparecer corretamente como
CANCELADA após recarga. Repetir a chamada apenas lê o status e não altera estoque,
movimentos ou financeiro. Não se recria receita com ID/defaults presumidos.

## Consistência e limites reais

Isso é compensação de múltiplas requisições, **não atomicidade PostgreSQL**.
Interromper o navegador entre etapas pode deixar uma tentativa pendente. Em
especial, depois de remover a receita e antes de finalizar o status, estoque e
financeiro já podem estar corrigidos enquanto a venda ainda mostra pendência.
A marca impede aplicar novamente a devolução, mas não é um mecanismo automático
de recuperação completa. Conferência manual precisa comparar itens, movimentos,
receita e estoques antes de decidir completar/reverter; não basta limpar a marca.

O UPDATE condicional de estoque detecta mudanças no valor, não todo histórico de
concorrência (ex.: uma quantidade que mudou e voltou ao mesmo número). Escritores
externos, triggers e alterações manuais não foram auditados no Supabase. Uma RPC
transacional continua sendo a evolução para eliminar essas janelas, mas não foi
criada nem exigida para disponibilizar este fluxo autorizado.

A reserva utiliza a nulabilidade já esperada de `cancelled_at` nas vendas concluídas.
Permissões de SELECT/UPDATE/INSERT/DELETE continuam dependendo das policies atuais;
se uma etapa for negada, o fluxo informa falha e tenta compensar conforme acima.
Os testes simulados não comprovam permissões ou integração remota.

## Financeiro manual e origem

Vendas geram receita `income`, categoria Venda e `reference_id = sales.id`.
Lançamentos manuais gravam `reference_id = null`. A exclusão manual continua
exigindo ID, usuário e referência nula no próprio DELETE; referência preenchida
ou ausente/indefinida não autoriza exclusão isolada. Categoria/descrição não definem
origem. A mensagem de proteção e o acesso “Ver venda de origem” foram preservados.

## Validação local

`tests/sale-cancel-checks.js` registra uma venda pelo fluxo existente, com dois
produtos, três variações e quantidades 2/3/1. Exercita detalhes, confirmação,
voltar, motivo, duplo toque, baixa/devolução, itens preservados, movimentos
originais e compensatórios, receita, resultado, faturamento e estoque baixo.

Cobre rejeições de estoque, inserção de movimento, exclusão financeira e status
final; perda de resposta depois de cada etapa; conflito de estoque durante
rollback; duas chamadas concorrentes e repetição. O runner preserva o backend
simulado em snapshot para recarregar a página e repetir o cancelamento, verificando
que não há nova devolução. Inclui confirmação em oito larguras e viewport baixa.
As suítes anteriores de vendas, financeiro manual, detalhes, perfil e UX permanecem.
