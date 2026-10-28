import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/auth/crypto";
import { currentSession } from "@/lib/auth/session";
import { generateTotpSecret, totpQrSvg } from "@/lib/auth/totp";
import { AuthCard } from "../../AuthCard";
import { AuthForm } from "../../AuthForm";
import { enableTotpAction } from "../../auth-actions";

export const metadata = { title: "Activer la double authentification" };
export const dynamic = "force-dynamic";

export default async function EnableTotpPage() {
  const session = await currentSession();
  if (!session) redirect("/admin/connexion");
  if (session.user.totpEnabled) redirect("/admin");

  // Nouveau secret à chaque affichage, tant que l'activation n'est pas confirmée
  const secret = generateTotpSecret();
  await prisma.adminUser.update({ where: { id: session.userId, totpEnabled: false }, data: { totpSecret: encrypt(secret) } });
  const qr = await totpQrSvg(session.user.email, secret);

  return (
    <AuthCard title="Activer la double authentification">
      <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm">
        <li>Installez sur votre téléphone une application d&apos;authentification (Google Authenticator, Microsoft Authenticator, 2FAS…).</li>
        <li>Scannez ce QR code avec l&apos;application :</li>
      </ol>
      <div className="mx-auto mb-3 w-[220px]" role="img" aria-label="QR code de configuration de la double authentification" dangerouslySetInnerHTML={{ __html: qr }} />
      <p className="mb-4 break-all text-center text-xs text-muted">
        Impossible de scanner ? Saisissez cette clé : <code className="font-mono text-ink">{secret.match(/.{1,4}/g)?.join(" ")}</code>
      </p>
      <p className="mb-2 text-sm">3. Saisissez le code à 6 chiffres affiché par l&apos;application :</p>
      <AuthForm action={enableTotpAction} submit="Activer" fields={[{ name: "code", label: "Code à 6 chiffres", type: "text", inputMode: "numeric", autoComplete: "one-time-code" }]} />
    </AuthCard>
  );
}
