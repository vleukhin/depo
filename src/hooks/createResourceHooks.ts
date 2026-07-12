import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Фабрика CRUD-хуков для сущности с REST-эндпоинтом /api/<path>. */
export function createResourceHooks<T extends { id: number }, Input>(
  key: string,
  path: string,
  opts?: { invalidateKeys?: string[] },
) {
  const listKey = [key];
  const url = `/api/${path}`;

  function useList() {
    return useQuery({ queryKey: listKey, queryFn: () => api.get<T[]>(url) });
  }

  function useInvalidate() {
    const qc = useQueryClient();
    return () => {
      qc.invalidateQueries({ queryKey: listKey });
      qc.invalidateQueries({ queryKey: ["summary"] });
      // Доп. ключи: напр. переименование менеджера должно обновить таблицу долгов.
      opts?.invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    };
  }

  function useCreate() {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: (input: Input) => api.post<T>(url, input),
      onSuccess: invalidate,
    });
  }

  function useUpdate() {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: ({ id, input }: { id: number; input: Input }) =>
        api.put<T>(`${url}/${id}`, input),
      onSuccess: invalidate,
    });
  }

  function useDelete() {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: (id: number) => api.del<{ ok: true }>(`${url}/${id}`),
      onSuccess: invalidate,
    });
  }

  /** Ручная сортировка: оптимистично переставляет кэш, при ошибке откатывает. */
  function useReorder() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (ids: number[]) => api.post<{ ok: true }>(`${url}/reorder`, { ids }),
      onMutate: async (ids) => {
        await qc.cancelQueries({ queryKey: listKey });
        const prev = qc.getQueryData<T[]>(listKey);
        if (prev) {
          const byId = new Map(prev.map((row) => [row.id, row]));
          qc.setQueryData(
            listKey,
            ids.map((id) => byId.get(id)).filter(Boolean) as T[],
          );
        }
        return { prev };
      },
      onError: (_err, _ids, ctx) => {
        if (ctx?.prev) qc.setQueryData(listKey, ctx.prev);
      },
      onSettled: () => qc.invalidateQueries({ queryKey: listKey }),
    });
  }

  return { useList, useCreate, useUpdate, useDelete, useReorder };
}
