/**
 * Institutional settings page.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo, useState } from 'react';
import { useApi, useApiMutation, put } from '../../lib/query.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  CardHeader,
  Button,
  Input,
  Badge,
  PageLoader,
  ErrorState,
  Alert,
  Dialog,
  Field,
} from '../../components/ui/index.js';
import { humanize, fmtDateTime } from '../../utils/format.js';

/**
 * Lists every setting by category with its description and current value, and lets administrators change one with a
 * reason. The change is recorded in the audit trail. The defaults are not confirmed University of Ghana policy
 * until authorised owners validate them.
 *
 * @returns {JSX.Element}
 */
export default function SettingsPage() {
  const { data, isLoading, error, refetch } = useApi('settings', '/settings');
  const [edit, setEdit] = useState(null);
  const save = useApiMutation(
    ({ key, value, reason }) => put(`/settings/${encodeURIComponent(key)}`, { value, reason }),
    { success: 'Setting saved', invalidate: ['settings'], onSuccess: () => setEdit(null) },
  );
  const groups = useMemo(() => {
    const m = new Map();
    for (const s of data?.data || []) m.set(s.category, [...(m.get(s.category) || []), s]);
    return [...m.entries()];
  }, [data]);
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  /**
   * Converts the edited text into the type of the setting's default: a number, a boolean, a comma-separated list or
   * text.
   *
   * @param {object} s The setting.
   * @param {*} raw The value entered.
   * @returns {*}
   */
  const parse = (s, raw) =>
    typeof s.defaultValue === 'number'
      ? Number(raw)
      : typeof s.defaultValue === 'boolean'
        ? raw === true || raw === 'true'
        : Array.isArray(s.defaultValue)
          ? String(raw)
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean)
          : raw;
  return (
    <div>
      <PageHeader
        title="System settings"
        description="Configurable institutional defaults. These are not confirmed University of Ghana policy until authorised owners validate them."
      />
      <Alert tone="warning" className="mb-6">
        Changes take effect within 30 seconds and are recorded in the audit trail with your reason.
      </Alert>
      <div className="space-y-6">
        {groups.map(([g, list]) => (
          <Card key={g}>
            <CardHeader title={humanize(g)} />
            <ul className="divide-y divide-line">
              {list.map((s) => (
                <li key={s.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-ink-soft">{s.key}</p>
                    <p>{s.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-canvas px-2 py-1 text-xs">{JSON.stringify(s.value)}</code>
                    {s.isCustomised && <Badge tone="blue">Customised</Badge>}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setEdit({
                          ...s,
                          raw: Array.isArray(s.value) ? s.value.join(', ') : String(s.value),
                          reason: '',
                        })
                      }
                    >
                      Change
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <Dialog
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={edit?.key}
        description={edit?.description}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              disabled={!edit?.reason?.trim()}
              onClick={() => save.mutate({ key: edit.key, value: parse(edit, edit.raw), reason: edit.reason })}
            >
              Save
            </Button>
          </>
        }
      >
        {edit && (
          <div className="space-y-4">
            {typeof edit.defaultValue === 'boolean' ? (
              <Field label="Value">
                <select
                  className="h-10 w-full rounded-lg border border-line px-2"
                  value={edit.raw}
                  onChange={(e) => setEdit({ ...edit, raw: e.target.value })}
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </Field>
            ) : (
              <Field
                label="Value"
                help={
                  Array.isArray(edit.defaultValue) ? 'Comma-separated' : `Default: ${JSON.stringify(edit.defaultValue)}`
                }
              >
                <Input
                  type={typeof edit.defaultValue === 'number' ? 'number' : 'text'}
                  value={edit.raw}
                  onChange={(e) => setEdit({ ...edit, raw: e.target.value })}
                />
              </Field>
            )}
            <Field label="Reason for change" required>
              <Input value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} />
            </Field>
            {edit.updatedAt && <p className="text-xs text-ink-soft">Last changed {fmtDateTime(edit.updatedAt)}</p>}
          </div>
        )}
      </Dialog>
    </div>
  );
}
