/**
 * Archival description constants shared by the description pages: levels, access levels, statuses, the fields
 * required per level and workflow action labels. They mirror the server rules for display; the server is
 * authoritative.
 *
 * @author Kwasi Adabo Boakye
 */

export const LEVELS = ['fonds', 'collection', 'subfonds', 'series', 'subseries', 'file', 'item'];
export const ACCESS_LEVELS = ['open', 'staff_only', 'restricted', 'embargoed', 'confidential', 'closed'];
export const STATUSES = ['draft', 'in_review', 'approved', 'published', 'withdrawn', 'superseded'];
const RANK = { fonds: 0, collection: 0, subfonds: 1, series: 2, subseries: 3, file: 4, item: 5 };

/**
 * Lists the levels allowed beneath a parent level: fonds or collection at the top, then any lower level, and
 * sub-fonds or sub-series may be nested within themselves.
 *
 * @param {string} [parentLevel] Level of the parent, or nothing for top level.
 * @returns {string[]}
 */
export function childLevels(parentLevel) {
  if (!parentLevel) return ['fonds', 'collection'];
  return LEVELS.filter(
    (l) => RANK[l] > RANK[parentLevel] || (l === parentLevel && ['subfonds', 'subseries'].includes(l)),
  );
}

// ISAD(G)-informed minimum metadata per level (mirrors the server).
export const REQUIRED = {
  fonds: ['title', 'dates', 'extentAndMedium', 'creator', 'scopeAndContent', 'adminBiographicalHistory'],
  collection: ['title', 'dates', 'extentAndMedium', 'creator', 'scopeAndContent'],
  subfonds: ['title', 'dates', 'scopeAndContent'],
  series: ['title', 'dates', 'extentAndMedium', 'scopeAndContent'],
  subseries: ['title', 'dates'],
  file: ['title', 'dates'],
  item: ['title', 'dates'],
};

export const ACTION_LABELS = {
  submit_for_review: 'Submit for review',
  return_to_draft: 'Return to draft',
  approve: 'Approve',
  publish: 'Publish',
  withdraw: 'Withdraw',
  reinstate: 'Reinstate',
};
