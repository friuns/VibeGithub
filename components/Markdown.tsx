import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MarkdownProps {
  children: string;
  className?: string;
}

export const Markdown: React.FC<MarkdownProps> = ({ children, className = '' }) => {
  return (
    <div className={`prose prose-sm max-w-none prose-slate dark:prose-invert
      prose-headings:text-slate-800 dark:prose-headings:text-slate-100 prose-headings:font-semibold
      prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-relaxed
      prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
      prose-code:text-pink-600 dark:prose-code:text-pink-400 prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-lg prose-pre:overflow-x-auto
      prose-blockquote:border-l-4 prose-blockquote:border-slate-300 dark:prose-blockquote:border-slate-600 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400
      prose-ul:list-disc prose-ol:list-decimal
      prose-li:text-slate-700 dark:prose-li:text-slate-300
      prose-img:rounded-lg prose-img:max-w-full
      prose-table:border-collapse prose-th:border prose-th:border-slate-300 dark:prose-th:border-slate-600 prose-th:bg-slate-100 dark:prose-th:bg-slate-800 prose-th:px-3 prose-th:py-2
      prose-td:border prose-td:border-slate-300 dark:prose-td:border-slate-600 prose-td:px-3 prose-td:py-2
      prose-hr:border-slate-200 dark:prose-hr:border-slate-700
      [&_input[type=checkbox]]:mr-2 [&_input[type=checkbox]]:accent-blue-600
      [&_details]:border [&_details]:border-slate-200 dark:[&_details]:border-slate-700 [&_details]:rounded-lg [&_details]:p-3 [&_details]:my-2 [&_details]:bg-slate-50 dark:[&_details]:bg-slate-800
      [&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:text-slate-700 dark:[&_summary]:text-slate-300 [&_summary]:select-none [&_summary]:list-none
      [&_summary::-webkit-details-marker]:hidden [&_summary::marker]:hidden
      [&_summary]:before:content-['▶'] [&_summary]:before:inline-block [&_summary]:before:mr-2 [&_summary]:before:text-xs [&_summary]:before:transition-transform
      [&_details[open]>summary]:before:content-['▼']
      [&_details[open]>summary]:mb-2
      ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Make links open in new tab
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          // Better image handling
          img: ({ src, alt }) => (
            <img 
              src={src} 
              alt={alt || ''} 
              loading="lazy"
              className="rounded-lg max-w-full h-auto"
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};
