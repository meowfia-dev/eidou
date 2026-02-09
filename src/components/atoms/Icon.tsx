import { useMemo, forwardRef } from 'react';
import { LucideProps, LucideIcon } from 'lucide-react';
import { getCarbonIcon } from '../../lib/carbon-icons';
import { getLucideIcon } from '../../lib/lucide-icons';

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: string;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(({ name, size = '1em', color, ...props }, ref) => {
  const isCarbonIcon = name.startsWith('carbon:');

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
    const numericSize = typeof size === 'string' && size.endsWith('em') ? undefined : size;
    return <IconComponent size={numericSize} {...props} />;
  }

  return <IconComponent ref={ref} size={size} color={color} {...props} />;
});

Icon.displayName = "Icon";
