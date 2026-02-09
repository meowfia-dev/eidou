import { invokeMock, resetTestEnv } from '../../test/test-env';
import { render, fireEvent, cleanup } from '../../test/utils';
import { describe, it, expect, afterEach } from 'bun:test';
import { Switch } from './Switch';

describe('Switch Atom', () => {
  afterEach(() => {
    resetTestEnv();
    cleanup();
  });

  it('renders with initial state', () => {
    const { getByRole, getByText } = render(<Switch name="test-switch" checked={true} label="Toggle Me" />);
    const switchEl = getByRole('switch');
    expect(switchEl.getAttribute('aria-checked')).toBe('true');
    expect(getByText('Toggle Me')).toBeTruthy();
  });

  it('emits switch_change event on toggle', () => {
    const { getByRole } = render(<Switch name="test-switch" checked={false} />);
    const switchEl = getByRole('switch');
    
    // Initial state
    expect(switchEl.getAttribute('aria-checked')).toBe('false');

    // User interaction
    fireEvent.click(switchEl);

    // Optimistic update check (optional but good)
    expect(switchEl.getAttribute('aria-checked')).toBe('true');

    // Protocol check
    expect(invokeMock).toHaveBeenCalledWith('submit_action', {
      payload: {
        action: 'switch_change',
        payload: {
          kind: 'switch_change',
          name: 'test-switch',
          value: true,
        },
      },
    });
  });
});
