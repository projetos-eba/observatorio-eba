# Fase 1 do CRM comercial

## Decisões aprovadas

O CRM pertence ao Site privado do Observatório. A mesma equipe convidada pela EBA consulta e edita o funil compartilhado. O cadastro inicial é manual e rápido. Os valores recorrente e pontual são registrados separadamente em reais. O objetivo do piloto é permitir que outra pessoa assuma uma negociação e execute o próximo passo usando a ficha da oportunidade.

## Telas e fluxos

| Tela | Comportamento de aceite |
| --- | --- |
| Hoje | Abrir em Minha fila, permitir Toda a equipe e agrupar Vencidos, Hoje e Sem próximo passo. Exibir contato, última interação, responsável, prazo e botão Registrar retorno. |
| Funil | Entrada, Qualificação, Diagnóstico, Proposta e Negociação. Consultar ganhos e perdas por filtro. Exibir valores mensais e pontuais separadamente e valor desconhecido como “A definir”. |
| Oportunidade | Abrir painel lateral no computador e ficha inteira no celular. Permitir mudar etapa, adicionar contatos, atribuir responsável e consultar histórico com autoria. |
| Contas ganhas | Reutilizar a empresa em vendas seguintes e preservar o vínculo de cada contrato com a negociação de origem. |

**Entrada.** Aceitar empresa ou nome do contato. Telefone, e-mail, origem e primeira tarefa podem ser completados depois. Em caso de telefone ou e-mail já cadastrado, oferecer o contato existente para uma nova negociação.

**Retorno.** Gravar interação e próximo passo juntos. Atualizar a fila pelo fuso de São Paulo. Uma negociação aberta sem agendamento volta ao grupo Sem próximo passo.

**Ganho.** Confirmar empresa, contato principal, escopo, objetivo, condições e valores, responsável pelo atendimento e primeiro compromisso com data. A conclusão deve criar ou reutilizar a conta de forma atômica.

**Perda.** Exigir motivo e permitir recuperar o histórico. A oportunidade sai da fila de trabalho.

## Estado do desenvolvimento

A branch `codex/crm-em-desenvolvimento` implementa as telas Hoje, Funil e Contas ganhas em `/crm`. O cadastro, a edição de contatos, as transferências, os retornos e a conclusão de vendas usam o D1. Os dados da equipe se atualizam ao trocar de vista, ao retomar a janela e a cada minuto enquanto a página estiver visível. O piloto local usa um banco independente do ambiente publicado.

O teste `node scripts/test-crm.mjs`, executado após `npm run build`, cria um D1 descartável e valida atribuição de responsável, concorrência, confirmação repetida e duas vendas vinculadas à mesma conta. A validação visual cobriu a fila, a ficha e o funil em 390 px, além da passagem de venda no computador.

## Aceite do piloto

- Criar um contato recebido no WhatsApp a partir de uma tela de 390 px e agendar retorno.
- Alternar Minha fila e Toda a equipe. Verificar que um segundo integrante consegue localizar o último combinado, assumir o negócio e registrar uma proposta.
- Conferir atribuição, autoria, valores e prazos após recarregar.
- Ganhar duas vendas da mesma empresa, obter uma única conta e duas passagens de contrato. Perder outra oportunidade e localizar seu motivo.
- Repetir a confirmação de ganho e editar em duas sessões para verificar consistência. Testar navegação por teclado e confirmar que o Observatório existente continua funcionando.
