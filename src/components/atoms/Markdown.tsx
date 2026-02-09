import React, { forwardRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '../../lib/utils';

interface MarkdownProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Markdown = forwardRef<HTMLDivElement, MarkdownProps>(({
  content,
  className,
  style,
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "prose prose-invert prose-sm max-w-none font-mono",
        "prose-headings:text-primary prose-headings:font-bold",
        "prose-p:text-foreground prose-p:leading-relaxed",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-code:text-primary prose-code:bg-card prose-code:px-1 prose-code:rounded-none",
        "prose-pre:bg-card prose-pre:border prose-pre:border-primary/20",
        "prose-blockquote:border-l-4 prose-blockquote:border-primary/50 prose-blockquote:text-foreground/70",
        "prose-li:text-foreground",
        className
      )}
      style={style}
    >
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

Markdown.displayName = "Markdown";
