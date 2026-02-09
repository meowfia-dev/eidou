import React, { forwardRef } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markup";
import "prismjs/themes/prism-tomorrow.css";
import { useCommittedTextInput } from "../../lib/hooks/useCommittedTextInput";
import { USER_ACTION_IDS } from "../../lib/protocol";

interface CodeEditorProps {
  value: string;
  language?: "javascript" | "typescript" | "css" | "json" | "html" | string;
  readOnly?: boolean;
  name: string;
  height?: string | number;
  className?: string;
  action?: string;
  style?: React.CSSProperties;
}

export const CodeEditor = forwardRef<HTMLDivElement, CodeEditorProps>(({
  value,
  language = "javascript",
  readOnly = false,
  name,
  height,
  className = "",
  action,
  style,
}, ref) => {
  const {
    localValue,
    onChange,
    onBlurCommit
  } = useCommittedTextInput({
    name,
    value,
    trigger: 'blur',
    actionId: action || USER_ACTION_IDS.INPUT_CHANGE,
  });

  const highlightCode = (input: string) => {
    const grammar = Prism.languages[language] || Prism.languages.plain;
    return Prism.highlight(input, grammar, language);
  };

  return (
    <div
      ref={ref}
      className={`relative rounded-none border border-border bg-card font-mono text-sm overflow-hidden ${className}`}
      style={{ ...style, height: height ?? "auto", minHeight: "100px" }}
    >
      <Editor
        value={localValue}
        onValueChange={onChange}
        highlight={highlightCode}
        padding={16}
        readOnly={readOnly}
        textareaId={name}
        onBlur={onBlurCommit}
        className="font-mono"
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 14,
          backgroundColor: "transparent",
          minHeight: "100%",
        }}
        textareaClassName="focus:outline-none"
      />
      <div className="absolute top-2 right-2 pointer-events-none opacity-50 text-[10px] uppercase tracking-wider text-foreground">
        {language}
      </div>
    </div>
  );
});

CodeEditor.displayName = "CodeEditor";
