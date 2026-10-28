import Link from "next/link";
import { BookingStatus } from "@prisma/client";
import { addDays } from "date-fns";
import { prisma } from "@/lib/db";
import { FULL_DAY_FROM_MIN, closureLabel } from "@/lib/admin/rooms";
import { formatTime } from "@/lib/format";
import { parisToUtc, utcToParis } from "@/lib/time";
import { PageTitle, STATUS_ADMIN, smallButton } from "@/components/admin";

export const metadata = { title: "Calendrier" };

/** Jour « d'exploitation » : de 6h00 à 6h00 le lendemain (une soirée jusqu'à 3h reste sur son jour). */
const dayWindow = (iso: string) => ({ start: parisToUtc(iso, FULL_DAY_FROM_MIN), end: parisToUtc(iso, 1440 + FULL_DAY_FROM_MIN) });
const shift = (iso: string, n: number) => utcToParis(addDays(parisToUtc(iso, 12 * 60), n)).isoDate;
const dayTitle = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const sp = await searchParams;
  const today = utcToParis(new Date()).isoDate;
  // Début de semaine : le mardi (jour d'ouverture) précédant la date demandée, sinon aujourd'hui
  let start = sp.semaine && /^\d{4}-\d{2}-\d{2}$/.test(sp.semaine) ? sp.semaine : today;
  while (utcToParis(parisToUtc(start, 720)).weekday !== 2) start = shift(start, -1);
  const days = Array.from({ length: 7 }, (_, i) => shift(start, i));
  const from = dayWindow(days[0]).start;
  const to = dayWindow(days[6]).end;

  const [rooms, bookings, closures] = await Promise.all([
    prisma.room.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, openingHours: { select: { weekday: true } } } }),
    prisma.booking.findMany({
      where: { startsAt: { gte: from, lt: to }, status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
      orderBy: { startsAt: "asc" },
      include: { customer: { select: { firstName: true, lastName: true, company: true } } },
    }),
    prisma.closure.findMany({ where: { startsAt: { lt: to }, endsAt: { gt: from } } }),
  ]);

  return (
    <div>
      <PageTitle
        actions={
          <>
            <Link href={`/admin/calendrier?semaine=${shift(start, -7)}`} className={smallButton}>← Semaine précédente</Link>
            <Link href="/admin/calendrier" className={smallButton}>Cette semaine</Link>
            <Link href={`/admin/calendrier?semaine=${shift(start, 7)}`} className={smallButton}>Semaine suivante →</Link>
          </>
        }
      >
        Calendrier
      </PageTitle>
      <p className="mb-4 flex flex-wrap gap-3 text-sm">
        {(["PENDING", "CONFIRMED", "COMPLETED"] as const).map((s) => (
          <span key={s} className={`rounded px-2 py-0.5 ${STATUS_ADMIN[s].className}`}>{STATUS_ADMIN[s].label}</span>
        ))}
        <span className="rounded bg-gray-800 px-2 py-0.5 text-white">Bloqué</span>
      </p>

      <div className="space-y-4">
        {days.map((iso) => {
          const w = dayWindow(iso);
          return (
            <section key={iso} aria-labelledby={`jour-${iso}`} className={`rounded-lg border bg-white ${iso === today ? "border-brand" : "border-line"}`}>
              <h2 id={`jour-${iso}`} className="border-b border-line px-4 py-2 font-semibold first-letter:uppercase">
                {dayTitle(iso)} {iso === today && <span className="text-sm font-normal text-brand">(aujourd&apos;hui)</span>}
              </h2>
              <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
                {rooms.map((room) => {
                  const items = bookings.filter((b) => b.roomId === room.id && b.startsAt >= w.start && b.startsAt < w.end);
                  const blocks = closures.filter((c) => (c.roomId === null || c.roomId === room.id) && c.startsAt < w.end && c.endsAt > w.start);
                  return (
                    <div key={room.id} className="min-h-20 p-3">
                      <h3 className="mb-2 text-sm font-semibold text-muted">{room.name}</h3>
                      <ul className="space-y-2">
                        {blocks.map((c) => (
                          <li key={c.id} className="rounded bg-gray-800 px-2 py-1 text-xs text-white">
                            Bloqué : {closureLabel(c)}{c.reason ? ` — ${c.reason}` : ""}
                          </li>
                        ))}
                        {items.map((b) => (
                          <li key={b.id}>
                            <Link href={`/admin/reservations/${b.id}`} className={`block rounded px-2 py-1 text-sm hover:underline ${STATUS_ADMIN[b.status].className}`}>
                              <span className="font-semibold">{formatTime(b.startsAt)}–{formatTime(b.endsAt)}</span> · {b.attendees} pers.
                              <span className="block">{b.customer.firstName} {b.customer.lastName}{b.customer.company ? ` (${b.customer.company})` : ""}</span>
                              <span className="sr-only"> — {STATUS_ADMIN[b.status].label}</span>
                            </Link>
                          </li>
                        ))}
                        {items.length === 0 && blocks.length === 0 && (
                          <li className="text-xs text-muted">
                            {room.openingHours.some((h) => h.weekday === utcToParis(parisToUtc(iso, 720)).weekday) ? "Libre" : "Fermé (horaires)"}
                          </li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
