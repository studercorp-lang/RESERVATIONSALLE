import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les modules natifs (hachage des mots de passe) restent côté serveur
  serverExternalPackages: ["@node-rs/argon2"],
  experimental: {
    // Envoi de photos de salles jusqu'à 3 Mo (+ marge pour l'encodage du formulaire)
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
