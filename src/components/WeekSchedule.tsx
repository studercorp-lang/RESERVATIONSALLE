/**
 * Planning d'une salle sur plusieurs jours : barre visuelle + liste textuelle
 * des plages libres (lisible par les lecteurs d'écran). Aucune information
 * sur les autres clients n'est affichée.
 */
import type { DaySchedule } from "@/lib/availability/search";
import { subtractIntervals } from "@/lib/availability/rules";
import { formatTime } from "@/lib/format";
import { parisToUtc } from "@/lib/time";

const DAY_START = 7 * 60;
const DAY_END = 24 * 60;

function pct(date: Date, isoDate: string) {
  const base = parisToUtc(isoDate, DAY_START).getTime();
  const span = parisToUtc(isoDate, DAY_END).getTime() - base;
  return Math.min(100, Math.max(0, ((date.getTime() - base) / span) * 100));
}

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

export function WeekSchedule({ days, now = new Date() }: { days: DaySchedule[]; now?: Date }) {
  return (
    <div>
      <ul className="space-y-3">
        {days.map((d) => {
          const free = subtractIntervals(d.open, d.busy).filter((f) => f.end > now).map((f) => ({ start: f.start < now ? now : f.start, end: f.end }));
          return (
            <li key={d.date} className="rounded-md border border-line bg-white p-3">
              <p className="mb-2 font-medium first-letter:uppercase">{dayLabel(d.date)}</p>
              <div className="relative h-4 overflow-hidden rounded bg-busy" aria-hidden="true">
                {free.map((f) => (
                  <span key={f.start.toISOString()} className="absolute inset-y-0 bg-free" style={{ left: `${pct(f.start, d.date)}%`, width: `${pct(f.end, d.date) - pct(f.start, d.date)}%` }} />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted" aria-hidden="true">
                <span>7h</span><span>12h</span><span>18h</span><span>24h</span>
              </div>
              <p className="mt-1 text-sm">
                {free.length === 0 ? (
                  <span className="text-muted">Complet ou fermé</span>
                ) : (
                  <>
                    <span className="font-medium">Libre :</span>{" "}
                    {free.map((f) => `${formatTime(f.start)} – ${formatTime(f.end) === "00h00" ? "minuit" : formatTime(f.end)}`).join(", ")}
                  </>
                )}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex gap-4 text-sm text-muted">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-free" aria-hidden="true" /> Libre</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-busy" aria-hidden="true" /> Occupé ou fermé</span>
      </p>
      <p className="mt-1 text-xs text-muted">Les plages occupées incluent le temps de préparation de la salle entre deux réservations.</p>
    </div>
  );
}
