// @vitest-environment node
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { SignJWT } from "jose";

// Mock server-only so it doesn't throw in the test environment
vi.mock("server-only", () => ({}));

async function importKey(rawSecret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(rawSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function makeToken(
  payload: Record<string, unknown>,
  opts: { expiresInSeconds?: number; secret?: CryptoKey } = {}
) {
  const key = opts.secret ?? (await importKey("development-secret-key"));
  const expSeconds =
    opts.expiresInSeconds !== undefined
      ? Math.floor(Date.now() / 1000) + opts.expiresInSeconds
      : Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expSeconds)
    .setIssuedAt()
    .sign(key);
}

// Shared mock for next/headers cookies()
let mockCookieValue: string | undefined;

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === "auth-token" && mockCookieValue !== undefined
          ? { value: mockCookieValue }
          : undefined,
    }),
}));

beforeEach(() => {
  mockCookieValue = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("getSession returns null when no auth-token cookie is present", async () => {
  const { getSession } = await import("../auth");
  const result = await getSession();
  expect(result).toBeNull();
});

test("getSession returns null when cookie contains a malformed token", async () => {
  mockCookieValue = "not.a.valid.jwt";
  const { getSession } = await import("../auth");
  const result = await getSession();
  expect(result).toBeNull();
});

test("getSession returns null when token is signed with the wrong secret", async () => {
  const wrongKey = await importKey("wrong-secret");
  mockCookieValue = await makeToken(
    { userId: "u1", email: "a@b.com", expiresAt: new Date().toISOString() },
    { secret: wrongKey }
  );
  const { getSession } = await import("../auth");
  const result = await getSession();
  expect(result).toBeNull();
});

test("getSession returns null when token is expired", async () => {
  mockCookieValue = await makeToken(
    { userId: "u1", email: "a@b.com", expiresAt: new Date().toISOString() },
    { expiresInSeconds: -10 }
  );
  const { getSession } = await import("../auth");
  const result = await getSession();
  expect(result).toBeNull();
});

test("getSession returns the session payload for a valid token", async () => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  mockCookieValue = await makeToken({
    userId: "user-123",
    email: "test@example.com",
    expiresAt: expiresAt.toISOString(),
  });
  const { getSession } = await import("../auth");
  const result = await getSession();
  expect(result).not.toBeNull();
  expect(result?.userId).toBe("user-123");
  expect(result?.email).toBe("test@example.com");
});

test("getSession returns correct userId and email from token", async () => {
  mockCookieValue = await makeToken({
    userId: "abc-456",
    email: "user@domain.org",
    expiresAt: new Date().toISOString(),
  });
  const { getSession } = await import("../auth");
  const result = await getSession();
  expect(result?.userId).toBe("abc-456");
  expect(result?.email).toBe("user@domain.org");
});

test("getSession returns null for an empty string token", async () => {
  mockCookieValue = "";
  const { getSession } = await import("../auth");
  const result = await getSession();
  expect(result).toBeNull();
});
