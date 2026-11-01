/**
 * Storage location hierarchy and the dialog for creating locations.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Lock, Printer } from 'lucide-react';
import { api, download } from '../../lib/api.js';
import { useApiMutation, post } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  CardHeader,
  Button,
  Dialog,
  Field,
  Input,
  Select,
  Checkbox,
  Skeleton,
  EmptyState,
  Badge,
  cn,
} from '../../components/ui/index.js';

/**
 * Shows how full a location is as a coloured bar and percentage of its capacity, announced to screen readers.
 *
 * @param {object} props
 * @param {object} props.loc Location with its capacity and occupancy.
 * @returns {JSX.Element|null}
 */
export function Utilisation({ loc }) {
  if (loc.capacity === null || loc.capacity === undefined)
    return <span className="text-xs text-ink-soft">{loc.occupancy?.items || 0} items</span>;
  const pct = loc.utilisation ?? 0;
  return (
    <span className="flex items-center gap-2" aria-label={`${pct}% of capacity used`}>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <span
          className={cn(
            'block h-full rounded-full',
            pct >= 100 ? 'bg-red-600' : pct >= 85 ? 'bg-gold-500' : 'bg-brand-600',
          )}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </span>
      <span className="text-xs tabular-nums text-ink-soft">
        {loc.occupancy?.used ?? 0}/{Number(loc.capacity)}
      </span>
    </span>
  );
}

/**
 * One location in the tree. Its sub-locations load when it is expanded, and restricted locations are marked.
 *
 * @param {object} props
 * @param {object} props.loc The location.
 * @param {number} props.depth Indentation level.
 * @param {((loc: object) => void)|null} props.onAdd Opens the dialog to add a location inside it, when allowed.
 * @returns {JSX.Element}
 */
function Node({ loc, depth, onAdd }) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['locations', loc.id],
    queryFn: () => api.get('/locations', { params: { parentId: loc.id } }).then((r) => r.data.data),
    enabled: open,
  });
  return (
    <li role="treeitem" aria-expanded={loc.childCount ? open : undefined}>
      <div
        className="flex items-center gap-1 rounded-md py-1.5 pr-2 hover:bg-canvas"
        style={{ paddingLeft: depth * 18 + 4 }}
      >
        {loc.childCount ? (
          <button
            type="button"
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={() => setOpen(!open)}
            className="rounded p-0.5 text-ink-soft"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <Link to={`/admin/storage/locations/${loc.id}`} className="flex min-w-0 flex-1 items-center gap-2">
          <span className="font-mono text-xs text-gold-700">{loc.code}</span>
          <span className="truncate text-sm font-medium">{loc.name}</span>
          <span className="text-[11px] text-ink-soft">{loc.type?.name}</span>
          {loc.isRestricted && <Lock className="h-3.5 w-3.5 text-amber-700" aria-label="Restricted location" />}
          {loc.isFull && <Badge tone="red">Full</Badge>}
        </Link>
        <Utilisation loc={loc} />
        {onAdd && (
          <Button size="icon" variant="ghost" aria-label={`Add location inside ${loc.code}`} onClick={() => onAdd(loc)}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
      {open && (
        <ul role="group">
          {data?.map((c) => (
            <Node key={c.id} loc={c} depth={depth + 1} onAdd={onAdd} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Dialog for creating a location inside a parent, or at the top level: type, code, name, capacity, accepted
 * materials and whether it is restricted (only location managers can move items into restricted locations).
 *
 * @param {object} props
 * @param {object|null} props.parent Parent location, or null.
 * @param {boolean} props.open Whether the dialog is shown.
 * @param {() => void} props.onClose Called to close it.
 * @returns {JSX.Element}
 */
export function NewLocationDialog({ parent, open, onClose }) {
  const types = useQuery({
    queryKey: ['location-types'],
    queryFn: () => api.get('/locations/types').then((r) => r.data.data),
  });
  const available = (types.data || []).filter((t) => !parent || t.rank > (parent.type?.rank ?? 0));
  const [f, setF] = useState({
    code: '',
    name: '',
    typeId: '',
    capacity: '',
    capacityUnit: 'boxes',
    environmentRef: '',
    isRestricted: false,
    materialRestrictions: '',
  });
  const create = useApiMutation((b) => post('/locations', b), {
    success: 'Location created',
    invalidate: ['locations'],
    onSuccess: onClose,
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={parent ? `New location inside ${parent.code}` : 'New top-level location'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={!f.code || !f.name || !(f.typeId || available[0])}
            onClick={() =>
              create.mutate({
                code: f.code,
                name: f.name,
                typeId: f.typeId || available[0].id,
                parentId: parent?.id ?? null,
                capacity: f.capacity ? Number(f.capacity) : null,
                capacityUnit: f.capacityUnit,
                environmentRef: f.environmentRef || null,
                isRestricted: f.isRestricted,
                materialRestrictions: f.materialRestrictions
                  ? f.materialRestrictions
                      .split(';')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : [],
              })
            }
          >
            Create
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          <Select value={f.typeId} onChange={(e) => setF({ ...f, typeId: e.target.value })}>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Code" required help="Unique, e.g. BAL-S2-R04-B03">
          <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        </Field>
        <Field label="Name" required className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Capacity" help="Leave blank if not measured">
          <Input type="number" min="0" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} />
        </Field>
        <Field label="Unit">
          <Select value={f.capacityUnit} onChange={(e) => setF({ ...f, capacityUnit: e.target.value })}>
            {['boxes', 'items', 'linear_metres', 'cubic_metres'].map((u) => (
              <option key={u} value={u}>
                {u.replace('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Environmental monitoring reference">
          <Input value={f.environmentRef} onChange={(e) => setF({ ...f, environmentRef: e.target.value })} />
        </Field>
        <Field label="Material restrictions" help="Semicolon-separated material types">
          <Input
            value={f.materialRestrictions}
            onChange={(e) => setF({ ...f, materialRestrictions: e.target.value })}
          />
        </Field>
        <Checkbox
          className="sm:col-span-2"
          label="Restricted location"
          description="Only location managers can move items here"
          checked={f.isRestricted}
          onChange={(e) => setF({ ...f, isRestricted: e.target.checked })}
        />
      </div>
    </Dialog>
  );
}

/**
 * Shows the storage hierarchy (building, room, shelf, box and so on) as an expandable tree with occupancy against
 * capacity. Location managers can add locations, and labels can be printed for the top-level locations.
 *
 * @returns {JSX.Element}
 */
export default function LocationsPage() {
  const { can } = useCan();
  const [adding, setAdding] = useState(undefined);
  const roots = useQuery({
    queryKey: ['locations', 'root'],
    queryFn: () => api.get('/locations', { params: { root: 'true' } }).then((r) => r.data.data),
  });
  return (
    <div>
      <PageHeader
        title="Storage locations"
        description="Repository → building → floor → room → area → aisle → bay → shelf → box. Not every repository uses every level."
        actions={
          <>
            {can('locations.manage') && (
              <Button icon={Plus} onClick={() => setAdding(null)}>
                New location
              </Button>
            )}
            <Button
              variant="secondary"
              icon={Printer}
              disabled={!roots.data?.length}
              onClick={() =>
                download('/locations/labels', { method: 'post', data: { locationIds: roots.data.map((r) => r.id) } })
              }
            >
              Print labels
            </Button>
          </>
        }
      />
      <Card>
        <CardHeader title="Location hierarchy" description="Utilisation shows recorded occupancy against capacity" />
        <div className="px-3 py-3">
          {roots.isLoading && <Skeleton className="h-24" />}
          {roots.data && !roots.data.length && (
            <EmptyState title="No locations yet" description="Create a building or strongroom to begin." />
          )}
          <ul role="tree" aria-label="Storage locations">
            {roots.data?.map((l) => (
              <Node key={l.id} loc={l} depth={0} onAdd={can('locations.manage') ? setAdding : null} />
            ))}
          </ul>
        </div>
      </Card>
      {adding !== undefined && <NewLocationDialog parent={adding} open onClose={() => setAdding(undefined)} />}
    </div>
  );
}
