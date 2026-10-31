import React from 'react';
import { clsx } from 'clsx';

interface FiltersPanelProps {
    showResolved: boolean;
    onToggleResolved: () => void;
    selectedAuthor: string | null;
    onSelectAuthor: (authorId: string | null) => void;
    authors: Array<{ id: string; name: string }>;
}

export const FiltersPanel: React.FC<FiltersPanelProps> = ({
    showResolved,
    onToggleResolved,
    selectedAuthor,
    onSelectAuthor,
    authors,
}) => {
    return (
        <div className="p-3 border-b border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Filters</span>
                <button
                    onClick={() => {
                        onToggleResolved();
                        onSelectAuthor(null);
                    }}
                    className="text-xs text-zinc-500 hover:text-white"
                >
                    Clear
                </button>
            </div>

            {/* Show Resolved Toggle */}
            <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-zinc-300">Show resolved</span>
                <div className="relative">
                    <input
                        type="checkbox"
                        checked={showResolved}
                        onChange={onToggleResolved}
                        className="sr-only"
                    />
                    <div className={clsx(
                        "w-10 h-5 rounded-full transition-colors",
                        showResolved ? "bg-blue-600" : "bg-zinc-700"
                    )}>
                        <div className={clsx(
                            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform",
                            showResolved && "translate-x-5"
                        )} />
                    </div>
                </div>
            </label>

            {/* Author Filter */}
            {authors.length > 0 && (
                <div>
                    <label className="text-xs text-zinc-400 uppercase tracking-wider mb-2 block">
                        Filter by author
                    </label>
                    <select
                        value={selectedAuthor || ''}
                        onChange={(e) => onSelectAuthor(e.target.value || null)}
                        className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                    >
                        <option value="">All authors</option>
                        {authors.map(author => (
                            <option key={author.id} value={author.id}>
                                {author.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
};
