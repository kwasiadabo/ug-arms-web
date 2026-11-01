/**
 * Unit tests for user-interface components: accessible field wiring, confirmation dialogs that require a reason or
 * a typed phrase, and status badges.
 *
 * @author Kwasi Adabo Boakye
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field, Input, ConfirmDialog, StatusBadge } from '../../src/components/ui/index.js';
import { Credits, APP_VERSION } from '../../src/components/layout/Credits.jsx';
import pkg from '../../package.json';

describe('Field', () => {
  it('associates label, help and error text with the control', () => {
    render(
      <Field label="Title" required help="As it appears" error="Title is required">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText(/^Title/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Title is required');
  });
  it('keeps hints out of the accessible name', () => {
    render(
      <Field label="Password" hint={<a href="/x">Forgot password?</a>}>
        <Input type="password" />
      </Field>,
    );
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('requires the typed phrase before a destructive action', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Execute"
        confirmText="UGA/DSP/2026/0001"
        confirmLabel="Execute disposal"
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: 'Execute disposal' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox'), 'UGA/DSP/2026/0001');
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onConfirm).toHaveBeenCalled();
  });
  it('treats an optional reason as optional', () => {
    render(
      <ConfirmDialog
        open
        title="Approve"
        requireReason="optional"
        confirmLabel="Approve"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });
});

describe('StatusBadge', () => {
  it('renders a readable status', () => {
    render(<StatusBadge status="awaiting_approval" />);
    expect(screen.getByText('Awaiting approval')).toBeInTheDocument();
  });
});

describe('Credits', () => {
  it('shows the release version, kept in step with package.json, and the development credit', () => {
    expect(APP_VERSION).toBe(pkg.version);
    render(<Credits />);
    expect(
      screen.getByText(`Version ${pkg.version} · Developed by Variable-x Solutions in collaboration with Globe Inform`),
    ).toBeInTheDocument();
  });
});
