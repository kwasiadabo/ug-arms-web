/**
 * Form for creating and editing an archival description, grouped by the ISAD(G) areas.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage, fieldErrors } from '../../lib/api.js';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { FormSection, FormActions } from '../../components/forms/FormSection.jsx';
import {
  Button,
  Field,
  Input,
  Textarea,
  Select,
  Checkbox,
  PageLoader,
  ErrorState,
  Alert,
} from '../../components/ui/index.js';
import { humanize } from '../../utils/format.js';
import { ACCESS_LEVELS, REQUIRED, childLevels } from './constants.js';

const TEXT_FIELDS = [
  'title',
  'alternativeTitle',
  'localIdentifier',
  'referenceCode',
  'collectionType',
  'dateExpression',
  'dateStart',
  'dateEnd',
  'bulkDateStart',
  'bulkDateEnd',
  'extentAndMedium',
  'creatorNote',
  'adminBiographicalHistory',
  'archivalHistory',
  'immediateSource',
  'scopeAndContent',
  'appraisalInfo',
  'accruals',
  'arrangement',
  'accessConditions',
  'reproductionConditions',
  'copyrightStatement',
  'physicalCharacteristics',
  'findingAids',
  'locationOfOriginals',
  'locationOfCopies',
  'relatedMaterials',
  'publicationNote',
  'archivistNote',
  'rulesConventions',
  'descriptionDate',
  'preferredCitation',
  'geographicCoverage',
  'preservationNote',
  'reviewDate',
  'originatingUnitId',
  'retentionTriggerDate',
];

/**
 * Converts a description from the API into form values: empty fields become empty text, lists become
 * semicolon-separated text, and defaults are applied.
 *
 * @param {object|null} r The description, or null for a new one.
 * @returns {object}
 */
function toForm(r) {
  const v = {};
  for (const f of TEXT_FIELDS) v[f] = r?.[f] ?? '';
  v.languages = (r?.languages || []).join('; ');
  v.keywords = (r?.keywords || []).join('; ');
  v.isFeatured = Boolean(r?.isFeatured);
  v.isPermanent = r?.isPermanent ?? true;
  v.custodyStatus = r?.custodyStatus || 'accessioned';
  v.level = r?.level || '';
  v.accessLevel = r?.accessLevel || '';
  v.changeSummary = '';
  return v;
}

/**
 * Splits semicolon-separated text into a list of trimmed, non-empty values.
 *
 * @param {string} text The text.
 * @returns {string[]}
 */
const splitList = (text) =>
  text
    ? text
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

/**
 * Converts form values into the request body: empty text becomes null, lists are split on semicolons, and an empty
 * reference code is left for the server to generate. The level and initial access level are sent only when
 * creating, and the local identifier only when creating.
 *
 * @param {object} v Form values.
 * @param {{ isNew: boolean }} options Whether a new description is being created.
 * @returns {object}
 */
function fromForm(v, { isNew }) {
  const out = {};
  for (const f of TEXT_FIELDS) out[f] = v[f] === '' ? null : v[f];
  out.languages = splitList(v.languages);
  out.keywords = splitList(v.keywords);
  out.isFeatured = v.isFeatured;
  out.isPermanent = v.isPermanent;
  out.custodyStatus = v.custodyStatus;
  if (!out.referenceCode) delete out.referenceCode;
  if (isNew) {
    out.level = v.level;
    if (v.accessLevel) out.accessLevel = v.accessLevel;
  } else {
    delete out.localIdentifier;
  }
  return out;
}

/**
 * Edits an existing description, or creates one under an optional parent. The levels offered depend on the parent,
 * and the fields required for the chosen level are marked. Editing sends the version that was loaded, so a
 * concurrent change by someone else is reported instead of being overwritten. A summary of the change is recorded
 * in the version history.
 *
 * @returns {JSX.Element}
 */
export default function RecordEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const parentId = params.get('parentId');
  const record = useQuery({
    queryKey: ['record', id],
    queryFn: () => api.get(`/records/${id}`).then((r) => r.data.data),
    enabled: !isNew,
  });
  const parent = useQuery({
    queryKey: ['record', parentId],
    queryFn: () => api.get(`/records/${parentId}`).then((r) => r.data.data),
    enabled: Boolean(parentId),
  });
  const units = useQuery({
    queryKey: ['org-units'],
    queryFn: () => api.get('/organisation-units').then((r) => r.data.data),
  });
  const vocabs = useQuery({
    queryKey: ['vocabularies'],
    queryFn: () => api.get('/vocabularies').then((r) => r.data.data),
  });
  const collectionTypes = vocabs.data?.find((v) => v.code === 'collection_types')?.terms || [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({ defaultValues: toForm(null) });
  useEffect(() => {
    if (record.data) reset(toForm(record.data));
  }, [record.data, reset]);
  useEffect(() => {
    if (isNew) reset({ ...toForm(null), level: childLevels(parent.data?.level)[0] || 'fonds', accessLevel: '' });
  }, [isNew, parent.data, reset]);
  useUnsavedChanges(isDirty && !isSubmitting);

  const level = watch('level') || record.data?.level;
  const required = useMemo(() => new Set(REQUIRED[level] || []), [level]);

  /**
   * Tells whether a field is required for the selected level.
   *
   * @param {string} f Field name.
   * @returns {boolean}
   */
  const req = (f) => required.has(f);
  const isTop = !level || ['fonds', 'collection'].includes(level);

  /**
   * Creates the description as a draft or saves the changes, then opens it.
   *
   * @param {object} v Form values.
   * @returns {Promise<void>}
   */
  const onSubmit = async (v) => {
    if (v.dateStart && v.dateEnd && v.dateStart > v.dateEnd) {
      setError('dateEnd', { message: 'End date must be on or after the start date' });
      return;
    }
    const body = fromForm(v, { isNew });
    try {
      if (isNew) {
        if (!body.referenceCode && !v.localIdentifier) {
          setError('localIdentifier', { message: 'Provide a local identifier' });
          return;
        }
        const res = await api.post('/records', { ...body, parentId: parentId || null });
        toast.success('Description created as a draft');
        reset(v);
        navigate(`/admin/records/${res.data.data.id}`, { replace: true });
      } else {
        await api.patch(`/records/${id}`, {
          ...body,
          version: record.data.version,
          changeSummary: v.changeSummary || undefined,
        });
        toast.success('Changes saved');
        reset(v);
        navigate(`/admin/records/${id}`);
      }
    } catch (err) {
      Object.entries(fieldErrors(err)).forEach(([k, m]) => setError(k, { message: m }));
      toast.error(errorMessage(err));
    }
  };

  if (!isNew && record.isLoading) return <PageLoader />;
  if (!isNew && record.error) return <ErrorState error={record.error} onRetry={record.refetch} />;
  const r = record.data;
  const trail = (r?.breadcrumbs || []).map((b) => ({ label: b.title, to: `/admin/records/${b.id}` }));
  const parentTrail = parent.data
    ? [
        ...(parent.data.breadcrumbs || []).map((b) => ({ label: b.title, to: `/admin/records/${b.id}` })),
        { label: parent.data.title, to: `/admin/records/${parent.data.id}` },
      ]
    : [];
  const crumbs = [
    { label: 'Descriptions', to: '/admin/records' },
    ...(isNew ? parentTrail : trail),
    ...(isNew ? [{ label: 'New' }] : [{ label: r.title, to: `/admin/records/${r.id}` }, { label: 'Edit' }]),
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <PageHeader
        breadcrumbs={crumbs}
        title={isNew ? (parent.data ? 'New description' : 'New collection or fonds') : `Edit ${r.referenceCode}`}
        description={
          isNew
            ? parent.data
              ? `Within ${parent.data.referenceCode} — ${parent.data.title}`
              : 'A top-level fonds or collection.'
            : 'Changes are versioned. Approved or published descriptions can be edited only by reviewers.'
        }
      />
      {!isNew && ['approved', 'published'].includes(r.status) && (
        <Alert tone="warning" className="mb-4">
          This description is {r.status}. Your edit is recorded as a new version and in the audit trail.
        </Alert>
      )}
      <div className="space-y-6">
        <FormSection
          id="identity"
          title="Identity statement"
          description="Reference code, title, dates, level and extent."
        >
          {isNew ? (
            <Field label="Level of description" required>
              <Select {...register('level')}>
                {childLevels(parent.data?.level).map((l) => (
                  <option key={l} value={l}>
                    {humanize(l)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Level of description">
              <Input value={humanize(r.level)} disabled readOnly />
            </Field>
          )}
          {isNew ? (
            <Field
              label="Local identifier"
              required
              help={
                parent.data
                  ? `The reference code becomes ${parent.data.referenceCode}/<identifier>`
                  : 'Appended to the repository code'
              }
              error={errors.localIdentifier?.message}
            >
              <Input {...register('localIdentifier')} />
            </Field>
          ) : (
            <Field
              label="Reference code"
              help={r.status === 'published' ? 'Cannot change once published' : 'Must be unique'}
              error={errors.referenceCode?.message}
            >
              <Input {...register('referenceCode')} disabled={r.status === 'published'} />
            </Field>
          )}
          <Field label="Title" required className="sm:col-span-2" error={errors.title?.message}>
            <Input {...register('title', { required: 'Title is required' })} />
          </Field>
          <Field label="Alternative title" className="sm:col-span-2">
            <Input {...register('alternativeTitle')} />
          </Field>
          <Field
            label="Date (as expressed)"
            required={req('dates')}
            help="e.g. 1948–1962, predominantly 1950s"
            error={errors.dateExpression?.message}
          >
            <Input {...register('dateExpression')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" error={errors.dateStart?.message}>
              <Input type="date" {...register('dateStart')} />
            </Field>
            <Field label="End date" error={errors.dateEnd?.message}>
              <Input type="date" {...register('dateEnd')} />
            </Field>
          </div>
          <Field label="Extent and medium" required={req('extentAndMedium')} help="e.g. 12 boxes (1.8 linear metres)">
            <Input {...register('extentAndMedium')} />
          </Field>
          {isTop && (
            <Field label="Collection type">
              <Select {...register('collectionType')} placeholder="Not specified">
                {collectionTypes.map((t) => (
                  <option key={t.id} value={t.label}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </FormSection>

        <FormSection
          id="context"
          title="Context"
          description="Who created the material and how it came to the Archives."
        >
          <Field
            label="Creator"
            required={req('creator')}
            help="Link authority records on the description page; this note is a fallback."
          >
            <Input {...register('creatorNote')} />
          </Field>
          <Field label="Originating department or unit">
            <Select {...register('originatingUnitId')} placeholder="Not recorded">
              {(units.data || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Administrative / biographical history"
            required={req('adminBiographicalHistory')}
            className="sm:col-span-2"
          >
            <Textarea rows={5} {...register('adminBiographicalHistory')} />
          </Field>
          <Field label="Archival (custodial) history" className="sm:col-span-2">
            <Textarea rows={3} {...register('archivalHistory')} />
          </Field>
          <Field label="Immediate source of acquisition" className="sm:col-span-2">
            <Textarea rows={2} {...register('immediateSource')} />
          </Field>
        </FormSection>

        <FormSection id="content" title="Content and structure">
          <Field label="Scope and content" required={req('scopeAndContent')} className="sm:col-span-2">
            <Textarea rows={6} {...register('scopeAndContent')} />
          </Field>
          <Field
            label="Appraisal, destruction and scheduling"
            className="sm:col-span-2"
            help="Internal; not shown publicly"
          >
            <Textarea rows={2} {...register('appraisalInfo')} />
          </Field>
          <Field label="Accruals">
            <Textarea rows={2} {...register('accruals')} />
          </Field>
          <Field label="System of arrangement">
            <Textarea rows={2} {...register('arrangement')} />
          </Field>
        </FormSection>

        <FormSection
          id="conditions"
          title="Conditions of access and use"
          description="Access and reproduction conditions are required before publication. Access levels are changed on the Access tab."
        >
          {isNew && (
            <Field
              label="Initial access level"
              help={
                parent.data
                  ? 'Children inherit the parent restriction and can never be more open.'
                  : 'Defaults to staff only'
              }
            >
              <Select {...register('accessLevel')} placeholder="Default">
                {ACCESS_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {humanize(l)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Conditions governing access" className="sm:col-span-2">
            <Textarea rows={2} {...register('accessConditions')} />
          </Field>
          <Field label="Conditions governing reproduction" className="sm:col-span-2">
            <Textarea rows={2} {...register('reproductionConditions')} />
          </Field>
          <Field label="Copyright statement" className="sm:col-span-2">
            <Textarea rows={2} {...register('copyrightStatement')} />
          </Field>
          <Field label="Languages" help="Separate with semicolons">
            <Input {...register('languages')} />
          </Field>
          <Field label="Physical characteristics and technical requirements">
            <Input {...register('physicalCharacteristics')} />
          </Field>
          <Field label="Finding aids" className="sm:col-span-2">
            <Textarea rows={2} {...register('findingAids')} />
          </Field>
        </FormSection>

        <FormSection id="allied" title="Allied materials">
          <Field label="Existence and location of originals">
            <Textarea rows={2} {...register('locationOfOriginals')} />
          </Field>
          <Field label="Existence and location of copies">
            <Textarea rows={2} {...register('locationOfCopies')} />
          </Field>
          <Field label="Related units of description" className="sm:col-span-2">
            <Textarea rows={2} {...register('relatedMaterials')} />
          </Field>
          <Field label="Publication note" className="sm:col-span-2">
            <Textarea rows={2} {...register('publicationNote')} />
          </Field>
          <Field label="Geographic coverage">
            <Input {...register('geographicCoverage')} />
          </Field>
          <Field label="Keywords" help="Free keywords; use Subjects for controlled terms">
            <Input {...register('keywords')} />
          </Field>
          <Field label="Preferred citation" className="sm:col-span-2" help="Leave blank to generate one automatically">
            <Input {...register('preferredCitation')} />
          </Field>
        </FormSection>

        <FormSection id="control" title="Description control and administration">
          <Field label="Archivist's note" className="sm:col-span-2" help="Internal only">
            <Textarea rows={2} {...register('archivistNote')} />
          </Field>
          <Field label="Rules or conventions">
            <Input placeholder="ISAD(G) 2nd edition" {...register('rulesConventions')} />
          </Field>
          <Field label="Date of description">
            <Input type="date" {...register('descriptionDate')} />
          </Field>
          <Field label="Review date">
            <Input type="date" {...register('reviewDate')} />
          </Field>
          <Field label="Custody status">
            <Select {...register('custodyStatus')}>
              <option value="accessioned">Accessioned into the Archives</option>
              <option value="departmental">Held for a department under a retention schedule</option>
            </Select>
          </Field>
          <Field label="Preservation note" className="sm:col-span-2">
            <Textarea rows={2} {...register('preservationNote')} />
          </Field>
          <div className="space-y-3 sm:col-span-2">
            <Checkbox
              label="Permanent archival holding"
              description="Excluded from routine disposal workflows"
              {...register('isPermanent')}
            />
            {isTop && (
              <Checkbox
                label="Feature on the public homepage"
                description="Only shown once published and open"
                {...register('isFeatured')}
              />
            )}
          </div>
          {!isNew && (
            <Field label="Summary of this change" className="sm:col-span-2" help="Recorded with the version history">
              <Input {...register('changeSummary')} />
            </Field>
          )}
        </FormSection>
      </div>
      <FormActions>
        <span className="mr-auto text-xs text-ink-soft">{isDirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isNew ? 'Save draft' : 'Save changes'}
        </Button>
      </FormActions>
    </form>
  );
}
