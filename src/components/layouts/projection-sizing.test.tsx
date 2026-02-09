import '../../test/test-env';
import { describe, it, expect, afterEach } from 'bun:test';
import { cleanup, render } from '../../test/utils';
import { ProjectionSizingProvider } from '../../lib/projection-sizing';
import { Field } from './Field';
import { ScrollArea } from './ScrollArea';

describe('Projection sizing mode classes', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps fixed mode constraints by default', () => {
    const { container } = render(
      <Field>
        <ScrollArea>Body</ScrollArea>
      </Field>
    );

    const field = container.firstElementChild;
    const scroll = container.querySelector('.overflow-y-auto');

    expect(field?.className).toContain('h-full');
    expect(scroll?.className).toContain('h-full');
  });

  it('uses intrinsic sizing classes under intrinsic provider', () => {
    const { container } = render(
      <ProjectionSizingProvider mode="intrinsic">
        <Field>
          <ScrollArea>Body</ScrollArea>
        </Field>
      </ProjectionSizingProvider>
    );

    const field = container.firstElementChild;
    const scroll = container.querySelector('.overflow-y-auto');

    expect(field?.className).toContain('h-auto');
    expect(field?.className).not.toContain('h-full');
    expect(scroll?.className).toContain('h-auto');
    expect(scroll?.className).not.toContain('h-full');
  });
});
