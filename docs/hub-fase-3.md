# Hub de Conteúdo da EBA

## Produção e memória de marca

Use **Hub de Conteúdo** para abrir o espaço da EBA Growth ou ativar o de uma conta ganha do CRM. Em **Marca e ativos**, registre as diretrizes e os ativos aprovados. As diretrizes podem valer para toda a marca ou para um objetivo, etapa PICO e canal específicos. Cada versão carrega sua data de revisão ou validade, seus direitos e seu comprovante.

A biblioteca aceita JPG, PNG, WebP e PDF de até 15 MB. Para outros arquivos, cadastre um link HTTPS. Abra uma versão de ativo para ver seu comprovante, as peças que a usaram e as publicações associadas. Mantenha uma cópia da pasta local `.wrangler/state` para preservar metadados e arquivos em conjunto.

Crie um briefing no **Conteúdo** ou pelo link na ficha de uma decisão da **Carteira**. Use o quadro para acompanhar a etapa e o calendário para conferir os prazos. Em **Revisão**, solicite ajustes ou aprove com um comprovante. A publicação conserva a versão aprovada, mesmo quando uma edição posterior volta para produção.

## Publicação, evidência e reaproveitamento

1. Na versão aprovada, use **Preparar publicação** para gerar o link identificado do site ou a mensagem de WhatsApp com referência. Preserve o código no formulário da página ou no registro do atendimento.
2. Depois que a peça for ao ar, confirme a data e registre o endereço publicado ou a evidência de publicação.
3. Registre o resultado confirmado pela origem usando o ID que identifica aquele evento. A planilha-modelo aceita `tipo;id_evento;data;fonte;codigo;valor_reais` e até 50 registros por arquivo. Use `Lead confirmado`, `Agendamento` ou `Venda` e datas no formato `AAAA-MM-DD`. Para vendas, o valor pode ficar em branco. Evite repetir um evento com outro ID.
4. Em **Vínculos pendentes**, recupere o código a partir da fonte e corrija o evento. A atualização conserva a autoria e a versão anterior. A comparação agrupa publicações pelo objetivo e considera os primeiros 30 dias, com janelas abertas exibidas à parte.
5. Escolha **Reaproveitar** a partir da evidência para criar um briefing com a hipótese de adaptação, origem e ativos elegíveis. Prepare um novo link ao publicar a derivação.

## Ambiente local

Com a Fase 2 já instalada, aplique a migração `0004_hub_conteudo.sql` pelo comando local do README e reinicie o servidor para ativar o armazenamento de arquivos. A interface abre em `/conteudo` e compartilha a identidade do CRM. O trabalho de publicação em Instagram, sites e WhatsApp ocorre nesses canais, com o link gerado no Hub.

Após o build, execute `node scripts/test-crm.mjs` para rodar a verificação integrada em bancos e arquivos temporários.
