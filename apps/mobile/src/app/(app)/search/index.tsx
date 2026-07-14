import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, EmptyState, StackScreen, TextField, Txt, spacing } from '@chrono/ui';
import { companyCurrency, searchAll } from '@chrono/sdk';
import type { SearchResults } from '@chrono/sdk';

import { useT } from '@/lib/i18n';
import { globalSupabaseClient } from '@/lib/supabase';
import { useActiveCompany } from '@/lib/active-company-context';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { InvoiceCard } from '@/components/invoices/InvoiceCard';
import { TimeEntryRow } from '@/components/time/TimeEntryRow';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ScreenLoader } from '@/components/common/ScreenLoader';

const EMPTY: SearchResults = { projects: [], entries: [], invoices: [] };

export default function SearchScreen() {
  const t = useT();
  const router = useRouter();
  const { companyId, company } = useActiveCompany();
  const currency = companyCurrency(company);

  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = term.trim();
    const mine = ++seq.current;
    // All state updates happen inside the timeout callback (never synchronously
    // in the effect body) so a keystroke can't trigger a cascading render.
    const handle = setTimeout(async () => {
      if (!companyId || q.length < 2) {
        if (mine === seq.current) {
          setResults(EMPTY);
          setLoading(false);
        }
        return;
      }
      if (mine === seq.current) setLoading(true);
      try {
        const res = await searchAll(globalSupabaseClient, companyId, q);
        if (mine === seq.current) setResults(res);
      } catch {
        if (mine === seq.current) setResults(EMPTY);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, q.length < 2 ? 0 : 300);
    return () => clearTimeout(handle);
  }, [term, companyId]);

  const total = results.projects.length + results.entries.length + results.invoices.length;
  const showEmpty = term.trim().length >= 2 && !loading && total === 0;

  return (
    <StackScreen title={t('common.search')} onBack={() => router.back()}>
      <View style={styles.wrap}>
        <TextField
          label={t('common.search')}
          value={term}
          onChangeText={setTerm}
          placeholder={t('details.searchPlaceholder')}
          autoCapitalize="none"
        />

        {loading ? <ScreenLoader fill={false} /> : null}

        {showEmpty ? (
          <EmptyState icon="search-outline" title={t('details.noMatches')} subtitle={t('details.noMatchesSubtitle')} />
        ) : null}

        {results.projects.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t('details.projects')} count={results.projects.length} />
            {results.projects.map((p) => (
              <ProjectCard key={p.id} project={p} currency={currency} onPress={() => router.push(`/project/${p.id}`)} />
            ))}
          </View>
        ) : null}

        {results.invoices.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t('details.invoices')} count={results.invoices.length} />
            {results.invoices.map((i) => (
              <InvoiceCard key={i.id} invoice={i} currency={currency} onPress={() => router.push(`/invoice/${i.id}`)} />
            ))}
          </View>
        ) : null}

        {results.entries.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t('details.timeEntries')} count={results.entries.length} />
            <Card padding="lg" style={styles.entries}>
              {results.entries.map((e) => (
                <TimeEntryRow key={e.id} entry={e} />
              ))}
            </Card>
          </View>
        ) : null}

        {term.trim().length < 2 ? (
          <Txt variant="caption" tone="textMuted">
            {t('details.typeTwoChars')}
          </Txt>
        ) : null}
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  section: { gap: spacing.sm },
  entries: { gap: spacing.xs },
});
