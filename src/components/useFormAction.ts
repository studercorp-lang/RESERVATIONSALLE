"use client";

/**
 * Comme useActionState, mais sans vider le formulaire après l'envoi :
 * en cas d'erreur, la personne retrouve sa saisie (React 19 réinitialise
 * sinon automatiquement les champs). Sans JavaScript, le formulaire
 * fonctionne toujours via son attribut `action`.
 */
import { startTransition, useActionState, type FormEvent } from "react";

export function useFormAction<S>(action: (state: Awaited<S>, fd: FormData) => Promise<S>, initial: Awaited<S>, confirmMessage?: string) {
  const [state, formAction, pending] = useActionState<S, FormData>(action, initial);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };
  return { state, formAction, onSubmit, pending };
}
