/* As datas das fontes são reais. O fluxo de avaliação e os testes são exemplos editáveis. */
const revendas = "Revendas de veículos";
const saude = "Clínicas e saúde";
const advocacia = "Advocacia";
const allNiches = [saude, advocacia, revendas];
const analytics = "https://support.google.com/analytics/answer/9164320?hl=en";
const analyticsPt =
  "https://support.google.com/analytics/answer/9164320?hl=pt-BR";
const records = [
  {
    id: "demand-gen-sazonalidade",
    title: "Demand Gen ganha ajustes de sazonalidade",
    summary:
      "Ofertas curtas podem orientar os lances do YouTube durante picos de conversão.",
    source: "Google Ads",
    url: "https://blog.google/products/ads-commerce/demand-gen-drop-november-2026/",
    sourceDate: "2026-11-18",
    date: "2026-11-18",
    theme: "Mídia paga",
    stage: "Impulsionar",
    impact: "Alto",
    priority: "Alta",
    status: "A avaliar",
    owner: "",
    niches: [revendas],
    changed:
      "O Google liberou os ajustes de sazonalidade para campanhas Demand Gen com CPA ou ROAS desejado. O anunciante informa a variação esperada na taxa de conversão durante uma promoção curta.",
    why: "Um feirão pode concentrar em poucos dias a procura que a estratégia de lances levaria mais tempo para reconhecer.",
    opportunity:
      "Comparar o histórico de dois feirões da mesma loja e estimar quanto a taxa de agendamento realmente mudou nos dias da oferta.",
    risks:
      "Uma estimativa inflada pode consumir a verba antes do fim do evento. Mais cadastros podem esconder queda na qualidade dos contatos.",
    decision: "",
    next: "Levantar gasto, agendamentos e comparecimentos do último feirão antes de propor o ajuste.",
  },
  {
    id: "meta-achados",
    title: "Meta lança o Achados no Brasil",
    summary:
      "O novo app aproxima a descoberta de produtos do primeiro contato pelo WhatsApp.",
    source: "Meta",
    url: "https://about.fb.com/br/news/2026/11/chegou-o-achados-o-melhor-lugar-para-garimpar-tudo-o-que-voce-ama/",
    sourceDate: "2026-11-17",
    date: "2026-11-17",
    theme: "Social commerce",
    stage: "Posicionar",
    impact: "Médio",
    priority: "Média",
    status: "A avaliar",
    owner: "",
    niches: [revendas],
    changed:
      "O Achados estreou no Android brasileiro reunindo ofertas do Marketplace, de grupos do Facebook e do Instagram. O comprador pode falar com o vendedor no app ou pelo WhatsApp.",
    why: "Para revendas que anunciam em canais da Meta, surge um caminho de descoberta que pode levar a uma conversa comercial.",
    opportunity:
      "Conferir quais anúncios da loja aparecem na região e perguntar a novos contatos onde encontraram o veículo.",
    risks:
      "Disponibilidade e categorias podem variar. Uma conversa nova por WhatsApp, sozinha, não identifica sua origem.",
    decision: "",
    next: "Conferir a presença de estoque elegível e preparar uma pergunta de origem para o atendimento.",
  },
  {
    id: "ads-trafego-invalido",
    title: "Google Ads detalha créditos por tráfego inválido",
    summary:
      "Um novo painel mostra os valores protegidos e os créditos gerados após a cobrança.",
    source: "Google Ads",
    url: "https://blog.google/products/ads-commerce/invalid-traffic-overview-google-ads/",
    sourceDate: "2026-11-12",
    date: "2026-11-16",
    theme: "Mídia paga",
    stage: "Otimizar",
    impact: "Alto",
    priority: "Alta",
    status: "Em avaliação",
    owner: "Mídia · exemplo",
    niches: allNiches,
    changed:
      "O Google começou a liberar um cartão que apresenta a economia com tráfego inválido filtrado e créditos aplicados quando a detecção ocorre depois da cobrança.",
    why: "O relatório oferece evidência adicional quando o cliente questiona diferenças entre investimento, cliques e contatos recebidos.",
    opportunity:
      "Conciliar os créditos do período com a fatura e, em outra análise, verificar a qualidade dos contatos no CRM.",
    risks:
      "Leads fora do perfil comercial e tráfego inválido medem coisas diferentes. Somar os créditos à economia pré-cobrança pode distorcer o custo líquido.",
    decision: "",
    next: "Verificar se o cartão já aparece na conta e comparar os valores com a fatura do mesmo período.",
  },
  {
    id: "ga4-data-manager",
    title: "GA4 reúne conexões de dados em um só lugar",
    summary:
      "O Data Manager, em beta, reúne fluxos, integrações e alertas de diagnóstico.",
    source: "Google Analytics",
    url: analytics + "#11062026",
    sourceDate: "2026-11-06",
    date: "2026-11-16",
    theme: "Mensuração",
    stage: "Otimizar",
    impact: "Médio",
    priority: "Média",
    status: "Analisado",
    owner: "Analytics · exemplo",
    niches: allNiches,
    changed:
      "O Data Manager chegou em beta à administração do GA4. Ele reúne vínculos de produtos, fluxos de dados, dados próprios e a saúde das conexões.",
    why: "Uma integração interrompida pode reduzir as conversões registradas mesmo quando o volume de atendimento está estável.",
    opportunity:
      "Incluir a origem, o responsável e a última verificação de cada conexão no diagnóstico de mensuração.",
    risks:
      "Uma conexão saudável pode receber eventos duplicados. A revisão também precisa confrontar uma conversão de teste com o evento recebido.",
    decision:
      "Exemplo de avaliação: acrescentar a inspeção das conexões ao roteiro de diagnóstico.",
    next: "Executar uma conversão de teste em uma propriedade elegível e registrar o horário de recebimento.",
  },
  {
    id: "clarity-sessoes",
    title: "Ask Clarity aponta onde o visitante desiste",
    summary:
      "Perguntas sobre o funil passam a trazer links para as gravações que embasam a resposta.",
    source: "Microsoft Clarity",
    url: "https://clarity.microsoft.com/blog/clarity-connects-agents-LLMs-people/",
    sourceDate: "2026-11-04",
    date: "2026-11-16",
    theme: "Conversão",
    stage: "Converter",
    impact: "Alto",
    priority: "Alta",
    status: "Analisado",
    owner: "CRO · exemplo",
    niches: [saude, advocacia],
    changed:
      "O Ask Clarity cruza gravações, mapas de calor e eventos para responder a perguntas sobre o comportamento no site. A resposta pode apontar sessões para inspeção.",
    why: "Antes de simplificar um formulário, a equipe pode conferir se a desistência coincide com um erro, um campo difícil ou uma mudança de dispositivo.",
    opportunity:
      "Investigar as sessões de visitantes que começaram um agendamento pelo celular e pararam antes de enviar.",
    risks:
      "Sessões isoladas não quantificam o problema. Campos com dados sensíveis precisam permanecer mascarados.",
    decision:
      "Exemplo de avaliação: validar a hipótese de atrito pelas gravações e depois medir sua frequência nos eventos.",
    next: "Definir o evento de início e o sucesso de envio no mesmo formulário.",
  },
  {
    id: "modo-ia-brasil",
    title: "Anúncios no Modo IA entram no plano para o Brasil",
    summary:
      "O Google projetou a expansão brasileira para o quarto trimestre de 2026.",
    source: "Google Ads",
    url: "https://blog.google/products/ads-commerce/ads-in-ai-mode-global/",
    sourceDate: "2026-10-28",
    date: "2026-11-12",
    theme: "Busca e IA",
    stage: "Posicionar",
    impact: "Alto",
    priority: "Média",
    status: "A avaliar",
    owner: "",
    niches: [advocacia, revendas],
    changed:
      "O Google anunciou a ampliação dos anúncios no Modo IA a mais dez países e incluiu o Brasil na próxima expansão planejada.",
    why: "Uma pergunta longa pode combinar localização, intenção e critérios de escolha. Páginas genéricas deixam parte dessas dúvidas sem resposta.",
    opportunity:
      "Agrupar perguntas reais do atendimento por intenção e revisar uma página de serviço com respostas verificáveis.",
    risks:
      "O anúncio de expansão não confirma disponibilidade para toda conta brasileira. A veiculação precisa ser verificada antes de entrar na proposta.",
    decision: "",
    next: "Selecionar uma página e levantar três dúvidas recorrentes com a equipe que atende os leads.",
  },
  {
    id: "tiktok-smart-search",
    title: "Smart+ automatiza palavras-chave no TikTok",
    summary:
      "A automação chega à seleção de termos e peças nas campanhas de pesquisa.",
    source: "TikTok",
    url: "https://newsroom.tiktok.com/tiktok-revela-atualizaes-com-inteligncia-artificial-para-anunciantes-impulsionando-descoberta-ao-e-resultados-de-negcios-mensurveis?lang=pt-BR",
    sourceDate: "2026-10-05",
    date: "2026-11-10",
    theme: "Mídia paga",
    stage: "Impulsionar",
    impact: "Médio",
    priority: "Média",
    status: "Analisado",
    owner: "Mídia · exemplo",
    niches: [revendas],
    changed:
      "O TikTok anunciou automação de palavras-chave e criativos com Smart+ nas campanhas de anúncios em pesquisa.",
    why: "Um vídeo de demonstração pode alcançar alguém já pesquisando o modelo que a loja oferece.",
    opportunity:
      "Testar a campanha em uma conta elegível com vídeos do estoque disponível, separando termos de pesquisa por intenção de compra.",
    risks:
      "Consultas sobre manutenção podem atrair proprietários sem intenção de compra. Um veículo vendido pode continuar em uma peça ativa.",
    decision:
      "Exemplo de avaliação: limitar o piloto a um modelo disponível e revisar os termos semanalmente.",
    next: "Definir o orçamento do piloto e como a revenda confirma um pedido de visita no CRM.",
  },
  {
    id: "meta-atribuicao",
    title: "Meta separa cliques em links de engajamento",
    summary:
      "Salvar e compartilhar anúncios passam a receber uma leitura própria na atribuição.",
    source: "Meta",
    url: "https://about.fb.com/br/news/2026/03/simplificando-a-mensuracao-de-anuncios-para-um-mundo-social-first/",
    sourceDate: "2026-03-03",
    date: "2026-11-09",
    theme: "Mensuração",
    stage: "Otimizar",
    impact: "Alto",
    priority: "Alta",
    status: "Analisado",
    owner: "Analytics · exemplo",
    niches: allNiches,
    changed:
      "Para conversões em sites e lojas físicas, a Meta passou a reservar a atribuição por clique aos links. Interações como salvar e compartilhar migraram para a atribuição por engajamento.",
    why: "Uma variação na série histórica pode refletir a mudança de definição, mesmo que o número de vendas do cliente se mantenha.",
    opportunity:
      "Anotar no relatório quando a conta recebeu a nova definição e cruzar conversões atribuídas com as confirmadas no sistema comercial.",
    risks:
      "Comparar períodos com regras diferentes pode levar à pausa de um conjunto que continua gerando resultados.",
    decision:
      "Exemplo de avaliação: separar os tipos de atribuição e incluir uma nota de metodologia no relatório mensal.",
    next: "Documentar a janela e a origem de cada indicador antes da próxima revisão de verba.",
  },
  {
    id: "ga4-perfil-local",
    title: "Perfil da Empresa leva as buscas locais ao GA4",
    summary:
      "Ligações, rotas e cliques no site entram na mesma leitura do negócio local.",
    source: "Google Analytics",
    url: analyticsPt + "#06082026",
    sourceDate: "2026-06-08",
    date: "2026-11-05",
    theme: "Busca local",
    stage: "Converter",
    impact: "Alto",
    priority: "Alta",
    status: "Analisado",
    owner: "Analytics · exemplo",
    niches: allNiches,
    changed:
      "O GA4 passou a aceitar o vínculo com o Perfil da Empresa e exibir uma coleção de relatórios com interações como ligações, solicitações de rota e cliques no site.",
    why: "O visitante pode demonstrar intenção de chegar ao local ou telefonar antes de abrir uma página de campanha.",
    opportunity:
      "Cruzar, por unidade e período, as solicitações de rota com visitas ou agendamentos registrados pelo atendimento.",
    risks:
      "Pedir uma rota não comprova comparecimento. O dado do perfil tem janela móvel de seis meses.",
    decision:
      "Exemplo de avaliação: mostrar sinais de intenção e agendamentos confirmados em linhas distintas do diagnóstico.",
    next: "Conferir a correspondência entre a unidade do perfil e a unidade registrada no CRM.",
  },
  {
    id: "ai-max-experimentos",
    title: "AI Max amplia testes de verba e metas",
    summary:
      "Várias campanhas de pesquisa podem participar do mesmo experimento de orçamento.",
    source: "Google Ads",
    url: "https://blog.google/products/ads-commerce/ai-max-testing-planning-tools/",
    sourceDate: "2026-08-20",
    date: "2026-11-03",
    theme: "Experimentação",
    stage: "Impulsionar",
    impact: "Médio",
    priority: "Média",
    status: "Em avaliação",
    owner: "Mídia · exemplo",
    niches: [revendas, advocacia],
    changed:
      "O Google anunciou testes A/B de orçamento e metas de retorno em várias campanhas de pesquisa. Experimentos do AI Max também passaram a aceitar configurações de marca e localização.",
    why: "A EBA pode analisar o efeito da verba adicional preservando restrições importantes de região e marca.",
    opportunity:
      "Definir um grupo de campanhas com o mesmo processo comercial e usar custo por lead qualificado como critério de leitura.",
    risks:
      "Mudar página, verba e meta ao mesmo tempo prejudica a interpretação. Atrasos no CRM podem favorecer o grupo com contatos mais antigos.",
    decision: "",
    next: "Estimar o prazo de qualificação e escolher uma variável antes de configurar o teste.",
  },
  {
    id: "ga4-trafego-ia",
    title: "GA4 identifica visitas de assistentes de IA",
    summary:
      "Um novo canal reúne sessões encaminhadas por serviços como ChatGPT e Gemini.",
    source: "Google Analytics",
    url: analyticsPt + "#05132026",
    sourceDate: "2026-05-13",
    date: "2026-10-27",
    theme: "Busca e IA",
    stage: "Posicionar",
    impact: "Médio",
    priority: "Baixa",
    status: "Arquivado",
    owner: "Conteúdo · exemplo",
    niches: [advocacia, saude],
    changed:
      "O GA4 criou um canal para identificar visitas provenientes de assistentes de IA reconhecidos a partir da referência de navegação.",
    why: "É possível verificar quais páginas recebem esse público e se ele passa da leitura à solicitação de contato.",
    opportunity:
      "Comparar as páginas de entrada e os envios de formulário desse canal com os da busca orgânica no mesmo período.",
    risks:
      "Visitas sem referência reconhecida podem ficar fora do canal. Poucas conversões tornam a taxa instável.",
    decision:
      "Exemplo de avaliação: acompanhar o volume mensal antes de recomendar uma frente dedicada.",
    next: "Retomar se houver volume de sessões e conversões suficiente para comparação.",
  },
];

export const radarSeed = {
  records: records.map((record) => ({
    ...record,
    updatedAt: record.date + "T15:00:00.000Z",
  })),
  tests: [
    {
      id: "teste-atribuicao",
      recordId: "meta-atribuicao",
      title: "Reconciliação de conversões da Meta",
      hypothesis:
        "Simulação: isolar as conversões por clique em link reduz a distância entre os totais da plataforma e do CRM.",
      metric: "Diferença entre conversões atribuídas e contatos confirmados",
      status: "Concluído",
      startDate: "2026-11-09",
      endDate: "2026-11-13",
      result:
        "Simulação com 50 contatos de CRM e 62 conversões atribuídas no total. Ao selecionar apenas cliques em links, restaram 54. A diferença passou de 12 para 4. Dados fictícios para demonstrar a leitura.",
    },
    {
      id: "teste-atrito",
      recordId: "clarity-sessoes",
      title: "Atrito no formulário de agendamento",
      hypothesis:
        "Simulação: esclarecer o formato do telefone antes do envio reduz os erros no celular.",
      metric: "Envios confirmados por início de formulário no celular",
      status: "Em andamento",
      startDate: "2026-11-16",
      endDate: "",
      result: "",
    },
    {
      id: "teste-feirao",
      recordId: "demand-gen-sazonalidade",
      title: "Lances para um feirão de fim de semana",
      hypothesis:
        "Simulação: um ajuste de sazonalidade calibrado com campanhas anteriores reduz o custo por visita confirmada.",
      metric: "Custo por comparecimento registrado no CRM",
      status: "Planejado",
      startDate: "2026-11-27",
      endDate: "2026-11-29",
      result: "",
    },
  ],
  insights: [
    {
      id: "insight-perfil",
      recordId: "ga4-perfil-local",
      destination: "Diagnóstico",
      title: "Do mapa ao agendamento",
      date: "2026-11-05",
      text: "Modelo de diagnóstico: apresentar ligações e pedidos de rota ao lado de agendamentos confirmados pela unidade. Identificar onde o interesse local deixa de virar atendimento.",
    },
    {
      id: "insight-google",
      recordId: "ai-max-experimentos",
      destination: "Proposta",
      title: "Verba adicional com critério de decisão",
      date: "2026-11-10",
      text: "Modelo de proposta: comparar a verba atual com uma ampliação controlada. Avaliar o custo por contato qualificado após completar o prazo de qualificação do CRM.",
    },
    {
      id: "insight-clarity",
      recordId: "clarity-sessoes",
      destination: "Página",
      title: "Instruções nos campos de maior atrito",
      date: "2026-11-17",
      text: "Modelo de briefing de página: usar as gravações para escolher um campo com erro recorrente. Explicar o formato aceito antes da digitação e medir os envios concluídos por dispositivo.",
    },
    {
      id: "insight-meta",
      recordId: "meta-atribuicao",
      destination: "Comunicação",
      title: "Explicar mudanças de atribuição",
      date: "2026-11-13",
      text: "Modelo para a EBA Growth: a Meta passou a distinguir conversões após cliques em links das que sucedem outras interações. Para interpretar o resultado comercial, acompanhamos também os contatos confirmados no CRM.",
    },
  ],
};
