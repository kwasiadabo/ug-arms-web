/**
 * Unit tests for registering an accession's boxes: the list of boxes, scanning barcodes one after another, the
 * request sent, and the message before approval.
 *
 * @author Kwasi Adabo Boakye
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { RegisterBoxesDialog } from '../../src/features/accessioning/RegisterBoxesDialog.jsx';
import { api } from '../../src/lib/api.js';
import { useAuth } from '../../src/store/auth.js';

const plan = (over = {}) => ({
  canRegister: true,
  registeredCount: 1,
  unboxedCount: 1,
  boxes: [
    { boxNumber: '1', registered: true, suggestedTitle: 'x', items: [{ id: 'a', description: 'Done' }] },
    {
      boxNumber: '2',
      registered: false,
      suggestedTitle: 'Board papers, Box 2 (UGA/TRF/2026/0016)',
      items: [
        { id: 'b', description: 'Minutes 1960' },
        { id: 'c', description: 'Minutes 1961' },
      ],
    },
    {
      boxNumber: 'Box 3',
      registered: false,
      suggestedTitle: 'Board papers, Box 3',
      items: [{ id: 'd', description: 'Files' }],
    },
  ],
  ...over,
});

/**
 * Renders the dialog with the API answering the box plan and the location search.
 *
 * @param {object} data The box plan.
 */
const show = (data) => {
  vi.spyOn(api, 'get').mockImplementation((url) =>
    Promise.resolve(
      url.includes('/boxes')
        ? { data: { data } }
        : { data: { data: [{ id: 'loc1', code: 'S-01', name: 'Shelf 1', occupancy: { used: 0 }, capacity: 10 }] } },
    ),
  );
  useAuth.setState({ user: { id: 'u', permissions: ['physical.move'] }, status: 'authenticated' });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <RegisterBoxesDialog accessionId="acc1" onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

afterEach(() => vi.restoreAllMocks());

describe('RegisterBoxesDialog', () => {
  it('lists only unregistered boxes, scans barcodes in turn and sends the boxes', async () => {
    const send = vi.spyOn(api, 'post').mockResolvedValue({ data: { data: [{}, {}] } });
    show(plan());
    expect(await screen.findByText('Box 2')).toBeInTheDocument();
    expect(screen.getByText('Box 3')).toBeInTheDocument();
    expect(screen.queryByText('Box 1')).not.toBeInTheDocument();
    expect(screen.getByText(/2 items: Minutes 1960; Minutes 1961/)).toBeInTheDocument();
    expect(screen.getByText(/1 accepted item\(s\) have no box number/)).toBeInTheDocument();

    const register = screen.getByRole('button', { name: 'Register 2 boxes' });
    expect(register).toBeDisabled();
    const [first, second] = screen.getAllByPlaceholderText('Scan or type');
    await userEvent.type(first, 'BX-0001{Enter}');
    expect(second).toHaveFocus();
    await userEvent.click(screen.getAllByLabelText('Generate')[1]);

    await userEvent.type(screen.getByPlaceholderText('Find a location by code or name…'), 'S-01');
    await userEvent.click(await screen.findByText(/S-01 — Shelf 1/));
    expect(register).toBeEnabled();
    await userEvent.click(register);
    expect(send).toHaveBeenCalledWith('/accessions/acc1/boxes', {
      boxes: [
        expect.objectContaining({ boxNumber: '2', barcode: 'BX-0001', generateBarcode: false, locationId: 'loc1' }),
        expect.objectContaining({ boxNumber: 'Box 3', generateBarcode: true, locationId: 'loc1' }),
      ],
    });
  });

  it('explains that boxes wait for approval', async () => {
    show(plan({ canRegister: false, reason: 'Boxes can be registered once the accession is approved' }));
    expect(await screen.findByText('Boxes can be registered once the accession is approved')).toBeInTheDocument();
  });
});
