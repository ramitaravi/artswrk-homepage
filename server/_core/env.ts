export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripeConnectClientId: process.env.STRIPE_CONNECT_CLIENT_ID ?? "",
  sendgridApiKey: process.env.SENDGRID_API_KEY ?? "",
  brevoApiKey: process.env.BREVO_API_KEY ?? "",
  /** Server-side Google key for Geocoding. Empty => fall back to the Forge
   *  maps proxy. Cannot be the browser key: Google rejects referrer-restricted
   *  keys on the REST APIs. */
  googleMapsServerApiKey: process.env.GOOGLE_MAPS_SERVER_API_KEY ?? "",
  canvaClientId: process.env.CANVA_CLIENT_ID ?? "",
  canvaClientSecret: process.env.CANVA_CLIENT_SECRET ?? "",
  /** Public site origin Canva redirects back to, e.g. https://artswrk.com */
  canvaRedirectBaseUrl: process.env.CANVA_REDIRECT_BASE_URL ?? "https://artswrk.com",
  /** Canva design with autofill fields title, date, location and rate. */
  canvaTemplateDesignId: process.env.CANVA_TEMPLATE_DESIGN_ID ?? "",
  /** Shared Canva folder the finished designs land in. */
  canvaJobsFolderId: process.env.CANVA_JOBS_FOLDER_ID ?? "",
};
