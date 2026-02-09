import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  rounded?: boolean;
}

export const Image = forwardRef<HTMLImageElement, ImageProps>(({
  src,
  alt = '',
  rounded = false,
  className,
  style,
  ...rest
}, ref) => {
  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={cn(
        "max-w-full h-auto object-cover",
        rounded && "rounded-none",
        className
      )}
      style={style}
      {...rest}
    />
  );
});

Image.displayName = "Image";
