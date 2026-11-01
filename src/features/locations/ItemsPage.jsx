/**
 * Physical items list and the dialog for registering an item.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Printer } from 'lucide-react';
import { api, download, errorMessage } from '../../lib/api.js';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { SearchInput, FilterSelect } from '../../components/search/SearchInput.jsx';
import {
  Button,
  StatusBadge,
  Dialog,
  Field,
  Input,
  Select,
  Checkbox,
  Textarea,
  Alert,
} from '../../components/ui/index.js';
import { RecordPicker, TypeAhead } from '../archival-records/Pickers.jsx';
import { humanize } from '../../utils/format.js';

const TYPES = [
  'box',
  'folder',
  'volume',
  'item',
  'map',
  'drawing',
  'photograph',
  'audiovisual_carrier',
  'artefact',
  'other',
];

/**
 * Picks a storage location by code or name.
 *
 * @param {object} props
 * @param {(item: { id: string, label: string, sub?: string }) => void} props.onPick Called with the chosen
 *   location.
 * @returns {JSX.Element}
 */
export const LocationPicker = ({ onPick }) => (
  <TypeAhead
    queryKey="location-pick"
    placeholder="Find a location by code or name…"
    onPick={onPick}
    fetcher={(q) =>
      api.get('/locations', { params: { q } }).then((r) =>
        r.data.data.map((l) => ({
          id: l.id,
          label: `${l.code} — ${l.name}`,
          sub: l.isFull ? 'Full' : l.capacity ? `${l.occupancy.used}/${Number(l.capacity)}` : '',
        })),
      )
    }
  />
);

/**
 * Dialog for registering a physical item with its barcode, title, type, description, location and handling notes.
 * The description or location can be preset from the page that opened it. A full location needs an authorised
 * capacity override with a reason, which is recorded in the audit trail.
 *
 * @param {object} props
 * @param {boolean} props.open Whether the dialog is shown.
 * @param {() => void} props.onClose Called to close it.
 * @param {{ recordId?: string, locationId?: string }} props.defaults Preset description and location.
 * @returns {JSX.Element}
 */
function NewItemDialog({ open, onClose, defaults }) {
  const navigate = useNavigate();
  const { can } = useCan();
  const rec = useQuery({
    queryKey: ['record', defaults.recordId],
    queryFn: () => api.get(`/records/${defaults.recordId}`).then((r) => r.data.data),
    enabled: Boolean(defaults.recordId),
  });
  const loc = useQuery({
    queryKey: ['location', defaults.locationId],
    queryFn: () => api.get(`/locations/${defaults.locationId}`).then((r) => r.data.data),
    enabled: Boolean(defaults.locationId),
  });
  const [f, setF] = useState({
    barcode: '',
    title: '',
    itemType: 'box',
    sizeUnits: 1,
    isFragile: false,
    materialType: '',
    handlingNotes: '',
    recordId: defaults.recordId || '',
    locationId: defaults.locationId || '',
    accessionId: defaults.accessionId || '',
    override: false,
    overrideReason: '',
  });
  const [labels, setLabels] = useState({});
  const [capacityError, setCapacityError] = useState(null);
  useEffect(() => {
    if (rec.data) setLabels((l) => ({ ...l, record: `${rec.data.referenceCode} ${rec.data.title}` }));
  }, [rec.data]);
  useEffect(() => {
    if (loc.data) setLabels((l) => ({ ...l, location: `${loc.data.code} — ${loc.data.name}` }));
  }, [loc.data]);
  const create = useApiMutation((b) => post('/physical-items', b), {
    success: 'Item registered',
    invalidate: ['physical-items'],
    silentError: true,
    onSuccess: (r) => navigate(`/admin/storage/items/${r.data.id}`),
    onError: (e) => setCapacityError(errorMessage(e)),
  });

  /**
   * Registers the item. Empty fields are left out, size units default to 1, and the capacity override and its
   * reason are sent only when the override is used.
   */
  const submit = () =>
    create.mutate(
      Object.fromEntries(
        Object.entries({
          ...f,
          sizeUnits: Number(f.sizeUnits) || 1,
          overrideReason: f.override ? f.overrideReason : undefined,
          override: f.override || undefined,
        }).filter(([, v]) => v !== '' && v !== undefined),
      ),
    );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Register a physical item"
      description="Every placement and movement is recorded."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={create.isPending} disabled={!f.barcode || !f.title} onClick={submit}>
            Register
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {capacityError && (
          <Alert tone="danger" className="sm:col-span-2">
            {capacityError}
          </Alert>
        )}
        <Field label="Barcode" required>
          <Input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} autoFocus />
        </Field>
        <Field label="Type">
          <Select value={f.itemType} onChange={(e) => setF({ ...f, itemType: e.target.value })}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title / label" required className="sm:col-span-2">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1 text-[13px] font-semibold">
            Description {labels.record && <span className="font-normal">— {labels.record}</span>}
          </p>
          <RecordPicker
            onPick={(r) => {
              setF({ ...f, recordId: r.id });
              setLabels({ ...labels, record: `${r.sub} ${r.label}` });
            }}
          />
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 text-[13px] font-semibold">
            Initial location {labels.location && <span className="font-normal">— {labels.location}</span>}
          </p>
          <LocationPicker
            onPick={(l) => {
              setF({ ...f, locationId: l.id });
              setLabels({ ...labels, location: l.label });
            }}
          />
        </div>
        <Field label="Size (capacity units)">
          <Input
            type="number"
            min="0"
            step="0.5"
            value={f.sizeUnits}
            onChange={(e) => setF({ ...f, sizeUnits: e.target.value })}
          />
        </Field>
        <Field label="Material type">
          <Input
            value={f.materialType}
            onChange={(e) => setF({ ...f, materialType: e.target.value })}
            placeholder="paper, film, magnetic tape…"
          />
        </Field>
        <Field label="Handling notes" className="sm:col-span-2">
          <Textarea rows={2} value={f.handlingNotes} onChange={(e) => setF({ ...f, handlingNotes: e.target.value })} />
        </Field>
        <Checkbox label="Fragile" checked={f.isFragile} onChange={(e) => setF({ ...f, isFragile: e.target.checked })} />
        {can('physical.override_capacity') && (
          <Checkbox
            label="Override capacity if full"
            description="Requires a reason; recorded in the audit trail"
            checked={f.override}
            onChange={(e) => setF({ ...f, override: e.target.checked })}
          />
        )}
        {f.override && (
          <Field label="Override reason" required className="sm:col-span-2">
            <Input value={f.overrideReason} onChange={(e) => setF({ ...f, overrideReason: e.target.value })} />
          </Field>
        )}
      </div>
    </Dialog>
  );
}

/**
 * Lists boxes, folders, volumes and other items with their barcode, location and status, filterable and searchable.
 * Authorised users can register items, and labels can be printed for the selected items.
 *
 * @returns {JSX.Element}
 */
export default function ItemsPage() {
  const navigate = useNavigate();
  const { can } = useCan();
  const [search] = useSearchParams();
  const [open, setOpen] = useState(search.get('new') === '1');
  const [p, set] = useQueryParams({ pageSize: 25, sort: 'barcode', order: 'asc' });
  const { data, isLoading, error, refetch } = useApi('physical-items', '/physical-items', {
    page: p.page,
    pageSize: p.pageSize,
    sort: p.sort,
    order: p.order,
    q: p.q,
    status: p.status,
  });
  const columns = useMemo(
    () => [
      {
        id: 'barcode',
        header: 'Barcode',
        sortKey: 'barcode',
        cell: ({ row }) => <span className="font-mono text-xs text-gold-700">{row.original.barcode}</span>,
      },
      {
        id: 'title',
        header: 'Item',
        sortKey: 'title',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold">{row.original.title}</p>
            <p className="text-xs text-ink-soft">{humanize(row.original.itemType)}</p>
          </div>
        ),
      },
      { id: 'record', header: 'Description', cell: ({ row }) => row.original.record?.referenceCode || '—' },
      {
        id: 'location',
        header: 'Location',
        cell: ({ row }) => (row.original.currentLocation ? `${row.original.currentLocation.code}` : '—'),
      },
      {
        id: 'status',
        header: 'Status',
        sortKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [],
  );
  return (
    <div>
      <PageHeader
        title="Physical items"
        description="Boxes, folders, volumes and other carriers with their current and home locations."
        actions={
          can('physical.move') && (
            <Button icon={Plus} onClick={() => setOpen(true)}>
              Register item
            </Button>
          )
        }
      />
      <DataTable
        id="physical-items"
        columns={columns}
        data={data?.data}
        total={data?.meta.total}
        page={p.page}
        pageSize={p.pageSize}
        sort={p.sort}
        order={p.order}
        onChange={(x) => set(x, { resetPage: !('page' in x) })}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={(r) => navigate(`/admin/storage/items/${r.id}`)}
        selectable
        bulkActions={(rows) => (
          <Button
            size="sm"
            variant="secondary"
            icon={Printer}
            onClick={() => download('/locations/labels', { method: 'post', data: { itemIds: rows.map((r) => r.id) } })}
          >
            Print labels
          </Button>
        )}
        toolbar={
          <>
            <SearchInput value={p.q} onChange={(q) => set({ q })} placeholder="Barcode or title" />
            <FilterSelect
              label="Status"
              value={p.status}
              onChange={(v) => set({ status: v })}
              options={['available', 'reserved', 'issued', 'in_conservation', 'missing', 'withdrawn', 'disposed'].map(
                (s) => ({ value: s, label: humanize(s) }),
              )}
            />
          </>
        }
      />
      {open && (
        <NewItemDialog
          open
          onClose={() => setOpen(false)}
          defaults={{
            recordId: search.get('recordId'),
            locationId: search.get('locationId'),
            accessionId: search.get('accessionId'),
          }}
        />
      )}
    </div>
  );
}
