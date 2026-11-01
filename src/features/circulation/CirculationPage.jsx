/**
 * Reading-room circulation desk.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightLeft, Undo2 } from 'lucide-react';
import { api, errorMessage } from '../../lib/api.js';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { FilterSelect } from '../../components/search/SearchInput.jsx';
import {
  Button,
  StatusBadge,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
  Alert,
  Card,
  CardBody,
} from '../../components/ui/index.js';
import { fmtDateTime, humanize } from '../../utils/format.js';

const CONDITIONS = ['good', 'fair', 'poor', 'critical'];

/**
 * Lists items currently out or overdue (other statuses can be chosen) with the researcher, issue time, due time and
 * condition. Items are issued by request number and barcode, recording their condition before issue; the server
 * refuses items that are not covered by an approved request or not available. Returns record the condition and any
 * incident; an item that comes back in poor or critical condition, worse than when issued, is sent to conservation.
 * An item is available again only after its return has been recorded.
 *
 * @returns {JSX.Element}
 */
export default function CirculationPage() {
  const { can } = useCan();
  const [search] = useSearchParams();
  const [p, set] = useQueryParams({ pageSize: 25, status: 'issued,overdue' });
  const [issueOpen, setIssueOpen] = useState(Boolean(search.get('requestId')));
  const [issue, setIssue] = useState({
    barcode: '',
    requestNumber: '',
    conditionBefore: 'good',
    conditionBeforeNotes: '',
  });
  const [ret, setRet] = useState(null);
  const [issueError, setIssueError] = useState(null);
  const { data, isLoading, error, refetch } = useApi('circulation', '/circulation', {
    page: p.page,
    pageSize: p.pageSize,
    status: p.status,
  });
  const reqFromUrl = useQuery({
    queryKey: ['staff-request', search.get('requestId')],
    queryFn: () => api.get(`/research-requests/${search.get('requestId')}`).then((r) => r.data.data),
    enabled: Boolean(search.get('requestId')),
  });
  const inval = ['circulation', 'physical-items'];
  const doIssue = useApiMutation(
    async () => {
      const item = await api
        .get(`/physical-items/by-barcode/${encodeURIComponent(issue.barcode)}`)
        .then((r) => r.data.data);
      const requestId =
        reqFromUrl.data?.id ||
        (await api
          .get('/research-requests', { params: { q: issue.requestNumber, pageSize: 1 } })
          .then((r) => r.data.data[0]?.id));
      if (!requestId)
        throw Object.assign(new Error('Request not found'), {
          response: { data: { error: { message: 'Request not found' } } },
        });
      return post('/circulation/issue', {
        physicalItemId: item.id,
        requestId,
        appointmentId: search.get('appointmentId') || undefined,
        conditionBefore: issue.conditionBefore,
        conditionBeforeNotes: issue.conditionBeforeNotes || undefined,
      });
    },
    {
      success: 'Item issued',
      invalidate: inval,
      silentError: true,
      onSuccess: () => {
        setIssueOpen(false);
        setIssue({ barcode: '', requestNumber: '', conditionBefore: 'good', conditionBeforeNotes: '' });
      },
      onError: (e) => setIssueError(errorMessage(e)),
    },
  );
  const doReturn = useApiMutation(
    () =>
      post(`/circulation/${ret.id}/return`, {
        conditionAfter: ret.conditionAfter,
        conditionAfterNotes: ret.conditionAfterNotes || undefined,
        incidentNotes: ret.incidentNotes || undefined,
      }),
    { success: 'Return recorded', invalidate: inval, onSuccess: () => setRet(null) },
  );
  const columns = useMemo(
    () => [
      {
        id: 'item',
        header: 'Item',
        cell: ({ row }) => (
          <div>
            <p className="font-mono text-xs text-gold-700">{row.original.physicalItem?.barcode}</p>
            <p className="font-semibold">{row.original.physicalItem?.title}</p>
          </div>
        ),
      },
      {
        id: 'who',
        header: 'Researcher',
        cell: ({ row }) => (
          <div>
            {row.original.researcherName}
            <p className="text-xs text-ink-soft">{row.original.request?.requestNumber}</p>
          </div>
        ),
      },
      {
        id: 'issued',
        header: 'Issued',
        cell: ({ row }) => (
          <div>
            {fmtDateTime(row.original.issuedAt)}
            <p className="text-xs text-ink-soft">by {row.original.issuedBy?.fullName}</p>
          </div>
        ),
      },
      { id: 'due', header: 'Due back', cell: ({ row }) => fmtDateTime(row.original.expectedReturnAt) },
      {
        id: 'cond',
        header: 'Condition',
        cell: ({ row }) =>
          `${humanize(row.original.conditionBefore)}${row.original.conditionAfter ? ` → ${humanize(row.original.conditionAfter)}` : ''}`,
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'act',
        header: '',
        enableHiding: false,
        cell: ({ row }) =>
          ['issued', 'overdue'].includes(row.original.status) &&
          can('circulation.return') && (
            <Button
              size="sm"
              variant="secondary"
              icon={Undo2}
              onClick={(e) => {
                e.stopPropagation();
                setRet({
                  ...row.original,
                  conditionAfter: row.original.conditionBefore || 'good',
                  conditionAfterNotes: '',
                  incidentNotes: '',
                });
              }}
            >
              Return
            </Button>
          ),
      },
    ],
    [can],
  );
  return (
    <div>
      <PageHeader
        title="Circulation desk"
        description="Supervised issue and return. An item is available again only after its return and condition check are recorded."
        actions={
          can('circulation.issue') && (
            <Button
              icon={ArrowRightLeft}
              onClick={() => {
                setIssueError(null);
                setIssueOpen(true);
              }}
            >
              Issue item
            </Button>
          )
        }
      />
      <DataTable
        id="circulation"
        columns={columns}
        data={data?.data}
        total={data?.meta.total}
        page={p.page}
        pageSize={p.pageSize}
        onChange={(x) => set(x, { resetPage: !('page' in x) })}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        toolbar={
          <FilterSelect
            label="Status"
            value={p.status}
            onChange={(v) => set({ status: v })}
            options={[
              { value: 'issued,overdue', label: 'Outstanding' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'returned', label: 'Returned' },
              { value: 'damaged,lost', label: 'Damaged or lost' },
            ]}
          />
        }
      />
      <Dialog
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title="Issue an item for consultation"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIssueOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={doIssue.isPending}
              disabled={!issue.barcode || (!reqFromUrl.data && !issue.requestNumber)}
              onClick={() => {
                setIssueError(null);
                doIssue.mutate();
              }}
            >
              Issue
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {issueError && <Alert tone="danger">{issueError}</Alert>}
          {reqFromUrl.data ? (
            <Card>
              <CardBody className="text-sm">
                <span className="font-semibold">{reqFromUrl.data.requestNumber}</span> · {reqFromUrl.data.contactName}
                <ul className="mt-1 text-xs text-ink-soft">
                  {reqFromUrl.data.items.map((i) => (
                    <li key={i.id}>
                      {i.record?.referenceCode} {i.record?.title} ({i.decision})
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : (
            <Field label="Request number" required>
              <Input
                value={issue.requestNumber}
                onChange={(e) => setIssue({ ...issue, requestNumber: e.target.value })}
                placeholder="UGA/RR/2026/00001"
              />
            </Field>
          )}
          <Field label="Item barcode" required>
            <Input autoFocus value={issue.barcode} onChange={(e) => setIssue({ ...issue, barcode: e.target.value })} />
          </Field>
          <Field label="Condition before issue">
            <Select
              value={issue.conditionBefore}
              onChange={(e) => setIssue({ ...issue, conditionBefore: e.target.value })}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Condition notes">
            <Textarea
              rows={2}
              value={issue.conditionBeforeNotes}
              onChange={(e) => setIssue({ ...issue, conditionBeforeNotes: e.target.value })}
            />
          </Field>
        </div>
      </Dialog>
      <Dialog
        open={Boolean(ret)}
        onClose={() => setRet(null)}
        title={`Record return: ${ret?.physicalItem?.barcode}`}
        description="Poor or critical condition worse than at issue sends the item to conservation."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRet(null)}>
              Cancel
            </Button>
            <Button loading={doReturn.isPending} onClick={() => doReturn.mutate()}>
              Record return
            </Button>
          </>
        }
      >
        {ret && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              Condition at issue: <span className="font-semibold text-ink">{humanize(ret.conditionBefore)}</span>
            </p>
            <Field label="Condition on return">
              <Select value={ret.conditionAfter} onChange={(e) => setRet({ ...ret, conditionAfter: e.target.value })}>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {humanize(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Condition notes">
              <Textarea
                rows={2}
                value={ret.conditionAfterNotes}
                onChange={(e) => setRet({ ...ret, conditionAfterNotes: e.target.value })}
              />
            </Field>
            <Field label="Incident (if any)">
              <Textarea
                rows={2}
                value={ret.incidentNotes}
                onChange={(e) => setRet({ ...ret, incidentNotes: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
