'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
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

/** Tablets and desktops keep the product usable while the panel is open (it overlays, never reflows). */
const WIDE = '(min-width: 600px)';

/**
 * DEMO ONLY. The presenter controls float over the product on every screen
 * size and start collapsed: a small "Demo" trigger. Phones open a bottom sheet
 * (modal); tablets and desktops open a drawer on the right that overlays the
 * app without taking layout space, so the presenter can keep using the app
 * while changing settings. The product never imports this.
 */
export function DemoRoot({ demo, children }: { readonly demo: DemoAdapters; readonly children: ReactNode }) {
  const app = useContainer();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLParagraphElement>(null);
  /** Opened with show() (drawer, no native Esc) rather than showModal() (sheet). `:modal` isn't in older WebViews. */
  const drawer = useRef(false);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const controller = useMemo(() => new DemoController(app, demo, (href) => router.push(href)), [app, demo, router]);

  useEffect(() => {
    window.__kskDemo = controller;
    return () => {
      delete window.__kskDemo;
    };
  }, [controller]);

  // The non-modal drawer gets no native Esc handling: add it while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !dialog.current?.open || !drawer.current) return;
      // A sheet or menu open on top of the app takes this Escape itself (native dialog cancel).
      if ([...document.querySelectorAll('dialog[open]')].some((d) => d !== dialog.current)) return;
      dialog.current.close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const show = () => {
    const d = dialog.current;
    if (!d || d.open) return;
    drawer.current = window.matchMedia(WIDE).matches;
    if (drawer.current) d.show();
    else d.showModal();
    // Start on the panel's title (not on a preset: one stray Enter must not switch the whole demo).
    title.current?.focus();
    setOpen(true);
  };
  const close = () => dialog.current?.close();

  return (
    <>
      {children}
      <button ref={trigger} type="button" className={styles.trigger} onClick={() => (open ? close() : show())} aria-label="Open demo controls" aria-expanded={open}>
        <Icon name="sliders" size={16} />
        <span className={styles.triggerText}>Demo</span>
      </button>
      <dialog
        ref={dialog}
        className={styles.panel}
        aria-labelledby={titleId}
        onClose={() => {
          setOpen(false);
          // Every way of closing (×, Esc, a preset) hands focus back to the trigger.
          trigger.current?.focus();
        }}
        onClick={(e) => e.target === dialog.current && close()}
      >
        <div className={styles.panelBar}>
          <p ref={title} id={titleId} className={styles.panelTitle} tabIndex={-1}>
            Demo controls
          </p>
          <button type="button" className={styles.close} onClick={close} aria-label="Close demo controls">
            <Icon name="x" size={20} />
          </button>
        </div>
        {/* Mounted only while open: nothing of the panel is in the page (or the accessibility tree) when collapsed. */}
        {open && <DemoPanel demo={demo} controller={controller} onDone={close} />}
      </dialog>
      <Suspense>
        <PresetFromUrl controller={controller} />
      </Suspense>
    </>
  );
}
