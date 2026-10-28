/**
 * Textes légaux stockés dans content/legal/*.md (modifiables sans toucher au code).
 * Les marqueurs {{…}} sont remplacés par les valeurs de la configuration.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { SITE } from "@/config/site";
import { describeCancellationPolicy } from "@/lib/booking/cancellation";
import { getSettings } from "@/lib/settings";

export const LEGAL_PAGES = ["mentions-legales", "confidentialite", "conditions-reservation", "mention-formulaire"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

export async function renderLegal(name: LegalPage): Promise<string> {
  const settings = await getSettings();
  const vars: Record<string, string> = {
    nom: SITE.name,
    adresse: SITE.address,
    email_contact: SITE.contactEmail,
    email_rgpd: SITE.privacyEmail,
    telephone: SITE.phone,
    duree_reservation: String(settings.retentionBookingYears),
    duree_prospection: String(settings.retentionProspectYears),
    duree_journaux: String(settings.retentionAuditMonths),
    bareme_annulation: describeCancellationPolicy(settings),
    absence_frais: String(settings.noShowFeePercent),
    delai_attente_jours: String(settings.pendingHoldDays),
    delai_modification_heures: String(settings.clientChangeDeadlineHours),
    delai_minimum_heures: String(settings.minNoticeHours),
    delai_maximum_mois: String(settings.maxAdvanceMonths),
    rappel_heures: String(settings.reminderHoursBefore),
    version_conditions: SITE.termsVersion,
  };
  const file = await readFile(path.join(process.cwd(), "content", "legal", `${name}.md`), "utf8");
  const md = file.replace(/<!--[\s\S]*?-->/g, "").replace(/\{\{(\w+)\}\}/g, (m, k: string) => vars[k] ?? m);
  // Contenu rédigé par l'équipe (fichier du projet), pas par les visiteurs.
  return marked.parse(md, { async: false });
}
