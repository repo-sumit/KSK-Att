'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/icons/Icon';
import { Latin } from '@/components/ui/Latin';
import { InlineBackBar } from '@/components/shell/Headers';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { useT } from '@/hooks/i18n';
import { routes } from '@/lib/routes';
import { useLoginFlow } from './LoginFlow';
import styles from './Login.module.css';

/** Step 2: show the institute's name and district; a wrong code becomes visible here (PRD §6.3). */
export function ConfirmInstituteScreen() {
  const t = useT();
  const router = useRouter();
  const flow = useLoginFlow();
  const institute = flow.institute;

  useEffect(() => {
    if (!institute) router.replace(routes.login);
  }, [institute, router]);
  if (!institute) return null;

  const deny = () => {
    flow.reset();
    router.replace(routes.login);
  };

  return (
    <ScreenLayout
      card
      surface="default"
      banner={false}
      padding="none"
      header={<InlineBackBar onBack={deny} />}
      footer={
        <>
          <Button fullWidth onClick={() => router.push(routes.loginTrainer)}>
            {t('login.yesContinue')}
          </Button>
          <Button variant="secondary" fullWidth onClick={deny}>
            {t('login.changeInstitute')}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <h1 className={styles.title}>{t('login.instituteTitle')}</h1>
        <div className={styles.card}>
          <span className={styles.well} aria-hidden="true">
            <Icon name="building" size={24} />
          </span>
          <div className={styles.cardText}>
            <p className={styles.instName}>
              <Latin>{institute.name}</Latin>
            </p>
            <p className={styles.instPlace}>
              <Latin>{t('login.instituteLocation', { locality: institute.locality, district: institute.district })}</Latin>
            </p>
            <p className={styles.instCode}>{t('login.instituteCode', { code: institute.code })}</p>
          </div>
        </div>
      </div>
    </ScreenLayout>
  );
}
