'use client';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { useT } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { routes } from '@/lib/routes';
import { LoginAssistButton } from './LoginAssistButton';
import { useLoginFlow } from './LoginFlow';
import styles from './Login.module.css';

const FORM_ID = 'institute-code';
const INPUT_ID = 'institute-code-input';

/** Step 1 (PRD §6.1): the institute code, checked live before anything else is asked. */
export function InstituteCodeScreen() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const { auth, configuration } = useServices();
  const flow = useLoginFlow();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    const result = await auth.lookupInstitute(code);
    setBusy(false);
    if (!result.ok) {
      setError(result.error === 'invalid_format' ? t('login.codeInvalid') : t('login.codeNotFound', { code }));
      return;
    }
    flow.setInstitute(result.value);
    router.push(configuration.base().identity.instituteConfirmStep ? routes.loginInstitute : routes.loginTrainer);
  };

  return (
    <ScreenLayout
      card
      surface="default"
      banner={false}
      padding="none"
      footer={
        <Button type="submit" form={FORM_ID} fullWidth disabled={!code.trim()} loading={busy}>
          {busy ? t('common.checking') : t('common.continue')}
        </Button>
      }
    >
      <div className={`${styles.body} ${styles.bodyFirst}`}>
        <div className={styles.lockup}>
          <Image src="/branding/ksk-emblem.png" alt={t('app.emblemAlt')} width={72} height={72} className={styles.emblem} priority />
          <div className={styles.lockupText}>
            <p className={styles.brandName}>{t('app.name')}</p>
            <p className={styles.brandState}>{t('app.state')}</p>
          </div>
        </div>
        <form id={FORM_ID} className={styles.form} onSubmit={submit} noValidate>
          <div className={styles.heading}>
            <h1 className={styles.title}>{t('login.codeTitle')}</h1>
            <p className={styles.hint}>{t('login.codeHint')}</p>
          </div>
          <Input
            id={INPUT_ID}
            label={t('login.codeLabel')}
            value={code}
            onChange={(v) => {
              setCode(v.replace(/\D/g, '').slice(0, 6));
              setError(undefined);
            }}
            placeholder={t('login.codePlaceholder')}
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="go"
            latin
            error={error}
          />
          <LoginAssistButton
            field="instituteCode"
            inputId={INPUT_ID}
            onFill={(v) => {
              setCode(v);
              setError(undefined);
            }}
          />
        </form>
      </div>
    </ScreenLayout>
  );
}
