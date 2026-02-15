import { create } from "zustand";

interface ClusterState {
  selectedClusterId: string | null;
  setSelectedCluster: (clusterId: string) => void;
  clearSelectedCluster: () => void;
  initialize: () => void;
}

export const useClusterStore = create<ClusterState>((set) => ({
  selectedClusterId: null,

  setSelectedCluster: (clusterId) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("velero_selected_cluster", clusterId);
    }
    set({ selectedClusterId: clusterId });
  },

  clearSelectedCluster: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("velero_selected_cluster");
    }
    set({ selectedClusterId: null });
  },

  initialize: () => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("velero_selected_cluster");
    if (saved) {
      set({ selectedClusterId: saved });
    }
  },
}));
