'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Latin } from '@/components/ui/Latin';
import { InlineBackBar } from '@/components/shell/Headers';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { useT } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { routes } from '@/lib/routes';
import { finishLogin } from './finishLogin';
import { useLoginFlow } from './LoginFlow';
import styles from './Login.module.css';

const FORM_ID = 'trainer-id';

/** Step 3 (PRD §6.2): the Trainer ID, checked against the confirmed institute only. */
export function TrainerIdScreen() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const services = useServices();
  const flow = useLoginFlow();
  const institute = flow.institute;
  const [trainerId, setTrainerId] = useState(params.get('tid') ?? '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!institute) router.replace(routes.login);
  }, [institute, router]);
  if (!institute) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!trainerId.trim() || busy) return;
    setBusy(true);
    const result = await services.auth.lookupInstructor(institute.id, trainerId);
    if (!result.ok) {
      setBusy(false);
      setError(result.error === 'invalid_format' ? t('login.trainerInvalid') : t('login.trainerNotFound', { institute: institute.shortName }));
      return;
    }
    flow.setInstructor(result.value);
    if (services.configuration.base().identity.instructorConfirmStep) {
      setBusy(false);
      router.push(routes.loginIdentity);
      return;
    }
    router.replace(await finishLogin(services, institute.id, result.value.id));
  };

  return (
    <ScreenLayout
      surface="default"
      banner={false}
      padding="none"
      header={<InlineBackBar onBack={() => router.back()} />}
      footer={
        <Button type="submit" form={FORM_ID} fullWidth disabled={!trainerId.trim()} loading={busy}>
          {busy ? t('common.checking') : t('common.continue')}
        </Button>
      }
    >
      <form id={FORM_ID} className={styles.body} onSubmit={submit} noValidate>
        <div className={styles.heading}>
          <h1 className={styles.title}>{t('login.trainerTitle')}</h1>
          <p className={styles.hint}>
            <Latin>{institute.shortName}</Latin>
          </p>
        </div>
        <Input
          label={t('login.trainerLabel')}
          value={trainerId}
          onChange={(v) => {
            setTrainerId(v.toUpperCase().slice(0, 12));
            setError(undefined);
          }}
          placeholder={t('login.trainerPlaceholder')}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          latin
          error={error}
        />
      </form>
    </ScreenLayout>
  );
}
