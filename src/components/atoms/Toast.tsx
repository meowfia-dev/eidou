import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { emitUserEvent } from '../../lib/events';
import { SYSTEM_ACTION_IDS } from '../../lib/protocol';

// Carbon icons: geometric, industrial, tactical
import Information from '@carbon/icons-react/es/Information';
import Checkmark from '@carbon/icons-react/es/Checkmark';
import Warning from '@carbon/icons-react/es/Warning';
import ErrorIcon from '@carbon/icons-react/es/Error';
import Close from '@carbon/icons-react/es/Close';

export interface ToastProps {
  message: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  icon?: string;
  className?: string;
  style?: React.CSSProperties;
}

// Variant-colored corner brackets (Eidou DNA)
// Renders 4 L-shaped corners using 8 linear-gradients on a single element
function CornerBrackets({ rgbVar }: { rgbVar: string }) {
  const color = `rgb(var(${rgbVar}))`;
  const grad = (dir: string) => `linear-gradient(${dir}, ${color}, ${color})`;
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-40 z-10"
      style={{
        backgroundImage: [
          grad('to right'), grad('to bottom'),
          grad('to left'), grad('to bottom'),
          grad('to right'), grad('to top'),
          grad('to left'), grad('to top'),
        ].join(', '),
        backgroundSize:
          '8px 1px, 1px 8px, 8px 1px, 1px 8px, 8px 1px, 1px 8px, 8px 1px, 1px 8px',
        backgroundPosition:
          'top left, top left, top right, top right, bottom left, bottom left, bottom right, bottom right',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}

const variantConfig = {
  info: {
    border: "border-info/30",
    icon: Information,
    iconColor: "text-info",
    titleColor: "text-info",
    closeHover: "hover:text-info",
    accentRgbVar: "--eidou-color-info-rgb",
  },
  success: {
    border: "border-primary/30",
    icon: Checkmark,
    iconColor: "text-primary",
    titleColor: "text-primary",
    closeHover: "hover:text-primary",
    accentRgbVar: "--eidou-color-primary-rgb",
  },
  warning: {
    border: "border-warning/30",
    icon: Warning,
    iconColor: "text-warning",
    titleColor: "text-warning",
    closeHover: "hover:text-warning",
    accentRgbVar: "--eidou-color-warning-rgb",
  },
  error: {
    border: "border-danger/30",
    icon: ErrorIcon,
    iconColor: "text-danger",
    titleColor: "text-danger",
    closeHover: "hover:text-danger",
    accentRgbVar: "--eidou-color-danger-rgb",
  }
};

export const Toast = forwardRef<HTMLDivElement, ToastProps>(({
  message,
  variant = 'info',
  title,
  className,
  style,
}, ref) => {
  const config = variantConfig[variant] || variantConfig.info;
  const IconComponent = config.icon;

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    emitUserEvent(SYSTEM_ACTION_IDS.CLOSE);
  };

  // Variant-colored ambient glow via CSS variable (theme-compatible)
  const glowStyle: React.CSSProperties = {
    boxShadow: `0 0 12px rgb(var(${config.accentRgbVar}) / 0.15)`,
    ...style,
  };

  return (
    <div
      ref={ref}
      className={cn(
        "flex w-full items-start p-4 rounded-none border bg-card/95 relative overflow-hidden select-none",
        "animate-appear",
        config.border,
        className,
      )}
      style={glowStyle}
    >
      {/* Drag layer: makes the toast window draggable without blocking the close button */}
      <div
        className="absolute inset-0 z-0 cursor-grab"
        data-tauri-drag-region
      />

      {/* Corner Brackets (variant-colored Eidou DNA) */}
      <CornerBrackets rgbVar={config.accentRgbVar} />

      <div className={cn("relative z-20 flex-shrink-0 mr-3 mt-0.5 pointer-events-none", config.iconColor)}>
        <IconComponent size={20} />
      </div>

      <div className="relative z-20 flex-1 min-w-0 mr-4 pointer-events-none">
        {title && (
          <h4 className={cn(
            "font-heading text-xs font-bold mb-1 tracking-widest uppercase",
            config.titleColor
          )}>
            {title}
          </h4>
        )}
        <p className="font-mono text-[11px] leading-relaxed text-foreground/80 break-words">
          {message}
        </p>
      </div>

      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleClose}
        className={cn(
          "relative z-20 flex-shrink-0 text-foreground/30 transition-all duration-100 p-1 -mr-2 -mt-2",
          config.closeHover
        )}
      >
        <Close size={16} />
      </button>
    </div>
  );
});

Toast.displayName = "Toast";
