"use client";

/**
 * Formulaire d'action du back-office : envoie au serveur, affiche l'erreur
 * éventuelle ; en cas de succès, le serveur redirige avec un message.
 */
import { useFormAction } from "./useFormAction";
import { Alert } from "./ui";

export type ActionState = { error?: string; fieldErrors?: Record<string, string> } | null;

export function ActionForm({
  action,
  children,
  submit,
  submitClassName,
  className = "space-y-3",
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submit: string;
  submitClassName: string;
  className?: string;
}) {
  const { state, formAction, onSubmit, pending } = useFormAction(action, null as ActionState);
  const details = Object.values(state?.fieldErrors ?? {});
  return (
    <form action={formAction} onSubmit={onSubmit} className={className}>
      {state?.error && (
        <Alert>
          {state.error}
          {details.length > 0 && <ul className="mt-1 list-inside list-disc">{details.map((d) => <li key={d}>{d}</li>)}</ul>}
        </Alert>
      )}
      {children}
      <button type="submit" disabled={pending} className={`${submitClassName} disabled:opacity-60`}>{pending ? "En cours…" : submit}</button>
    </form>
  );
}
