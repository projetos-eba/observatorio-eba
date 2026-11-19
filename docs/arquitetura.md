# Arquitetura e operação

| Componente | Responsabilidade |
| --- | --- |
| `app/page.tsx` e `app/layout.tsx` | Inicializam a página em português e os arquivos de interface. |
| `public/radar.js`, `dialogs.js`, `radar.css` e `dialogs.css` | Navegação, filtros, comparações, fichas, formulários e layout responsivo. |
| `lib/radar-seed.ts` | Curadoria e exemplos versionados, com IDs usados pelos vínculos entre registros. |
| `app/api/store/route.ts` | Leitura e gravação dos registros da equipe, com verificação de revisão. |
| `app/api/sources/route.ts` | Consulta sob demanda aos feeds oficiais de Google Ads, Microsoft Advertising e Microsoft Clarity. |
| `db/` e `drizzle/` | Esquema Drizzle e histórico de migrações D1. |
| `worker/` e `.openai/hosting.json` | Entrada do Worker, identidade do Site e ligação com o banco D1 de nome lógico `DB`. |

## Ciclo de gravação

`GET /api/store` devolve os registros persistidos. O cliente combina esses dados com a base inicial por coleção e ID. `PUT /api/store` recebe coleção, ID, dados e revisão esperada. As coleções da versão publicada são `records`, `tests`, `insights` e `settings`. A primeira gravação usa revisão zero. Uma revisão obsoleta recebe HTTP 409 e exige reconciliar o conteúdo com a versão atual.

`GET /api/sources` retorna publicações e o estado de cada fonte para seleção manual. A consulta ocorre quando a pessoa abre ou atualiza as fontes. A visão semanal é calculada com o fuso de São Paulo.

## Ambientes e acesso

O desenvolvimento local usa D1 simulado em `.wrangler/state`. O Site hospedado usa o banco provisionado para o projeto. O manifesto versionado identifica a publicação existente. O acesso à aplicação hospedada depende da política privada do Sites. Em outra hospedagem, configurar autenticação e autorização antes de expor a API que lê e grava os dados da equipe.

Para validar uma instalação local, abrir o radar, salvar uma avaliação de teste, recarregar a página e pesquisar a decisão. Conferir também a resposta de `/api/store`. A publicação de código no GitHub e o deploy do Worker são operações distintas.

## CRM comercial

A rota `/crm` abre a fila do usuário autenticado. Os parâmetros `vista=funil`, `vista=contas` e `ficha=<id>` permitem abrir diretamente uma vista ou negociação. O acesso é compartilhado entre as pessoas autorizadas no Site privado.

`GET /api/crm` identifica o integrante e devolve negócios, pessoas, empresas, atividades e passagens para atendimento. `POST /api/crm` exige o identificador do pedido, a oportunidade, a ação e a revisão esperada. Cada atividade tem uma combinação única de oportunidade e revisão. Os comandos de uma mesma gravação são aplicados em lote, com leitura do recibo nas retentativas. `PATCH /api/crm` permite corrigir nome e canais de um contato, verificando os valores anteriores. O banco guarda dinheiro em centavos e separa os valores mensais dos pontuais.
