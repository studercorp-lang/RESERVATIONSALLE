import type { Metadata } from "next";
import { LegalContent } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Politique de confidentialité" };
export const dynamic = "force-dynamic"; // les durées et le barème suivent les réglages du back-office

export default function Page() {
  return <LegalContent name="confidentialite" />;
}
