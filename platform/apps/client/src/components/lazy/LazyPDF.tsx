/**
 * Lazy-loaded PDF viewer component
 * 
 * Usage:
 * Instead of importing react-pdf directly:
 *   import { Document, Page } from 'react-pdf';
 * 
 * Use this wrapper:
 *   import { LazyPDFViewer } from '@/components/lazy/LazyPDF';
 *   <Suspense fallback={<PDFSkeleton />}>
 *     <LazyPDFViewer file={pdfUrl} />
 *   </Suspense>
 */

import React from 'react';

// Skeleton for PDF while loading
export const PDFSkeleton: React.FC<{ height?: number }> = ({ height = 600 }) => (
  <div 
    className="animate-pulse bg-[color:var(--muted)] rounded-lg flex items-center justify-center" 
    style={{ height }}
  >
    <p className="text-[color:var(--muted-foreground)] text-sm">Loading PDF viewer...</p>
  </div>
);

// Lazy wrapper component that loads react-pdf on demand
export const LazyPDFViewer: React.FC<{
  file: string;
  height?: number;
  className?: string;
}> = ({ file, height = 600, className }) => {
  const [PDFComponents, setPDFComponents] = React.useState<{
    Document: React.ComponentType<any>;
    Page: React.ComponentType<any>;
  } | null>(null);
  const [numPages, setNumPages] = React.useState<number>(0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    Promise.all([
      import('react-pdf'),
      import('react-pdf/dist/Page/AnnotationLayer.css'),
      import('react-pdf/dist/Page/TextLayer.css'),
    ])
      .then(([pdfModule]) => {
        // Set up worker
        pdfModule.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfModule.pdfjs.version}/build/pdf.worker.min.mjs`;
        setPDFComponents({
          Document: pdfModule.Document,
          Page: pdfModule.Page,
        });
      })
      .catch((err) => {
        setError('Failed to load PDF viewer');
        console.error('PDF loader error:', err);
      });
  }, []);

  if (error) {
    return (
      <div className="text-red-500 text-sm p-4 border border-red-200 rounded-lg">
        {error}
      </div>
    );
  }

  if (!PDFComponents) {
    return <PDFSkeleton height={height} />;
  }

  const { Document, Page } = PDFComponents;

  return (
    <div className={className} style={{ height, overflow: 'auto' }}>
      <Document
        file={file}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        onLoadError={(err) => setError(err.message)}
        loading={<PDFSkeleton height={height} />}
      >
        {Array.from(new Array(numPages), (_, index) => (
          <Page key={`page_${index + 1}`} pageNumber={index + 1} />
        ))}
      </Document>
    </div>
  );
};

export default LazyPDFViewer;
