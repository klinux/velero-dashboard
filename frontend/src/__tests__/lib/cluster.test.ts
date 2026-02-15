import { describe, it, expect, beforeEach, vi } from "vitest";
import { useClusterStore } from "@/lib/cluster";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string): string | null => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

describe("useClusterStore", () => {
  beforeEach(() => {
    // Reset store state
    useClusterStore.setState({ selectedClusterId: null });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("has null selectedClusterId initially", () => {
    const state = useClusterStore.getState();
    expect(state.selectedClusterId).toBeNull();
  });

  it("setSelectedCluster updates state and localStorage", () => {
    const { setSelectedCluster } = useClusterStore.getState();

    setSelectedCluster("cluster-123");

    const state = useClusterStore.getState();
    expect(state.selectedClusterId).toBe("cluster-123");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "velero_selected_cluster",
      "cluster-123"
    );
  });

  it("clearSelectedCluster resets state and removes from localStorage", () => {
    const { setSelectedCluster, clearSelectedCluster } =
      useClusterStore.getState();

    setSelectedCluster("cluster-123");
    clearSelectedCluster();

    const state = useClusterStore.getState();
    expect(state.selectedClusterId).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      "velero_selected_cluster"
    );
  });

  it("initialize restores from localStorage", () => {
    localStorageMock.getItem.mockReturnValueOnce("saved-cluster-id");

    const { initialize } = useClusterStore.getState();
    initialize();

    const state = useClusterStore.getState();
    expect(state.selectedClusterId).toBe("saved-cluster-id");
  });

  it("initialize does nothing when localStorage is empty", () => {
    localStorageMock.getItem.mockReturnValueOnce(null);

    const { initialize } = useClusterStore.getState();
    initialize();

    const state = useClusterStore.getState();
    expect(state.selectedClusterId).toBeNull();
  });

  it("setSelectedCluster can switch between clusters", () => {
    const { setSelectedCluster } = useClusterStore.getState();

    setSelectedCluster("cluster-1");
    expect(useClusterStore.getState().selectedClusterId).toBe("cluster-1");

    setSelectedCluster("cluster-2");
    expect(useClusterStore.getState().selectedClusterId).toBe("cluster-2");

    expect(localStorageMock.setItem).toHaveBeenCalledTimes(2);
  });
});
