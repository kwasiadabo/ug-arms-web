/**
 * Unit tests for the inventory line form: the line checks (matching the server's) and the dialog's add, add another
 * and edit behaviour.
 *
 * @author Kwasi Adabo Boakye
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { validateLine, parseLineDate } from '../../src/features/accessioning/inventoryLine.js';
import { InventoryLineDialog } from '../../src/features/accessioning/InventoryLineDialog.jsx';

const KEYS = [
  'sourceIdentifier',
  'title',
  'dateExpression',
  'dateStart',
  'dateEnd',
  'format',
  'quantity',
  'extent',
  'boxNumber',
  'condition',
  'confidentiality',
  'notes',
];
const blank = (over = {}) => ({ ...Object.fromEntries(KEYS.map((k) => [k, ''])), ...over });

describe('validateLine', () => {
  it('accepts a line with only a title', () => {
    expect(validateLine(blank({ title: 'Minutes' }), [])).toEqual({});
  });
  it('requires a title', () => {
    expect(validateLine(blank({ title: '  ' }), []).title).toBeDefined();
  });
  it('checks date forms and order', () => {
    expect(parseLineDate('15/03/1962')).toBe('1962-03-15');
    expect(validateLine(blank({ title: 'x', dateStart: '1962-13-40' }), []).dateStart).toBeDefined();
    expect(validateLine(blank({ title: 'x', dateStart: '1970', dateEnd: '1965' }), []).dateEnd).toMatch(/before/);
    expect(validateLine(blank({ title: 'x', dateStart: '1960', dateEnd: '31/12/1965' }), [])).toEqual({});
  });
  it('requires a positive whole quantity when given', () => {
    expect(validateLine(blank({ title: 'x', quantity: '0' }), []).quantity).toBeDefined();
    expect(validateLine(blank({ title: 'x', quantity: '2.5' }), []).quantity).toBeDefined();
    expect(validateLine(blank({ title: 'x', quantity: '3' }), [])).toEqual({});
  });
  it('refuses an identifier another line uses, ignoring case', () => {
    expect(
      validateLine(blank({ title: 'x', sourceIdentifier: 'hist/001' }), ['HIST/001']).sourceIdentifier,
    ).toBeDefined();
  });
});

describe('InventoryLineDialog', () => {
  it('shows every field at once and adds a valid line', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(
      <InventoryLineDialog
        open
        onClose={onClose}
        line={blank({ sourceIdentifier: 'HIST/001' })}
        lineNumber={null}
        otherIdentifiers={[]}
        prefix="HIST"
        onSubmit={onSubmit}
      />,
    );
    for (const label of [
      'Identifier',
      'Format',
      'Title / description',
      'Dates as written',
      'From',
      'To',
      'Quantity',
      'Extent',
      'Box',
      'Condition',
      'Confidentiality',
      'Notes',
    ])
      expect(screen.getByLabelText(new RegExp(`^${label.replace('/', '\\/')}`))).toBeInTheDocument();
    expect(screen.getByLabelText(/^Identifier/)).toHaveValue('HIST/001');
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a title')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Title/), 'Board minutes');
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ sourceIdentifier: 'HIST/001', title: 'Board minutes' }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the form open with the next identifier after "Add and add another"', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(
      <InventoryLineDialog
        open
        onClose={onClose}
        line={blank({ sourceIdentifier: 'HIST/001' })}
        lineNumber={null}
        otherIdentifiers={[]}
        prefix="HIST"
        onSubmit={onSubmit}
      />,
    );
    await userEvent.type(screen.getByLabelText(/^Title/), 'Board minutes');
    await userEvent.click(screen.getByRole('button', { name: 'Add and add another' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Identifier/)).toHaveValue('HIST/002');
    expect(screen.getByLabelText(/^Title/)).toHaveValue('');
    expect(screen.getByText(/1 line added/)).toBeInTheDocument();
  });

  it('edits an existing line', async () => {
    const onSubmit = vi.fn();
    render(
      <InventoryLineDialog
        open
        onClose={() => {}}
        line={blank({ sourceIdentifier: 'HIST/002', title: 'Old title' })}
        lineNumber={2}
        otherIdentifiers={['HIST/001']}
        prefix="HIST"
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText('Edit line 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add and add another' })).not.toBeInTheDocument();
    const title = screen.getByLabelText(/^Title/);
    await userEvent.clear(title);
    await userEvent.type(title, 'New title');
    await userEvent.click(screen.getByRole('button', { name: 'Update line' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ sourceIdentifier: 'HIST/002', title: 'New title' }),
    );
  });
});
