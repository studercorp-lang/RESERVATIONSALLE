/** Sert une photo de salle stockée en base, avec mise en cache par le navigateur. */
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await prisma.roomPhoto.findUnique({ where: { id }, select: { data: true, mimeType: true } });
  if (!photo) return new Response("Introuvable", { status: 404 });
  return new Response(Buffer.from(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "public, max-age=86400, immutable", // une photo modifiée reçoit un nouvel identifiant
      "X-Content-Type-Options": "nosniff",
    },
  });
}
