import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthError } from "@/auth/api";
import { useHabitSource } from "@/hooks/useHabitSource";
import { useI18n } from "@/i18n/context";
import { queryKeys } from "@/lib/query/queryKeys";
import type { Habit } from "@/lib/types/habit";
import { habitDay, progressToday } from "@/lib/utils/habits";

const terminalCodes = new Set(["SESSION_CHANGED", "UNAUTHENTICATED", "FORBIDDEN", "INVALID_HABIT_PROGRESS", "HABIT_NOT_FOUND"]);

export function useHabitQuickProgress(habit: Habit) {
  const client = useQueryClient();
  const { source } = useHabitSource();
  const { t } = useI18n();
  const serverValue = progressToday(habit);
  const [value, setValue] = useState(serverValue);
  const [pending, setPending] = useState(false);
  const confirmed = useRef(serverValue);
  const desired = useRef(serverValue);
  const running = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);
  const { mutateAsync } = useMutation({
    mutationFn: source.setProgress,
    retry: (failureCount, error) =>
      failureCount < 2 && error instanceof AuthError && !terminalCodes.has(error.code),
    retryDelay: 150,
  });
  const updateHabitCache = useCallback((next: number) => {
    client.setQueriesData<Habit[]>({ queryKey: queryKeys.habits }, (items) =>
      items?.map((item) => item.id === habit.id
        ? { ...item, progress: next, recordedOn: habitDay() }
        : item),
    );
  }, [client, habit.id]);
  const refreshSummaries = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.habits }),
      client.invalidateQueries({ queryKey: queryKeys.dashboard }),
      client.invalidateQueries({ queryKey: queryKeys.reports }),
    ]);
  }, [client]);

  useEffect(() => {
    if (running.current) return;
    confirmed.current = serverValue;
    desired.current = serverValue;
    setValue(serverValue);
  }, [serverValue]);

  const flush = useCallback(async () => {
    if (running.current || desired.current === confirmed.current) return;
    running.current = true;
    setPending(true);
    let acknowledged = false;
    try {
      while (desired.current !== confirmed.current) {
        const target = desired.current;
        await mutateAsync({ id: habit.id, value: target });
        confirmed.current = target;
        acknowledged = true;
      }
      await refreshSummaries();
      if (acknowledged && desired.current === confirmed.current) {
        toast.success(t("habits.ui.progressUpdated"));
      }
    } catch (error) {
      desired.current = confirmed.current;
      setValue(confirmed.current);
      updateHabitCache(confirmed.current);
      await refreshSummaries();
      if (!(error instanceof AuthError && ["SESSION_CHANGED", "UNAUTHENTICATED"].includes(error.code))) {
        toast.error(t("habits.ui.failed"));
      }
    } finally {
      running.current = false;
      setPending(false);
      if (desired.current !== confirmed.current) {
        queueMicrotask(() => void flushRef.current());
      }
    }
  }, [habit.id, mutateAsync, refreshSummaries, t, updateHabitCache]);
  flushRef.current = flush;

  const setProgress = useCallback((next: number) => {
    const safe = Math.max(0, Math.min(100000, Math.trunc(next)));
    if (safe === desired.current) return;
    desired.current = safe;
    setValue(safe);
    updateHabitCache(safe);
    void flushRef.current();
  }, [updateHabitCache]);
  const adjust = useCallback((delta: number) => {
    setProgress(desired.current + delta);
  }, [setProgress]);

  return { value, pending, adjust, setProgress };
}
