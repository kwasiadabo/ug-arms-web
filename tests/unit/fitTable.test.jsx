/**
 * Unit tests for tables that stack instead of scrolling sideways. The test browser has no layout, so widths are set
 * by hand.
 *
 * @author Kwasi Adabo Boakye
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FitTable } from '../../src/components/tables/FitTable.jsx';

/**
 * Sets the width of the measuring container and of the table's content for the next render.
 *
 * @param {number} container Width available.
 * @param {number} table Width the columns need.
 */
const widths = (container, table) => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(container);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(table);
};

const rows = (
  <>
    <thead>
      <tr>
        <th>Title</th>
        <th>Box</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td data-label="Title">Board minutes</td>
        <td data-label="Box">3</td>
      </tr>
    </tbody>
  </>
);

afterEach(() => vi.restoreAllMocks());

describe('FitTable', () => {
  it('keeps columns when they fit', () => {
    widths(1000, 1000);
    render(<FitTable watch={1}>{rows}</FitTable>);
    expect(screen.getByRole('table')).not.toHaveClass('table-stacked');
  });

  it('stacks rows when the columns are wider than the space', () => {
    widths(600, 900);
    render(<FitTable watch={1}>{rows}</FitTable>);
    expect(screen.getByRole('table')).toHaveClass('table-stacked');
    expect(screen.getByText('Board minutes')).toHaveAttribute('data-label', 'Title');
  });

  it('returns to columns once there is room for them', () => {
    widths(600, 900);
    const { rerender } = render(<FitTable watch={1}>{rows}</FitTable>);
    expect(screen.getByRole('table')).toHaveClass('table-stacked');
    vi.restoreAllMocks();
    widths(950, 900);
    rerender(<FitTable watch={2}>{rows}</FitTable>);
    expect(screen.getByRole('table')).not.toHaveClass('table-stacked');
  });
});
