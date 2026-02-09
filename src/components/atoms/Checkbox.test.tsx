import { invokeMock, resetTestEnv } from '../../test/test-env';
import { render, fireEvent, cleanup } from '../../test/utils';
import { describe, it, expect, afterEach } from 'bun:test';
import { Checkbox } from './Checkbox';

describe('Checkbox Atom', () => {
  afterEach(() => {
    resetTestEnv();
    cleanup();
  });

  it('renders with initial state', () => {
    const { getByRole, getByText } = render(<Checkbox name="test-check" checked={true} label="Accept Terms" />);
    const checkbox = getByRole('checkbox');
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
    expect(getByText('Accept Terms')).toBeTruthy();
  });

  it('emits input_change event on click', () => {
    const { getByRole } = render(<Checkbox name="test-check" checked={false} />);
    const checkbox = getByRole('checkbox');
    
    expect(checkbox.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(checkbox);

    expect(checkbox.getAttribute('aria-checked')).toBe('true');

    expect(invokeMock).toHaveBeenCalledWith('submit_action', {
      payload: {
        action: 'input_change',
        payload: {
          kind: 'input_change',
          name: 'test-check',
          value: true,
        },
      },
    });
  });
});
