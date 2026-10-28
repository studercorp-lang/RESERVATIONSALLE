import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Back-office", template: "%s — Back-office QUAI 19" }, robots: { index: false, follow: false } };

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-surface">{children}</div>;
}
