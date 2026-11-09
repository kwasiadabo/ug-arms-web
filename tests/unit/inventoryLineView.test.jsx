/**
 * Unit tests for the read-only inventory line view used while a transfer is reviewed.
 *
 * @author Kwasi Adabo Boakye
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryLineView } from '../../src/features/accessioning/InventoryLineView.jsx';

const items = [
  {
    id: 'a',
    sourceIdentifier: 'HIST/001',
    title: 'Board minutes',
    dateStart: '1960-01-01',
    extent: '0.5 linear metres',
    boxNumber: '3',
    quantity: 2,
    decision: 'accepted',
    decisionNote: 'Permanent value',
  },
  { id: 'b', sourceIdentifier: 'HIST/002', title: 'Duplicate copies', quantity: 1, decision: 'pending' },
];

describe('InventoryLineView', () => {
  it('shows every field, marks empty ones and shows the decision', () => {
    render(<InventoryLineView items={items} index={0} onChange={() => {}} />);
    expect(screen.getByText('Line 1 of 2')).toBeInTheDocument();
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
      expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText('0.5 linear metres')).toBeInTheDocument();
    expect(screen.getAllByText('Not given').length).toBe(6);
    expect(screen.getByText('Permanent value')).toBeInTheDocument();
  });

  it('steps between lines and hides an undecided decision', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<InventoryLineView items={items} index={0} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onChange).toHaveBeenCalledWith(1);
    rerender(<InventoryLineView items={items} index={1} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.queryByText('Decision:')).not.toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<InventoryLineView items={items} index={null} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
