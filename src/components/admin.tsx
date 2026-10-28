/** Petits composants partagés du back-office. */
import type { BookingStatus } from "@prisma/client";

export const STATUS_ADMIN: Record<BookingStatus, { label: string; className: string }> = {
  PENDING: { label: "En attente", className: "bg-amber-100 text-amber-900" },
  CONFIRMED: { label: "Confirmée", className: "bg-green-100 text-green-900" },
  REFUSED: { label: "Refusée", className: "bg-red-100 text-red-900" },
  CANCELLED: { label: "Annulée", className: "bg-gray-200 text-gray-800" },
  EXPIRED: { label: "Expirée", className: "bg-gray-200 text-gray-800" },
  COMPLETED: { label: "Terminée", className: "bg-blue-100 text-blue-900" },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const s = STATUS_ADMIN[status];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>{s.label}</span>;
}

export function PageTitle({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{children}</h1>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Message de confirmation après une action (?ok=…). */
export function Flash({ messages, code }: { messages: Record<string, string>; code?: string }) {
  if (!code || !messages[code]) return null;
  return <div role="status" className="mb-4 rounded-md border-l-4 border-brand bg-brand-soft p-3">{messages[code]}</div>;
}

export const smallButton = "inline-flex items-center justify-center rounded-md border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-surface";
export const primarySmall = "inline-flex items-center justify-center rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark";
export const dangerSmall = "inline-flex items-center justify-center rounded-md border-2 border-danger bg-white px-3 py-2 text-sm font-semibold text-danger hover:bg-red-50";
