/**
 * Lazy-loaded component wrappers
 * 
 * These wrappers defer loading of heavy libraries until they're actually needed,
 * reducing the initial bundle size and improving first-paint time.
 */

export { LazyChart, ChartSkeleton } from './LazyCharts';
export { LazyPDFViewer, PDFSkeleton } from './LazyPDF';
