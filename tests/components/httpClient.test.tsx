import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, http, request } from "~/lib/httpClient";

describe("httpClient 502 killer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps 502 to API_UNREACHABLE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) } as unknown as Response),
    );
    const err = await request("/api/ping", { auth: false }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("API_UNREACHABLE");
    expect((err as ApiError).status).toBe(502);
  });

  it("masks login 401 as UNAUTHENTICATED on the default authed path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: "INVALID_CREDENTIALS", message: "Invalid email or password" }),
      } as unknown as Response),
    );
    const err = await request("/api/auth/login", {
      method: "POST",
      body: { email: "admin@example.com", password: "wrong" },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("UNAUTHENTICATED");
  });

  it("surfaces the real 401 code when login opts out via http.post passthrough", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: "INVALID_CREDENTIALS", message: "Invalid email or password" }),
      } as unknown as Response),
    );
    const err = await http
      .post("/api/auth/login", { email: "admin@example.com", password: "wrong" }, undefined, {
        auth: false,
        retry: false,
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("INVALID_CREDENTIALS");
    expect((err as ApiError).message).toBe("Invalid email or password");
  });
});
