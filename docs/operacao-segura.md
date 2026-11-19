# Permissões e coleta em produção

## Permissões

O Cloudflare Access controla o login. O D1 controla os registros que a pessoa pode acessar depois de entrar. A equipe existente é identificada pelo ID autenticado salvo em `crm_members`. As permissões explícitas ficam em `workspace_permissions`. Aplique a migração `0006_operacao_segura.sql` antes de publicar o build do Pages e registre o titular do workspace como administrador usando seu ID autenticado.

| Escopo | Valor em `target` | Acesso |
| --- | --- | --- |
| `admin` | String vazia | Workspace inteiro, credenciais dos provedores, trilha de auditoria e fechamento da pauta geral |
| `account` | ID em `crm_companies.id` | CRM e Carteira da conta, além do espaço editorial da marca vinculada |
| `brand` | `eba` ou `conta:<id da empresa>` | Espaço editorial da marca. Para EBA Growth, também Radar e leitura das Integrações |

O responsável atual do CRM e o responsável da passagem de venda também têm acesso à conta correspondente. Ao remover o acesso de alguém, revise as atribuições no CRM e os escopos explícitos. Uma permissão de marca de cliente não concede acesso ao CRM ou às decisões PICO da conta. O acesso de edição de um contato compartilhado exige acesso a todas as oportunidades que usam esse cadastro.

Ao registrar uma concessão, use o ID da pessoa em `member`, o ID do administrador em `grantedBy` e o horário UTC em `grantedAt`. As mudanças de conexão, troca de credencial e desconexão são auditadas com autor, horário e recurso. Os tokens não entram na trilha.

## Worker agendado

O projeto `observatorio-eba-integracoes` usa [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) e não tem rota HTTP. Use a configuração `wrangler.sync.jsonc` para implantar o código com o binding `DB` no banco de produção e agendamento a cada 15 minutos.

```sh
npx wrangler deploy --config wrangler.sync.jsonc
npx wrangler secret put EBA_INTEGRATION_KEY --config wrangler.sync.jsonc
```

O secret precisa ter o mesmo valor no Pages e no Worker. Preserve a chave vigente quando houver conexões. Uma chave nova não abre credenciais criptografadas com a anterior. O agendador tenta a coleta a partir das 8h em São Paulo. Com uma coleta bem-sucedida no dia, ignora novas tentativas do mesmo provedor. O WhatsApp Business tem verificação de acesso, enquanto Instagram e Meta Ads têm coleta de métricas.

Na Central, confira a última coleta bem-sucedida e as mensagens de erro ou credencial expirada. Depois das 9h, uma conexão sem sucesso naquele dia mostra atraso. Limites dos provedores e falhas temporárias entram na próxima tentativa elegível. A interface mostra os alertas no painel.
