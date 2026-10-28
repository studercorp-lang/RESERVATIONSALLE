import { SITE } from "@/config/site";

/** Cadre commun des écrans de connexion. */
export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main id="contenu" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <p className="mb-4 text-center text-xl font-bold tracking-widest">{SITE.name}</p>
      <div className="rounded-lg border border-line bg-white p-6">
        <h1 className="mb-4 text-xl font-bold">{title}</h1>
        {children}
      </div>
    </main>
  );
}
