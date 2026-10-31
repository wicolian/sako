import React from 'react';

interface ImageViewerProps {
    src: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ src }) => {
    return (
        <div className="w-full h-full flex items-center justify-center">
            <img src={src} alt="Asset" className="max-w-full max-h-full object-contain" />
        </div>
    );
};
