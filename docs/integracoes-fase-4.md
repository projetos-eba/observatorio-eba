# Central de Integrações da EBA

A central em `/integracoes` usa o acesso local da equipe. Selecione o app da EBA Growth, siga as instruções na tela, teste a credencial, confira a prévia e confirme o recurso. Use **Trocar credencial** para renovar ou escolher outro recurso. **Desconectar** remove a credencial desta instalação. As leituras anteriores continuam disponíveis pelo seletor de recursos.

## Conexões

- **Instagram.** Use um perfil profissional e um token do Instagram Login com `instagram_business_basic`. Depois de conectar, rode **Atualizar agora** para trazer os posts. Vincule o post à publicação de Instagram correspondente no Hub para consultar curtidas e comentários ao lado da publicação.
- **Meta Ads.** Use o token com `ads_read` e acesso à conta de anúncios. Para validar um recurso diretamente, informe o ID numérico da conta, com ou sem `act_`. O relatório usa 30 dias completos no fuso da conta e mantém a moeda original. Compare um dia com o Gerenciador de Anúncios usando o mesmo recorte de conta e campanha.
- **WhatsApp Business.** Use o ID da conta WhatsApp Business e um token autorizado a consultar seus números. Selecione o número da EBA. Para usar os atalhos de conversa, confirme no Hub uma publicação com esse número como destino. A ficha da publicação já pode receber o agendamento ou a venda confirmada com a referência preservada pelo atendimento.

As instruções de cada app têm links para a documentação oficial. O painel distingue credencial expirada, acesso recusado, limitação temporária e falha de comunicação.

## Dados e rotina local

Instagram e Meta Ads atualizam uma vez ao dia a partir das 8h de São Paulo enquanto o servidor de desenvolvimento estiver em execução. O processo verifica a fila a cada 15 minutos e tenta recuperar o período após uma interrupção. A página pode ficar fechada. O botão **Atualizar agora** funciona sob demanda.

As credenciais são cifradas no D1 com a chave privada em `.sites-runtime/integracoes.key`. Guarde essa chave separadamente junto ao processo de backup do ambiente local. Uma cópia do banco sem a chave correspondente precisa de reconexão dos apps. Use o campo do assistente para informar a credencial.

Se a Fase 3 já estiver instalada, aplique a migração `0005_central_integracoes.sql` pelo comando do README e reinicie com `npm run dev`. Após o build, execute `node scripts/test-integracoes.mjs` para verificar as consultas e gravações com um banco descartável.
