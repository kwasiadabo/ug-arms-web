/**
 * Class-name helper used by every component.
 *
 * @author Kwasi Adabo Boakye
 */

import clsx from 'clsx';

/**
 * Joins CSS class names, ignoring false, null and undefined values (a thin wrapper around clsx).
 *
 * @param {...*} a Class names or conditional class objects.
 * @returns {string}
 */
export const cn = (...a) => clsx(...a);
