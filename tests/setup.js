/**
 * Vitest setup for the frontend unit tests: adds the jest-dom matchers, cleans up rendered components after each
 * test, and provides the minimal `showModal` and `close` behaviour of `<dialog>`, which jsdom does not implement.
 *
 * @author Kwasi Adabo Boakye
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
// jsdom does not implement <dialog>; provide the minimum the Dialog component uses.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
}
