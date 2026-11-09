/**
 * Unit tests for the supporting-document preview: which types are shown, how text is shown, and the download-only
 * fallback.
 *
 * @author Kwasi Adabo Boakye
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentPreview, canPreview } from '../../src/components/viewer/DocumentPreview.jsx';
import { api } from '../../src/lib/api.js';

/**
 * Renders the preview inside a fresh query client.
 *
 * @param {object} doc The document.
 */
const show = (doc) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentPreview doc={doc} basePath="/transfers/t1/documents" onClose={() => {}} />
    </QueryClientProvider>,
  );

afterEach(() => vi.restoreAllMocks());

describe('canPreview', () => {
  it('accepts PDF, JPEG, PNG, text and CSV only', () => {
    for (const t of ['application/pdf', 'image/jpeg', 'image/png', 'text/plain', 'text/csv'])
      expect(canPreview(t)).toBe(true);
    for (const t of [
      'image/tiff',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ])
      expect(canPreview(t)).toBe(false);
  });
});

describe('DocumentPreview', () => {
  it('fetches a CSV in preview mode and shows it as plain text', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: 'Identifier,Title\nH/1,<b>Minutes</b>' });
    show({ id: 'd1', originalFilename: 'list.csv', mediaType: 'text/csv', sizeBytes: 40 });
    expect(await screen.findByText(/H\/1,<b>Minutes<\/b>/)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/transfers/t1/documents/d1', {
      params: { preview: 'true' },
      responseType: 'text',
    });
  });

  it('offers a download instead for types the browser cannot show', () => {
    const get = vi.spyOn(api, 'get');
    show({
      id: 'd2',
      originalFilename: 'memo.docx',
      mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    expect(screen.getByText(/cannot be shown in the browser/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it("shows the server's reason when a preview is refused", async () => {
    const body = new TextEncoder().encode(
      JSON.stringify({
        error: { message: 'This document could not be scanned for malware and is held until it is re-scanned' },
      }),
    ).buffer;
    vi.spyOn(api, 'get').mockRejectedValue({ response: { status: 409, data: body } });
    show({ id: 'd3', originalFilename: 'scan.pdf', mediaType: 'application/pdf' });
    expect(await screen.findByText(/held until it is re-scanned/)).toBeInTheDocument();
  });
});
