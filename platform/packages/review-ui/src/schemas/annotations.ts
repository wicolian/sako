import { z } from 'zod';

export const ImagePinPayloadSchema = z.object({
    x: z.number(),
    y: z.number(),
});

export const PDFPinPayloadSchema = z.object({
    x: z.number(),
    y: z.number(),
    page: z.number(),
});

export const VideoTimePayloadSchema = z.object({
    time: z.number(),
});

export const LottieTimePayloadSchema = z.object({
    time: z.number(),
});

export const RiveTimePayloadSchema = z.object({
    time: z.number(),
});

export const FigmaPayloadSchema = z.object({
    nodeId: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
});

export const BoundingBoxSchema = z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
});

export const GenericNotePayloadSchema = z.object({
    type: z.string().optional(),
});

export const AnnotationPayloadSchema = z.union([
    ImagePinPayloadSchema,
    PDFPinPayloadSchema,
    VideoTimePayloadSchema,
    LottieTimePayloadSchema,
    RiveTimePayloadSchema,
    FigmaPayloadSchema,
    BoundingBoxSchema,
    GenericNotePayloadSchema,
]);

export type AnnotationPayload = z.infer<typeof AnnotationPayloadSchema>;
