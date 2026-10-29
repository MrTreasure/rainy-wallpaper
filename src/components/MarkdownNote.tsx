import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check } from "lucide-react";

export function MarkdownNote({ markdown, onToggleTask }: { markdown: string; onToggleTask: (offset: number) => void }) {
  const components = useMemo<Components>(() => ({
    input: () => null,
    a: ({ node: _node, children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>,
    li: ({ node, className, children, ...props }) => {
      const offset = node?.position?.start.offset;
      if (!className?.includes("task-list-item") || offset === undefined) return <li {...props} className={className}>{children}</li>;
      const done = /^(?:[-+*]|\d+[.)])\s+\[[xX]\]/.test(markdown.slice(offset));
      return (
        <li {...props} className={`task-list-item ${done ? "task-done" : ""}`}>
          <button type="button" className="paper-checkbox" role="checkbox" aria-checked={done}
            aria-label={done ? "标记为未完成" : "标记为已完成"} onClick={() => onToggleTask(offset)}>
            {done && <Check size={13} strokeWidth={2.2} aria-hidden="true" />}
          </button>
          <div className="task-copy">{children}</div>
        </li>
      );
    },
  }), [markdown, onToggleTask]);
  return <div className="paper-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>{markdown}</ReactMarkdown></div>;
}
