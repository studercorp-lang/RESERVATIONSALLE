import Link from "next/link";
import { PageTitle } from "@/components/admin";
import { Card } from "@/components/ui";
import { RoomInfoForm } from "../RoomSections";

export const metadata = { title: "Nouvelle salle" };

export default function NewRoomPage() {
  return (
    <div>
      <Link href="/admin/salles" className="text-sm text-brand underline">← Salles</Link>
      <PageTitle>Nouvelle salle</PageTitle>
      <Card><RoomInfoForm /></Card>
      <p className="mt-3 text-sm text-muted">Après la création, vous pourrez renseigner les horaires, les tarifs et les photos.</p>
    </div>
  );
}
