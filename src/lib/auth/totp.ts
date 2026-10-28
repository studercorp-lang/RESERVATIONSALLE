/**
 * Double authentification par code à 6 chiffres (TOTP, RFC 6238), compatible
 * avec les applications Google Authenticator, Microsoft Authenticator, 2FAS, etc.
 */
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { SITE } from "@/config/site";

authenticator.options = { window: 1 }; // tolère un décalage d'horloge de ±30 s

export const generateTotpSecret = () => authenticator.generateSecret();

export function verifyTotp(secret: string, code: string): boolean {
  const clean = code.replace(/\s/g, "");
  return /^\d{6}$/.test(clean) && authenticator.check(clean, secret);
}

/** QR code (SVG, généré localement — aucun service externe) à scanner avec l'application. */
export async function totpQrSvg(email: string, secret: string): Promise<string> {
  return QRCode.toString(authenticator.keyuri(email, `${SITE.name} back-office`, secret), { type: "svg", margin: 1, width: 220 });
}
