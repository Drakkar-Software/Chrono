import { Link, Stack } from 'expo-router';
import { Button, EmptyState, StackScreen } from '@chrono/ui';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <StackScreen title="Not found">
        <EmptyState
          icon="help-circle-outline"
          title="This page doesn't exist"
          subtitle="The link may be broken or the page may have moved."
          action={
            <Link href="/" asChild>
              <Button title="Go home" />
            </Link>
          }
        />
      </StackScreen>
    </>
  );
}
