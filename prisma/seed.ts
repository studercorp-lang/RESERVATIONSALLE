/**
 * Données de démonstration — 100 % fictives.
 * Aucune vraie donnée personnelle : les e-mails utilisent le domaine réservé
 * « example.com » et les numéros de téléphone la plage fictive 01 99 00 xx xx (ARCEP).
 *
 * Lancement : npm run db:seed (efface puis recrée les salles et réservations de démo).
 */
import { PrismaClient, PriceUnit, BookingStatus } from "@prisma/client";
import { addDays } from "date-fns";
import { parisToUtc, utcToParis } from "../src/lib/time";

const prisma = new PrismaClient();

const ROOMS = [
  {
    slug: "la-verriere",
    name: "La Verrière",
    description:
      "Grande salle lumineuse sous verrière, idéale pour les séminaires, conférences et réceptions.",
    capacity: 80,
    equipment: ["Vidéoprojecteur", "Sonorisation", "Micros sans fil", "Wi-Fi", "Office traiteur"],
    accessiblePmr: true,
    minDurationMin: 120,
    maxDurationMin: 720,
    bufferMin: 60,
    // Tarifs TTC en euros : [heure, demi-journée, journée], semaine puis week-end
    weekPrices: [150, 550, 950],
    weekendPrices: [200, 750, 1300],
  },
  {
    slug: "le-salon-saone",
    name: "Le Salon Saône",
    description: "Salon chaleureux avec vue sur la Saône, pour réunions, ateliers et déjeuners.",
    capacity: 30,
    equipment: ["Écran 75 pouces", "Visioconférence", "Paperboard", "Wi-Fi"],
    accessiblePmr: true,
    minDurationMin: 60,
    maxDurationMin: 720,
    bufferMin: 30,
    weekPrices: [80, 300, 520],
    weekendPrices: [110, 400, 700],
  },
  {
    slug: "l-atelier",
    name: "L'Atelier",
    description: "Petite salle intimiste pour réunions de travail et entretiens.",
    capacity: 12,
    equipment: ["Écran 55 pouces", "Tableau blanc", "Wi-Fi"],
    accessiblePmr: false,
    minDurationMin: 60,
    maxDurationMin: 720,
    bufferMin: 15,
    weekPrices: [45, 160, 280],
    weekendPrices: [60, 220, 380],
  },
];

const CUSTOMERS = [
  { email: "camille.martin@example.com", firstName: "Camille", lastName: "Martin", phone: "+33199000101", company: "Exemple Conseil" },
  { email: "dominique.bernard@example.com", firstName: "Dominique", lastName: "Bernard", phone: "+33199000102", company: null },
  { email: "alex.petit@example.com", firstName: "Alex", lastName: "Petit", phone: "+33199000103", company: "Association Démo" },
];

async function main() {
  // Nettoyage (ordre imposé par les relations)
  await prisma.consent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.room.deleteMany();

  const rooms = [];
  for (const [i, r] of ROOMS.entries()) {
    const { weekPrices, weekendPrices, ...data } = r;
    const units = [PriceUnit.HOUR, PriceUnit.HALF_DAY, PriceUnit.DAY];
    const room = await prisma.room.create({
      data: {
        ...data,
        sortOrder: i,
        // Horaires QUAI 19 : ouvert 7j/7 de 15h00 à 03h00 le lendemain,
        // début de réservation au plus tard à 22h00.
        openingHours: {
          create: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
            weekday,
            openMin: 15 * 60,
            closeMin: 24 * 60 + 3 * 60, // 03h00 le lendemain
            lastStartMin: 22 * 60,
          })),
        },
        priceRules: {
          create: [1, 2, 3, 4, 5, 6, 7].flatMap((weekday) =>
            units.map((unit, u) => ({
              weekday,
              unit,
              amountCents: (weekday >= 6 ? weekendPrices[u] : weekPrices[u]) * 100,
            })),
          ),
        },
      },
    });
    rooms.push(room);
  }

  const customers = await Promise.all(CUSTOMERS.map((c) => prisma.customer.create({ data: c })));

  // Quelques réservations dans les prochains jours, à heures « rondes » de Paris
  const today = utcToParis(new Date()).isoDate;
  const day = (offset: number) => utcToParis(addDays(parisToUtc(today, 12 * 60), offset)).isoDate;
  // Horaires en minutes depuis minuit du jour de début ; au-delà de 1440 = lendemain (02h00 = 1560)
  const demo = [
    { room: 0, customer: 0, date: day(3), start: 18 * 60, end: 26 * 60, attendees: 60, status: BookingStatus.CONFIRMED },
    { room: 1, customer: 1, date: day(3), start: 15 * 60, end: 18 * 60, attendees: 20, status: BookingStatus.PENDING },
    { room: 2, customer: 2, date: day(5), start: 19 * 60, end: 23 * 60, attendees: 8, status: BookingStatus.CONFIRMED },
    { room: 0, customer: 2, date: day(10), start: 20 * 60, end: 27 * 60, attendees: 75, status: BookingStatus.PENDING },
  ];
  for (const [i, b] of demo.entries()) {
    const room = rooms[b.room];
    const startsAt = parisToUtc(b.date, b.start);
    const endsAt = parisToUtc(b.date, b.end);
    await prisma.booking.create({
      data: {
        reference: `DEMO-${String(i + 1).padStart(4, "0")}`,
        roomId: room.id,
        customerId: customers[b.customer].id,
        startsAt,
        endsAt,
        blockedUntil: new Date(endsAt.getTime() + room.bufferMin * 60_000),
        attendees: b.attendees,
        status: b.status,
        pendingExpiresAt: b.status === BookingStatus.PENDING ? addDays(new Date(), 7) : null,
        decidedAt: b.status === BookingStatus.CONFIRMED ? new Date() : null,
      },
    });
  }

  console.log(`✔ ${rooms.length} salles, ${customers.length} clients fictifs et ${demo.length} réservations de démonstration créés.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
