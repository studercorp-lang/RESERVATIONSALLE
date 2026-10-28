import { AuthCard } from "../AuthCard";
import { AuthForm } from "../AuthForm";
import { loginAction } from "../auth-actions";

export const metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <AuthCard title="Connexion à l'espace équipe">
      <AuthForm
        action={loginAction}
        submit="Se connecter"
        fields={[
          { name: "email", label: "Adresse e-mail", type: "email", autoComplete: "username" },
          { name: "password", label: "Mot de passe", type: "password", autoComplete: "current-password" },
        ]}
      />
    </AuthCard>
  );
}
