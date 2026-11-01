/**
 * Unit tests for formatting helpers, the hierarchy rules that mirror the server, and permission-filtered
 * navigation.
 *
 * @author Kwasi Adabo Boakye
 */

import { describe, it, expect } from 'vitest';
import { humanize, fmtBytes } from '../../src/utils/format.js';
import { childLevels } from '../../src/features/archival-records/constants.js';
import { visibleNav } from '../../src/components/layout/nav.js';

describe('formatting', () => {
  it('humanises snake_case and camelCase identifiers', () => {
    expect(humanize('extentAndMedium')).toBe('Extent and medium');
    expect(humanize('partially_accepted')).toBe('Partially accepted');
    expect(humanize(null)).toBe('—');
  });
  it('formats byte sizes', () => {
    expect(fmtBytes(0)).toBe('0 B');
    expect(fmtBytes(1536)).toBe('1.5 KB');
  });
});

describe('archival hierarchy rules (mirrors the server)', () => {
  it('allows only fonds or collection at the top', () => {
    expect(childLevels(null)).toEqual(['fonds', 'collection']);
  });
  it('never allows a higher level beneath a lower one', () => {
    expect(childLevels('file')).toEqual(['item']);
    expect(childLevels('item')).toEqual([]);
    expect(childLevels('series')).toContain('subseries');
    expect(childLevels('subseries')).toContain('subseries');
  });
});

describe('navigation', () => {
  it('shows only sections the user has permissions for', () => {
    const liaison = visibleNav(['dashboard.view', 'transfer.submit']);
    const labels = liaison.flatMap((g) => g.items.map((i) => i.label));
    expect(labels).toContain('Transfer submissions');
    expect(labels).not.toContain('Users');
    expect(labels).not.toContain('Audit explorer');
  });
});
