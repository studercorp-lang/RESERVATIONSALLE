import Link from "next/link";
import { prisma } from "@/lib/db";
import { getTimeOptions } from "@/lib/availability/search";
import { utcToParis } from "@/lib/time";
import { ActionForm } from "@/components/ActionForm";
import { PageTitle, primarySmall } from "@/components/admin";
import { SlotFields } from "@/components/SearchForm";
import { Card, inputClass } from "@/components/ui";
import { createAction } from "../actions";

export const metadata = { title: "Saisir une réservation" };

const CONTACT = [
  { name: "lastName", label: "Nom", required: true, type: "text", autoComplete: "off" },
  { name: "firstName", label: "Prénom", required: true, type: "text", autoComplete: "off" },
  { name: "email", label: "E-mail", required: true, type: "email", autoComplete: "off" },
  { name: "phone", label: "Téléphone", required: true, type: "tel", autoComplete: "off" },
  { name: "company", label: "Société", required: false, type: "text", autoComplete: "off" },
];

export default async function NewBookingPage() {
  const [rooms, times] = await Promise.all([
    prisma.room.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, capacity: true } }),
    getTimeOptions(),
  ]);
  const today = utcToParis(new Date()).isoDate;

  return (
    <div>
      <Link href="/admin/reservations" className="text-sm text-brand underline">← Réservations</Link>
      <PageTitle>Saisir une réservation</PageTitle>
      <Card>
        <p className="mb-4 text-sm text-muted">
          Pour une demande reçue par téléphone ou sur place. La disponibilité, les horaires et la capacité sont vérifiés ; les délais de réservation en ligne ne s&apos;appliquent pas.
        </p>
        <ActionForm action={createAction} submit="Enregistrer la réservation" submitClassName={primarySmall} className="space-y-6">
          <fieldset>
            <legend className="mb-3 text-lg font-semibold">Créneau</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="roomId" className="mb-1 block text-sm font-medium">Salle</label>
                <select id="roomId" name="roomId" required className={inputClass}>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.capacity} pers.)</option>)}
                </select>
              </div>
              <SlotFields times={times} minDate={today} maxDate="2100-12-31" />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-lg font-semibold">Client</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {CONTACT.map((f) => (
                <div key={f.name}>
                  <label htmlFor={f.name} className="mb-1 block text-sm font-medium">
                    {f.label} {!f.required && <span className="font-normal text-muted">(facultatif)</span>}
                  </label>
                  <input id={f.name} name={f.name} type={f.type} required={f.required} autoComplete={f.autoComplete} className={inputClass} />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label htmlFor="comment" className="mb-1 block text-sm font-medium">Besoins particuliers <span className="font-normal text-muted">(facultatif — pas d&apos;informations sensibles)</span></label>
                <textarea id="comment" name="comment" rows={3} maxLength={1000} className={inputClass} />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-lg font-semibold">Statut et envoi</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2"><input type="radio" name="status" value="CONFIRMED" defaultChecked className="h-4 w-4 accent-brand" /> Confirmée</label>
              <label className="flex items-center gap-2"><input type="radio" name="status" value="PENDING" className="h-4 w-4 accent-brand" /> En attente (devis à envoyer)</label>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" name="sendEmail" defaultChecked className="h-4 w-4 accent-brand" /> Envoyer au client l&apos;e-mail récapitulatif avec son lien de gestion</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="termsInformed" className="h-4 w-4 accent-brand" /> Le client a été informé des conditions de réservation et de la politique de confidentialité</label>
          </fieldset>
        </ActionForm>
      </Card>
    </div>
  );
}
