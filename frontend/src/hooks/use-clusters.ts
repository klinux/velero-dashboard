import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listClusters,
  getCluster,
  createCluster,
  updateCluster,
  deleteCluster,
} from "@/lib/api";
import type {
  Cluster,
  CreateClusterRequest,
  UpdateClusterRequest,
} from "@/lib/types";
import { useClusterStore } from "@/lib/cluster";

// List all clusters
export function useClusters() {
  return useQuery({
    queryKey: ["clusters"],
    queryFn: listClusters,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider stale after 10 seconds
  });
}

// Get single cluster
export function useCluster(id: string) {
  return useQuery({
    queryKey: ["clusters", id],
    queryFn: () => getCluster(id),
    enabled: !!id,
  });
}

// Create cluster mutation
export function useCreateCluster() {
  const queryClient = useQueryClient();
  const setSelectedCluster = useClusterStore(
    (state) => state.setSelectedCluster
  );

  return useMutation({
    mutationFn: (data: CreateClusterRequest) => createCluster(data),
    onSuccess: (newCluster) => {
      // Invalidate and refetch clusters list
      queryClient.invalidateQueries({ queryKey: ["clusters"] });

      // If this is set as default, auto-select it
      if (newCluster.isDefault) {
        setSelectedCluster(newCluster.id);
      }
    },
  });
}

// Update cluster mutation
export function useUpdateCluster() {
  const queryClient = useQueryClient();
  const setSelectedCluster = useClusterStore(
    (state) => state.setSelectedCluster
  );

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClusterRequest }) =>
      updateCluster(id, data),
    onSuccess: (updatedCluster, { id }) => {
      // Invalidate clusters list and specific cluster
      queryClient.invalidateQueries({ queryKey: ["clusters"] });
      queryClient.invalidateQueries({ queryKey: ["clusters", id] });

      // If this is now the default, auto-select it
      if (updatedCluster.isDefault) {
        setSelectedCluster(updatedCluster.id);
      }
    },
  });
}

// Delete cluster mutation
export function useDeleteCluster() {
  const queryClient = useQueryClient();
  const selectedClusterId = useClusterStore(
    (state) => state.selectedClusterId
  );
  const setSelectedCluster = useClusterStore(
    (state) => state.setSelectedCluster
  );

  return useMutation({
    mutationFn: (id: string) => deleteCluster(id),
    onSuccess: (_, deletedId) => {
      // Invalidate clusters list
      queryClient.invalidateQueries({ queryKey: ["clusters"] });

      // If we deleted the currently selected cluster, switch to default
      if (selectedClusterId === deletedId) {
        const clusters = queryClient.getQueryData<Cluster[]>(["clusters"]) || [];
        const defaultCluster =
          clusters.find((c) => c.isDefault) || clusters[0];
        if (defaultCluster) {
          setSelectedCluster(defaultCluster.id);
        }
      }
    },
  });
}
