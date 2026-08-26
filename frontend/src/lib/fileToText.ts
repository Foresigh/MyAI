export const MAX_ATTACHMENT_BYTES = 200_000;

export function isLikelyTextFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  const textExtensions = [
    ".txt", ".md", ".json", ".csv", ".py", ".js", ".jsx", ".ts", ".tsx",
    ".java", ".c", ".cpp", ".h", ".css", ".html", ".yml", ".yaml", ".xml",
    ".sh", ".sql", ".go", ".rs", ".rb", ".php", ".env", ".log", ".ini", ".toml",
  ];
  return textExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
}

export async function readFileAsText(file: File): Promise<string> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${file.name} is too large (limit ${Math.round(MAX_ATTACHMENT_BYTES / 1000)}KB).`);
  }
  return await file.text();
}
