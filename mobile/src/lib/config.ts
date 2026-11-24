// The live Arvo backend. Override with EXPO_PUBLIC_API_URL in mobile/.env
// to point the app at a local backend while developing.
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://mellow-flexibility-production-e36fe4b6.up.railway.app"
).replace(/\/$/, "");

// The website, used for pages the app links out to (pricing and checkout).
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "").replace(/\/$/, "");

export const DEFAULT_MODEL = "arvo-1.0";
export const MAX_IMAGES_PER_MESSAGE = 3;
