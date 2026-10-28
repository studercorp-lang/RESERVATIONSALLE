import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/session";
import { AuthCard } from "../../AuthCard";
import { AuthForm } from "../../AuthForm";
import { changePasswordAction } from "../../auth-actions";

export const metadata = { title: "Changer de mot de passe" };

export default async function ChangePasswordPage() {
  const session = await currentSession();
  if (!session || !session.totpPassed) redirect("/admin/connexion");
  return (
    <AuthCard title={session.user.mustChangePassword ? "Choisissez votre mot de passe" : "Changer de mot de passe"}>
      {session.user.mustChangePassword && <p className="mb-4 text-sm">Votre mot de passe actuel est provisoire : remplacez-le par un mot de passe personnel.</p>}
      <AuthForm
        action={changePasswordAction}
        submit="Enregistrer"
        fields={[
          { name: "current", label: "Mot de passe actuel", type: "password", autoComplete: "current-password" },
          { name: "next", label: "Nouveau mot de passe", type: "password", autoComplete: "new-password", hint: "Au moins 12 caractères, avec des lettres et des chiffres ou symboles. Une phrase de passe est idéale." },
          { name: "confirm", label: "Confirmez le nouveau mot de passe", type: "password", autoComplete: "new-password" },
        ]}
      />
    </AuthCard>
  );
}
