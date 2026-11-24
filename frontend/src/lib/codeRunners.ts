const JS_LANGUAGES = new Set(["js", "jsx", "javascript", "ts", "tsx", "typescript"]);
const IMPORT_RE = /(?:import\s[^'"]*?from\s*|import\s*|require\(\s*)['"]([^'"]+)['"]/g;
const BUILT_IN = new Set(["react", "react-native"]);

export function isHtmlPreviewable(language: string, code: string): boolean {
  const lang = language.toLowerCase();
  return (lang === "html" || lang === "htm") && /<(html|body|div|main|section|h1|canvas|script)\b/i.test(code);
}

export function isExpoApp(language: string, code: string): boolean {
  if (!JS_LANGUAGES.has(language.toLowerCase())) return false;
  return /from\s*['"](react-native|expo[^'"]*)['"]/.test(code) && /export\s+default\b/.test(code);
}

function packageName(spec: string): string | null {
  if (spec.startsWith(".") || spec.startsWith("/")) return null;
  const parts = spec.split("/");
  const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  return BUILT_IN.has(name) ? null : name;
}

/**
 * Builds an Expo Snack link that opens the code as a runnable app.
 * `embedded` gives the minimal player used for the in-chat preview.
 */
export function expoSnackUrl(language: string, code: string, embedded = false): string {
  const isTs = ["ts", "tsx", "typescript"].includes(language.toLowerCase());
  const files = { [isTs ? "App.tsx" : "App.js"]: { type: "CODE", contents: code } };
  const deps = new Set<string>();
  for (const match of code.matchAll(IMPORT_RE)) {
    const name = packageName(match[1]);
    if (name) deps.add(name);
  }
  // Snack's docs encode with encodeURIComponent (spaces as %20, not "+").
  const params: [string, string][] = [
    ["name", "Made with Arvo"],
    ["platform", "web"],
    ["files", JSON.stringify(files)],
  ];
  if (deps.size) params.push(["dependencies", [...deps].join(",")]);
  if (embedded) params.push(["preview", "true"], ["theme", "dark"], ["supportedPlatforms", "web,mydevice"]);
  return `https://snack.expo.dev/${embedded ? "embedded" : ""}?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
