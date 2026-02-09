import { ComponentType } from 'react';

// Curated IBM Carbon icon subset for Eidou system UI.
// Each icon is explicitly imported to ensure tree-shaking.

// -- System / Core --
import Terminal from '@carbon/icons-react/es/Terminal';
import Security from '@carbon/icons-react/es/Security';
import Locked from '@carbon/icons-react/es/Locked';
import Unlocked from '@carbon/icons-react/es/Unlocked';
import Chip from '@carbon/icons-react/es/Chip';
import Network_4 from '@carbon/icons-react/es/Network_4';
import Code from '@carbon/icons-react/es/Code';
import Settings from '@carbon/icons-react/es/Settings';
import Activity from '@carbon/icons-react/es/Activity';
import Data_1 from '@carbon/icons-react/es/Data_1';

// -- File / Document --
import Document from '@carbon/icons-react/es/Document';
import Folder from '@carbon/icons-react/es/Folder';

// -- Status --
import Warning from '@carbon/icons-react/es/Warning';
import ErrorIcon from '@carbon/icons-react/es/Error';
import Checkmark from '@carbon/icons-react/es/Checkmark';
import Information from '@carbon/icons-react/es/Information';

// -- Actions --
import Close from '@carbon/icons-react/es/Close';
import Add from '@carbon/icons-react/es/Add';
import Subtract from '@carbon/icons-react/es/Subtract';
import Copy from '@carbon/icons-react/es/Copy';
import Download from '@carbon/icons-react/es/Download';
import Upload from '@carbon/icons-react/es/Upload';
import Search from '@carbon/icons-react/es/Search';
import Filter from '@carbon/icons-react/es/Filter';
import Share from '@carbon/icons-react/es/Share';
import Restart from '@carbon/icons-react/es/Restart';
import Power from '@carbon/icons-react/es/Power';

// -- Navigation --
import ChevronRight from '@carbon/icons-react/es/ChevronRight';
import ChevronDown from '@carbon/icons-react/es/ChevronDown';
import OverflowMenuVertical from '@carbon/icons-react/es/OverflowMenuVertical';

// -- Views --
import Dashboard from '@carbon/icons-react/es/Dashboard';

interface CarbonIconProps {
  size?: number | string;
  [key: string]: unknown;
}

type CarbonIconComponent = ComponentType<CarbonIconProps>;

export const CARBON_ICON_MAP: Record<string, CarbonIconComponent> = {
  'terminal': Terminal,
  'security': Security,
  'locked': Locked,
  'unlocked': Unlocked,
  'chip': Chip,
  'network-4': Network_4,
  'code': Code,
  'settings': Settings,
  'activity': Activity,
  'data-1': Data_1,
  'document': Document,
  'folder': Folder,
  'warning': Warning,
  'error': ErrorIcon,
  'checkmark': Checkmark,
  'information': Information,
  'close': Close,
  'add': Add,
  'subtract': Subtract,
  'copy': Copy,
  'download': Download,
  'upload': Upload,
  'search': Search,
  'filter': Filter,
  'share': Share,
  'restart': Restart,
  'power': Power,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'overflow-menu-vertical': OverflowMenuVertical,
  'dashboard': Dashboard,
};

export function getCarbonIcon(name: string): CarbonIconComponent | undefined {
  return CARBON_ICON_MAP[name];
}
