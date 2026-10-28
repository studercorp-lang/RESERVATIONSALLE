/**
 * Filtre appliqué à chaque page :
 * 1. Politique de sécurité du contenu (CSP) avec un jeton unique (« nonce ») par
 *    requête : seuls les scripts de l'application s'exécutent, aucun script
 *    injecté ni chargé depuis un autre site.
 * 2. Back-office : sans cookie de session, renvoi vers la page de connexion
 *    (la vérification complète est faite par requireStaff() sur chaque page).
 */
import { NextResponse, type NextRequest } from "next/server";

const isDev = process.env.NODE_ENV === "development";

export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // attributs style (barres du planning) ; aucun style externe
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/connexion") {
    const hasSession = req.cookies.has("__Host-q19_admin") || req.cookies.has("q19_admin");
    if (!hasSession) return NextResponse.redirect(new URL("/admin/connexion", req.url));
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp); // lu par Next.js pour marquer ses propres scripts

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  if (pathname.startsWith("/admin") || pathname.startsWith("/reservation/")) {
    res.headers.set("Cache-Control", "no-store"); // pages contenant des données personnelles : jamais en cache
  }
  return res;
}

export const config = {
  // Toutes les pages, sauf les fichiers statiques et les photos (pas de HTML)
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|photos/|robots.txt).*)" }],
};
