/**
 * Planning d'une salle sur plusieurs jours : barre visuelle + liste textuelle
 * des plages libres (lisible par les lecteurs d'écran). Aucune information
 * sur les autres clients n'est affichée.
 * Chaque jour va de l'ouverture à la fermeture, même après minuit (ex. 15h → 3h).
 */
import type { DaySchedule } from "@/lib/availability/search";
import { subtractIntervals, type Interval } from "@/lib/availability/rules";
import { formatTime } from "@/lib/format";

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

/** Position (en %) d'un instant dans la fenêtre affichée du jour. */
const pct = (date: Date, w: Interval) =>
  Math.min(100, Math.max(0, ((date.getTime() - w.start.getTime()) / (w.end.getTime() - w.start.getTime())) * 100));

/** Libellé de fin : « minuit », ou « 03h00 » suivi de « (lendemain) » si besoin. */
function endLabel(end: Date, dayStart: Date): string {
  const t = formatTime(end);
  if (t === "00h00") return "minuit";
  return formatDay(end) !== formatDay(dayStart) ? `${t} (lendemain)` : t;
}
const formatDay = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

/** Graduations : environ toutes les 3 heures sur la fenêtre affichée. */
function ticks(w: Interval): string[] {
  const hours = (w.end.getTime() - w.start.getTime()) / 3_600_000;
  const step = hours > 9 ? 3 : 2;
  const out: string[] = [];
  for (let h = 0; h <= hours; h += step) out.push(`${Number(formatTime(new Date(w.start.getTime() + h * 3_600_000)).slice(0, 2))}h`);
  return out;
}

export function WeekSchedule({ days, now = new Date() }: { days: DaySchedule[]; now?: Date }) {
  return (
    <div>
      <ul className="space-y-3">
        {days.map((d) => {
          const free = subtractIntervals(d.open, d.busy)
            .filter((f) => f.end > now)
            .map((f) => ({ start: f.start < now ? now : f.start, end: f.end }));
          return (
            <li key={d.date} className="rounded-md border border-line bg-white p-3">
              <p className="mb-2 font-medium first-letter:uppercase">{dayLabel(d.date)}</p>
              <div className="relative h-4 overflow-hidden rounded bg-busy" aria-hidden="true">
                {free.map((f) => (
                  <span
                    key={f.start.toISOString()}
                    className="absolute inset-y-0 bg-free"
                    style={{ left: `${pct(f.start, d.window)}%`, width: `${pct(f.end, d.window) - pct(f.start, d.window)}%` }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted" aria-hidden="true">
                {ticks(d.window).map((t, i) => <span key={i}>{t}</span>)}
              </div>
              <p className="mt-1 text-sm">
                {free.length === 0 ? (
                  <span className="text-muted">Complet ou fermé</span>
                ) : (
                  <>
                    <span className="font-medium">Libre :</span>{" "}
                    {free.map((f) => `${formatTime(f.start)} – ${endLabel(f.end, d.window.start)}`).join(", ")}
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
