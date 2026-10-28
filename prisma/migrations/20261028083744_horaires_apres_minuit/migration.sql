-- AlterTable
ALTER TABLE "opening_hours" ADD COLUMN     "lastStartMin" INTEGER;

-- Une plage d'ouverture peut désormais se terminer le lendemain (jusqu'à 24 h après minuit),
-- et l'heure de début au plus tard doit se situer dans la plage.
ALTER TABLE "opening_hours" DROP CONSTRAINT "opening_hours_valid";
ALTER TABLE "opening_hours"
  ADD CONSTRAINT "opening_hours_valid" CHECK (
    "weekday" BETWEEN 1 AND 7
    AND "openMin" >= 0 AND "openMin" < 1440
    AND "closeMin" > "openMin" AND "closeMin" <= 2880
    AND ("lastStartMin" IS NULL OR ("lastStartMin" >= "openMin" AND "lastStartMin" < "closeMin"))
  );
