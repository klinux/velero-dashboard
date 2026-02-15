import { useEffect, useRef } from "react";
import { useClusters } from "./use-clusters";
import { useClusterStore } from "@/lib/cluster";

/**
 * Auto-selects a cluster when:
 * 1. No cluster is currently selected, OR
 * 2. The selected cluster no longer exists (was deleted externally)
 *
 * Prefers the default cluster, falls back to the first available.
 */
export function useClusterAutoSelect() {
  const { data: clusters } = useClusters();
  const selectedClusterId = useClusterStore((state) => state.selectedClusterId);
  const setSelectedCluster = useClusterStore(
    (state) => state.setSelectedCluster
  );
  const clearSelectedCluster = useClusterStore(
    (state) => state.clearSelectedCluster
  );
  const hasAutoSelectedRef = useRef(false);

  useEffect(() => {
    if (!clusters || clusters.length === 0) {
      // No clusters available — clear stale selection if any
      if (selectedClusterId) {
        clearSelectedCluster();
      }
      return;
    }

    // Check if the currently selected cluster still exists
    const selectionValid =
      selectedClusterId &&
      clusters.some((c) => c.id === selectedClusterId);

    if (selectionValid) {
      // Current selection is fine, mark auto-select as done
      hasAutoSelectedRef.current = true;
      return;
    }

    // Need to auto-select: either nothing selected or selected cluster was deleted
    if (!hasAutoSelectedRef.current || !selectionValid) {
      const defaultCluster =
        clusters.find((c) => c.isDefault) || clusters[0];
      setSelectedCluster(defaultCluster.id);
      hasAutoSelectedRef.current = true;
    }
  }, [clusters, selectedClusterId, setSelectedCluster, clearSelectedCluster]);
}
