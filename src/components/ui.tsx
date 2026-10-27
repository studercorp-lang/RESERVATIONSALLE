/** Petits composants d'interface réutilisables et accessibles. */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "block w-full rounded-md border border-line bg-white px-3 py-2.5 text-base text-ink shadow-sm aria-[invalid=true]:border-danger";

export function ButtonLink({ className = "", ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={`inline-flex items-center justify-center rounded-md bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark ${className}`}
    />
  );
}

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-md bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60 ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-white p-4 sm:p-6 ${className}`}>{children}</div>;
}

/** Bandeau d'erreur annoncé aux lecteurs d'écran. */
export function Alert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" }) {
  const styles = tone === "error" ? "border-danger bg-red-50 text-danger" : "border-brand bg-brand-soft text-ink";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border-l-4 p-4 ${styles}`}>
      {children}
    </div>
  );
}

/** Indicateur des 3 étapes du parcours de réservation. */
export function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Choisir", "Vos coordonnées", "Confirmation"];
  return (
    <ol className="mb-6 flex gap-2 text-sm" aria-label="Étapes de la réservation">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className={`flex-1 rounded-md border px-2 py-2 text-center ${
              state === "current" ? "border-brand bg-brand text-white" : state === "done" ? "border-brand text-brand" : "border-line text-muted"
            }`}
          >
            <span className="font-semibold">{n}.</span> {label}
            {state === "done" && <span className="sr-only"> (terminé)</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Visuel de remplacement tant qu'aucune photo de la salle n'a été ajoutée. */
export function PhotoPlaceholder({ name }: { name: string }) {
  return (
    <div aria-hidden="true" className="flex aspect-[16/9] w-full items-center justify-center rounded-md bg-gradient-to-br from-brand-soft to-line">
      <span className="text-3xl font-bold tracking-widest text-brand">{name}</span>
    </div>
  );
}
