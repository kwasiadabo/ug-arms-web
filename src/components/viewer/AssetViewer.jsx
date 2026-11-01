/**
 * Viewers for digital files: images, PDFs (pdf.js), audio, video and plain text. Files are always fetched through
 * short-lived delivery links; access is checked when a link is issued and again for every byte served. Text files
 * are shown in a fully sandboxed frame.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, FileText } from 'lucide-react';
import { api, errorMessage, apiUrl, API_BASE } from '../../lib/api.js';
import { Button, Skeleton, Alert } from '../ui/index.js';

/**
 * Requests a short-lived delivery link for a file.
 *
 * @param {string} assetId Identifier of the file.
 * @param {'inline'|'attachment'} [disposition='inline'] View or download.
 * @returns {import('@tanstack/react-query').UseQueryResult<{ url: string, canDownload: boolean }>}
 */
export function useDeliveryUrl(assetId, disposition = 'inline') {
  return useQuery({
    queryKey: ['asset-link', assetId, disposition],
    queryFn: () =>
      api
        .post(`/digital-assets/${assetId}/link`, { disposition })
        .then((r) => ({ ...r.data.data, url: apiUrl(r.data.data.url) })),
    enabled: Boolean(assetId),
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * Requests a download link for a file and starts the download.
 *
 * @param {string} assetId Identifier of the file.
 * @returns {Promise<void>}
 */
export async function downloadAsset(assetId) {
  const r = await api.post(`/digital-assets/${assetId}/link`, { disposition: 'attachment' });
  window.location.assign(apiUrl(r.data.data.url));
}

/**
 * Renders a PDF page by page on a canvas with paging and zoom. Script evaluation inside the PDF is disabled.
 *
 * @param {object} props
 * @param {string} props.url Delivery link.
 * @returns {JSX.Element|null}
 */
function PdfViewer({ url }) {
  const canvasRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    let task;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        task = pdfjs.getDocument({ url, withCredentials: true, isEvalSupported: false });
        const d = await task.promise;
        if (!cancelled) {
          setDoc(d);
          setPage(1);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
      task?.destroy?.();
    };
  }, [url]);
  useEffect(() => {
    if (!doc || !canvasRef.current) return undefined;
    let renderTask;
    let cancelled = false;
    doc.getPage(page).then((p) => {
      if (cancelled) return;
      const viewport = p.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const ratio = window.devicePixelRatio || 1;
      canvas.width = viewport.width * ratio;
      canvas.height = viewport.height * ratio;
      canvas.style.width = `${viewport.width}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      renderTask = p.render({ canvasContext: ctx, viewport });
    });
    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [doc, page, scale]);
  if (error) return <Alert tone="danger">The PDF could not be displayed: {error}</Alert>;
  if (!doc) return <Skeleton className="h-[480px] w-full" />;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronLeft}
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          aria-label="Previous page"
        />
        <span className="text-sm tabular-nums" aria-live="polite">
          Page {page} of {doc.numPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronRight}
          disabled={page >= doc.numPages}
          onClick={() => setPage((p) => p + 1)}
          aria-label="Next page"
        />
        <span className="mx-1 h-5 w-px bg-line" />
        <Button
          variant="secondary"
          size="sm"
          icon={ZoomOut}
          onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
          aria-label="Zoom out"
        />
        <Button
          variant="secondary"
          size="sm"
          icon={ZoomIn}
          onClick={() => setScale((s) => Math.min(3, s + 0.2))}
          aria-label="Zoom in"
        />
      </div>
      <div className="max-h-[75vh] overflow-auto rounded-lg border border-line bg-slate-100 p-3">
        <canvas ref={canvasRef} className="mx-auto block bg-white shadow" aria-label={`PDF page ${page}`} />
      </div>
    </div>
  );
}

/**
 * Shows a file with the viewer suited to its type, and a download button when downloading is allowed.
 *
 * @param {object} props
 * @param {object} props.asset The file.
 * @param {string} [props.title] Accessible title.
 * @returns {JSX.Element|null}
 */
export function AssetViewer({ asset, title }) {
  const { data, isLoading, error } = useDeliveryUrl(asset?.id);
  if (!asset) return null;
  if (isLoading) return <Skeleton className="h-[420px] w-full" />;
  if (error) return <Alert tone="warning">{errorMessage(error, 'This file is not available to view.')}</Alert>;
  const { mediaType } = asset;
  let body;
  if (mediaType?.startsWith('image/') && mediaType !== 'image/tiff')
    body = (
      <img
        src={data.url}
        alt={title || asset.title || asset.originalFilename || 'Archival image'}
        className="mx-auto max-h-[75vh] rounded-lg border border-line bg-slate-50 object-contain"
      />
    );
  else if (mediaType === 'application/pdf') body = <PdfViewer url={data.url} />;
  else if (mediaType?.startsWith('audio/'))
    body = (
      <audio controls preload="metadata" src={data.url} className="w-full">
        Your browser cannot play this audio.
      </audio>
    );
  else if (mediaType?.startsWith('video/'))
    body = (
      <video controls preload="metadata" src={data.url} className="max-h-[75vh] w-full rounded-lg bg-black">
        Your browser cannot play this video.
      </video>
    );
  else if (mediaType?.startsWith('text/') || mediaType === 'application/json')
    body = (
      <iframe
        title={title || 'Text file'}
        src={data.url}
        sandbox=""
        className="h-[60vh] w-full rounded-lg border border-line bg-white"
      />
    );
  else
    body = (
      <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas p-6 text-sm">
        <FileText className="h-6 w-6 text-ink-soft" />
        This format ({mediaType}) cannot be previewed in the browser.
      </div>
    );
  return (
    <div className="space-y-3">
      {body}
      {data.canDownload && (
        <Button variant="secondary" size="sm" icon={Download} onClick={() => downloadAsset(asset.id)}>
          Download
        </Button>
      )}
    </div>
  );
}

/**
 * Renders a lazily loaded thumbnail, or a decorative placeholder when there is none.
 *
 * @param {object} props
 * @param {string} [props.assetId] Thumbnail asset.
 * @param {string} [props.alt=''] Alternative text.
 * @returns {JSX.Element|null}
 */
export function Thumb({ assetId, alt = '', className }) {
  if (!assetId)
    return <div className={className ? `${className} bg-gradient-to-br from-brand-50 to-gold-50` : ''} aria-hidden />;
  return <img src={`${API_BASE}/public/thumbnails/${assetId}`} alt={alt} loading="lazy" className={className} />;
}
