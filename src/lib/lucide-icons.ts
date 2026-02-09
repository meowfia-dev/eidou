import { LucideIcon } from 'lucide-react';

// Curated Lucide icon subset for Eidou EUIP dynamic rendering.
// Only icons referenced via the <Icon name="..."> component (EUIP JSON)
// need to be in this map. Direct imports in atom components are already
// tree-shaken and do NOT need entries here.
//
// To add a new icon:
// 1. Import it by name from 'lucide-react'
// 2. Add a kebab-case entry to LUCIDE_ICON_MAP
// 3. Run `bun run build` to verify

// -- Status / Feedback --
import { Activity } from 'lucide-react';
import { AlertOctagon } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import { Check } from 'lucide-react';
import { CheckCircle } from 'lucide-react';
import { Info } from 'lucide-react';
import { Loader2 } from 'lucide-react';

// -- Navigation / Arrows --
import { ArrowDown } from 'lucide-react';
import { ArrowUp } from 'lucide-react';
import { ChevronDown } from 'lucide-react';

// -- Objects --
import { Heart } from 'lucide-react';
import { Layers } from 'lucide-react';
import { Shield } from 'lucide-react';

// -- Actions --
import { X } from 'lucide-react';

export const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  'activity': Activity,
  'alert-octagon': AlertOctagon,
  'alert-triangle': AlertTriangle,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  'check': Check,
  'check-circle': CheckCircle,
  'chevron-down': ChevronDown,
  'heart': Heart,
  'info': Info,
  'layers': Layers,
  'loader-2': Loader2,
  'shield': Shield,
  'x': X,
};

export function getLucideIcon(name: string): LucideIcon | undefined {
  return LUCIDE_ICON_MAP[name];
}
