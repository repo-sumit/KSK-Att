// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useLayoutEffect, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { VoiceDiagnostics } from '@/features/voice/diagnostics/VoiceDiagnostics';
import { I18nProvider } from '@/hooks/i18n';
import { ServicesProvider } from '@/hooks/services';
import { probeEnvironment, testMicrophone } from '@/services/voice/audio/probes';
import { setup } from '../../helpers/app';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/hooks/session', () => ({ useSession: () => ({ journey: { voice: { enabled: true } } }) }));
// The screen's frame and header are not under test here.
vi.mock('@/components/shell/ScreenLayout', () => ({ ScreenLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/features/shell/AppHeader', () => ({ AppHeader: () => null }));
vi.mock('@/services/voice/audio/types', () => ({ audioSupported: () => true }));

/** Whether the screen had committed when the environment probe ran (set by a layout effect beside it). */
const probe = vi.hoisted(() => ({ committed: false, calledCommitted: [] as boolean[] }));
vi.mock('@/services/voice/audio/probes', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/services/voice/audio/probes')>();
  return {
    ...real,
    probeEnvironment: vi.fn(() => {
      probe.calledCommitted.push(probe.committed);
      return [{ id: 'secureContext', status: 'pass' }];
    }),
    testMicrophone: vi.fn(),
    testSpeaker: vi.fn(() => ({ id: 'speaker', status: 'info' })),
  };
});

afterEach(cleanup);

function Committed() {
  useLayoutEffect(() => {
    probe.committed = true;
  });
  return null;
}

function renderScreen() {
  const { app } = setup({ voice: { enabled: true } });
  return render(
    <ServicesProvider container={app}>
      <I18nProvider>
        <ToastProvider>
          <VoiceDiagnostics />
          <Committed />
        </ToastProvider>
      </I18nProvider>
    </ServicesProvider>,
  );
}

describe('VoiceDiagnostics', () => {
  it('runs the environment probe (two AudioContexts) after the screen mounts, never while rendering (C11)', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByRole('list', { name: 'Checks' })).toBeInTheDocument());
    expect(probeEnvironment).toHaveBeenCalledTimes(1);
    expect(probe.calledCommitted).toEqual([true]);
  });

  it('a microphone test that rejects ends with a failed row and an enabled button (C13)', async () => {
    vi.mocked(testMicrophone).mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }));
    renderScreen();
    const button = await screen.findByRole('button', { name: 'Test microphone' });
    fireEvent.click(button);
    const mic = await screen.findByRole('list', { name: 'Microphone' });
    expect(mic).toHaveTextContent('Microphone test');
    expect(mic).toHaveTextContent('Fail');
    expect(mic).toHaveTextContent('AbortError');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Test microphone' })).toBeEnabled());
    expect(screen.getByText(/\[FAIL\] Microphone test: AbortError/)).toBeInTheDocument();
  });
});
