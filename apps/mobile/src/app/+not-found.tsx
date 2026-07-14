import { Link, Stack } from 'expo-router';
import { Button, EmptyState, StackScreen } from '@chrono/ui';
import { useT } from '@/lib/i18n';

export default function NotFound() {
  const t = useT();
  return (
    <>
      <Stack.Screen options={{ title: t('landing.notFound.title') }} />
      <StackScreen title={t('landing.notFound.title')}>
        <EmptyState
          icon="help-circle-outline"
          title={t('landing.notFound.emptyTitle')}
          subtitle={t('landing.notFound.emptySubtitle')}
          action={
            <Link href="/" asChild>
              <Button title={t('landing.notFound.goHome')} />
            </Link>
          }
        />
      </StackScreen>
    </>
  );
}
