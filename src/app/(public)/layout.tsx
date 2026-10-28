import Link from "next/link";
import { SITE } from "@/config/site";

/** Mise en page du site public : en-tête, contenu, pied de page avec liens légaux. */
export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          {/* 🖼️ Remplacer par le logo : <Image src="/logo.svg" alt="QUAI 19" … /> */}
          <Link href="/" className="text-xl font-bold tracking-widest">
            {SITE.name}
          </Link>
          <nav aria-label="Navigation principale">
            <ul className="flex gap-4 text-sm font-medium">
              <li>
                <Link href="/#salles" className="hover:underline">
                  Nos salles
                </Link>
              </li>
              <li>
                <Link href="/#recherche" className="hover:underline">
                  Réserver
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="contenu" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
        {children}
      </main>

      <footer className="border-t border-line bg-white text-sm text-muted">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 sm:flex-row sm:justify-between">
          <p>
            <strong className="text-ink">{SITE.name}</strong> — {SITE.address}
            <br />
            <a href={`mailto:${SITE.contactEmail}`} className="underline">
              {SITE.contactEmail}
            </a>
          </p>
          <nav aria-label="Informations légales">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              <li>
                <Link href="/mentions-legales" className="underline">
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className="underline">
                  Politique de confidentialité
                </Link>
              </li>
              <li>
                <Link href="/conditions-reservation" className="underline">
                  Conditions de réservation
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
