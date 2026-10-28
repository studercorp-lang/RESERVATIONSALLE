import type { Metadata } from "next";
import { LegalContent } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Conditions de réservation" };
export const dynamic = "force-dynamic"; // les durées et le barème suivent les réglages du back-office

export default function Page() {
  return <LegalContent name="conditions-reservation" />;
}
