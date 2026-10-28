"use client";

/** Formulaire générique des écrans de connexion (affiche l'erreur renvoyée par le serveur). */
import { useFormAction } from "@/components/useFormAction";
import { Alert, Button, inputClass } from "@/components/ui";
import type { FormState } from "./auth-actions";

type Field = { name: string; label: string; type: string; autoComplete: string; inputMode?: "numeric"; hint?: string };

export function AuthForm({ action, fields, submit }: { action: (s: FormState, fd: FormData) => Promise<FormState>; fields: Field[]; submit: string }) {
  const { state, formAction, onSubmit, pending } = useFormAction(action, null as FormState);
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-4">
      {state?.error && <Alert>{state.error}</Alert>}
      {fields.map((f, i) => (
        <div key={f.name}>
          <label htmlFor={f.name} className="mb-1 block font-medium">{f.label}</label>
          {f.hint && <p id={`hint-${f.name}`} className="mb-1 text-sm text-muted">{f.hint}</p>}
          <input id={f.name} name={f.name} type={f.type} autoComplete={f.autoComplete} inputMode={f.inputMode} required autoFocus={i === 0}
            aria-describedby={f.hint ? `hint-${f.name}` : undefined} className={inputClass} />
        </div>
      ))}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Vérification…" : submit}</Button>
    </form>
  );
}
