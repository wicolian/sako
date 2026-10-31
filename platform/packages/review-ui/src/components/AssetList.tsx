import React from 'react';
import { ReviewAsset, ReviewAssetType, ReviewRevisionStatus } from '../types';
import { clsx } from 'clsx';
import { FileImage, FileVideo, FileText, Figma, PlayCircle } from 'lucide-react';

interface AssetListProps {
    assets: ReviewAsset[];
    activeAssetId?: string;
    onSelectAsset: (id: string) => void;
}

const AssetIcon = ({ type }: { type: ReviewAssetType }) => {
    switch (type) {
        case ReviewAssetType.IMAGE: return <FileImage className="w-4 h-4" />;
        case ReviewAssetType.VIDEO: return <FileVideo className="w-4 h-4" />;
        case ReviewAssetType.PDF: return <FileText className="w-4 h-4" />;
        case ReviewAssetType.FIGMA: return <Figma className="w-4 h-4" />;
        case ReviewAssetType.LOTTIE:
        case ReviewAssetType.RIVE: return <PlayCircle className="w-4 h-4" />;
        default: return <FileText className="w-4 h-4" />;
    }
};

const typeLabel: Record<ReviewAssetType, string> = {
    [ReviewAssetType.IMAGE]: 'Image',
    [ReviewAssetType.VIDEO]: 'Video',
    [ReviewAssetType.PDF]: 'PDF',
    [ReviewAssetType.FIGMA]: 'Figma',
    [ReviewAssetType.LOTTIE]: 'Lottie',
    [ReviewAssetType.RIVE]: 'Rive',
    [ReviewAssetType.EMBED]: 'Embed',
};

const statusColor: Record<ReviewRevisionStatus, string> = {
    [ReviewRevisionStatus.DRAFT]: 'bg-[color:var(--muted)] text-[color:var(--muted-foreground)]',
    [ReviewRevisionStatus.IN_REVIEW]: 'bg-[color:var(--primary)]/10 text-[color:var(--primary)]',
    [ReviewRevisionStatus.APPROVED]: 'bg-[color:var(--accent)] text-[color:var(--accent-foreground)]',
    [ReviewRevisionStatus.CHANGES_REQUESTED]: 'bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]',
};

export const AssetList: React.FC<AssetListProps> = ({ assets, activeAssetId, onSelectAsset }) => {
    return (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {assets.map((asset) => (
                <button
                    key={asset.id}
                    onClick={() => onSelectAsset(asset.id)}
                    className={clsx(
                        "w-full flex flex-col gap-2 p-3 rounded-2xl border text-left transition-all",
                        activeAssetId === asset.id
                            ? "border-[color:var(--primary)]/60 bg-[color:var(--accent)] text-[color:var(--foreground)] shadow-sm"
                            : "border-[color:var(--border)] bg-[color:var(--card)] hover:border-[color:var(--primary)]/40 hover:bg-[color:var(--background)]"
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className={clsx(
                            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-[color:var(--foreground)]",
                            activeAssetId === asset.id ? "bg-[color:var(--background)] text-[color:var(--primary)]" : "bg-[color:var(--muted)] text-[color:var(--muted-foreground)]"
                        )}>
                            <AssetIcon type={asset.type} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-[13px] text-[color:var(--foreground)]">{asset.title}</div>
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                                <span>{typeLabel[asset.type]}</span>
                                <span>•</span>
                                <span>{asset.revisions.length} rev{asset.revisions.length === 1 ? '' : 's'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                        {asset.currentRevision && (
                            <span className={clsx(
                                "px-2 py-1 rounded-full font-medium",
                                statusColor[asset.currentRevision.status]
                            )}>
                                {asset.currentRevision.status.replace('_', ' ')}
                            </span>
                        )}
                        <span className="text-[color:var(--muted-foreground)]">
                            {asset.currentRevision?.annotations.filter(a => !a.resolved).length || 0} unresolved
                        </span>
                    </div>
                </button>
            ))}
        </div>
    );
};
