"use client";

/** Formulaire d'action sur l'équipe : affiche le résultat, dont un éventuel mot de passe provisoire (une seule fois). */
import { useFormAction } from "@/components/useFormAction";
import type { TeamState } from "./actions";

export function TeamForm({
  action,
  submit,
  className,
  confirm,
  children,
}: {
  action: (s: TeamState, fd: FormData) => Promise<TeamState>;
  submit: string;
  className: string;
  confirm?: string;
  children?: React.ReactNode;
}) {
  const { state, formAction, onSubmit, pending } = useFormAction(action, null as TeamState, confirm);
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-2">
      {children}
      <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>{pending ? "…" : submit}</button>
      {state?.error && <p role="alert" className="text-sm font-medium text-danger">{state.error}</p>}
      {state?.done && (
        <div role="status" className="rounded-md bg-brand-soft p-2 text-sm">
          {state.done}
          {state.password && (
            <p className="mt-1">
              Mot de passe provisoire à transmettre de vive voix ou par un canal sûr (il ne sera plus affiché) :{" "}
              <code className="select-all rounded bg-white px-1 font-mono">{state.password}</code>
            </p>
          )}
        </div>
      )}
    </form>
  );
}
