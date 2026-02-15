import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listClusters,
  getCluster,
  createCluster,
  deleteCluster,
} from "@/lib/api";

// Mock fetch and localStorage
const mockFetch = vi.fn();
global.fetch = mockFetch;

const localStorageMock = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

const mockCluster = {
  id: "cluster-1",
  name: "production",
  namespace: "velero",
  status: "connected",
  isDefault: true,
  createdAt: "2026-01-01T00:00:00Z",
  lastHealthCheck: "2026-01-01T00:01:00Z",
};

describe("Cluster API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe("listClusters", () => {
    it("calls GET /api/clusters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [mockCluster],
      });

      const result = await listClusters();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/clusters",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
      expect(result).toEqual([mockCluster]);
    });
  });

  describe("getCluster", () => {
    it("calls GET /api/clusters/:id", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCluster,
      });

      const result = await getCluster("cluster-1");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/clusters/cluster-1",
        expect.any(Object)
      );
      expect(result.name).toBe("production");
    });
  });

  describe("createCluster", () => {
    it("calls POST /api/clusters with body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockCluster,
      });

      const result = await createCluster({
        name: "production",
        kubeconfig: "apiVersion: v1\nkind: Config",
        namespace: "velero",
        setAsDefault: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/clusters",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"name":"production"'),
        })
      );
      expect(result.id).toBe("cluster-1");
    });

    it("sends token auth fields when using token mode", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockCluster,
      });

      await createCluster({
        name: "gke-cluster",
        namespace: "velero",
        setAsDefault: false,
        apiServer: "https://api.gke.example.com",
        token: "bearer-token-123",
        caCert: "base64cert",
        insecureSkipTLS: false,
      });

      const callBody = mockFetch.mock.calls[0][1].body;
      const parsed = JSON.parse(callBody);
      expect(parsed.apiServer).toBe("https://api.gke.example.com");
      expect(parsed.token).toBe("bearer-token-123");
      expect(parsed.caCert).toBe("base64cert");
    });
  });

  describe("deleteCluster", () => {
    it("calls DELETE /api/clusters/:id", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: "Cluster deleted successfully" }),
      });

      const result = await deleteCluster("cluster-1");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/clusters/cluster-1",
        expect.objectContaining({ method: "DELETE" })
      );
      expect(result.message).toBe("Cluster deleted successfully");
    });
  });

  describe("authentication", () => {
    it("includes Bearer token when available", async () => {
      localStorageMock.getItem.mockReturnValue("my-jwt-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await listClusters();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/clusters",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer my-jwt-token",
          }),
        })
      );
    });
  });

  describe("error handling", () => {
    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: "Forbidden" }),
      });

      await expect(listClusters()).rejects.toThrow("Forbidden");
    });
  });
});
