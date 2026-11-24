// Same detection and link format as the website's "Open in Expo Snack" button.
const JS_LANGUAGES = new Set(["js", "jsx", "javascript", "ts", "tsx", "typescript"]);
const IMPORT_RE = /(?:import\s[^'"]*?from\s*|import\s*|require\(\s*)['"]([^'"]+)['"]/g;
const BUILT_IN = new Set(["react", "react-native"]);

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

export function expoSnackUrl(language: string, code: string): string {
  const isTs = ["ts", "tsx", "typescript"].includes(language.toLowerCase());
  const files = { [isTs ? "App.tsx" : "App.js"]: { type: "CODE", contents: code } };
  const deps = new Set<string>();
  for (const match of code.matchAll(IMPORT_RE)) {
    const name = packageName(match[1]);
    if (name) deps.add(name);
  }
  const params: [string, string][] = [
    ["name", "Made with Arvo"],
    ["platform", "mydevice"],
    ["files", JSON.stringify(files)],
  ];
  if (deps.size) params.push(["dependencies", [...deps].join(",")]);
  return `https://snack.expo.dev/?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
