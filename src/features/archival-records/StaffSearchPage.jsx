/**
 * Staff catalogue search page.
 *
 * @author Kwasi Adabo Boakye
 */

import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { SearchExperience } from '../../components/search/SearchExperience.jsx';

/**
 * Renders the shared search interface against the staff search API, which searches descriptions and approved OCR
 * text the user is cleared to read; restricted results show identifying information only.
 *
 * @returns {JSX.Element}
 */
export default function StaffSearchPage() {
  return (
    <div>
      <PageHeader
        title="Catalogue search"
        description="Searches descriptions and approved OCR text you are cleared to read. Restricted results show metadata only."
      />
      <SearchExperience
        endpoint="/search"
        suggestEndpoint="/search/suggest"
        recordHref={(id) => `/admin/records/${id}`}
        staff
        title="Catalogue search"
      />
    </div>
  );
}
