import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DepoSnapshot, DepoSnapshotDetail } from "@/types";
import type { SnapshotInput } from "@/lib/validate";

/** Список снимков депо (без содержимого блоков), свежие сверху. */
export function useSnapshots() {
  return useQuery({
    queryKey: ["snapshots"],
    queryFn: () => api.get<DepoSnapshot[]>("/api/snapshots"),
  });
}

/** Полный снимок с замороженными копиями всех блоков. */
export function useSnapshot(id: number) {
  return useQuery({
    queryKey: ["snapshots", id],
    queryFn: () => api.get<DepoSnapshotDetail>(`/api/snapshots/${id}`),
  });
}

/** Инвалидация ["snapshots"] префиксно накрывает и список, и детали. */
export function useCreateSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SnapshotInput) => api.post<DepoSnapshotDetail>("/api/snapshots", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snapshots"] }),
  });
}

export function useDeleteSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ ok: true }>(`/api/snapshots/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snapshots"] }),
  });
}
