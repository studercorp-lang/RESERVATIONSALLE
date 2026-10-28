"use client";

/** Formulaires du lien de gestion (annuler, modifier, corriger, se désinscrire). */
import { useState } from "react";
import { useFormAction } from "@/components/useFormAction";
import { SlotFields, type SearchDefaults } from "@/components/SearchForm";
import type { TimeOptions } from "@/lib/availability/time-options";
import { Alert, Button, inputClass } from "@/components/ui";
import { cancelAction, contactAction, marketingAction, modifyAction, type ManageState } from "./actions";

function Feedback({ state }: { state: ManageState }) {
  if (!state || state.ok) return null;
  const messages = [state.error, ...Object.values(state.fieldErrors ?? {})].filter(Boolean);
  return <Alert>{messages.join(" ")}</Alert>;
}

const base = "inline-flex items-center justify-center rounded-md border bg-white px-5 py-3 font-semibold hover:bg-surface";
const secondary = `${base} border-line text-ink`;

export function CancelForm({ token, feePercent }: { token: string; feePercent: number }) {
  const { state, formAction: action, onSubmit, pending } = useFormAction(cancelAction.bind(null, token), null as ManageState);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${base} border-2 border-danger text-danger`}>
        Annuler ma réservation
      </button>
    );
  }
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4 rounded-md border border-danger p-4">
      <p className="font-semibold">Confirmez-vous l&apos;annulation ?</p>
      <p>
        {feePercent > 0 ? (
          <>
            Selon nos conditions de réservation, <strong>des frais de {feePercent} % du montant du devis</strong> s&apos;appliquent pour une
            annulation à cette date.
          </>
        ) : (
          <>Cette annulation est <strong>sans frais</strong>.</>
        )}
      </p>
      <Feedback state={state} />
      <input type="hidden" name="confirm" value="oui" />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending} className="bg-danger hover:bg-red-800">
          {pending ? "Annulation…" : "Oui, annuler"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className={secondary}>
          Non, garder ma réservation
        </button>
      </div>
    </form>
  );
}

export function ModifyForm({
  token,
  defaults,
  minDate,
  maxDate,
  times,
}: {
  token: string;
  defaults: SearchDefaults;
  minDate: string;
  maxDate: string;
  times: TimeOptions;
}) {
  const { state, formAction: action, onSubmit, pending } = useFormAction(modifyAction.bind(null, token), null as ManageState);
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SlotFields idPrefix="mod-" defaults={defaults} minDate={minDate} maxDate={maxDate} times={times} />
      </div>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Vérification…" : "Modifier ma demande"}</Button>
    </form>
  );
}

export function ContactForm({ token, defaults }: { token: string; defaults: { lastName: string; firstName: string; phone: string; company: string } }) {
  const { state, formAction: action, onSubmit, pending } = useFormAction(contactAction.bind(null, token), null as ManageState);
  const field = (name: keyof typeof defaults, label: string, autoComplete: string, optional = false) => (
    <div>
      <label htmlFor={`c-${name}`} className="mb-1 block font-medium">
        {label} {optional && <span className="text-sm font-normal text-muted">(facultatif)</span>}
      </label>
      <input id={`c-${name}`} name={name} defaultValue={defaults[name]} autoComplete={autoComplete} required={!optional} maxLength={120} className={inputClass}
        aria-invalid={state && !state.ok && state.fieldErrors?.[name] ? true : undefined} />
    </div>
  );
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("lastName", "Nom", "family-name")}
        {field("firstName", "Prénom", "given-name")}
        {field("phone", "Téléphone", "tel")}
        {field("company", "Société ou organisation", "organization", true)}
      </div>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer mes coordonnées"}</Button>
    </form>
  );
}

export function MarketingForm({ token }: { token: string }) {
  const { state, formAction: action, onSubmit, pending } = useFormAction(marketingAction.bind(null, token), null as ManageState);
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-3">
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={secondary}>Ne plus recevoir d&apos;informations commerciales</button>
    </form>
  );
}
