/**
 * Staff view of the archival hierarchy.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, FolderTree, Plus, List } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  CardHeader,
  Button,
  Skeleton,
  StatusBadge,
  AccessBadge,
  EmptyState,
  Tabs,
  cn,
} from '../../components/ui/index.js';
import RecordsListPage from '../archival-records/RecordsListPage.jsx';
import { humanize } from '../../utils/format.js';

/**
 * One node of the hierarchy tree. Its children are loaded only when it is expanded, so large collections stay fast.
 *
 * @param {object} props
 * @param {object} props.node The description at this node.
 * @param {number} props.depth Indentation level.
 * @returns {JSX.Element}
 */
function TreeNode({ node, depth }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['tree', node.id],
    queryFn: () => api.get('/records/tree', { params: { parentId: node.id } }).then((r) => r.data.data),
    enabled: open,
  });
  return (
    <li role="treeitem" aria-expanded={node.childCount ? open : undefined} aria-level={depth + 1}>
      <div
        className="group flex items-center gap-1 rounded-md py-1 pr-2 hover:bg-canvas"
        style={{ paddingLeft: depth * 18 + 4 }}
      >
        {node.childCount ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Collapse' : 'Expand'}
            className="rounded p-0.5 text-ink-soft hover:bg-white"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <Link to={`/admin/records/${node.id}`} className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 font-mono text-[11.5px] text-gold-700">{node.referenceCode}</span>
          <span className="truncate text-sm font-medium group-hover:text-brand-800">{node.title}</span>
          <span className="shrink-0 text-[11px] text-ink-soft">
            {humanize(node.level)}
            {node.childCount ? ` · ${node.childCount}` : ''}
          </span>
        </Link>
        <span className="hidden shrink-0 gap-1 sm:flex">
          <AccessBadge level={node.effectiveAccessLevel} />
          <StatusBadge status={node.status} />
        </span>
      </div>
      {open && (
        <ul role="group">
          {isLoading && (
            <li style={{ paddingLeft: (depth + 1) * 18 + 28 }}>
              <Skeleton className="my-1 h-4 w-48" />
            </li>
          )}
          {data?.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Shows the archival hierarchy as an expandable tree (repository, fonds or collection, sub-fonds, series, file and
 * item), or as a list of top-level collections, with a button to create a new collection for authorised users.
 *
 * @returns {JSX.Element}
 */
export default function CollectionsPage() {
  const { can } = useCan();
  const [view, setView] = useState('tree');
  const roots = useQuery({
    queryKey: ['tree', 'root'],
    queryFn: () => api.get('/records/tree').then((r) => r.data.data),
  });
  return (
    <div>
      <PageHeader
        title="Collections and fonds"
        description="Browse the archival hierarchy: repository → fonds or collection → subfonds → series → file → item."
        actions={
          can('records.create') && (
            <Button icon={Plus} to="/admin/records/new">
              New collection or fonds
            </Button>
          )
        }
      />
      <Tabs
        className="mb-4"
        value={view}
        onChange={setView}
        tabs={[
          { value: 'tree', label: 'Hierarchy' },
          { value: 'list', label: 'Top-level list' },
        ]}
      />
      {view === 'tree' ? (
        <Card>
          <CardHeader
            title="Archival hierarchy"
            description="Expand a node to load its contents"
            actions={<FolderTree className="h-4 w-4 text-ink-soft" />}
          />
          <div className="px-3 py-3">
            {roots.isLoading && (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            )}
            {roots.data && !roots.data.length && (
              <EmptyState
                title="No collections yet"
                description="Create a fonds or collection, or accession material first."
              />
            )}
            <ul role="tree" aria-label="Archival hierarchy" className={cn('space-y-0.5')}>
              {roots.data?.map((n) => (
                <TreeNode key={n.id} node={n} depth={0} />
              ))}
            </ul>
          </div>
        </Card>
      ) : (
        <TopLevel />
      )}
    </div>
  );
}

/**
 * Lists only fonds and collections, reusing the descriptions list.
 *
 * @returns {JSX.Element}
 */
function TopLevel() {
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-sm text-ink-soft">
        <List className="h-4 w-4" /> Showing fonds and collections only.
      </p>
      <RecordsListPage topLevel embedded />
    </div>
  );
}
