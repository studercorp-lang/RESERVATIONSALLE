import Link from "next/link";
import { SITE } from "@/config/site";
import { requireStaff } from "@/lib/auth/session";
import { logoutAction } from "../auth-actions";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/reservations", label: "Réservations" },
  { href: "/admin/calendrier", label: "Calendrier" },
  { href: "/admin/salles", label: "Salles et horaires" },
];
const ADMIN_NAV = [
  { href: "/admin/reglages", label: "Réglages" },
  { href: "/admin/equipe", label: "Équipe" },
];

/** Espace équipe : chaque page est protégée (session + double authentification). */
export default async function StaffLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireStaff();
  const items = session.user.role === "ADMIN" ? [...NAV, ...ADMIN_NAV] : NAV;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-ink text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-bold tracking-widest">{SITE.name} <span className="font-normal text-white/70">· équipe</span></Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-white/80">{session.user.name}</span>
            <Link href="/admin/securite/mot-de-passe" className="underline">Mot de passe</Link>
            <form action={logoutAction}><button className="rounded border border-white/40 px-2 py-1 hover:bg-white/10">Se déconnecter</button></form>
          </div>
        </div>
        <nav aria-label="Back-office" className="mx-auto max-w-7xl overflow-x-auto px-4">
          <ul className="flex gap-1 text-sm">
            {items.map((i) => (
              <li key={i.href}><Link href={i.href} className="block whitespace-nowrap rounded-t px-3 py-2 hover:bg-white/10">{i.label}</Link></li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="contenu" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
