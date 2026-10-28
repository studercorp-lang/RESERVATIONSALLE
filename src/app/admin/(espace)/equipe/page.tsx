import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { PageTitle, dangerSmall, primarySmall, smallButton } from "@/components/admin";
import { Card, inputClass } from "@/components/ui";
import { createStaffAction, resetPasswordAction, resetTotpAction, setRoleAction, toggleActiveAction } from "./actions";
import { TeamForm } from "./TeamForm";

export const metadata = { title: "Équipe" };

export default async function TeamPage() {
  const session = await requireStaff("ADMIN");
  const users = await prisma.adminUser.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });

  return (
    <div className="space-y-6">
      <PageTitle>Équipe</PageTitle>
      <p className="text-sm text-muted">
        <strong>Administrateur</strong> : tous les droits (réglages, équipe, données personnelles). <strong>Gestionnaire</strong> : réservations, salles, horaires et calendrier.
      </p>

      <ul className="grid gap-4 lg:grid-cols-2">
        {users.map((u) => (
          <li key={u.id}>
            <Card className={u.active ? "" : "opacity-70"}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{u.name} {u.id === session.userId && <span className="text-sm font-normal text-muted">(vous)</span>}</h2>
                  <p className="text-sm text-muted">{u.email}</p>
                </div>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs">{u.active ? (u.role === "ADMIN" ? "Administrateur" : "Gestionnaire") : "Désactivé"}</span>
              </div>
              <p className="mt-2 text-sm">
                Double authentification : {u.totpEnabled ? "activée" : <span className="text-danger">à configurer</span>}
                {u.lastLoginAt && <> · dernière connexion le {u.lastLoginAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}</>}
              </p>
              {u.id !== session.userId && (
                <div className="mt-3 flex flex-wrap items-start gap-2">
                  <TeamForm action={setRoleAction.bind(null, u.id)} submit="Changer le rôle" className={smallButton}>
                    <label className="sr-only" htmlFor={`role-${u.id}`}>Rôle</label>
                    <select id={`role-${u.id}`} name="role" defaultValue={u.role} className={`${inputClass} py-1.5 text-sm`}>
                      <option value="MANAGER">Gestionnaire</option>
                      <option value="ADMIN">Administrateur</option>
                    </select>
                  </TeamForm>
                  <TeamForm action={resetPasswordAction.bind(null, u.id)} submit="Nouveau mot de passe" className={smallButton} confirm="Générer un mot de passe provisoire et déconnecter ce compte ?" />
                  <TeamForm action={resetTotpAction.bind(null, u.id)} submit="Réinitialiser la 2FA" className={smallButton} confirm="Réinitialiser la double authentification (téléphone perdu) ?" />
                  <TeamForm action={toggleActiveAction.bind(null, u.id, !u.active)} submit={u.active ? "Désactiver" : "Réactiver"} className={u.active ? dangerSmall : smallButton} confirm={u.active ? "Désactiver ce compte ? La personne sera déconnectée immédiatement." : undefined} />
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Ajouter un membre</h2>
        <TeamForm action={createStaffAction} submit="Créer le compte" className={primarySmall}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label htmlFor="new-name" className="mb-1 block text-sm font-medium">Nom</label><input id="new-name" name="name" required maxLength={80} className={inputClass} /></div>
            <div><label htmlFor="new-email" className="mb-1 block text-sm font-medium">E-mail</label><input id="new-email" name="email" type="email" required className={inputClass} /></div>
            <div>
              <label htmlFor="new-role" className="mb-1 block text-sm font-medium">Rôle</label>
              <select id="new-role" name="role" defaultValue="MANAGER" className={inputClass}>
                <option value="MANAGER">Gestionnaire</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </div>
          </div>
        </TeamForm>
      </Card>
    </div>
  );
}
