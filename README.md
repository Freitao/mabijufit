# MabijuFit

Sistema de gestão da loja MabijuFit.

## Publicação da atualização completa

1. Faça backup ou confirme um ponto de restauração do projeto Supabase.
2. No SQL Editor do Supabase, execute uma única vez o conteúdo de `supabase/ATUALIZACAO-COMPLETA.sql`.
3. Aguarde a consulta terminar sem erro. O script usa uma transação: se uma etapa falhar, as alterações desta execução são revertidas.
4. Publique no GitHub o conteúdo completo deste pacote, substituindo os arquivos existentes.
5. Abra o site atualizado, recarregue o aplicativo e confira os fluxos descritos em `supabase/VALIDACAO-POS-ATUALIZACAO.md`.

O script consolidado inclui as operações comerciais de compras, devoluções parciais ao fornecedor, crédito, reembolso e reposição, além da tabela e das permissões das anotações de pedidos de clientes. Ele preserva os registros existentes e associa fornecedores a partir dos nomes já salvos nas compras.

Os arquivos em `supabase/migrations/` são as versões separadas para controle de histórico. Para esta publicação, use somente `ATUALIZACAO-COMPLETA.sql` no SQL Editor; não execute também as migrations individuais.
