/**
 * Preview dialog for supporting documents attached to transfers and accessions.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { api, download, errorMessage } from '../../lib/api.js';
import { Alert, Button, Dialog, Skeleton } from '../ui/index.js';
import { PdfViewer } from './AssetViewer.jsx';
import { fmtBytes, fmtDateTime } from '../../utils/format.js';

// Types the browser can show safely. Word, Excel and TIFF files are offered as downloads instead.
const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const TEXT_TYPES = ['text/plain', 'text/csv'];
const TEXT_LIMIT = 200_000;

/**
 * Tells whether a document's type can be previewed in the browser.
 *
 * @param {string} mediaType The document's media type, as detected from its content at upload.
 * @returns {boolean}
 */
export const canPreview = (mediaType) =>
  mediaType === 'application/pdf' || IMAGE_TYPES.includes(mediaType) || TEXT_TYPES.includes(mediaType);

/**
 * Shows a supporting document in a dialog: PDFs in the PDF viewer (scripts in the PDF are not run), JPEG and PNG
 * images as images, and text and CSV files as plain text. The file is fetched through the API, so the usual access
 * checks, malware hold and audit record ("document.preview") apply. Other types show a download button.
 *
 * @param {object} props
 * @param {object|null} props.doc The document to show, or null when closed.
 * @param {string} props.basePath API path of the owner's documents, such as "/transfers/<id>/documents".
 * @param {() => void} props.onClose Called to close the dialog.
 * @returns {JSX.Element|null}
 */
export function DocumentPreview({ doc, basePath, onClose }) {
  const previewable = Boolean(doc) && canPreview(doc.mediaType);
  const file = useQuery({
    queryKey: ['document-preview', basePath, doc?.id],
    queryFn: () =>
      api
        .get(`${basePath}/${doc.id}`, {
          params: { preview: 'true' },
          responseType: TEXT_TYPES.includes(doc.mediaType) ? 'text' : 'arraybuffer',
        })
        .then((r) => r.data)
        .catch((err) => {
          // Binary requests return the API's error as bytes; decode it so its message (such as a malware hold) shows.
          const body = err?.response?.data;
          if (Object.prototype.toString.call(body) === '[object ArrayBuffer]')
            try {
              err.response.data = JSON.parse(new TextDecoder().decode(body));
            } catch {
              /* not JSON: keep the generic message */
            }
          throw err;
        }),
    enabled: previewable,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const [imageUrl, setImageUrl] = useState(null);
  useEffect(() => {
    if (!doc || !IMAGE_TYPES.includes(doc.mediaType) || !file.data) return undefined;
    const url = URL.createObjectURL(new Blob([file.data], { type: doc.mediaType }));
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [doc, file.data]);
  if (!doc) return null;

  let body;
  if (!previewable)
    body = (
      <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas p-6 text-sm">
        <FileText className="h-6 w-6 shrink-0 text-ink-soft" aria-hidden="true" />
        This type of file cannot be shown in the browser. Download it to open it on your computer.
      </div>
    );
  else if (file.isLoading) body = <Skeleton className="h-[420px] w-full" />;
  else if (file.error)
    body = <Alert tone="warning">{errorMessage(file.error, 'This document cannot be previewed.')}</Alert>;
  else if (doc.mediaType === 'application/pdf') body = <PdfViewer data={file.data} />;
  else if (IMAGE_TYPES.includes(doc.mediaType))
    body = imageUrl && (
      <img
        src={imageUrl}
        alt={doc.originalFilename}
        className="mx-auto max-h-[70vh] rounded-lg border border-line bg-slate-50 object-contain"
      />
    );
  else
    body = (
      <div>
        <pre className="max-h-[65vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-canvas p-4 font-mono text-xs">
          {String(file.data).slice(0, TEXT_LIMIT)}
        </pre>
        {String(file.data).length > TEXT_LIMIT && (
          <p className="mt-2 text-xs text-ink-soft">Only the beginning is shown. Download the file to see all of it.</p>
        )}
      </div>
    );

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={doc.originalFilename}
      description={[doc.mediaType, fmtBytes(doc.sizeBytes), fmtDateTime(doc.createdAt)].filter(Boolean).join(' · ')}
      footer={
        <>
          <Button variant="secondary" icon={Download} onClick={() => download(`${basePath}/${doc.id}`)}>
            Download
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {body}
    </Dialog>
  );
}
