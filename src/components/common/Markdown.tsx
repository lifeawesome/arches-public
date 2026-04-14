import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { sanitizeMarkdownUrl } from "@/lib/utils/markdown";

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url, key) =>
          key === "href" ? sanitizeMarkdownUrl(url, true) : sanitizeMarkdownUrl(url, false)
        }
        components={{
          a: ({ children, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              {children}
            </a>
          ),
          img: ({ alt, ...props }) => (
            // We keep markdown images responsive to avoid content overflow.
            <img
              {...props}
              alt={alt ?? ""}
              loading="lazy"
              className="h-auto max-w-full rounded-md border border-border"
            />
          ),
          ul: ({ children, ...props }) => (
            <ul {...props} className="my-2 list-disc pl-5">
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol {...props} className="my-2 list-decimal pl-5">
              {children}
            </ol>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote {...props} className="my-2 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children, ...props }) => (
            <div className="my-3 overflow-x-auto">
              <table {...props} className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th {...props} className="border border-border bg-muted px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td {...props} className="border border-border px-2 py-1 align-top">
              {children}
            </td>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className: codeClassName, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClassName ?? "");
            const value = String(children ?? "").replace(/\n$/, "");

            if (match) {
              return (
                <SyntaxHighlighter
                  PreTag="pre"
                  language={match[1]}
                  style={oneDark}
                  customStyle={{
                    marginTop: "0.5rem",
                    marginBottom: "0.5rem",
                    borderRadius: "0.5rem",
                    fontSize: "0.8rem",
                  }}
                >
                  {value}
                </SyntaxHighlighter>
              );
            }

            return (
              <code {...props} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
                {children}
              </code>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

