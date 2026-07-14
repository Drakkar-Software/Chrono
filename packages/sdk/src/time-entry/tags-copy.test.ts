import { describe, expect, it } from 'vitest';
import { allTags, buildCopiedEntries, parseTags, shiftEntryDate, summarizeByTag } from './time-entry.lib';

describe('parseTags', () => {
  it('splits, trims, lowercases and dedupes', () => {
    expect(parseTags('Dev, meeting ,dev\nSupport')).toEqual(['dev', 'meeting', 'support']);
    expect(parseTags('   ')).toEqual([]);
  });
});

describe('allTags / summarizeByTag', () => {
  const entries = [
    { tags: ['dev', 'meeting'], duration_minutes: 60 },
    { tags: ['dev'], duration_minutes: 30 },
    { tags: [], duration_minutes: 10 },
  ];
  it('lists distinct sorted tags', () => {
    expect(allTags(entries)).toEqual(['dev', 'meeting']);
  });
  it('sums minutes per tag (multi-tag counts under each)', () => {
    expect(summarizeByTag(entries)).toEqual({
      dev: { minutes: 90, count: 2 },
      meeting: { minutes: 60, count: 1 },
    });
  });
});

describe('shiftEntryDate / buildCopiedEntries', () => {
  it('shifts a date by whole days across month boundaries', () => {
    expect(shiftEntryDate('2026-07-30', 7)).toBe('2026-08-06');
    expect(shiftEntryDate('2026-03-03', -7)).toBe('2026-02-24');
  });
  it('clones entries shifted forward, keeping project/duration/tags', () => {
    const copied = buildCopiedEntries(
      [{ project_id: 'p1', entry_date: '2026-07-06', duration_minutes: 120, description: 'x', billable: true, tags: ['dev'] }],
      7,
    );
    expect(copied).toEqual([
      { project_id: 'p1', entry_date: '2026-07-13', duration_minutes: 120, description: 'x', billable: true, tags: ['dev'] },
    ]);
  });
});
