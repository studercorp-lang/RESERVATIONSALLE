/**
 * Export CSV pour Excel / LibreOffice (séparateur « ; », encodage UTF-8 avec BOM).
 * Protection contre l'injection de formules : une cellule commençant par = + - @
 * est préfixée d'une apostrophe pour ne jamais être exécutée par le tableur.
 */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
