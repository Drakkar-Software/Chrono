import { describe, expect, it } from 'vitest';

import { sortCompaniesByName } from './company.lib';

type Row = { id: string; content: Record<string, unknown>; slug: string | null };

const row = (id: string, name: string | null, slug: string | null = null): Row => ({
  id,
  content: name === null ? {} : { name },
  slug,
});

describe('sortCompaniesByName', () => {
  it('orders by display name, case-insensitively', () => {
    const sorted = sortCompaniesByName([
      row('1', 'zenith'),
      row('2', 'Atlas'),
      row('3', 'meridian'),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(['2', '3', '1']);
  });

  it('falls back to the slug when the name is blank', () => {
    const sorted = sortCompaniesByName([row('1', '  ', 'zulu'), row('2', null, 'alpha')]);
    expect(sorted.map((c) => c.id)).toEqual(['2', '1']);
  });

  it('breaks ties on id so the order is total', () => {
    const sorted = sortCompaniesByName([
      row('c', 'Same'),
      row('a', 'Same'),
      row('b', 'Same'),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input', () => {
    const input = [row('1', 'zenith'), row('2', 'Atlas')];
    sortCompaniesByName(input);
    expect(input.map((c) => c.id)).toEqual(['1', '2']);
  });
});
