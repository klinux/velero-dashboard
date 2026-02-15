import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Import after mock
import { listBackups, createBackup, deleteBackup, getDashboardStats } from "@/lib/api";

beforeEach(() => {
  mockFetch.mockReset();
  localStorageMock.getItem.mockReturnValue(null);
});

describe("API client", () => {
  it("listBackups calls correct endpoint", async () => {
    const backups = [{ name: "test", phase: "Completed" }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => backups,
    });

    const result = await listBackups();
    expect(result).toEqual(backups);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/backups",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
  });

  it("createBackup sends POST with body", async () => {
    const created = { name: "new", phase: "New" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => created,
    });

    const result = await createBackup({ name: "new" });
    expect(result).toEqual(created);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/backups",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "new" }),
      })
    );
  });

  it("deleteBackup sends DELETE", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "deleted" }),
    });

    await deleteBackup("my-backup");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/backups/my-backup",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "internal error" }),
    });

    await expect(listBackups()).rejects.toThrow("internal error");
  });

  it("getDashboardStats calls correct endpoint", async () => {
    const stats = { totalBackups: 5, completedBackups: 3 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => stats,
    });

    const result = await getDashboardStats();
    expect(result).toEqual(stats);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/dashboard/stats",
      expect.any(Object)
    );
  });
});
