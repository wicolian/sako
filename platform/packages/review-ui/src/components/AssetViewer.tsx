import React from 'react';
import { ReviewAsset, ReviewAssetRevision, ReviewAssetType, ReviewAnnotationKind } from '../types';
import { AnnotationPayload } from '../schemas/annotations';
import { ImageViewer } from '../viewers/ImageViewer';
import { VideoViewer } from '../viewers/VideoViewer';
import { PDFViewer } from '../viewers/PDFViewer';
import { LottieViewer } from '../viewers/LottieViewer';
import { RiveViewer } from '../viewers/RiveViewer';
import { FigmaViewer } from '../viewers/FigmaViewer';
import { AnnotationLayer } from './AnnotationLayer';

interface AssetViewerProps {
    asset: ReviewAsset;
    revision: ReviewAssetRevision;
    onAddAnnotation: (payload: AnnotationPayload, text: string, kind: ReviewAnnotationKind) => void;
    onSelectAnnotation: (annotationId: string | null) => void;
    selectedAnnotationId?: string | null;
}

export const AssetViewer: React.FC<AssetViewerProps> = ({ asset, revision, onAddAnnotation, onSelectAnnotation, selectedAnnotationId }) => {
    const url = revision.fileUrl || asset.sourceUrl;

    const renderContent = () => {
        switch (asset.type) {
            case ReviewAssetType.IMAGE:
                return (
                    <AnnotationLayer
                        annotations={revision.annotations}
                        onAddAnnotation={onAddAnnotation}
                        annotationKind={ReviewAnnotationKind.IMAGE_PIN}
                        selectedAnnotationId={selectedAnnotationId}
                        onSelectAnnotation={onSelectAnnotation}
                    >
                        <ImageViewer src={url} />
                    </AnnotationLayer>
                );

            case ReviewAssetType.VIDEO:
                return (
                    <VideoViewer
                        src={url}
                        annotations={revision.annotations}
                        selectedAnnotationId={selectedAnnotationId}
                        onSelectAnnotation={onSelectAnnotation}
                        onAddAnnotation={(payload, text) => onAddAnnotation(payload, text, ReviewAnnotationKind.VIDEO_TIME)}
                    />
                );

            case ReviewAssetType.PDF:
                return (
                    <AnnotationLayer
                        annotations={revision.annotations}
                        onAddAnnotation={onAddAnnotation}
                        annotationKind={ReviewAnnotationKind.PDF_PIN}
                        selectedAnnotationId={selectedAnnotationId}
                        onSelectAnnotation={onSelectAnnotation}
                    >
                        <PDFViewer src={url} />
                    </AnnotationLayer>
                );

            case ReviewAssetType.LOTTIE:
                return <LottieViewer src={url} />;

            case ReviewAssetType.RIVE:
                return <RiveViewer src={url} />;

            case ReviewAssetType.FIGMA:
                return <FigmaViewer url={url} />;

            default:
                return (
                    <div className="text-center">
                        <p className="text-[color:var(--muted-foreground)] mb-2">Unsupported Asset Type</p>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[color:var(--primary)] hover:underline text-sm">
                            Open in new tab →
                        </a>
                    </div>
                );
        }
    };

    return (
        <div className="w-full h-full flex items-center justify-center bg-[color:var(--background)]">
            {renderContent()}
        </div>
    );
};
