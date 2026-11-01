/**
 * Public page of one archival description.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Lock,
  Copy,
  BookmarkPlus,
  CalendarPlus,
  KeyRound,
  FileImage,
  ChevronRight,
  FolderTree,
  MessageSquareWarning,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../store/auth.js';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  MetaList,
  Alert,
  ErrorState,
  PageLoader,
  Badge,
  Dialog,
  Textarea,
  Field,
} from '../../components/ui/index.js';
import { Breadcrumbs } from '../../components/layout/PageHeader.jsx';
import { AssetViewer, Thumb } from '../../components/viewer/AssetViewer.jsx';
import { humanize, fmtDate } from '../../utils/format.js';

/**
 * Lists the parts within a description (up to 100), marking restricted ones.
 *
 * @param {object} props
 * @param {string} props.id Identifier of the description.
 * @returns {JSX.Element|null}
 */
function Children({ id }) {
  const { data } = useQuery({
    queryKey: ['public-children', id],
    queryFn: () => api.get(`/public/records/${id}/children`, { params: { pageSize: 100 } }).then((r) => r.data),
  });
  if (!data?.data.length) return null;
  return (
    <Card>
      <CardHeader
        title="Contents"
        description={`${data.meta.total} part${data.meta.total === 1 ? '' : 's'} within this description`}
      />
      <ul className="divide-y divide-line">
        {data.data.map((c) => (
          <li key={c.id}>
            <Link to={`/records/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-gold-600">
                  {c.referenceCode} · {humanize(c.level)}
                </span>
                <span className="block font-semibold">{c.title}</span>
                {c.dateExpression && <span className="block text-xs text-ink-soft">{c.dateExpression}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-ink-soft">
                {c.publicVisibility === 'metadata_only' && (
                  <Lock className="h-3.5 w-3.5 text-amber-700" aria-label="Restricted" />
                )}
                {c.childCount > 0 && `${c.childCount} within`}
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Shows a description with its breadcrumb trail, digital copies in the viewer, the full catalogue entry, subjects,
 * related descriptions and the conditions of access and reproduction. For restricted material only identifying
 * information and the reason for the restriction are shown. Visitors can copy a citation, request access, a visit
 * or a copy, save the description to their research list, and suggest a correction.
 *
 * @returns {JSX.Element}
 */
export default function RecordPage() {
  const { id } = useParams();
  const user = useAuth((s) => s.user);
  const [active, setActive] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const {
    data: r,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['public-record', id],
    queryFn: () => api.get(`/public/records/${id}`).then((x) => x.data.data),
  });
  useEffect(() => {
    if (r) document.title = `${r.title} · UG Archives`;
  }, [r]);
  useEffect(() => {
    setActive(r?.digitalItems?.[0] ?? null);
  }, [r]);
  if (isLoading)
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <PageLoader />
      </div>
    );
  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  const full = r.access.mode === 'full';

  /**
   * Saves the description to the signed-in researcher's research list.
   *
   * @returns {Promise<void>}
   */
  const save = async () => {
    try {
      await api.post('/me/research-list', { recordId: r.id });
      toast.success('Saved to your research list');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  /**
   * Sends the visitor's suggested correction to the archivists. It never changes the catalogue directly.
   *
   * @returns {Promise<void>}
   */
  const sendFeedback = async () => {
    try {
      await api.post('/me/feedback', { recordId: r.id, message: feedback });
      toast.success('Thank you. An archivist will review your note.');
      setFeedbackOpen(false);
      setFeedback('');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const crumbs = [
    { label: 'Collections', to: '/collections' },
    ...r.breadcrumbs.map((b) => ({ label: b.title, to: `/records/${b.id}` })),
    { label: r.title },
  ];
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={crumbs} />
      <div className="mt-2 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <header>
            <p className="text-sm font-semibold text-gold-600">
              {r.referenceCode} · {humanize(r.level)}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight">{r.title}</h1>
            <p className="mt-2 text-ink-soft">{[r.dateExpression, r.extentAndMedium].filter(Boolean).join(' · ')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {full ? (
                <Badge tone="green">Description available</Badge>
              ) : (
                <Badge tone="amber">
                  <Lock className="h-3 w-3" /> Restricted
                </Badge>
              )}
              {r.access.viaGrant && <Badge tone="blue">Access granted to you</Badge>}
              {r.digitalItems?.length > 0 && (
                <Badge tone="brand">
                  <FileImage className="h-3 w-3" /> {r.digitalItems.length} digital item
                  {r.digitalItems.length === 1 ? '' : 's'}
                </Badge>
              )}
            </div>
          </header>

          {!full && (
            <Alert tone="warning" icon={Lock} title="Access to this material is restricted">
              {r.accessExplanations
                ?.filter((e) => e.explanation)
                .map((e) => (
                  <p key={e.type}>
                    {e.explanation}
                    {e.until ? ` (until ${fmtDate(e.until)})` : ''}
                  </p>
                ))}
              {r.accessConditions && <p>{r.accessConditions}</p>}
              <p className="mt-1">You can request access; an archivist will review your request.</p>
            </Alert>
          )}

          {active && (
            <Card>
              <CardBody>
                <AssetViewer asset={active} title={r.title} />
                {r.digitalItems.length > 1 && (
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Digital items">
                    {r.digitalItems.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        role="listitem"
                        onClick={() => setActive(d)}
                        aria-current={active.id === d.id}
                        className={`shrink-0 overflow-hidden rounded-lg border-2 ${active.id === d.id ? 'border-brand-600' : 'border-transparent'}`}
                      >
                        {d.thumbnailAssetId ? (
                          <Thumb assetId={d.thumbnailAssetId} alt={d.title} className="h-16 w-16 object-cover" />
                        ) : (
                          <span className="flex h-16 w-24 items-center justify-center bg-canvas px-1 text-[10px]">
                            {d.title}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {full && (
            <Card>
              <CardHeader title="Description" />
              <CardBody className="space-y-6">
                {r.scopeAndContent && (
                  <section>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Scope and content</h2>
                    <div className="prose-archive mt-2 whitespace-pre-line">{r.scopeAndContent}</div>
                  </section>
                )}
                {r.adminBiographicalHistory && (
                  <section>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                      Administrative / biographical history
                    </h2>
                    <div className="mt-2 whitespace-pre-line">{r.adminBiographicalHistory}</div>
                  </section>
                )}
                <MetaList
                  items={[
                    { label: 'Creator', value: r.creators?.map((c) => c.authorizedName).join('; ') || r.creatorNote },
                    { label: 'Dates', value: r.dateExpression },
                    { label: 'Extent and medium', value: r.extentAndMedium },
                    { label: 'Languages', value: r.languages },
                    { label: 'Arrangement', value: r.arrangement, wide: true },
                    { label: 'Archival history', value: r.archivalHistory, wide: true },
                    { label: 'Immediate source of acquisition', value: r.immediateSource, wide: true },
                    { label: 'Physical characteristics', value: r.physicalCharacteristics, wide: true },
                    { label: 'Related material', value: r.relatedMaterials, wide: true },
                    { label: 'Finding aids', value: r.findingAids, wide: true },
                    { label: 'Geographic coverage', value: r.geographicCoverage },
                  ]}
                />
                {r.subjects?.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Subjects</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.subjects.map((s) => (
                        <Link
                          key={s.id}
                          to={`/search?subjectId=${s.id}`}
                          className="rounded-full border border-line px-3 py-1 text-sm hover:bg-canvas"
                        >
                          {s.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
          <Children id={r.id} />
          {r.related?.length > 0 && (
            <Card>
              <CardHeader title="Related descriptions" />
              <ul className="divide-y divide-line">
                {r.related.map((x) => (
                  <li key={x.id}>
                    <Link to={`/records/${x.id}`} className="block px-5 py-3 hover:bg-canvas">
                      <span className="text-xs text-ink-soft">
                        {humanize(x.relationType)} · {x.referenceCode}
                      </span>
                      <span className="block font-semibold">{x.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardBody className="space-y-2">
              <p className="text-sm font-bold">Use this material</p>
              {!full && (
                <Button className="w-full" icon={KeyRound} to={`/request?type=restricted_access&recordId=${r.id}`}>
                  Request access
                </Button>
              )}
              <Button
                variant={full ? 'primary' : 'secondary'}
                className="w-full"
                icon={CalendarPlus}
                to={`/request?type=consultation&recordId=${r.id}`}
              >
                Book reading-room visit
              </Button>
              {full && (
                <Button variant="secondary" className="w-full" to={`/request?type=digital_copy&recordId=${r.id}`}>
                  Request a copy
                </Button>
              )}
              {user ? (
                <Button variant="ghost" className="w-full" icon={BookmarkPlus} onClick={save}>
                  Save to research list
                </Button>
              ) : (
                <p className="pt-1 text-xs text-ink-soft">
                  <Link to={`/login?next=/records/${r.id}`} className="font-semibold text-brand-700 hover:underline">
                    Sign in
                  </Link>{' '}
                  to save records and track requests.
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                icon={FolderTree}
                to={`/records/${r.rootId}/finding-aid`}
              >
                Collection finding aid
              </Button>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm font-bold">Cite this</p>
              <p className="mt-2 rounded-lg bg-canvas p-3 text-sm">{r.citation.text}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                icon={Copy}
                onClick={() =>
                  navigator.clipboard.writeText(r.citation.text).then(() => toast.success('Citation copied'))
                }
              >
                Copy citation
              </Button>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-sm">
              <p className="font-bold">Conditions</p>
              <dl className="mt-2 space-y-2">
                {r.accessConditions && (
                  <div>
                    <dt className="text-xs font-semibold text-ink-soft">Access</dt>
                    <dd>{r.accessConditions}</dd>
                  </div>
                )}
                {r.reproductionConditions && (
                  <div>
                    <dt className="text-xs font-semibold text-ink-soft">Reproduction</dt>
                    <dd>{r.reproductionConditions}</dd>
                  </div>
                )}
                {r.copyrightStatement && (
                  <div>
                    <dt className="text-xs font-semibold text-ink-soft">Copyright</dt>
                    <dd>{r.copyrightStatement}</dd>
                  </div>
                )}
                {r.repository && (
                  <div>
                    <dt className="text-xs font-semibold text-ink-soft">Held at</dt>
                    <dd>{r.repository.name}</dd>
                  </div>
                )}
              </dl>
              {user && full && (
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                  onClick={() => setFeedbackOpen(true)}
                >
                  <MessageSquareWarning className="h-3.5 w-3.5" /> Suggest a correction
                </button>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
      <Dialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title="Suggest a correction"
        description="Your note goes to the archivists. It does not change the catalogue directly."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFeedbackOpen(false)}>
              Cancel
            </Button>
            <Button disabled={feedback.trim().length < 5} onClick={sendFeedback}>
              Send
            </Button>
          </>
        }
      >
        <Field label="Your note">
          <Textarea rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}
