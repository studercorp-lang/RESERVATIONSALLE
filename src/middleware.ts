/**
 * Premier filtre devant le back-office : sans cookie de session, on renvoie
 * vers la page de connexion. La vérification complète (session valide,
 * double authentification, droits) est faite par requireStaff() sur chaque page.
 */
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ADMIN = ["/admin/connexion"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_ADMIN.some((p) => pathname === p)) return NextResponse.next();
  const hasSession = req.cookies.has("__Host-q19_admin") || req.cookies.has("q19_admin");
  if (!hasSession) return NextResponse.redirect(new URL("/admin/connexion", req.url));
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store"); // pas de mise en cache des pages contenant des données clients
  return res;
}

export const config = { matcher: ["/admin/:path*"] };
