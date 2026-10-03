'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { completenessIssues, countMarks } from '@/domain/marking';
import type { Mark, StatusCode } from '@/domain/status';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { routes } from '@/lib/routes';
import type { RosterData } from '@/services/attendance';

const NO_MARKS: Readonly<Record<string, Mark>> = {};

/**
 * Roster state on the live draft (D-084): taps and voice write the same draft, every change is saved
 * at once (it survives a dropped connection, PRD §16.1), and each row keeps its object unless it changed.
 */
export function useRoster(key: string) {
  const ctx = useSession();
  const { attendance, drafts } = useServices();
  const router = useRouter();
  const [roster, setRoster] = useState<RosterData | null>(null);
  const [attention, setAttention] = useState(false);

  useEffect(() => {
    let alive = true;
    void attendance.openRoster(ctx, key).then((result) => {
      if (!alive) return;
      if (!result.ok) {
        // submitted elsewhere: a live draft of it is stale (a voice code bound to it must not survive)
        if (result.error === 'already_submitted') drafts.close(key, { kind: 'closed', via: 'system' });
        router.replace(result.error === 'already_submitted' ? routes.record(key) : routes.open(key));
        return;
      }
      // openRoster already merged the saved draft; the same configuration keeps the live one (no reverted taps).
      drafts.open(ctx, result.value);
      setRoster(result.value);
    });
    return () => {
      alive = false;
    };
  }, [attendance, drafts, ctx, key, router]);

  const snapshot = useSyncExternalStore(
    useCallback((onChange: () => void) => drafts.subscribe(key, onChange), [drafts, key]),
    () => drafts.get(key),
    () => undefined,
  );
  const marks = snapshot?.marks ?? NO_MARKS;

  const onStatus = useCallback((id: string, status: StatusCode) => void drafts.setMark(key, id, { status }, { via: 'tap' }), [drafts, key]);
  const onDetail = useCallback((id: string, mark: Mark) => void drafts.setMark(key, id, mark, { via: 'tap' }), [drafts, key]);

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
      requestAnimationFrame(() => (row?.querySelector<HTMLElement>('[data-needs] [role="radio"]') ?? row?.querySelector<HTMLElement>('select'))?.focus({ preventScroll: true }));
      return;
    }
    await drafts.flush(key);
    router.push(routes.review(key));
  }, [issues, drafts, key, router]);

  return { roster, marks, counts, issues, attention, onStatus, onDetail, goToReview };
}
