/**
 * Research request form of the public portal.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../store/auth.js';
import { Button, Field, Input, Textarea, Select, Checkbox, Alert, Card, CardBody } from '../../components/ui/index.js';

const TYPES = [
  { value: 'consultation', label: 'Consult material in the reading room' },
  { value: 'restricted_access', label: 'Request access to restricted material' },
  { value: 'digital_copy', label: 'Request a digital copy' },
  { value: 'enquiry', label: 'General research enquiry' },
];

const schema = z.object({
  requestType: z.enum(['consultation', 'digital_copy', 'restricted_access', 'enquiry', 'reproduction']),
  purpose: z.string().trim().min(10, 'Please describe your research (at least 10 characters)'),
  preferredDate: z.string().optional(),
  deliveryPreference: z.string().optional(),
  affiliation: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  restrictionsAcknowledged: z.boolean().optional(),
});

/**
 * Lets a visitor send an enquiry, book a consultation, request access to restricted material or ask for a copy. A
 * description linked from its page is added to the requested material automatically, and duplicates are ignored.
 * Visitors without an account may only send enquiries and consultation requests, and only where the Archives allows
 * it. Restricted access requires acknowledging the access conditions. After submission the request number is shown
 * with a link to track it.
 *
 * @returns {JSX.Element}
 */
export default function RequestPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const [items, setItems] = useState([]);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);
  const recordId = params.get('recordId');
  const { data: rec } = useQuery({
    queryKey: ['public-record', recordId],
    queryFn: () => api.get(`/public/records/${recordId}`).then((r) => r.data.data),
    enabled: Boolean(recordId),
  });
  useEffect(() => {
    if (rec)
      setItems((x) =>
        x.some((i) => i.id === rec.id) ? x : [...x, { id: rec.id, title: rec.title, referenceCode: rec.referenceCode }],
      );
  }, [rec]);
  useEffect(() => {
    document.title = 'Research request · UG Archives';
  }, []);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { requestType: params.get('type') || 'consultation', restrictionsAcknowledged: false },
  });
  const type = watch('requestType');
  const needsAccount = ['restricted_access', 'digital_copy'].includes(type) && !user;

  /**
   * Submits the request, through the anonymous enquiry endpoint when the visitor is not signed in, and shows the
   * confirmation or the error.
   *
   * @param {object} values Validated form values.
   * @returns {Promise<void>}
   */
  const onSubmit = async (v) => {
    setError(null);
    if (type === 'restricted_access' && !v.restrictionsAcknowledged) {
      setError('Please acknowledge the access conditions.');
      return;
    }
    if (!user && (!v.contactName || !v.contactEmail)) {
      setError('Please give your name and email address.');
      return;
    }
    try {
      const body = { ...v, preferredDate: v.preferredDate || undefined, items: items.map((i) => ({ recordId: i.id })) };
      const res = user ? await api.post('/research-requests', body) : await api.post('/research-requests/public', body);
      setDone(res.data.data);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="success" icon={CheckCircle2} title={`Request ${done.requestNumber || ''} received`}>
          We have emailed a confirmation. An archivist will review your request and contact you.
        </Alert>
        <div className="mt-6 flex gap-2">
          {user ? (
            <Button onClick={() => navigate(`/my/requests/${done.id}`)}>Track this request</Button>
          ) : (
            <Button to="/register" variant="secondary">
              Create an account to track requests
            </Button>
          )}
          <Button variant="ghost" to="/search">
            Continue searching
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="label-eyebrow">Research services</p>
      <h1 className="mt-1 text-3xl font-extrabold">Make a research request</h1>
      <p className="mt-2 text-ink-soft">
        Tell us what you need. Requests for restricted material are reviewed and may need a second approval. We will
        never ask for payment unless an approved fee applies.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Card>
          <CardBody className="space-y-4">
            <Field label="What would you like to do?" required>
              <Select {...register('requestType')}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            {needsAccount && (
              <Alert tone="warning">
                Please{' '}
                <Link
                  className="font-semibold underline"
                  to={`/login?next=${encodeURIComponent(`/request?${params.toString()}`)}`}
                >
                  sign in
                </Link>{' '}
                or{' '}
                <Link className="font-semibold underline" to="/register">
                  register
                </Link>{' '}
                to request restricted access or copies.
              </Alert>
            )}
            <div>
              <p className="text-[13px] font-semibold">Requested material</p>
              {items.length ? (
                <ul className="mt-2 space-y-2">
                  {items.map((i) => (
                    <li
                      key={i.id}
                      className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="text-xs text-gold-600">{i.referenceCode}</span> {i.title}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${i.title}`}
                        onClick={() => setItems((x) => x.filter((y) => y.id !== i.id))}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-ink-soft">
                  {type === 'enquiry' ? 'Optional. ' : ''}Add material from a description page using “Book reading-room
                  visit” or “Request access”.
                </p>
              )}
            </div>
            <Field
              label="Research purpose"
              required
              help="What you are researching and how the material will be used"
              error={errors.purpose?.message}
            >
              <Textarea rows={5} {...register('purpose')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preferred date">
                <Input type="date" min={new Date().toISOString().slice(0, 10)} {...register('preferredDate')} />
              </Field>
              {type === 'digital_copy' && (
                <Field label="Delivery preference">
                  <Input placeholder="e.g. PDF by download" {...register('deliveryPreference')} />
                </Field>
              )}
              <Field label="Affiliation">
                <Input {...register('affiliation')} defaultValue={user?.affiliation} />
              </Field>
            </div>
            {!user && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name" required>
                  <Input autoComplete="name" {...register('contactName')} />
                </Field>
                <Field label="Email" required>
                  <Input type="email" autoComplete="email" {...register('contactEmail')} />
                </Field>
              </div>
            )}
            {type === 'restricted_access' && (
              <Checkbox
                label="I acknowledge the access conditions"
                description="Approved access may be time-limited, on-site only, and subject to conditions. Use of restricted material is logged."
                {...register('restrictionsAcknowledged')}
              />
            )}
          </CardBody>
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={needsAccount || (type !== 'enquiry' && !items.length)}>
            Submit request
          </Button>
        </div>
      </form>
    </div>
  );
}
