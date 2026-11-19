import type { Provider } from "./model";
export const guides: Record<
  Provider,
  { intro: string; steps: string[]; url: string; requirement: string }
> = {
  instagram: {
    intro:
      "Importe publicações orgânicas e relacione os posts às peças do Hub.",
    steps: [
      "No Meta for Developers, abra o app da EBA e configure Instagram API com Instagram Login.",
      "Adicione o perfil profissional Business ou Creator ao app e conclua a autorização da conta. Confira se o acesso do app permite usar esse perfil.",
      "Gere o token do Instagram com instagram_business_basic. Cole o token no campo abaixo e confira o @perfil devolvido pelo teste.",
    ],
    url: "https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login",
    requirement: "Perfil profissional · instagram_business_basic",
  },
  meta_ads: {
    intro: "Consulte investimento, impressões e cliques das campanhas.",
    steps: [
      "Abra o app da EBA no Meta for Developers e configure acesso à Marketing API.",
      "Atribua a conta de anúncios à pessoa ou identidade que gerará o token. Gere uma credencial com ads_read e acesso à conta.",
      "Teste a credencial para listar as contas. Se tiver o ID numérico da conta, informe-o para testar esse recurso diretamente.",
    ],
    url: "https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization",
    requirement: "Conta de anúncios · ads_read",
  },
  whatsapp: {
    intro:
      "Verifique o número comercial e acompanhe os resultados pelo código do Hub.",
    steps: [
      "No app da EBA, abra o produto WhatsApp na Meta. Localize o ID da conta WhatsApp Business na configuração da API.",
      "Gere um token autorizado a ler os números da conta WhatsApp Business. Confira a permissão whatsapp_business_management.",
      "Informe o ID da conta e a credencial. Escolha o número que a EBA usa nas conversas das publicações.",
    ],
    url: "https://developers.facebook.com/documentation/business-messaging/whatsapp/overview",
    requirement: "Cloud API · ID da conta WhatsApp Business",
  },
};
