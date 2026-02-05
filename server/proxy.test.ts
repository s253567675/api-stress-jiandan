import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("proxy.request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should successfully proxy a GET request", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      text: vi.fn().mockResolvedValue('{"data": "test"}'),
      headers: new Map([["content-type", "application/json"]]),
    };
    mockResponse.headers.entries = () => mockResponse.headers[Symbol.iterator]();
    mockFetch.mockResolvedValue(mockResponse);

    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.proxy.request({
      url: "https://api.example.com/test",
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.statusText).toBe("OK");
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/test",
      expect.objectContaining({
        method: "GET",
        headers: { "Accept": "application/json" },
      })
    );
  });

  it("should successfully proxy a POST request with body", async () => {
    const mockResponse = {
      ok: true,
      status: 201,
      statusText: "Created",
      text: vi.fn().mockResolvedValue('{"id": 1}'),
      headers: new Map([["content-type", "application/json"]]),
    };
    mockResponse.headers.entries = () => mockResponse.headers[Symbol.iterator]();
    mockFetch.mockResolvedValue(mockResponse);

    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.proxy.request({
      url: "https://api.example.com/create",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"name": "test"}',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe(201);
    expect(result.body).toBe('{"id": 1}');
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/create",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"name": "test"}',
      })
    );
  });

  it("should handle failed requests (4xx/5xx)", async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: vi.fn().mockResolvedValue('{"error": "Not found"}'),
      headers: new Map(),
    };
    mockResponse.headers.entries = () => mockResponse.headers[Symbol.iterator]();
    mockFetch.mockResolvedValue(mockResponse);

    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.proxy.request({
      url: "https://api.example.com/notfound",
      method: "GET",
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
    expect(result.statusText).toBe("Not Found");
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.proxy.request({
      url: "https://api.example.com/error",
      method: "GET",
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(0);
    expect(result.statusText).toBe("Network Error");
    expect(result.error).toBe("Network error");
  });

  it("should validate URL format", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    // Invalid URL should throw validation error
    await expect(
      caller.proxy.request({
        url: "not-a-valid-url",
        method: "GET",
      })
    ).rejects.toThrow();
  });

  it("should support all HTTP methods", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      text: vi.fn().mockResolvedValue(""),
      headers: new Map(),
    };
    mockResponse.headers.entries = () => mockResponse.headers[Symbol.iterator]();
    mockFetch.mockResolvedValue(mockResponse);

    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

    for (const method of methods) {
      mockFetch.mockClear();
      await caller.proxy.request({
        url: "https://api.example.com/test",
        method,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/test",
        expect.objectContaining({ method })
      );
    }
  });
});
