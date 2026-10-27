import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SITE } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `Réserver une salle — ${SITE.name}`, template: `%s — ${SITE.name}` },
  description: `Réservez une salle de réunion ou de réception chez ${SITE.name}, ${SITE.address}.`,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col antialiased">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Aller au contenu
        </a>
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            {/* 🖼️ Remplacer par le logo : <Image src="/logo.svg" alt="QUAI 19" … /> */}
            <Link href="/" className="text-xl font-bold tracking-widest">
              {SITE.name}
            </Link>
            <nav aria-label="Navigation principale">
              <ul className="flex gap-4 text-sm font-medium">
                <li><Link href="/#salles" className="hover:underline">Nos salles</Link></li>
                <li><Link href="/#recherche" className="hover:underline">Réserver</Link></li>
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
              <a href={`mailto:${SITE.contactEmail}`} className="underline">{SITE.contactEmail}</a>
            </p>
            <nav aria-label="Informations légales">
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                <li><Link href="/mentions-legales" className="underline">Mentions légales</Link></li>
                <li><Link href="/confidentialite" className="underline">Politique de confidentialité</Link></li>
                <li><Link href="/conditions-reservation" className="underline">Conditions de réservation</Link></li>
              </ul>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
