/**
 * Management of controlled vocabularies and their terms.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Plus, Pencil, EyeOff, Eye } from 'lucide-react';
import { useApi, useApiMutation, post, patch } from '../../lib/query.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  CardHeader,
  Button,
  Dialog,
  Field,
  Input,
  Textarea,
  PageLoader,
  ErrorState,
  Badge,
  cn,
} from '../../components/ui/index.js';

/**
 * Lists the vocabularies and the terms of the selected one. Authorised users can create vocabularies, add and edit
 * terms with scope notes, and deactivate or reactivate terms; terms are deactivated rather than deleted, so
 * existing descriptions keep their meaning.
 *
 * @returns {JSX.Element}
 */
export default function VocabulariesPage() {
  const { data, isLoading, error, refetch } = useApi(['vocabularies', 'all'], '/vocabularies', {
    includeInactive: 'true',
  });
  const [active, setActive] = useState(null);
  const [term, setTerm] = useState(null);
  const [newVocab, setNewVocab] = useState(null);
  const inval = ['vocabularies'];
  const saveTerm = useApiMutation(
    (t) =>
      t.id
        ? patch(`/vocabularies/terms/${t.id}`, { label: t.label, scopeNote: t.scopeNote || null, isActive: t.isActive })
        : post(`/vocabularies/${t.vocabularyId}/terms`, { label: t.label, scopeNote: t.scopeNote || undefined }),
    { success: 'Term saved', invalidate: inval, onSuccess: () => setTerm(null) },
  );
  const toggle = useApiMutation((t) => patch(`/vocabularies/terms/${t.id}`, { isActive: !t.isActive }), {
    success: 'Updated',
    invalidate: inval,
  });
  const createVocab = useApiMutation((v) => post('/vocabularies', v), {
    success: 'Vocabulary created',
    invalidate: inval,
    onSuccess: () => setNewVocab(null),
  });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const vocabs = data.data;
  const current = vocabs.find((v) => v.id === active) || vocabs[0];
  return (
    <div>
      <PageHeader
        title="Controlled vocabularies"
        description="Managed term lists keep subjects, document types and languages consistent. Terms in use are deactivated rather than deleted."
        actions={
          <Button variant="secondary" icon={Plus} onClick={() => setNewVocab({ code: '', name: '', description: '' })}>
            New vocabulary
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card as="nav" aria-label="Vocabularies" className="p-2">
          {vocabs.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setActive(v.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm',
                current?.id === v.id ? 'bg-brand-50 font-semibold text-brand-800' : 'hover:bg-canvas',
              )}
            >
              {v.name}
              <span className="text-xs text-ink-soft">{v.terms.length}</span>
            </button>
          ))}
        </Card>
        {current && (
          <Card>
            <CardHeader
              title={current.name}
              description={current.description || `Code: ${current.code}`}
              actions={
                <Button
                  size="sm"
                  icon={Plus}
                  onClick={() => setTerm({ vocabularyId: current.id, label: '', scopeNote: '' })}
                >
                  Add term
                </Button>
              }
            />
            <ul className="divide-y divide-line">
              {current.terms.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className={cn(!t.isActive && 'text-ink-soft line-through')}>
                    {t.label} {t.scopeNote && <span className="text-xs text-ink-soft">— {t.scopeNote}</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    {!t.isActive && <Badge>Inactive</Badge>}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Edit ${t.label}`}
                      onClick={() => setTerm({ ...t })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t.isActive ? 'Deactivate' : 'Activate'}
                      onClick={() => toggle.mutate(t)}
                    >
                      {t.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <Dialog
        open={Boolean(term)}
        onClose={() => setTerm(null)}
        title={term?.id ? 'Edit term' : 'New term'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTerm(null)}>
              Cancel
            </Button>
            <Button disabled={!term?.label?.trim()} loading={saveTerm.isPending} onClick={() => saveTerm.mutate(term)}>
              Save
            </Button>
          </>
        }
      >
        {term && (
          <div className="space-y-4">
            <Field label="Label" required>
              <Input value={term.label} onChange={(e) => setTerm({ ...term, label: e.target.value })} />
            </Field>
            <Field label="Scope note">
              <Textarea
                rows={2}
                value={term.scopeNote || ''}
                onChange={(e) => setTerm({ ...term, scopeNote: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Dialog>
      <Dialog
        open={Boolean(newVocab)}
        onClose={() => setNewVocab(null)}
        title="New vocabulary"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewVocab(null)}>
              Cancel
            </Button>
            <Button
              loading={createVocab.isPending}
              onClick={() => createVocab.mutate({ ...newVocab, description: newVocab.description || undefined })}
            >
              Create
            </Button>
          </>
        }
      >
        {newVocab && (
          <div className="space-y-4">
            <Field label="Code" help="lowercase_with_underscores">
              <Input value={newVocab.code} onChange={(e) => setNewVocab({ ...newVocab, code: e.target.value })} />
            </Field>
            <Field label="Name">
              <Input value={newVocab.name} onChange={(e) => setNewVocab({ ...newVocab, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Textarea
                rows={2}
                value={newVocab.description}
                onChange={(e) => setNewVocab({ ...newVocab, description: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
