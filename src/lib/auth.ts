import { NextRequest } from "next/server";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { eq } from "drizzle-orm";

const JWT_SECRET = "tierlist-jwt-secret-2024"; // In production, use env var
const COOKIE_NAME = "tierlist_auth";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

// --- PBKDF2 password hashing (edge-compatible) ---

export async function hashPasswordSecure(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${saltHex}:${hashHex}`;
}

export async function verifyPasswordSecure(
  password: string,
  stored: string
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(
    saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16))
  );
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const computedHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computedHex === hashHex;
}

// --- JWT (HMAC-SHA256 via Web Crypto) ---

async function getSigningKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function createJWT(payload: {
  userId: string;
  username: string;
}): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + COOKIE_MAX_AGE };

  const encoder = new TextEncoder();
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const bodyB64 = base64url(encoder.encode(JSON.stringify(body)));
  const signingInput = `${headerB64}.${bodyB64}`;

  const key = await getSigningKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signingInput)
  );

  return `${signingInput}.${base64url(sig)}`;
}

export async function verifyJWT(
  token: string
): Promise<{ userId: string; username: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, bodyB64, sigB64] = parts;
    const signingInput = `${headerB64}.${bodyB64}`;

    const key = await getSigningKey();
    const encoder = new TextEncoder();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(sigB64).buffer as ArrayBuffer,
      encoder.encode(signingInput)
    );
    if (!valid) return null;

    const body = JSON.parse(
      new TextDecoder().decode(base64urlDecode(bodyB64))
    ) as { userId: string; username: string; exp: number };

    if (body.exp < Math.floor(Date.now() / 1000)) return null;

    return { userId: body.userId, username: body.username };
  } catch {
    return null;
  }
}

// --- Cookie helpers ---

export function authCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=None; Max-Age=${COOKIE_MAX_AGE}; Domain=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID}.discordsays.com; Secure`;
}

// --- Get authenticated user from request ---

export async function getAuthUser(
  req: NextRequest
): Promise<{ id: string; username: string } | null> {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  const payload = await verifyJWT(cookie.value);
  if (!payload) return null;

  const env = getEnv();
  const db = getDb(env.DB);
  const user = await db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.id, payload.userId))
    .get();

  return user || null;
}
