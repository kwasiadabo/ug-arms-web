/**
 * Storage location detail page.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Printer, ClipboardCheck, Lock } from 'lucide-react';
import { download, api } from '../../lib/api.js';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  CardHeader,
  CardBody,
  MetaList,
  Button,
  StatusBadge,
  PageLoader,
  ErrorState,
  Alert,
} from '../../components/ui/index.js';
import { Utilisation, NewLocationDialog } from './LocationsPage.jsx';
import { useQuery } from '@tanstack/react-query';
import { fmtDateTime, humanize } from '../../utils/format.js';

/**
 * Shows a location with its path, details, the locations inside it, the items it holds and its inventory audits.
 * Authorised users can add a sub-location, register an item here, start or continue an inventory audit, and print
 * labels for the location and its items.
 *
 * @returns {JSX.Element}
 */
export default function LocationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useCan();
  const [adding, setAdding] = useState(false);
  const { data, isLoading, error, refetch } = useApi(['location', id], `/locations/${id}`);
  const children = useQuery({
    queryKey: ['locations', id],
    queryFn: () => api.get('/locations', { params: { parentId: id } }).then((r) => r.data.data),
  });
  const startAudit = useApiMutation(() => post(`/locations/${id}/audits`, {}), {
    success: 'Inventory audit started',
    onSuccess: (r) => navigate(`/admin/storage/audits/${r.data.id}`),
  });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const l = data.data;
  const loc = { ...l, utilisation: l.capacity ? Math.round((l.occupancy.used / Number(l.capacity)) * 100) : null };
  const openAudit = l.audits.find((a) => a.status === 'open');
  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Storage', to: '/admin/storage' },
          ...l.breadcrumbs.map((b) => ({ label: b.code, to: `/admin/storage/locations/${b.id}` })),
          { label: l.code },
        ]}
        eyebrow={`${l.type?.name} · ${l.code}`}
        title={l.name}
        meta={
          <>
            <Utilisation loc={loc} />
            {l.isRestricted && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                <Lock className="h-3.5 w-3.5" /> Restricted
              </span>
            )}
          </>
        }
        actions={
          <>
            {can('locations.manage') && (
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAdding(true)}>
                Add inside
              </Button>
            )}
            {can('physical.move') && (
              <Button size="sm" variant="secondary" icon={Plus} to={`/admin/storage/items?new=1&locationId=${l.id}`}>
                Register item here
              </Button>
            )}
            {can('physical.audit') &&
              (openAudit ? (
                <Button size="sm" icon={ClipboardCheck} to={`/admin/storage/audits/${openAudit.id}`}>
                  Continue audit
                </Button>
              ) : (
                <Button
                  size="sm"
                  icon={ClipboardCheck}
                  loading={startAudit.isPending}
                  onClick={() => startAudit.mutate()}
                >
                  Start inventory audit
                </Button>
              ))}
            <Button
              size="sm"
              variant="ghost"
              icon={Printer}
              onClick={() =>
                download('/locations/labels', {
                  method: 'post',
                  data: { locationIds: [l.id, ...(children.data || []).map((c) => c.id)] },
                })
              }
            >
              Labels
            </Button>
          </>
        }
      />
      {loc.utilisation >= 100 && (
        <Alert tone="warning" className="mb-4">
          This location is at or over capacity. New placements need an authorised override with a reason.
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {children.data?.length > 0 && (
            <Card>
              <CardHeader title="Locations inside" />
              <ul className="divide-y divide-line">
                {children.data.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/admin/storage/locations/${c.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-canvas"
                    >
                      <span>
                        <span className="font-mono text-xs text-gold-700">{c.code}</span> {c.name}{' '}
                        <span className="text-xs text-ink-soft">{c.type?.name}</span>
                      </span>
                      <Utilisation loc={c} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader
              title="Items here"
              description={`${l.items.length} item(s)`}
              actions={
                l.items.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Printer}
                    onClick={() =>
                      download('/locations/labels', { method: 'post', data: { itemIds: l.items.map((i) => i.id) } })
                    }
                  >
                    Item labels
                  </Button>
                )
              }
            />
            <ul className="divide-y divide-line">
              {l.items.map((i) => (
                <li key={i.id}>
                  <Link
                    to={`/admin/storage/items/${i.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-canvas"
                  >
                    <span>
                      <span className="font-mono text-xs text-gold-700">{i.barcode}</span> {i.title}{' '}
                      <span className="text-xs text-ink-soft">
                        {humanize(i.itemType)} · {Number(i.sizeUnits)} unit(s)
                      </span>
                    </span>
                    <StatusBadge status={i.status} />
                  </Link>
                </li>
              ))}
            </ul>
            {!l.items.length && (
              <CardBody className="text-sm text-ink-soft">No items recorded in this location.</CardBody>
            )}
          </Card>
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <MetaList
                columns={1}
                items={[
                  {
                    label: 'Capacity',
                    value: l.capacity ? `${Number(l.capacity)} ${l.capacityUnit.replace('_', ' ')}` : 'Not measured',
                  },
                  { label: 'Used', value: l.occupancy.used },
                  { label: 'Material restrictions', value: l.materialRestrictions },
                  { label: 'Environment reference', value: l.environmentRef },
                  { label: 'Restriction note', value: l.restrictionNote },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Inventory audits" />
            <ul className="divide-y divide-line">
              {l.audits.map((a) => (
                <li key={a.id}>
                  <Link to={`/admin/storage/audits/${a.id}`} className="block px-5 py-2.5 text-sm hover:bg-canvas">
                    <StatusBadge status={a.status} /> {fmtDateTime(a.createdAt)}
                    {a.summary?.expected !== undefined && (
                      <span className="block text-xs text-ink-soft">
                        Found {a.summary.found}/{a.summary.expected} · missing {a.summary.missing} · unexpected{' '}
                        {a.summary.unexpected}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            {!l.audits.length && <CardBody className="text-sm text-ink-soft">No audits yet.</CardBody>}
          </Card>
        </aside>
      </div>
      {adding && <NewLocationDialog parent={l} open onClose={() => setAdding(false)} />}
    </div>
  );
}
