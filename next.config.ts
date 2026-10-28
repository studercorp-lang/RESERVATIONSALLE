import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/** En-têtes de sécurité envoyés avec chaque réponse (la CSP est ajoutée par src/middleware.ts). */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" }, // le site ne peut pas être affiché dans un cadre (clickjacking)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HTTPS obligatoire pendant 2 ans (uniquement en production, derrière HTTPS)
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // ne pas annoncer la technologie utilisée
  // Les modules natifs (hachage des mots de passe) restent côté serveur
  serverExternalPackages: ["@node-rs/argon2"],
  experimental: {
    // Envoi de photos de salles jusqu'à 3 Mo (+ marge pour l'encodage du formulaire)
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
