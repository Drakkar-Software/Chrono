import { Fragment } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Txt, spacing, radii, useTheme } from '@chrono/ui';
import { markdownToBlocks, parseInline, type InlineSegment } from '@chrono/sdk';

function Inline({ segments }: { segments: InlineSegment[] }) {
  const { colors } = useTheme();
  return (
    <>
      {segments.map((s, i) => (
        <Txt
          key={i}
          variant="body"
          weight={s.bold ? 'bold' : undefined}
          style={[
            s.italic ? styles.italic : null,
            s.code ? [styles.code, { backgroundColor: colors.fill }] : null,
            s.href ? { color: colors.accent, textDecorationLine: 'underline' } : null,
          ]}
          onPress={s.href ? () => void Linking.openURL(s.href!) : undefined}
        >
          {s.text}
        </Txt>
      ))}
    </>
  );
}

/** Native article renderer: markdown blocks → themed Txt/View. */
export function ArticleBody({ markdown }: { markdown: string }) {
  const { colors } = useTheme();
  const blocks = markdownToBlocks(markdown);

  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading':
            return (
              <Txt key={i} variant={b.level === 1 ? 'title' : b.level === 2 ? 'heading' : 'bodyMedium'} weight="bold" style={styles.heading}>
                {b.text}
              </Txt>
            );
          case 'quote':
            return (
              <View key={i} style={[styles.quote, { borderLeftColor: colors.accent }]}>
                <Txt variant="body" tone="text" style={styles.italic}>
                  {b.text}
                </Txt>
              </View>
            );
          case 'hr':
            return <View key={i} style={[styles.hr, { backgroundColor: colors.border }]} />;
          case 'list':
            return (
              <View key={i} style={styles.list}>
                {b.items.map((item, j) => (
                  <View key={j} style={styles.listItem}>
                    <Txt variant="body" tone="textMuted">{b.ordered ? `${j + 1}.` : '•'}</Txt>
                    <Txt variant="body" tone="textMuted" style={styles.listText}>
                      <Inline segments={parseInline(item)} />
                    </Txt>
                  </View>
                ))}
              </View>
            );
          case 'paragraph':
          default:
            return (
              <Txt key={i} variant="body" tone="textMuted" style={styles.paragraph}>
                <Inline segments={parseInline(b.text)} />
              </Txt>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  heading: { marginTop: spacing.lg, marginBottom: spacing.sm },
  paragraph: { marginBottom: spacing.md, lineHeight: 26 },
  italic: { fontStyle: 'italic' },
  code: { borderRadius: radii.sm, paddingHorizontal: 4 },
  quote: { borderLeftWidth: 3, paddingLeft: spacing.md, marginVertical: spacing.md },
  hr: { height: 1, marginVertical: spacing.lg },
  list: { marginBottom: spacing.md, gap: spacing.xs },
  listItem: { flexDirection: 'row', gap: spacing.sm },
  listText: { flex: 1, lineHeight: 26 },
});
