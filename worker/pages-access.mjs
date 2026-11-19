const host = "hub.ebaagencia.com";
const teamDomain = /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/;
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const keysets = new Map();
const identityHeaders = {
  id: "oai-authenticated-user-id",
  email: "oai-authenticated-user-email",
  name: "oai-authenticated-user-full-name",
  encoding: "oai-authenticated-user-full-name-encoding",
};
const publicFiles = new Set([
  "/dialogs.css", "/dialogs.js", "/eba-theme.css", "/favicon.svg", "/icons.js",
  "/manrope.ttf", "/radar.css", "/radar.js", "/radar.webp",
]);

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid token encoding");
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));
}

async function signingKey(issuer, kid) {
  const cached = keysets.get(issuer);
  if (cached?.expires > Date.now() && cached.keys.has(kid)) return cached.keys.get(kid);
  // Limit refreshes triggered by unknown key IDs while allowing key rotation.
  if (cached?.refreshAfter > Date.now()) return null;
  const response = await fetch(`${issuer}/cdn-cgi/access/certs`, { redirect: "manual" });
  if (!response.ok) throw new Error("Access keys are unavailable");
  const { keys } = await response.json();
  const rsaKeys = new Map(keys.filter((key) => key.kty === "RSA" && key.alg === "RS256").map((key) => [key.kid, key]));
  const now = Date.now();
  keysets.set(issuer, { keys: rsaKeys, expires: now + 300_000, refreshAfter: now + 15_000 });
  return rsaKeys.get(kid);
}

async function verifyIdentity(token, issuer, audience) {
  if (!token || token.length > 8192) return null;
  try {
    const [header, payload, signature, extra] = token.split(".");
    if (!signature || extra !== undefined) return null;
    const { alg, kid } = JSON.parse(decoder.decode(decodeBase64Url(header)));
    if (alg !== "RS256" || typeof kid !== "string" || !kid) return null;
    const claims = JSON.parse(decoder.decode(decodeBase64Url(payload)));
    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(audience) ||
        !Number.isSafeInteger(claims.exp) || claims.exp <= now ||
        (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > now)) ||
        typeof claims.sub !== "string" || !/^[a-z0-9_-]+$/i.test(claims.sub) ||
        typeof claims.email !== "string" || !/^[\x21-\x7e]+@[^\s@]+$/.test(claims.email)) return null;
    const jwk = await signingKey(issuer, kid);
    if (!jwk) return null;
    const options = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
    const key = await crypto.subtle.importKey("jwk", jwk, options, false, ["verify"]);
    const valid = await crypto.subtle.verify(options, key, decodeBase64Url(signature), encoder.encode(`${header}.${payload}`));
    return valid ? { id: `cf-access:${claims.sub}`, email: claims.email } : null;
  } catch {
    return null;
  }
}

function denied(status, message) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

export function protectPages(app) {
  return async (request, env, ctx) => {
    const url = new URL(request.url);
    if (url.hostname !== host) {
      if (request.method !== "GET" && request.method !== "HEAD") return denied(403, "Acesso restrito ao domínio do Hub EBA.");
      return Response.redirect(new URL(`https://${host}${url.pathname}${url.search}`), 302);
    }
    const issuer = env.EBA_ACCESS_ISSUER;
    const audience = env.EBA_ACCESS_AUDIENCE;
    if (typeof issuer !== "string" || !teamDomain.test(issuer) || typeof audience !== "string" || !audience) {
      return denied(503, "O acesso privado ao Hub EBA está em configuração.");
    }
    const user = await verifyIdentity(request.headers.get("Cf-Access-Jwt-Assertion"), issuer, audience);
    if (!user) return denied(403, "Entre com uma conta autorizada no Cloudflare Access.");
    if (url.pathname === "/signout-with-chatgpt") return Response.redirect(new URL("/cdn-cgi/access/logout", url), 302);
    if (url.pathname === "/signin-with-chatgpt") return Response.redirect(new URL("/", url), 302);

    if (publicFiles.has(url.pathname) || /^\/_next\/static\/[\w./~-]+$/.test(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    const headers = new Headers(request.headers);
    for (const header of Object.values(identityHeaders)) headers.delete(header);
    headers.set(identityHeaders.id, user.id);
    headers.set(identityHeaders.email, user.email);
    const response = await app.fetch(new Request(request, { headers }), env, ctx);
    const privateResponse = new Response(response.body, response);
    privateResponse.headers.set("Cache-Control", "private, no-store");
    return privateResponse;
  };
}
