/** Affiche un texte légal rédigé en Markdown (content/legal/*.md). */
import { renderLegal, type LegalPage } from "@/lib/content/legal";

export async function LegalContent({ name }: { name: LegalPage }) {
  const html = await renderLegal(name);
  return <article className="legal mx-auto max-w-3xl rounded-lg border border-line bg-white p-5 sm:p-8" dangerouslySetInnerHTML={{ __html: html }} />;
}
