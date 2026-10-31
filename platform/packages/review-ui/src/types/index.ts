import { AnnotationPayload } from '../schemas/annotations';

export enum ReviewAssetType {
    IMAGE = 'IMAGE',
    PDF = 'PDF',
    VIDEO = 'VIDEO',
    FIGMA = 'FIGMA',
    LOTTIE = 'LOTTIE',
    RIVE = 'RIVE',
    EMBED = 'EMBED',
}

export enum ReviewRevisionStatus {
    DRAFT = 'DRAFT',
    IN_REVIEW = 'IN_REVIEW',
    APPROVED = 'APPROVED',
    CHANGES_REQUESTED = 'CHANGES_REQUESTED',
}

export enum ReviewAnnotationKind {
    IMAGE_PIN = 'IMAGE_PIN',
    PDF_PIN = 'PDF_PIN',
    VIDEO_TIME = 'VIDEO_TIME',
    LOTTIE_TIME = 'LOTTIE_TIME',
    RIVE_TIME = 'RIVE_TIME',
    EMBED_REF = 'EMBED_REF',
}

export interface ReviewAuthor {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    workspaceRole?: string | null;
    avatarUrl?: string | null;
}

export interface ReviewAnnotation {
    id: string;
    kind: ReviewAnnotationKind;
    text: string;
    payload: any;
    resolved: boolean;
    createdAt: string;
    resolvedAt?: string;
    parentId?: string;
    replies?: ReviewAnnotation[];
    authorId?: string;
    author?: ReviewAuthor;
}

export interface ReviewAssetRevision {
    id: string;
    label: string;
    isCurrent: boolean;
    status: ReviewRevisionStatus;
    fileUrl?: string;
    reason?: string;
    createdAt: string;
    annotations: ReviewAnnotation[];
}

export interface ReviewAsset {
    id: string;
    type: ReviewAssetType;
    title: string;
    sourceUrl: string;
    createdAt: string;
    revisions: ReviewAssetRevision[];
    currentRevision?: ReviewAssetRevision;
}

export interface ReviewBoardData {
    taskId: string;
    taskTitle: string;
    taskStatus: string;
    assets: ReviewAsset[];
}



export interface ReviewBoardTransport {
    createAnnotation: (revisionId: string, payload: AnnotationPayload, text: string, kind: ReviewAnnotationKind) => Promise<void>;
    replyToAnnotation: (annotationId: string, text: string) => Promise<void>;
    resolveAnnotation: (annotationId: string) => Promise<void>;
    unresolveAnnotation: (annotationId: string) => Promise<void>;
    requestChanges: (revisionId: string, feedback: string) => Promise<void>;
    markCompleted: (revisionId: string) => Promise<void>;
}
