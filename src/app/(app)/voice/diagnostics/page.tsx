import type { Metadata } from 'next';
import { VoiceDiagnostics } from '@/features/voice/diagnostics/VoiceDiagnostics';

// A hidden route: nothing in the app links here. It is opened by address, on the phone being checked.
export const metadata: Metadata = { title: 'Voice check', robots: { index: false, follow: false } };

export default function Page() {
  return <VoiceDiagnostics />;
}
