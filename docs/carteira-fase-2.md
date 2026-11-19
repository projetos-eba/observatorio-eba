# Fase 2 da Carteira e Método PICO

## Reunião de carteira

1. Ganhe uma oportunidade no CRM. Em **Carteira → Contas**, configure o nicho, responsável, taxa principal, meta e etapa do PICO em foco. Vendas seguintes da mesma empresa aparecem como contratos na mesma conta.
2. Registre as contagens e a fonte para a última semana completa. A ficha calcula a taxa principal, a variação em pontos percentuais e o menor avanço disponível do funil. Use a mesma definição de contagem para comparar semanas.
3. Abra **Pauta da semana**. Revise as pendências, registre a decisão e indique o próximo passo, responsável e data de revisão. Em **Análises do Radar**, verifique as sugestões de nicho e etapa, consulte a fonte e vincule as que sustentam a decisão.
4. Em **Fechar pauta**, escolha os participantes e marque cada conta como discutida ou adiada. A ata guarda as evidências e os dados exibidos no fechamento. Retome as ações na data de revisão e registre o resultado na ficha.

## Importação de indicadores

Baixe o CSV modelo em **Importar CSV**. Use o ID da ficha de cada conta já configurada e informe a semana pela segunda-feira em formato `AAAA-MM-DD`. A sequência de contagens sempre corresponde às quatro etapas do funil da conta. Células vazias representam dados ausentes. Use zero para uma contagem observada de zero. A prévia sinaliza registros repetidos e correções. O limite é de 50 medições por arquivo e o lote é gravado em conjunto.

## Banco e ambiente local

Em um banco que já executa a Fase 1, aplique a migração `0003_chemical_king_bedlam.sql` pelo mesmo comando local do README. A área está em `/carteira`. Use `?vista=contas&conta=<id>` para a ficha e `?vista=atas&ata=<segunda-feira>` para uma ata.

A API `GET /api/carteira` retorna as contas ganhas, medições, decisões, análises concluídas e reunião atual. `POST /api/carteira` usa a revisão que a pessoa abriu. O recibo do pedido permite retentativas, e a revisão protege a importação e a ata de alterações concorrentes. Medições e decisões têm histórico de revisões. Cada ata guarda uma cópia das referências, contagens e decisões discutidas.

Após o build, execute `node scripts/test-crm.mjs` para validar com o D1 descartável. A versão local usa os registros existentes na pasta `.wrangler/state`.
