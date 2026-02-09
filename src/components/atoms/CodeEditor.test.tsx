import '../../test/test-env';
import { describe, it, expect, afterEach } from 'bun:test';
import { render, cleanup } from '../../test/utils';
import { invokeMock, resetTestEnv } from '../../test/test-env';
import { useEffect } from 'react';
import { useCommittedTextInput } from '../../lib/hooks/useCommittedTextInput';

describe('CodeEditor', () => {
  afterEach(() => {
    cleanup();
    resetTestEnv();
  });

  it('emits INPUT_CHANGE on blur commit', () => {
    function Harness() {
      const { onChange, onBlurCommit } = useCommittedTextInput({
        name: 'script',
        value: "console.log('init')",
        trigger: 'blur',
      });

      useEffect(() => {
        onChange("console.log('changed')");
        onBlurCommit();
      }, [onChange, onBlurCommit]);

      return null;
    }

    render(<Harness />);

    expect(invokeMock).toHaveBeenCalledWith('submit_action', {
      payload: {
        action: 'input_change',
        payload: {
          kind: 'input_change',
          name: 'script',
          value: "console.log('changed')",
        },
      },
    });
  });
});
