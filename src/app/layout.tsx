import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { SITE } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `Réserver une salle — ${SITE.name}`, template: `%s — ${SITE.name}` },
  description: `Réservez une salle de réunion ou de réception chez ${SITE.name}, ${SITE.address}.`,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Lecture des en-têtes : chaque page est rendue à la demande, avec le jeton CSP de la requête
  await headers();
  return (
    <html lang="fr">
      <body className="antialiased">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
        >
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
