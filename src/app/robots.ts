import type { MetadataRoute } from "next";

/** Les moteurs de recherche n'indexent ni l'espace équipe ni les pages personnelles des clients. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/reservation/", "/reserver", "/api/"] }] };
}
