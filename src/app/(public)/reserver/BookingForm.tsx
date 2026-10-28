"use client";

/**
 * Formulaire « Vos coordonnées » (étape 2) puis confirmation (étape 3).
 * Les erreurs sont vérifiées dans le navigateur pour le confort, puis à nouveau
 * sur le serveur (qui seul fait foi).
 */
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { formatEuros } from "@/lib/availability/pricing";
import { formatSlot } from "@/lib/format";
import { COMMENT_MAX, contactSchema, fieldErrors } from "@/lib/validation/booking";
import { Alert, Button, Card, Steps, inputClass } from "@/components/ui";
import { requestBooking, type RequestState } from "./actions";

type Slot = { salle: string; date: string; debut: number; fin: number; personnes: number };

const FIELDS = [
  { name: "lastName", label: "Nom", autoComplete: "family-name", type: "text", required: true },
  { name: "firstName", label: "Prénom", autoComplete: "given-name", type: "text", required: true },
  {
    name: "email",
    label: "Adresse e-mail",
    autoComplete: "email",
    type: "email",
    required: true,
    hint: "Nous y enverrons la confirmation et votre lien de gestion.",
  },
  {
    name: "phone",
    label: "Téléphone",
    autoComplete: "tel",
    type: "tel",
    required: true,
    hint: "Format français (06 12 34 56 78) ou international (+41 …).",
  },
  { name: "company", label: "Société ou organisation", autoComplete: "organization", type: "text", required: false },
] as const;

const omit = (o: Record<string, string>, key: string) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));

export function BookingForm({ slot, privacyNotice, summary }: { slot: Slot; privacyNotice: string; summary: React.ReactNode }) {
  const [state, formAction, pending] = useActionState<RequestState, FormData>(requestBooking, null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState({ acceptTerms: false, marketingOptIn: false });
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  const serverErrors =
    state && !state.ok ? Object.fromEntries(Object.entries(state.fieldErrors ?? {}).map(([k, v]) => [k.replace(/^contact\./, ""), v])) : {};
  const errors = { ...serverErrors, ...clientErrors };

  // Après l'envoi : on place le focus sur le résultat (accessibilité)
  useEffect(() => {
    if (state?.ok) doneRef.current?.focus();
    else if (state) formRef.current?.querySelector<HTMLElement>("[aria-invalid=true], [role=alert]")?.focus();
  }, [state]);

  if (state?.ok) {
    const b = state.booking;
    const confirmed = b.status === "CONFIRMED";
    return (
      <div>
        <Steps current={3} />
        <Card>
          <h1 ref={doneRef} tabIndex={-1} className="text-2xl font-bold">
            {confirmed ? "Votre réservation est confirmée" : "Votre demande a bien été envoyée"}
          </h1>
          <p className="mt-2">
            {confirmed
              ? "Notre équipe vous contactera pour vous adresser le devis."
              : "Le créneau est bloqué pour vous le temps que notre équipe étudie votre demande. Nous revenons vers vous rapidement avec un devis personnalisé."}
          </p>
          <dl className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr] sm:gap-x-6">
            <dt className="text-muted">Référence</dt>
            <dd className="font-semibold">{b.reference}</dd>
            <dt className="text-muted">Salle</dt>
            <dd className="font-semibold">{b.roomName}</dd>
            <dt className="text-muted">Date et horaires</dt>
            <dd className="font-semibold">{formatSlot(new Date(b.startsAt), new Date(b.endsAt))}</dd>
            <dt className="text-muted">Personnes</dt>
            <dd className="font-semibold">{b.attendees}</dd>
            {b.estimatedCents != null && (
              <>
                <dt className="text-muted">Estimation indicative</dt>
                <dd className="font-semibold">{formatEuros(b.estimatedCents)} TTC</dd>
              </>
            )}
          </dl>
          <div className="mt-4">
            {state.emailSent ? (
              <Alert tone="info">
                Un e-mail récapitulatif vous a été envoyé, avec un lien personnel pour consulter, modifier ou annuler votre demande. Pensez
                à vérifier vos courriers indésirables.
              </Alert>
            ) : (
              <Alert>
                Votre demande est bien enregistrée, mais l&apos;e-mail de confirmation n&apos;a pas pu être envoyé. Notez votre référence :
                notre équipe vous contactera.
              </Alert>
            )}
          </div>
          <Link href="/" className="mt-6 inline-block text-brand underline">
            Retour à l&apos;accueil
          </Link>
        </Card>
      </div>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const parsed = contactSchema.safeParse({ lastName: "", firstName: "", email: "", phone: "", ...values });
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    if (!checks.acceptTerms) errs.acceptTerms = "Vous devez accepter les conditions de réservation.";
    setClientErrors(errs);
    if (Object.keys(errs).length) {
      e.preventDefault();
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
    }
  }

  const set = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [name]: e.target.value }));
    if (clientErrors[name]) setClientErrors((errs) => omit(errs, name));
  };
  const errProps = (name: string) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": [errors[name] && `err-${name}`, `hint-${name}`].filter(Boolean).join(" ") || undefined,
  });
  const ErrorText = ({ name }: { name: string }) =>
    errors[name] ? (
      <p id={`err-${name}`} className="mt-1 text-sm font-medium text-danger">
        {errors[name]}
      </p>
    ) : null;

  return (
    <div>
      <Steps current={2} />
      <h1 className="text-2xl font-bold sm:text-3xl">Vos coordonnées</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="lg:order-2 lg:self-start">{summary}</Card>
        <Card className="lg:order-1">
          <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate className="space-y-5">
            {Object.entries({ salle: slot.salle, date: slot.date, debut: slot.debut, fin: slot.fin, personnes: slot.personnes }).map(
              ([k, v]) => (
                <input key={k} type="hidden" name={k} value={String(v)} />
              ),
            )}

            {state && !state.ok && (state.formError || Object.keys(serverErrors).length > 0) && (
              <div tabIndex={-1}>
                <Alert>{state.formError ?? "Merci de corriger les champs signalés."}</Alert>
              </div>
            )}

            <p className="text-sm text-muted">
              Les champs marqués d&apos;un <span aria-hidden="true">*</span>
              <span className="sr-only">astérisque</span> sont obligatoires.
            </p>

            <div className="grid gap-5 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.name} className={f.name === "company" ? "sm:col-span-2" : ""}>
                  <label htmlFor={f.name} className="mb-1 block font-medium">
                    {f.label}{" "}
                    {f.required ? <span aria-hidden="true">*</span> : <span className="text-sm font-normal text-muted">(facultatif)</span>}
                  </label>
                  {"hint" in f && (
                    <p id={`hint-${f.name}`} className="mb-1 text-sm text-muted">
                      {f.hint}
                    </p>
                  )}
                  <input
                    id={f.name}
                    name={f.name}
                    type={f.type}
                    autoComplete={f.autoComplete}
                    required={f.required}
                    maxLength={f.name === "email" ? 254 : f.name === "company" ? 120 : 80}
                    value={values[f.name] ?? ""}
                    onChange={set(f.name)}
                    className={inputClass}
                    {...errProps(f.name)}
                  />
                  <ErrorText name={f.name} />
                </div>
              ))}
            </div>

            <div>
              <label htmlFor="comment" className="mb-1 block font-medium">
                Commentaire ou besoins particuliers <span className="text-sm font-normal text-muted">(facultatif)</span>
              </label>
              <p id="hint-comment" className="mb-1 text-sm text-muted">
                Type d&apos;événement, disposition souhaitée, matériel…{" "}
                <strong>Merci de ne pas indiquer d&apos;informations sensibles (santé, etc.).</strong>
              </p>
              <textarea
                id="comment"
                name="comment"
                rows={4}
                maxLength={COMMENT_MAX}
                value={values.comment ?? ""}
                onChange={set("comment")}
                className={inputClass}
                {...errProps("comment")}
              />
              <p className="mt-1 text-right text-xs text-muted" aria-live="polite">
                {(values.comment ?? "").length} / {COMMENT_MAX} caractères
              </p>
              <ErrorText name="comment" />
            </div>

            {/* Pot de miel anti-robots : invisible et ignoré par les technologies d'assistance */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="site_web">Ne pas remplir ce champ</label>
              <input id="site_web" name="site_web" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
            </div>

            <fieldset className="space-y-3">
              <legend className="sr-only">Conditions et consentements</legend>
              <div>
                <div className="flex items-start gap-3">
                  <input
                    id="acceptTerms"
                    name="acceptTerms"
                    type="checkbox"
                    required
                    checked={checks.acceptTerms}
                    onChange={(e) => {
                      setChecks((c) => ({ ...c, acceptTerms: e.target.checked }));
                      setClientErrors((errs) => omit(errs, "acceptTerms"));
                    }}
                    className="mt-1 h-5 w-5 shrink-0 accent-brand"
                    {...errProps("acceptTerms")}
                  />
                  <label htmlFor="acceptTerms">
                    J&apos;accepte les{" "}
                    <Link href="/conditions-reservation" target="_blank" className="text-brand underline">
                      conditions de réservation<span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
                    </Link>{" "}
                    <span aria-hidden="true">*</span>
                  </label>
                </div>
                <ErrorText name="acceptTerms" />
              </div>
              <div className="flex items-start gap-3">
                <input
                  id="marketingOptIn"
                  name="marketingOptIn"
                  type="checkbox"
                  checked={checks.marketingOptIn}
                  onChange={(e) => setChecks((c) => ({ ...c, marketingOptIn: e.target.checked }))}
                  className="mt-1 h-5 w-5 shrink-0 accent-brand"
                />
                <label htmlFor="marketingOptIn">
                  J&apos;accepte de recevoir des informations commerciales de QUAI 19 (offres, événements).{" "}
                  <span className="text-sm text-muted">(facultatif — désinscription possible à tout moment)</span>
                </label>
              </div>
            </fieldset>

            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? "Envoi en cours…" : "Envoyer ma demande"}
            </Button>

            <div
              className="border-t border-line pt-4 text-xs text-muted [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: privacyNotice }}
            />
          </form>
        </Card>
      </div>
    </div>
  );
}
