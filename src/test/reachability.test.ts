import './test-env';
import { describe, expect, it } from 'bun:test';
import { diagnoseInteractiveReachability } from '../lib/reachability';

function mockRect(
  element: HTMLElement,
  rect: { top: number; left: number; width: number; height: number },
): void {
  const value = {
    x: rect.left,
    y: rect.top,
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => ({}),
  } as DOMRect;

  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => value,
  });
}

describe('diagnoseInteractiveReachability', () => {
  it('reports zero-size interactive elements', () => {
    const container = document.createElement('div');
    const button = document.createElement('button');
    button.id = 'zero-size';
    container.appendChild(button);

    mockRect(container, { top: 0, left: 0, width: 200, height: 200 });
    mockRect(button, { top: 10, left: 10, width: 0, height: 20 });

    const report = diagnoseInteractiveReachability(container);
    expect(report.totalInteractive).toBe(1);
    expect(report.unreachable).toHaveLength(1);
    expect(report.unreachable[0]?.reason).toBe('zero-size');
    expect(report.unreachable[0]?.id).toBe('zero-size');
  });

  it('reports outside elements when no scroll path exists', () => {
    const container = document.createElement('div');
    const button = document.createElement('button');
    button.id = 'outside';
    container.appendChild(button);

    mockRect(container, { top: 0, left: 0, width: 200, height: 200 });
    mockRect(button, { top: 260, left: 20, width: 80, height: 30 });

    const report = diagnoseInteractiveReachability(container);
    expect(report.totalInteractive).toBe(1);
    expect(report.unreachable).toHaveLength(1);
    expect(report.unreachable[0]?.reason).toBe('outside-without-scroll');
    expect(report.unreachable[0]?.id).toBe('outside');
  });

  it('ignores outside elements when a scrollable ancestor exists', () => {
    const container = document.createElement('div');
    const scrollArea = document.createElement('div');
    const button = document.createElement('button');
    button.id = 'scroll-reachable';
    scrollArea.appendChild(button);
    container.appendChild(scrollArea);

    mockRect(container, { top: 0, left: 0, width: 200, height: 200 });
    mockRect(button, { top: 260, left: 20, width: 80, height: 30 });

    Object.defineProperty(scrollArea, 'clientHeight', { configurable: true, value: 120 });
    Object.defineProperty(scrollArea, 'scrollHeight', { configurable: true, value: 600 });
    Object.defineProperty(scrollArea, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(scrollArea, 'scrollWidth', { configurable: true, value: 200 });

    const report = diagnoseInteractiveReachability(container);
    expect(report.totalInteractive).toBe(1);
    expect(report.unreachable).toHaveLength(0);
  });
});
