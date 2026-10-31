import React from 'react';
import { Sparkles } from 'lucide-react';

interface ComposerPreviewProps {
  composerDraftId?: string | null;
  composerExportUrl?: string | null;
  workspaceId: string;
}

export const ComposerPreview: React.FC<ComposerPreviewProps> = ({
  composerDraftId,
  composerExportUrl,
}) => {
  if (!composerDraftId && !composerExportUrl) {
    return null;
  }

  return (
    <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-[color:var(--border)]">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-[color:var(--foreground)]">
            Composer draft info
          </h3>
          <p className="text-[11px] text-[color:var(--muted-foreground)]">
            From external Composer app
          </p>
        </div>
      </div>
      <div className="p-4">
        <p className="text-[12px] text-[color:var(--muted-foreground)]">
          This task was created from the Composer app.
        </p>
        {composerDraftId && (
          <p className="mt-3 text-[11px] text-[color:var(--muted-foreground)]">
            Draft ID: <span className="text-[color:var(--foreground)]">{composerDraftId}</span>
          </p>
        )}
        {composerExportUrl && (
          <p className="text-[11px] text-[color:var(--muted-foreground)]">
            Export URL: <span className="text-[color:var(--foreground)] break-all">{composerExportUrl}</span>
          </p>
        )}
      </div>
    </div>
  );
};
