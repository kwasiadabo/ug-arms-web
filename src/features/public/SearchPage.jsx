/**
 * Public search page.
 *
 * @author Kwasi Adabo Boakye
 */

import { SearchExperience } from '../../components/search/SearchExperience.jsx';

/**
 * Renders the shared search interface against the public search API, which returns only publicly discoverable
 * material.
 *
 * @returns {JSX.Element}
 */
export default function SearchPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="label-eyebrow">Catalogue</p>
      <h1 className="mb-6 mt-1 text-3xl font-extrabold">Search the archives</h1>
      <SearchExperience
        endpoint="/public/search"
        suggestEndpoint="/public/suggest"
        recordHref={(id) => `/records/${id}`}
      />
    </div>
  );
}
