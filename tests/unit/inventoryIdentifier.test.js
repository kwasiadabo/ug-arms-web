/**
 * Unit tests for the default identifiers given to new transfer inventory lines.
 *
 * @author Kwasi Adabo Boakye
 */

import { describe, it, expect } from 'vitest';
import { identifierPrefix, nextIdentifier } from '../../src/features/accessioning/inventoryIdentifier.js';

describe('identifierPrefix', () => {
  it('uses the unit code, cleaned up, or ITEM when there is none', () => {
    expect(identifierPrefix('HIST')).toBe('HIST');
    expect(identifierPrefix('hist ')).toBe('HIST');
    expect(identifierPrefix('')).toBe('ITEM');
    expect(identifierPrefix(undefined)).toBe('ITEM');
  });
});

describe('nextIdentifier', () => {
  it('starts the sequence at 001', () => {
    expect(nextIdentifier('HIST', [])).toBe('HIST/001');
    expect(nextIdentifier('HIST', ['', null])).toBe('HIST/001');
  });
  it('continues after the highest number, without reusing deleted ones', () => {
    expect(nextIdentifier('HIST', ['HIST/001', 'HIST/002'])).toBe('HIST/003');
    expect(nextIdentifier('HIST', ['HIST/001', 'HIST/007'])).toBe('HIST/008');
    expect(nextIdentifier('HIST', ['hist/4'])).toBe('HIST/005');
  });
  it('ignores identifiers typed in another form', () => {
    expect(nextIdentifier('HIST', ['H/1', 'Box 12', 'HIST/ADM/12'])).toBe('HIST/001');
  });
  it('never repeats an existing identifier', () => {
    expect(nextIdentifier('HIST', ['HIST/001', 'hist/002'])).toBe('HIST/003');
    expect(nextIdentifier('HIST', ['HIST/002', 'HIST/003', 'HIST/001'])).toBe('HIST/004');
  });
  it('treats dots and hyphens in the prefix literally', () => {
    expect(nextIdentifier('A.B', ['AXB/005'])).toBe('A.B/001');
  });
});
