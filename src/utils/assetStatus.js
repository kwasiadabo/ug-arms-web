/**
 * Digital asset statuses shared by the pages that show uploads.
 *
 * @author Kwasi Adabo Boakye
 */

/**
 * Statuses of a file that is still on its way: received and waiting for its malware scan, being scanned and copied
 * to secure storage, or having its derivatives made. Pages refresh while any file is in one of these.
 */
export const IN_PROGRESS = ['uploaded', 'scanning', 'processing'];
