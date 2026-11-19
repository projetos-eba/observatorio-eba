# Publicação do Hub na Cloudflare Pages

O projeto Pages `observatorio-eba` atende `hub.ebaagencia.com`. O build gera assets e o servidor Vinext em `dist/pages`; o servidor roda como Pages Functions em modo avançado.

## Preparação da conta

1. Crie um projeto Pages com branch de produção `main` e um banco D1 exclusivo para o Hub. Reserve um bucket R2 privado para os arquivos do Hub. Use o ambiente de produção para os bindings `DB` e `BUCKET`.
2. Aplique ao banco remoto os arquivos SQL de `drizzle/` com `wrangler d1 migrations apply`. Na configuração local usada pelo comando, indique o identificador do banco em `d1_databases`, `migrations_dir` como `drizzle` e preserve a tabela de controle de migrações do Wrangler. O procedimento inicia o banco com o esquema. A migração de dados locais precisa de uma exportação planejada com mapeamento de identidades e arquivos.
3. Configure uma aplicação *Self-hosted* no Cloudflare Access para `hub.ebaagencia.com` e uma política que inclua somente as contas autorizadas. Cadastre `EBA_ACCESS_ISSUER` com o endereço completo `https://<equipe>.cloudflareaccess.com` e `EBA_ACCESS_AUDIENCE` com o AUD da aplicação. O servidor verifica assinatura, emissor, audiência e validade antes de atender páginas e APIs. Os endereços auxiliares do Pages redirecionam as navegações para o subdomínio canônico.
4. Vincule `hub.ebaagencia.com` em **Workers & Pages → projeto → Custom domains**. Aguarde DNS e HTTPS ativos. Os demais registros do domínio podem permanecer como estão.
5. Para conectar provedores com credenciais, use o secret `EBA_INTEGRATION_KEY` com 32 bytes novos em base64url. As conexões são cadastradas pela Central de Integrações. A rotina periódica do ambiente de desenvolvimento depende do Vite local.

## Build e publicação

Use Node.js 22.13 ou superior. Execute `npm ci` e `npm run build:pages`. No deploy Pages, use o diretório `dist/pages`, `compatibility_date` `2026-05-15` e a flag `nodejs_compat`.

Na publicação direta, passe `--no-bundle` para preservar os módulos gerados pelo Vinext. Use `--config` apontando para a configuração do Pages, pois o Vite também gera uma configuração de Workers em `dist/server` para a prévia local.

```sh
npx wrangler pages deploy dist/pages --project-name observatorio-eba --branch main --no-bundle --config wrangler.pages.jsonc
```

Uma configuração de Pages usada pela CLI precisa declarar `pages_build_output_dir: "./dist/pages"`, `name`, a data e flags de compatibilidade e os bindings de produção. Para um projeto que já tem os bindings salvos no painel, `wrangler pages download config observatorio-eba` exporta a configuração atual. Mantenha secrets no painel.

Depois de publicar, verifique o login, abra Radar, CRM, Carteira, Conteúdo e Integrações e grave um registro de teste. Valide a leitura de um arquivo via Hub e confirme que navegadores sem autenticação recebem a tela de login ou uma resposta de bloqueio.
