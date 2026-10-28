/**
 * Modèles des e-mails envoyés par l'application.
 * Chaque e-mail existe en HTML (simple, lisible sur mobile) et en texte brut.
 */
import { SITE, appUrl } from "@/config/site";
import { formatEuros } from "@/lib/availability/pricing";
import { formatPhone, formatSlot } from "@/lib/format";

/** Échappe le texte saisi par l'utilisateur avant de l'insérer dans du HTML (anti-XSS). */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export type BookingMailData = {
  reference: string;
  status: "PENDING" | "CONFIRMED" | "REFUSED" | "CANCELLED" | "EXPIRED" | "COMPLETED";
  roomName: string;
  startsAt: Date;
  endsAt: Date;
  attendees: number;
  estimatedCents: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company?: string | null;
  comment?: string | null;
  manageUrl?: string;
};

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1c1c1c;line-height:1.5">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<p style="font-size:20px;font-weight:bold;letter-spacing:.05em;margin:0 0 16px">${esc(SITE.name)}</p>
<div style="background:#fff;border-radius:8px;padding:24px">${body}</div>
<p style="font-size:12px;color:#555;margin-top:16px">${esc(SITE.name)} — ${esc(SITE.address)}<br>
Vos données sont traitées pour gérer votre demande. <a href="${appUrl("/confidentialite")}" style="color:#555">Politique de confidentialité</a></p>
</div></body></html>`;
}

function recapRows(d: BookingMailData): [string, string][] {
  return [
    ["Référence", d.reference],
    ["Salle", d.roomName],
    ["Date et horaires", formatSlot(d.startsAt, d.endsAt)],
    ["Nombre de personnes", String(d.attendees)],
    ...(d.estimatedCents != null ? [["Estimation indicative (TTC)", `${formatEuros(d.estimatedCents)} — devis à suivre`] as [string, string]] : []),
  ];
}

const table = (rows: [string, string][]) =>
  `<table style="width:100%;border-collapse:collapse;font-size:15px">${rows
    .map(([k, v]) => `<tr><td style="padding:6px 8px 6px 0;color:#555;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;font-weight:bold">${esc(v)}</td></tr>`)
    .join("")}</table>`;

const text = (rows: [string, string][]) => rows.map(([k, v]) => `${k} : ${v}`).join("\n");

const button = (url: string, label: string) =>
  `<p style="margin:24px 0"><a href="${url}" style="background:#1c1c1c;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">${esc(label)}</a></p>`;

/** Accusé de réception de la demande (ou confirmation directe si la validation automatique est activée). */
export function customerRequestReceived(d: BookingMailData) {
  const confirmed = d.status === "CONFIRMED";
  const subject = confirmed
    ? `Votre réservation ${d.reference} est confirmée — ${SITE.name}`
    : `Nous avons bien reçu votre demande ${d.reference} — ${SITE.name}`;
  const intro = confirmed
    ? `Votre réservation est confirmée. Notre équipe vous contactera pour vous adresser le devis.`
    : `Merci pour votre demande de réservation. Le créneau est bloqué pour vous le temps que notre équipe l'étudie : nous revenons vers vous rapidement avec un devis.`;
  const rows = recapRows(d);
  const manage = d.manageUrl
    ? `<p>Vous pouvez consulter, modifier ou annuler votre demande à tout moment grâce à ce lien personnel (ne le partagez pas) :</p>${button(d.manageUrl, "Gérer ma réservation")}`
    : "";
  const html = layout(subject, `<p>Bonjour ${esc(d.firstName)},</p><p>${intro}</p>${table(rows)}
<p><strong>Adresse :</strong> ${esc(SITE.address)}</p>${manage}
<p style="font-size:14px;color:#555"><strong>Annulation :</strong> une demande non encore confirmée peut être annulée sans frais. Une fois le devis accepté, des frais peuvent s'appliquer selon nos <a href="${appUrl("/conditions-reservation")}">conditions de réservation</a>. La caution est gérée directement avec notre équipe.</p>
<p>À bientôt,<br>L'équipe ${esc(SITE.name)}</p>`);
  const plain = `Bonjour ${d.firstName},\n\n${intro}\n\n${text(rows)}\nAdresse : ${SITE.address}\n\n${
    d.manageUrl ? `Gérer ma réservation (lien personnel, ne le partagez pas) : ${d.manageUrl}\n\n` : ""
  }Conditions de réservation : ${appUrl("/conditions-reservation")}\n\nL'équipe ${SITE.name}`;
  return { subject, html, text: plain };
}

/** Notification à l'équipe : nouvelle demande à traiter. */
export function teamNewRequest(d: BookingMailData) {
  const subject = `Nouvelle demande ${d.reference} — ${d.roomName}`;
  const rows: [string, string][] = [
    ...recapRows(d),
    ["Client", `${d.firstName} ${d.lastName}`],
    ...(d.company ? [["Société", d.company] as [string, string]] : []),
    ["E-mail", d.email],
    ["Téléphone", formatPhone(d.phone)],
    ...(d.comment ? [["Commentaire", d.comment] as [string, string]] : []),
  ];
  const adminUrl = appUrl("/admin/reservations");
  const html = layout(subject, `<p>Une nouvelle demande de réservation vient d'arriver.</p>${table(rows)}${button(adminUrl, "Ouvrir le back-office")}`);
  return { subject, html, text: `Nouvelle demande de réservation\n\n${text(rows)}\n\nBack-office : ${adminUrl}` };
}

/** Rappel avant le créneau. */
export function customerReminder(d: BookingMailData) {
  const subject = `Rappel : votre réservation ${d.reference} approche — ${SITE.name}`;
  const rows = recapRows(d).filter(([k]) => !k.startsWith("Estimation"));
  const html = layout(subject, `<p>Bonjour ${esc(d.firstName)},</p><p>Nous vous attendons bientôt :</p>${table(rows)}
<p><strong>Adresse :</strong> ${esc(SITE.address)}</p>${d.manageUrl ? button(d.manageUrl, "Voir ma réservation") : ""}
<p>Une question ? Écrivez-nous à ${esc(SITE.contactEmail)}.</p><p>L'équipe ${esc(SITE.name)}</p>`);
  return { subject, html, text: `Bonjour ${d.firstName},\n\nNous vous attendons bientôt :\n${text(rows)}\nAdresse : ${SITE.address}\n\nL'équipe ${SITE.name}` };
}

/** Statuts affichés au client. */
export const STATUS_LABELS: Record<BookingMailData["status"], string> = {
  PENDING: "Demande en cours d'étude",
  CONFIRMED: "Confirmée",
  REFUSED: "Non retenue",
  CANCELLED: "Annulée",
  EXPIRED: "Expirée",
  COMPLETED: "Terminée",
};

/** Annulation : confirmation au client. */
export function customerCancelled(d: BookingMailData & { feePercent: number }) {
  const subject = `Annulation de votre réservation ${d.reference} — ${SITE.name}`;
  const fee =
    d.feePercent > 0
      ? `Conformément à nos conditions de réservation, des frais d'annulation de ${d.feePercent} % du montant du devis s'appliquent. Notre équipe reviendra vers vous à ce sujet.`
      : "Cette annulation est sans frais.";
  const rows = recapRows(d).filter(([k]) => !k.startsWith("Estimation"));
  const html = layout(subject, `<p>Bonjour ${esc(d.firstName)},</p><p>Votre réservation a bien été annulée.</p>${table(rows)}<p>${esc(fee)}</p>
<p>Au plaisir de vous accueillir une prochaine fois,<br>L'équipe ${esc(SITE.name)}</p>`);
  return { subject, html, text: `Bonjour ${d.firstName},\n\nVotre réservation a bien été annulée.\n\n${text(rows)}\n\n${fee}\n\nL'équipe ${SITE.name}` };
}

/** Modification : confirmation au client. */
export function customerModified(d: BookingMailData) {
  const subject = `Modification de votre demande ${d.reference} — ${SITE.name}`;
  const rows = recapRows(d);
  const html = layout(subject, `<p>Bonjour ${esc(d.firstName)},</p><p>Votre demande a bien été modifiée. Voici le nouveau récapitulatif :</p>${table(rows)}
${d.manageUrl ? button(d.manageUrl, "Gérer ma réservation") : ""}<p>L'équipe ${esc(SITE.name)}</p>`);
  return { subject, html, text: `Bonjour ${d.firstName},\n\nVotre demande a bien été modifiée :\n\n${text(rows)}\n\n${manageText(d)}L'équipe ${SITE.name}` };
}

/** Notification à l'équipe d'un changement fait par le client via son lien. */
export function teamClientChange(d: BookingMailData, what: string) {
  const subject = `${what} par le client — ${d.reference}`;
  const rows: [string, string][] = [...recapRows(d), ["Client", `${d.firstName} ${d.lastName}`], ["E-mail", d.email], ["Téléphone", formatPhone(d.phone)]];
  const adminUrl = appUrl("/admin/reservations");
  const html = layout(subject, `<p>${esc(what)} par le client via son lien de gestion.</p>${table(rows)}${button(adminUrl, "Ouvrir le back-office")}`);
  return { subject, html, text: `${what} par le client.\n\n${text(rows)}\n\nBack-office : ${adminUrl}` };
}

/** Lien de gestion en texte brut (remplace les liens envoyés précédemment). */
const manageText = (d: BookingMailData) =>
  d.manageUrl ? `Gérer ma réservation (lien personnel, il remplace les liens reçus précédemment) : ${d.manageUrl}\n\n` : "";

/** Message libre de l'équipe, inséré dans l'e-mail (échappé, retours à la ligne conservés). */
const teamMessage = (m?: string | null) => (m ? `<p style="border-left:3px solid #ccc;padding-left:12px;white-space:pre-line">${esc(m)}</p>` : "");

/** Réservation confirmée par l'équipe. */
export function customerConfirmed(d: BookingMailData, message?: string | null) {
  const subject = `Votre réservation ${d.reference} est confirmée — ${SITE.name}`;
  const rows = recapRows(d);
  const html = layout(subject, `<p>Bonjour ${esc(d.firstName)},</p><p>Bonne nouvelle : votre réservation est confirmée.</p>${teamMessage(message)}${table(rows)}
<p><strong>Adresse :</strong> ${esc(SITE.address)}</p>${d.manageUrl ? button(d.manageUrl, "Gérer ma réservation") : ""}
<p style="font-size:14px;color:#555">En cas d'annulation, des frais peuvent s'appliquer selon nos <a href="${appUrl("/conditions-reservation")}">conditions de réservation</a>. La caution est gérée directement avec notre équipe.</p>
<p>À bientôt,<br>L'équipe ${esc(SITE.name)}</p>`);
  return { subject, html, text: `Bonjour ${d.firstName},\n\nVotre réservation est confirmée.\n\n${message ? `${message}\n\n` : ""}${text(rows)}\nAdresse : ${SITE.address}\n\n${manageText(d)}L'équipe ${SITE.name}` };
}

/** Demande non retenue. */
export function customerRefused(d: BookingMailData, message?: string | null) {
  const subject = `Votre demande ${d.reference} — ${SITE.name}`;
  const rows = recapRows(d).filter(([k]) => !k.startsWith("Estimation"));
  const html = layout(subject, `<p>Bonjour ${esc(d.firstName)},</p><p>Nous sommes désolés : nous ne pouvons pas donner suite à votre demande de réservation.</p>${teamMessage(message)}${table(rows)}
<p>N'hésitez pas à nous proposer une autre date ou à nous contacter à ${esc(SITE.contactEmail)}.</p><p>L'équipe ${esc(SITE.name)}</p>`);
  return { subject, html, text: `Bonjour ${d.firstName},\n\nNous ne pouvons pas donner suite à votre demande.\n\n${message ? `${message}\n\n` : ""}${text(rows)}\n\nL'équipe ${SITE.name}` };
}

/** Annulation décidée par l'équipe. */
export function customerCancelledByTeam(d: BookingMailData, message?: string | null) {
  const subject = `Annulation de votre réservation ${d.reference} — ${SITE.name}`;
  const rows = recapRows(d).filter(([k]) => !k.startsWith("Estimation"));
  const html = layout(subject, `<p>Bonjour ${esc(d.firstName)},</p><p>Votre réservation a été annulée par notre équipe.</p>${teamMessage(message)}${table(rows)}
<p>Pour toute question : ${esc(SITE.contactEmail)}.</p><p>L'équipe ${esc(SITE.name)}</p>`);
  return { subject, html, text: `Bonjour ${d.firstName},\n\nVotre réservation a été annulée par notre équipe.\n\n${message ? `${message}\n\n` : ""}${text(rows)}\n\nL'équipe ${SITE.name}` };
}

/** Créneau modifié par l'équipe. */
export function customerRescheduledByTeam(d: BookingMailData, message?: string | null) {
  const subject = `Modification de votre réservation ${d.reference} — ${SITE.name}`;
  const rows = recapRows(d);
  const html = layout(subject, `<p>Bonjour ${esc(d.firstName)},</p><p>Votre réservation a été modifiée par notre équipe. Voici le nouveau récapitulatif :</p>${teamMessage(message)}${table(rows)}
${d.manageUrl ? button(d.manageUrl, "Gérer ma réservation") : ""}<p>L'équipe ${esc(SITE.name)}</p>`);
  return { subject, html, text: `Bonjour ${d.firstName},\n\nVotre réservation a été modifiée :\n\n${message ? `${message}\n\n` : ""}${text(rows)}\n\n${manageText(d)}L'équipe ${SITE.name}` };
}
