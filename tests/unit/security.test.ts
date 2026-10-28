/** Sécurité : recherches chiffrées dans les URL, politique de sécurité du contenu. */
import { describe, expect, it } from "vitest";
import { openQuery, sealQuery } from "@/lib/security/sealed-query";
import { contentSecurityPolicy } from "@/middleware";

process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 9).toString("base64");

describe("recherche chiffrée dans l'adresse", () => {
  it("le texte recherché n'apparaît pas en clair et se relit", () => {
    const sealed = sealQuery("camille.martin@example.com");
    expect(sealed).not.toMatch(/camille|example/);
    expect(encodeURIComponent(sealed)).toBe(sealed); // utilisable tel quel dans une URL
    expect(openQuery(sealed)).toBe("camille.martin@example.com");
  });

  it("un paramètre falsifié ou absent donne une recherche vide", () => {
    expect(openQuery("camille@example.com")).toBe("");
    expect(openQuery(sealQuery("x").replace(/.$/, "A"))).toBe("");
    expect(openQuery(undefined)).toBe("");
  });
});

describe("politique de sécurité du contenu", () => {
  const csp = contentSecurityPolicy("abc123");
  it("n'autorise que les scripts de l'application, jamais un site tiers ni l'intégration en cadre", () => {
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toMatch(/https?:\/\//);
  });
});
