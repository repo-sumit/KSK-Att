import { Latin } from '@/components/ui/Latin';
import type { Batch, Trade } from '@/domain/entities';
import { useT } from '@/hooks/i18n';
import { batchTitle } from './labels';

/**
 * "Electrician · Shift 1 · Unit 2" with only the trade name marked as Latin
 * master data: in Marathi "शिफ्ट 1 · युनिट 2" must not be read out as English.
 */
export function BatchLabel({ trade, batch }: { readonly trade: Trade; readonly batch: Batch }) {
  const t = useT();
  return (
    <>
      <Latin>{trade.name}</Latin>
      {' · '}
      {batchTitle(t, batch)}
    </>
  );
}
