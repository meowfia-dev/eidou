import { invokeMock, resetTestEnv } from '../../test/test-env';
import { render, fireEvent, cleanup } from '../../test/utils';
import { describe, it, expect, afterEach } from 'bun:test';
import { RadioGroup } from './RadioGroup';

describe('RadioGroup Atom', () => {
  afterEach(() => {
    resetTestEnv();
    cleanup();
  });

  it('renders options correctly', () => {
    const options = [
      { label: 'Option A', value: 'a' },
      { label: 'Option B', value: 'b' },
    ];
    const { getByRole } = render(<RadioGroup name="test-radio" value="a" options={options} />);
    
    const radioA = getByRole('radio', { name: 'Option A' });
    const radioB = getByRole('radio', { name: 'Option B' });

    expect(radioA.getAttribute('aria-checked')).toBe('true');
    expect(radioB.getAttribute('aria-checked')).toBe('false');
  });

  it('emits input_change event on selection', () => {
    const options = [
      { label: 'Option A', value: 'a' },
      { label: 'Option B', value: 'b' },
    ];
    const { getByRole } = render(<RadioGroup name="test-radio" value="a" options={options} />);
    
    const radioB = getByRole('radio', { name: 'Option B' });

    fireEvent.click(radioB);

    expect(radioB.getAttribute('aria-checked')).toBe('true');

    expect(invokeMock).toHaveBeenCalledWith('submit_action', {
      payload: {
        action: 'input_change',
        payload: {
          kind: 'input_change',
          name: 'test-radio',
          value: 'b',
        },
      },
    });
  });
});
