/**
 * Public help page: how to visit, the access policy and the reading rooms.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { Card, CardBody } from '../../components/ui/index.js';

/**
 * Explains how to use the archives and the access policy, and lists the reading rooms with their opening details.
 *
 * @returns {JSX.Element}
 */
export default function HelpPage() {
  useEffect(() => {
    document.title = 'Visiting and access · UG Archives';
  }, []);
  const rooms = useQuery({
    queryKey: ['reading-rooms'],
    queryFn: () => api.get('/reading-rooms').then((r) => r.data.data),
  });
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="label-eyebrow">Help</p>
      <h1 className="mt-1 text-3xl font-extrabold">Visiting and access policy</h1>
      <p className="mt-3 text-ink-soft">
        This page summarises how access works in this system. The University's approved access policy, opening hours and
        conduct rules take precedence and will be published here once confirmed.
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {[
          [
            'Open material',
            'Published descriptions marked open can be read online. Where digital copies are published you can view them, and download them if the rights allow.',
          ],
          [
            'Restricted material',
            'Some records are restricted to protect privacy, legal interests, donor wishes or fragile originals. You can see that they exist and request access. Requests are reviewed by an archivist and sometimes a second approver.',
          ],
          [
            'Embargoes',
            'Embargoed material is closed until a stated date. When the date passes, the Archives reviews the material before opening it.',
          ],
          [
            'Reading-room visits',
            'Physical originals are consulted under supervision. Book a slot after your request is approved and bring photo identification.',
          ],
          [
            'Copies and reproduction',
            'Approval to consult does not by itself permit copying. Copyright and reproduction conditions are checked separately for each copy.',
          ],
          [
            'Your information',
            'We collect only what is needed to manage your requests and keep it according to the approved retention policy.',
          ],
        ].map(([t, d]) => (
          <Card key={t}>
            <CardBody>
              <h2 className="font-bold">{t}</h2>
              <p className="mt-1.5 text-sm text-ink-soft">{d}</p>
            </CardBody>
          </Card>
        ))}
      </div>
      {rooms.data?.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">Reading rooms</h2>
          <ul className="mt-4 space-y-3">
            {rooms.data.map((r) => (
              <li key={r.id} className="card p-4">
                <p className="font-bold">{r.name}</p>
                <p className="text-sm text-ink-soft">{r.location}</p>
                {r.rules && <p className="mt-2 whitespace-pre-line text-sm">{r.rules}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
