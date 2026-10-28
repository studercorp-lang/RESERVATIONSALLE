import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { searchPeople } from "@/lib/gdpr/person";
import { PageTitle, primarySmall } from "@/components/admin";
import { Card, inputClass } from "@/components/ui";

export const metadata = { title: "Données personnelles" };

export default async function GdprSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff("ADMIN");
  const { q = "" } = await searchParams;
  const results = q ? await searchPeople(q) : [];
  return (
    <div className="space-y-6">
      <PageTitle>Données personnelles (RGPD)</PageTitle>
      <Card>
        <p className="mb-3 text-sm">
          Une personne vous demande l&apos;accès à ses données, leur correction ou leur effacement ? Retrouvez-la ici. Vous devez répondre <strong>sous un mois</strong> (procédure : <code>docs/rgpd/</code>).
          Vérifiez son identité : la demande doit venir de l&apos;adresse e-mail enregistrée.
        </p>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label htmlFor="q" className="mb-1 block text-sm font-medium">E-mail, nom ou téléphone</label>
            <input id="q" name="q" defaultValue={q} minLength={3} required className={inputClass} />
          </div>
          <button className={primarySmall}>Rechercher</button>
        </form>
      </Card>
      {q && (
        <Card>
          <h2 className="mb-2 font-semibold">Résultats</h2>
          {results.length === 0 ? <p className="text-muted">Aucune personne trouvée (les données ont peut-être déjà été effacées).</p> : (
            <ul className="divide-y divide-line">
              {results.map((r) => (
                <li key={r.id} className="py-2">
                  <Link href={`/admin/donnees-personnelles/${r.id}`} className="font-medium text-brand underline">{r.firstName} {r.lastName}</Link>
                  <span className="text-sm text-muted"> — {r.email}{r.company ? ` — ${r.company}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
