/**
 * Inventory audit page for scanning a location's contents.
 *
 * @author Kwasi Adabo Boakye
 */

import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ScanBarcode, CheckCircle2 } from 'lucide-react';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  StatusBadge,
  PageLoader,
  ErrorState,
  Alert,
  Checkbox,
  ConfirmDialog,
  Badge,
} from '../../components/ui/index.js';
import { fmtDateTime, humanize } from '../../utils/format.js';

const TONE = { found: 'green', missing: 'red', unexpected: 'amber', misplaced: 'violet' };

/**
 * Records barcodes as they are scanned and reports each one as found, misplaced or unexpected. Completing the audit
 * lists every item expected in the area but not scanned as missing and, if chosen, marks those items missing in the
 * catalogue. The reconciliation summary is then shown.
 *
 * @returns {JSX.Element}
 */
export default function InventoryAuditPage() {
  const { id } = useParams();
  const inputRef = useRef(null);
  const [code, setCode] = useState('');
  const [last, setLast] = useState(null);
  const [finish, setFinish] = useState(false);
  const [markMissing, setMarkMissing] = useState(false);
  const { data, isLoading, error, refetch } = useApi(['audit', id], `/locations/audits/${id}`);
  const scan = useApiMutation((barcode) => post(`/locations/audits/${id}/scan`, { barcode }), {
    invalidate: [['audit', id]],
    onSuccess: (r) => {
      setLast(r.data);
      setCode('');
      inputRef.current?.focus();
    },
  });
  const complete = useApiMutation(() => post(`/locations/audits/${id}/complete`, { markMissing }), {
    success: 'Audit completed and reconciled',
    invalidate: [['audit', id]],
    onSuccess: () => setFinish(false),
  });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const a = data.data;
  const open = a.status === 'open';
  const counts = a.lines.reduce((acc, l) => ({ ...acc, [l.outcome]: (acc[l.outcome] || 0) + 1 }), {});
  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Storage', to: '/admin/storage' },
          { label: a.location.code, to: `/admin/storage/locations/${a.location.id}` },
          { label: 'Inventory audit' },
        ]}
        title={`Inventory audit: ${a.location.name}`}
        meta={
          <>
            <StatusBadge status={a.status} />
            <span className="text-sm text-ink-soft">Started {fmtDateTime(a.createdAt)}</span>
          </>
        }
        actions={
          open && (
            <Button icon={CheckCircle2} onClick={() => setFinish(true)}>
              Complete and reconcile
            </Button>
          )
        }
      />
      {open ? (
        <Card className="mb-6">
          <CardBody>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) scan.mutate(code.trim());
              }}
            >
              <label className="flex-1">
                <span className="mb-1 block text-[13px] font-semibold">Scan or type a barcode</span>
                <span className="relative block">
                  <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
                  <input
                    ref={inputRef}
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="h-12 w-full rounded-lg border border-line pl-11 pr-3 font-mono text-lg focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25"
                  />
                </span>
              </label>
              <Button type="submit" size="lg" loading={scan.isPending}>
                Record
              </Button>
            </form>
            {last && (
              <Alert tone={last.line.outcome === 'found' ? 'success' : 'warning'} className="mt-4">
                <span className="font-semibold">{humanize(last.line.outcome)}:</span>{' '}
                {last.item ? last.item.title : `${last.line.scannedBarcode} is not a registered item`}
              </Alert>
            )}
          </CardBody>
        </Card>
      ) : (
        <Alert tone="success" className="mb-6" title="Reconciled">
          Expected {a.summary.expected}, found {a.summary.found}, misplaced {a.summary.misplaced}, unexpected{' '}
          {a.summary.unexpected}, missing {a.summary.missing}
          {a.summary.markedMissing ? ' (marked missing in the catalogue)' : ''}.
        </Alert>
      )}
      <Card>
        <CardHeader
          title="Scanned"
          description={
            Object.entries(counts)
              .map(([k, v]) => `${humanize(k)} ${v}`)
              .join(' · ') || 'Nothing scanned yet'
          }
        />
        <ul className="divide-y divide-line">
          {a.lines.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span>
                <span className="font-mono text-xs">{l.scannedBarcode}</span>{' '}
                {l.item && (
                  <Link className="hover:underline" to={`/admin/storage/items/${l.item.id}`}>
                    {l.item.title}
                  </Link>
                )}
                {l.note && <span className="block text-xs text-ink-soft">{l.note}</span>}
              </span>
              <Badge tone={TONE[l.outcome]}>{humanize(l.outcome)}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <ConfirmDialog
        open={finish}
        onClose={() => setFinish(false)}
        title="Complete this audit?"
        description="Items recorded here but not scanned are listed as missing."
        confirmLabel="Complete"
        loading={complete.isPending}
        onConfirm={() => complete.mutate()}
      >
        <Checkbox
          label="Also mark unscanned items as missing in the catalogue"
          checked={markMissing}
          onChange={(e) => setMarkMissing(e.target.checked)}
        />
      </ConfirmDialog>
    </div>
  );
}
