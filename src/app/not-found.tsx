import Link from "next/link";
import { SITE } from "@/config/site";

export const metadata = { title: "Page introuvable" };

export default function NotFound() {
  return (
    <main id="contenu" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 text-center">
      <p className="text-xl font-bold tracking-widest">{SITE.name}</p>
      <h1 className="mt-6 text-2xl font-bold">Page introuvable</h1>
      <p className="mt-2 text-muted">Cette page n&apos;existe pas ou n&apos;est plus disponible.</p>
      <Link href="/" className="mt-6 font-medium text-brand underline">Retour à l&apos;accueil</Link>
    </main>
  );
}
