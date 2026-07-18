import { describe, expect, test } from "bun:test";

process.env.DATABASE_PATH = ":memory:";
process.env.WATCHERS_ENABLED = "false";

const { connectDb } = await import("../db/client");
const { buildApp } = await import("../server");

connectDb(":memory:");
const app = buildApp();

function req(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

describe("GET /wallets/value", () => {
  test("requires auth", async () => {
    const res = await app.fetch(req("/wallets/value"));
    expect(res.status).toBe(401);
  });

  test("empty for a key with no addresses", async () => {
    const mintRes = await app.fetch(req("/personal", { method: "POST" }));
    const { personalKey } = (await mintRes.json()) as { personalKey: string };
    const auth = { Authorization: `Bearer ${personalKey}` };

    const res = await app.fetch(req("/wallets/value", { headers: auth }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      currency: string;
      priceAsOf: number | null;
      total: number;
      wallets: unknown[];
    };
    expect(body.currency).toBe("usd");
    expect(body.priceAsOf).toBeNull();
    expect(body.total).toBe(0);
    expect(body.wallets).toEqual([]);
  });
});
