"use client";

/** Erreur inattendue : message neutre, sans aucun détail technique (ni donnée) affiché. */
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="contenu" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">Un problème est survenu</h1>
      <p className="mt-2 text-muted">Merci de réessayer dans quelques instants. Si le problème persiste, contactez-nous.</p>
      <div className="mt-6 flex justify-center gap-4">
        <button onClick={reset} className="rounded-md bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark">Réessayer</button>
        <Link href="/" className="px-4 py-2 font-medium text-brand underline">Accueil</Link>
      </div>
    </main>
  );
}
