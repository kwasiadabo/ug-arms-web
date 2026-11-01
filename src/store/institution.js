/**
 * Store of the public institution settings (names, tagline, registration and enquiry options, privacy notice),
 * loaded once at start-up, with sensible defaults until they arrive.
 *
 * @author Kwasi Adabo Boakye
 */

import { create } from 'zustand';

export const useInstitution = create((set) => ({
  name: 'University of Ghana Archives',
  shortName: 'UG Archives',
  tagline: 'Records Management',
  allowAnonymousEnquiries: true,
  publicRegistration: true,
  registrationNotice: '',
  setFromSettings: (s) =>
    set({
      name: s['institution.name'] || 'University of Ghana Archives',
      shortName: s['institution.shortName'] || 'UG Archives',
      tagline: s['institution.tagline'] || 'Records Management',
      allowAnonymousEnquiries: s['research.allowAnonymousEnquiries'] !== false,
      publicRegistration: s['security.publicRegistration'] !== false,
      registrationNotice: s['privacy.registrationNotice'] || '',
    }),
}));
