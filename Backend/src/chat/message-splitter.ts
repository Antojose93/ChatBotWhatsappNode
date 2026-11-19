/** Divide una respuesta en mensajes legibles para las restricciones de WhatsApp. */
export function splitMessage(input: string, maxLines = 3, maxChars = 100): string[] {
  if (!input?.trim()) return [];
  // Normalize escaped newlines because model responses may contain literal "\\n".
  const text = input.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/(^|\n)\s*\\\s*(?=\n|$)/g, "$1");
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      // A long URL or token has no spaces, so split it explicitly to preserve
      // the configured upper bound for each line.
      if (word.length > maxChars) {
        if (current) { lines.push(current); current = ""; }
        for (let i = 0; i < word.length; i += maxChars) lines.push(word.slice(i, i + maxChars));
      }
      else if (!current) current = word;
      else if (current.length + 1 + word.length <= maxChars) current += ` ${word}`;
      else { lines.push(current); current = word; }
    }
    if (current) lines.push(current);
  }
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += maxLines) chunks.push(lines.slice(i, i + maxLines).join("\n"));
  return chunks.filter((chunk) => chunk.trim());
}
