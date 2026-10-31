import React, { useState, useCallback } from 'react';
import { Maximize2, X, ExternalLink, Loader2 } from 'lucide-react';

interface FigmaViewerProps {
    url: string;
}

export const FigmaViewer: React.FC<FigmaViewerProps> = ({ url }) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [loading, setLoading] = useState(true);

    // Convert URL to embed format
    // Supports: figma.com/design/, figma.com/file/, figma.com/proto/ (prototypes)
    const getEmbedUrl = useCallback((figmaUrl: string) => {
        // If already an embed URL, use as-is
        if (figmaUrl.includes('figma.com/embed')) {
            return figmaUrl;
        }
        
        // Check if it's a prototype link
        if (figmaUrl.includes('/proto/')) {
            // For prototypes, use proto embed format
            return `https://www.figma.com/embed?embed_host=sako&url=${encodeURIComponent(figmaUrl)}`;
        }
        
        // Standard embed format
        return `https://www.figma.com/embed?embed_host=sako&url=${encodeURIComponent(figmaUrl)}`;
    }, []);

    const embedUrl = getEmbedUrl(url);

    const openFullscreen = useCallback(() => {
        setIsFullscreen(true);
        document.body.style.overflow = 'hidden';
    }, []);

    const closeFullscreen = useCallback(() => {
        setIsFullscreen(false);
        document.body.style.overflow = '';
    }, []);

    const openInFigma = useCallback(() => {
        window.open(url, '_blank', 'noopener,noreferrer');
    }, [url]);

    return (
        <>
            <div className="w-full h-full flex flex-col bg-gray-100">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm">
                    <span className="text-sm text-gray-600">Figma Design</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={openInFigma}
                            className="p-1 rounded hover:bg-gray-100"
                            title="Open in Figma"
                        >
                            <ExternalLink className="w-5 h-5" />
                        </button>
                        <button
                            onClick={openFullscreen}
                            className="p-1 rounded hover:bg-gray-100"
                            title="Full screen"
                        >
                            <Maximize2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                {/* Embed */}
                <div className="flex-1 relative">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 z-10">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    )}
                    <iframe
                        src={embedUrl}
                        className="w-full h-full border-0"
                        title="Figma Design"
                        allowFullScreen
                        onLoad={() => setLoading(false)}
                    />
                </div>
            </div>

            {/* Fullscreen modal */}
            {isFullscreen && (
                <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
                    {/* Fullscreen toolbar */}
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                        <span className="text-sm text-gray-300">Figma Design</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={openInFigma}
                                className="p-1 rounded hover:bg-gray-700 text-white"
                                title="Open in Figma"
                            >
                                <ExternalLink className="w-5 h-5" />
                            </button>
                            <button
                                onClick={closeFullscreen}
                                className="p-1 rounded hover:bg-gray-700 text-white"
                                title="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    
                    {/* Fullscreen embed */}
                    <div className="flex-1">
        <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            title="Figma Design"
            allowFullScreen
        />
                    </div>
                </div>
            )}
        </>
    );
};
