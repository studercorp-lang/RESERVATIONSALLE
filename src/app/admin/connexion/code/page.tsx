import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/session";
import { AuthCard } from "../../AuthCard";
import { AuthForm } from "../../AuthForm";
import { totpAction } from "../../auth-actions";

export const metadata = { title: "Code de sécurité" };

export default async function TotpPage() {
  const session = await currentSession();
  if (!session) redirect("/admin/connexion");
  if (!session.user.totpEnabled) redirect("/admin/securite/activer-2fa");
  if (session.totpPassed) redirect("/admin");
  return (
    <AuthCard title="Code de sécurité">
      <AuthForm
        action={totpAction}
        submit="Valider"
        fields={[{ name: "code", label: "Code à 6 chiffres", type: "text", inputMode: "numeric", autoComplete: "one-time-code", hint: "Ouvrez votre application d'authentification et saisissez le code affiché pour QUAI 19." }]}
      />
    </AuthCard>
  );
}
