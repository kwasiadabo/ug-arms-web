/**
 * Upload progress indicator.
 *
 * @author Kwasi Adabo Boakye
 */

/**
 * Shows an accessible progress bar for a file upload, then "Processing on the server" once the transfer is
 * complete. Nothing is shown while no upload is running.
 *
 * @param {object} props
 * @param {number|null} props.percent Progress from 0 to 100.
 * @param {string} [props.label='Uploading'] Accessible label.
 * @returns {JSX.Element|null}
 */
export function UploadProgress({ percent, label = 'Uploading' }) {
  if (percent === null || percent === undefined) return null;
  return (
    <div
      className="mt-3"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className="mb-1 flex justify-between text-xs text-ink-soft">
        <span>{percent < 100 ? label : 'Processing on the server…'}</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
