export type ReachabilityIssueReason = 'zero-size' | 'outside-without-scroll';

export interface ReachabilityIssue {
  reason: ReachabilityIssueReason;
  tagName: string;
  id: string;
  role: string | null;
  rect: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface ReachabilityReport {
  totalInteractive: number;
  unreachable: ReachabilityIssue[];
}

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[tabindex]',
].join(',');

function isEnabledInteractive(element: HTMLElement): boolean {
  if ('disabled' in element && (element as HTMLInputElement | HTMLButtonElement).disabled) {
    return false;
  }

  if (element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  if (element.hasAttribute('tabindex')) {
    const value = Number(element.getAttribute('tabindex'));
    if (Number.isFinite(value) && value < 0) {
      return false;
    }
  }

  return true;
}

function rectToSerializable(rect: DOMRect): ReachabilityIssue['rect'] {
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function isOutsideViewport(rect: DOMRect, containerRect: DOMRect): boolean {
  return (
    rect.right <= containerRect.left
    || rect.left >= containerRect.right
    || rect.bottom <= containerRect.top
    || rect.top >= containerRect.bottom
  );
}

function isScrollable(element: HTMLElement): boolean {
  return (
    element.scrollHeight > element.clientHeight
    || element.scrollWidth > element.clientWidth
  );
}

function hasScrollablePathToContainer(element: HTMLElement, container: HTMLElement): boolean {
  let current: HTMLElement | null = element.parentElement;
  while (current) {
    if (isScrollable(current)) {
      return true;
    }
    if (current === container) {
      break;
    }
    current = current.parentElement;
  }
  return false;
}

export function diagnoseInteractiveReachability(container: HTMLElement): ReachabilityReport {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR))
    .filter((element) => isEnabledInteractive(element));
  const containerRect = container.getBoundingClientRect();

  const unreachable = candidates.flatMap((element): ReachabilityIssue[] => {
    const rect = element.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return [{
        reason: 'zero-size',
        tagName: element.tagName.toLowerCase(),
        id: element.id,
        role: element.getAttribute('role'),
        rect: rectToSerializable(rect),
      }];
    }

    if (isOutsideViewport(rect, containerRect) && !hasScrollablePathToContainer(element, container)) {
      return [{
        reason: 'outside-without-scroll',
        tagName: element.tagName.toLowerCase(),
        id: element.id,
        role: element.getAttribute('role'),
        rect: rectToSerializable(rect),
      }];
    }

    return [];
  });

  return {
    totalInteractive: candidates.length,
    unreachable,
  };
}
