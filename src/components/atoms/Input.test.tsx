import '../../test/test-env';
import { describe, it, expect, afterEach } from 'bun:test';
import { render, fireEvent, cleanup } from '../../test/utils';
import { Input } from './Input';
import { invokeMock, resetTestEnv } from '../../test/test-env';
import { useEffect } from 'react';
import { useCommittedTextInput } from '../../lib/hooks/useCommittedTextInput';

describe('Input', () => {
  afterEach(() => {
    cleanup();
    resetTestEnv();
  });

  it('overwrites local value when server prop changes', () => {
    const { rerender, getByRole } = render(<Input name="test" value="Initial" />);
    const input = getByRole('textbox') as HTMLInputElement;

    expect(input.value).toBe('Initial');

    // User types "Changed"
    fireEvent.change(input, { target: { value: 'Changed' } });
    expect(input.value).toBe('Changed');

    // Server sends update "Server Override"
    rerender(<Input name="test" value="Server Override" />);

    // Expect overwrite (Goal of the refactor)
    expect(input.value).toBe('Server Override');
  });

  it('does not double emit when blurring before debounce timer with trigger="change"', async () => {
    function Harness() {
      const { onChange, onBlurCommit } = useCommittedTextInput({
        name: 'test-input',
        value: 'start',
        trigger: 'change',
      });

      useEffect(() => {
        onChange('startA');
        onBlurCommit();
      }, [onChange, onBlurCommit]);

      return null;
    }

    render(<Harness />);

    // Should emit immediately due to blur commit
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('submit_action', {
      payload: {
        action: 'input_change',
        payload: {
          kind: 'input_change',
          name: 'test-input',
          value: 'startA',
        }
      }
    });

    // Reset mock to check for double emit
    invokeMock.mockClear();

    // Wait for > 300ms (default debounce is 300ms)
    await new Promise(resolve => setTimeout(resolve, 350));

    // Should NOT emit again
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('does not emit event when disabled is true', () => {
    const { getByRole } = render(<Input name="test" value="Initial" disabled={true} />);
    const input = getByRole('textbox') as HTMLInputElement;
    
    expect(input.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'Changed' } });
    
    // No emission should happen
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('shows error styling and message when error is set', () => {
    const { getByRole, container } = render(<Input name="test" value="" error="This field is required" />);
    const input = getByRole('textbox') as HTMLInputElement;
    
    expect(input.className).toContain('border-danger');
    expect(container.textContent).toContain('This field is required');
  });
});
