import { useMemo, forwardRef } from 'react';
import { LucideProps, LucideIcon } from 'lucide-react';
import { getCarbonIcon } from '../../lib/carbon-icons';
import { getLucideIcon } from '../../lib/lucide-icons';

// Semantic size tokens -> numeric pixel values.
// EUIP spec allows 'sm'/'md'/'lg'/'xl' string tokens for Lucide icons.
const ICON_SIZE_MAP: Record<string, number> = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

function resolveIconSize(size: string | number | undefined): string | number {
  if (size === undefined) return '1em';
  if (typeof size === 'number') return size;
  return ICON_SIZE_MAP[size] ?? size;
}

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: string;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(({ name, size, color, ...props }, ref) => {
  const isCarbonIcon = name.startsWith('carbon:');
  const resolvedSize = resolveIconSize(size);

  const IconComponent = useMemo(() => {
    if (isCarbonIcon) {
      const carbonName = name.slice('carbon:'.length);
      return getCarbonIcon(carbonName);
    }

    return getLucideIcon(name) as LucideIcon | undefined;
  }, [name, isCarbonIcon]);

  if (!IconComponent) {
    console.warn(`[Icon] Icon not found: ${name}`);
    return null;
  }

  if (isCarbonIcon) {
    const numericSize = typeof resolvedSize === 'string' && resolvedSize.endsWith('em') ? undefined : resolvedSize;
    return <IconComponent size={numericSize} {...props} />;
  }

  return <IconComponent ref={ref} size={resolvedSize} color={color} {...props} />;
});

Icon.displayName = "Icon";
