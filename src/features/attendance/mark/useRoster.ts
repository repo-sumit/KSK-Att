'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { completenessIssues, countMarks } from '@/domain/marking';
import type { Mark, StatusCode } from '@/domain/status';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { routes } from '@/lib/routes';
import type { RosterData } from '@/services/attendance';
import { markReducer } from './markReducer';

const DRAFT_DEBOUNCE_MS = 300;

/** Roster state: one reducer, stable callbacks, a debounced draft that survives a dropped connection (PRD §16.1). */
export function useRoster(key: string) {
  const ctx = useSession();
  const { attendance } = useServices();
  const router = useRouter();
  const [roster, setRoster] = useState<RosterData | null>(null);
  const [marks, dispatch] = useReducer(markReducer, {});
  const [attention, setAttention] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingSave = useRef<(() => void) | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    void attendance.openRoster(ctx, key).then((result) => {
      if (!alive) return;
      if (!result.ok) {
        router.replace(result.error === 'already_submitted' ? routes.record(key) : routes.open(key));
        return;
      }
      loaded.current = true;
      setRoster(result.value);
      dispatch({ type: 'reset', marks: result.value.marks });
    });
    return () => {
      alive = false;
    };
    // Load once per session key; configuration changes arrive as a new session (and a reload).
  }, [attendance, ctx, key, router]);

  // Debounced draft persistence; never blocks a tap.
  useEffect(() => {
    if (!loaded.current || !roster) return;
    const save = () => {
      pendingSave.current = null;
      void attendance.saveDraft(ctx, key, marks);
    };
    pendingSave.current = save;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(saveTimer.current);
  }, [marks, roster, attendance, ctx, key]);
  // Leaving the roster within the debounce (one click on the header navigation) still keeps the last taps.
  useEffect(() => {
    const pending = pendingSave;
    return () => pending.current?.();
  }, []);

  const onStatus = useCallback((id: string, status: StatusCode) => dispatch({ type: 'status', id, status }), []);
  const onDetail = useCallback((id: string, mark: Mark) => dispatch({ type: 'detail', id, mark }), []);

  const counts = useMemo(() => countMarks(marks), [marks]);
  const issues = useMemo(() => completenessIssues(marks, ctx.config.marking), [marks, ctx.config.marking]);

  /** INV-02: Review must count from exactly these marks, so the draft is flushed before navigating. */
  const goToReview = useCallback(async () => {
    if (issues.length) {
      setAttention(true);
      const first = issues[0].studentIds[0];
      const row = document.querySelector<HTMLElement>(`[data-student="${first}"]`);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      row?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      // Keyboard, switch and screen-reader users land on the control that still needs a choice.
      requestAnimationFrame(() => row?.querySelector<HTMLElement>('[data-needs] button, select')?.focus({ preventScroll: true }));
      return;
    }
    clearTimeout(saveTimer.current);
    pendingSave.current = null;
    await attendance.saveDraft(ctx, key, marks);
    router.push(routes.review(key));
  }, [issues, attendance, ctx, key, marks, router]);

  return { roster, marks, counts, issues, attention, onStatus, onDetail, goToReview };
}
