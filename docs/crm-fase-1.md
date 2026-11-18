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

A branch local `codex/crm-em-desenvolvimento` preserva o trabalho iniciado antes da preparação do repositório. Inclui modelos relacionais, migração complementar, rota `/api/crm`, tipos de dados e componentes parciais de formulário. Para concluir a fase, integrar telas, navegação, estados de erro e identidade visual e executar os testes de aceite. A migração adicional pertence a essa branch.

## Aceite do piloto

- Criar um contato recebido no WhatsApp a partir de uma tela de 390 px e agendar retorno.
- Alternar Minha fila e Toda a equipe. Verificar que um segundo integrante consegue localizar o último combinado, assumir o negócio e registrar uma proposta.
- Conferir atribuição, autoria, valores e prazos após recarregar.
- Ganhar duas vendas da mesma empresa, obter uma única conta e duas passagens de contrato. Perder outra oportunidade e localizar seu motivo.
- Repetir a confirmação de ganho e editar em duas sessões para verificar consistência. Testar navegação por teclado e confirmar que o Observatório existente continua funcionando.
