# Observatório EBA Growth

Painel da EBA Aceleradora Digital para avaliar mudanças em mídia paga, marketing de performance e conversão pelo Método PICO. A equipe registra o que mudou, decide como agir e pode transformar a decisão em teste ou em material reutilizável.

## Versões deste repositório

| Branch | Conteúdo | Estado |
| --- | --- | --- |
| `main` | Observatório, CRM, Carteira, Hub de Conteúdo e Central de Integrações | Branch de publicação no GitHub e na Cloudflare Pages |
| `codex/crm-em-desenvolvimento` | CRM comercial, Carteira, Hub de Conteúdo e Central de Integrações | Branch local de implementação das fases 1 a 4 |

A identidade verde da EBA está especificada em [Identidade visual](docs/identidade-visual.md). A versão original do Observatório permanece no histórico do repositório.

## Documentos canônicos

| Para responder | Documento |
| --- | --- |
| O que o Observatório entrega hoje? | [Produto e Método PICO](docs/produto.md) |
| Como os dados entram, são salvos e chegam à interface? | [Arquitetura e operação](docs/arquitetura.md) |
| Qual identidade adotar na evolução? | [Identidade visual e prévia](docs/identidade-visual.md) |
| Qual a ordem de desenvolvimento? | [Mapa de evolução em PDF](docs/referencias/Mapa-de-evolucao-EBA.pdf) · [Original editável em Word](docs/referencias/Mapa-de-evolucao-EBA.docx) |
| Como desenvolver e aceitar o primeiro CRM? | [Fase 1 do CRM comercial](docs/crm-fase-1.md) |
| Como preparar e registrar a reunião de carteira? | [Fase 2 da Carteira e Método PICO](docs/carteira-fase-2.md) |
| Como produzir, medir e reaproveitar conteúdo? | [Fase 3 do Hub de Conteúdo](docs/hub-fase-3.md) |
| Como conectar Instagram, Meta Ads e WhatsApp? | [Fase 4 de Integrações](docs/integracoes-fase-4.md) |
| Como enviar esta pasta ao meu GitHub? | [Publicação do repositório](docs/publicar-no-github.md) |
| Como publicar o Hub em `hub.ebaagencia.com`? | [Cloudflare Pages](docs/cloudflare-pages.md) |

## Executar esta branch

Use Node.js 22.13 ou superior e npm. A partir da raiz da pasta, execute uma vez em um clone novo:

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_colossal_supreme_intelligence.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_nifty_justin_hammer.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_modern_songbird.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_chemical_king_bedlam.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_hub_conteudo.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0005_central_integracoes.sql
npm run dev
```

Abra a URL local indicada no terminal. Em um banco já inicializado, aplique somente as migrações pendentes, em ordem. Para voltar ao trabalho com o mesmo banco, execute `npm run dev`. Para conferir os tipos, execute `npx --no-install tsc --noEmit`.

Abra **CRM comercial** no menu ou acesse `/crm`. No desenvolvimento local, o botão **Entrar** usa a identidade simulada do Sites. Na hospedagem privada, cada pessoa entra com sua conta e passa a aparecer entre os responsáveis ao abrir o CRM.

Abra **Carteira e Método PICO** no menu ou acesse `/carteira`. A Carteira compartilha o acesso local do CRM.

Abra **Hub de Conteúdo** no menu ou acesse `/conteudo`. O Hub usa a mesma sessão local. Os arquivos da biblioteca ficam no armazenamento R2 local e os metadados ficam no D1.

Após o build, execute `node scripts/test-crm.mjs` para validar CRM, Carteira e Hub com duas identidades em armazenamento temporário. Use `node scripts/test-integracoes.mjs` para validar as integrações com respostas controladas da Meta.

A curadoria inicial acompanha o código. As avaliações gravadas pelas pessoas ficam no D1 do ambiente em que trabalharam. O endereço registrado para a publicação de 18/11/2026 é o [Observatório EBA Growth](https://observatorio-eba-growth.cleverbutterfly1.chatgpt.site).
