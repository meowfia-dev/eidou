import { invokeMock, resetTestEnv } from '../../test/test-env';
import { describe, it, expect, afterEach } from 'bun:test';
import { render, fireEvent, cleanup } from '../../test/utils';
import { Button } from './Button';

describe('Button', () => {
  afterEach(() => {
    cleanup();
    resetTestEnv();
  });

  it('is disabled and shows error title when action is missing', () => {
    const { getByRole } = render(<Button label="No Action" action={undefined as unknown as string} />);
    const button = getByRole('button') as HTMLButtonElement;
    
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('ERR_MISSING_ACTION');
  });

  it('calls invoke with correct payload when action is present', () => {
    const { getByRole } = render(<Button label="Has Action" action="my_action" />);
    const button = getByRole('button') as HTMLButtonElement;
    
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    
    expect(invokeMock).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith('submit_action', {
      payload: {
        action: 'my_action',
        payload: {}
      }
    });
  });

  it('does not call invoke when action is missing', () => {
    const { getByRole } = render(<Button label="No Action" action={undefined as unknown as string} />);
    const button = getByRole('button') as HTMLButtonElement;
    
    // Even if we force click (though it is disabled)
    fireEvent.click(button);
    
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('does not emit event when disabled is true', () => {
    const { getByRole } = render(<Button label="Disabled" action="my_action" disabled={true} />);
    const button = getByRole('button') as HTMLButtonElement;
    
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('shows spinner and does not emit when loading is true', () => {
    const { getByRole, container } = render(<Button label="Loading" action="my_action" loading={true} />);
    const button = getByRole('button') as HTMLButtonElement;
    
    expect(button.disabled).toBe(true);
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    
    fireEvent.click(button);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
