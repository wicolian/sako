import React from 'react';
import { Sparkles, ExternalLink } from 'lucide-react';
import { Task } from '../lib/types';
import { COMPOSER_URL } from '../lib/config';

interface ComposerSectionProps {
  task: Task;
}

export const ComposerSection: React.FC<ComposerSectionProps> = ({ task }) => {
  const fromComposer = task.source === 'COMPOSER_STANDALONE' || !!task.composerDraftId;

  return (
    <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="text-[14px] font-semibold text-[color:var(--foreground)]">AI Composer</span>
          <p className="text-[11px] text-[color:var(--muted-foreground)]">Generate designs with AI</p>
        </div>
      </div>
      {fromComposer ? (
        <p className="text-[12px] text-[color:var(--muted-foreground)] mb-3">
          This task was created from Composer. You can open Composer to create new designs or continue working on this task in Studio.
        </p>
      ) : (
        <p className="text-[12px] text-[color:var(--muted-foreground)] mb-3">
          Create AI-powered designs in Composer and send them to Studio when ready.
        </p>
      )}
      <button
        onClick={() => window.open(COMPOSER_URL, '_blank')}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-[13px] font-medium hover:opacity-90 transition"
      >
        <Sparkles className="h-4 w-4" />
        Open Composer
        <ExternalLink className="h-3 w-3 opacity-70" />
      </button>
    </div>
  );
};