'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icons/Icon';
import { useContainer } from '@/hooks/services';
import type { DemoAdapters } from '../adapters';
import { DemoController } from '../controller';
import { DemoPanel } from './DemoPanel';
import styles from './DemoRoot.module.css';

declare global {
  interface Window {
    __kskDemo?: DemoController;
  }
}

/** Applies ?preset=<id> once (presenter links, automated tests). */
function PresetFromUrl({ controller }: { readonly controller: DemoController }) {
  const preset = useSearchParams().get('preset');
  const applied = useRef(false);
  useEffect(() => {
    if (preset && !applied.current) {
      applied.current = true;
      void controller.applyPreset(preset);
    }
  }, [preset, controller]);
  return null;
}

/** DEMO ONLY. Hosts the presenter controls around the app; the product never imports this. */
export function DemoRoot({ demo, children }: { readonly demo: DemoAdapters; readonly children: ReactNode }) {
  const app = useContainer();
  const router = useRouter();
  const sheet = useRef<HTMLDialogElement>(null);
  const controller = useMemo(() => new DemoController(app, demo, (href) => router.push(href)), [app, demo, router]);

  useEffect(() => {
    window.__kskDemo = controller;
    return () => {
      delete window.__kskDemo;
    };
  }, [controller]);

  const close = () => sheet.current?.close();
  return (
    <div className={styles.layout}>
      <aside className={styles.side} aria-label="Demo controls">
        <DemoPanel demo={demo} controller={controller} />
      </aside>
      <div className={styles.app}>{children}</div>
      <button type="button" className={styles.pill} onClick={() => sheet.current?.showModal()} aria-label="Open demo controls">
        <Icon name="sliders" size={16} />
        <span className={styles.pillText}>DEMO</span>
      </button>
      <dialog ref={sheet} className={styles.sheet} aria-label="Demo controls" onClick={(e) => e.target === sheet.current && close()}>
        <div className={styles.sheetBar}>
          <button type="button" className={styles.close} onClick={close} aria-label="Close demo controls">
            <Icon name="x" size={20} />
          </button>
        </div>
        <DemoPanel demo={demo} controller={controller} onDone={close} />
      </dialog>
      <Suspense>
        <PresetFromUrl controller={controller} />
      </Suspense>
    </div>
  );
}
