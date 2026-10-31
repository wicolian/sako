"use client";

import { useState } from "react";
import { IconCopy, IconCheck, IconRobot } from "@tabler/icons-react";
import { prepareMarkdownForCopyAsync, copyToClipboard } from "@/lib/markdown-utils";
import { cn } from "@/lib/utils";

interface LLMCopyButtonProps {
  slug: string;
  className?: string;
}

export function LLMCopyButton({ slug, className }: LLMCopyButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle');

  const handleCopy = async () => {
    if (status !== 'idle') return;
    
    setStatus('loading');
    try {
      // 1. Fetch raw MDX from our API
      const response = await fetch(`/api/raw-mdx?slug=${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error('Failed to fetch content');
      
      const { content, title, description } = await response.text().then(text => JSON.parse(text));
      
      // 2. Process MDX to Markdown
      const markdown = await prepareMarkdownForCopyAsync(content, title, description);
      
      // 3. Copy to clipboard with robust mobile support
      const success = await copyToClipboard(markdown);
      
      if (success) {
        setStatus('copied');
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        throw new Error('Copy failed');
      }
    } catch (err) {
      console.error('Copy error:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      disabled={status === 'loading'}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-full transition-all border",
        status === 'idle' && "bg-white text-gray-600 border-gray-200 hover:border-black hover:text-black",
        status === 'loading' && "bg-gray-50 text-gray-400 border-gray-200 cursor-wait",
        status === 'copied' && "bg-[#9AE83E]/10 text-[#6B9E2E] border-[#9AE83E] shadow-[0_0_10px_rgba(154,232,62,0.2)]",
        status === 'error' && "bg-red-50 text-red-500 border-red-200",
        className
      )}
      title="Copy page content for AI analysis"
    >
      {status === 'loading' ? (
        <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      ) : status === 'copied' ? (
        <IconCheck className="w-3.5 h-3.5" />
      ) : (
        <IconRobot className="w-3.5 h-3.5" />
      )}
      
      <span>
        {status === 'loading' ? 'Preparing...' : 
         status === 'copied' ? 'Copied for AI' : 
         status === 'error' ? 'Failed' : 
         'Copy for AI'}
      </span>
    </button>
  );
}

