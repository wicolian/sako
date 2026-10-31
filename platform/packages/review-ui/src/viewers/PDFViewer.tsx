import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader2, Maximize2, X } from 'lucide-react';

// Dynamic import for react-pdf to handle SSR
let Document: React.ComponentType<any> | null = null;
let Page: React.ComponentType<any> | null = null;
let pdfjs: any = null;

interface PDFViewerProps {
    src: string;
    page?: number;
  onPageChange?: (page: number) => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ src, page = 1, onPageChange }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(page);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const openFullscreen = useCallback(() => {
    setIsFullscreen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
    document.body.style.overflow = '';
  }, []);

  // Load react-pdf dynamically
  useEffect(() => {
    const loadPdfLib = async () => {
      try {
        const reactPdf = await import('react-pdf');
        Document = reactPdf.Document;
        Page = reactPdf.Page;
        pdfjs = reactPdf.pdfjs;
        
        // Set worker source - use CDN for simplicity
        pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        
        setPdfLoaded(true);
      } catch (err) {
        console.error('Failed to load react-pdf:', err);
        setError('Failed to load PDF viewer. Using fallback.');
      }
    };

    loadPdfLib();
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error('PDF load error:', err);
    setError('Failed to load PDF document');
    setLoading(false);
  }, []);

  const goToPage = useCallback((newPage: number) => {
    if (numPages && newPage >= 1 && newPage <= numPages) {
      setCurrentPage(newPage);
      onPageChange?.(newPage);
    }
  }, [numPages, onPageChange]);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 3.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleDownload = useCallback(() => {
    // Open in new tab - CORS prevents fetch for cross-origin files
    window.open(src, '_blank');
  }, [src]);

  // Fallback to iframe if react-pdf fails to load
  if (error || !pdfLoaded) {
    if (!pdfLoaded && !error) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      );
    }

    // Fallback iframe
    const pdfSrc = currentPage > 1 ? `${src}#page=${currentPage}` : src;
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b">
          <span className="text-sm text-gray-600">PDF Viewer (Fallback Mode)</span>
          <button
            onClick={handleDownload}
            className="p-1 rounded hover:bg-gray-200"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        <iframe
            src={pdfSrc}
          className="flex-1 border-0"
            title="PDF Document"
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-600 min-w-[80px] text-center">
            {numPages ? `${currentPage} / ${numPages}` : 'Loading...'}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={!numPages || currentPage >= numPages}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-600 min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={scale >= 3.0}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom in"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <div className="w-px h-5 bg-gray-300 mx-2" />
          <button
            onClick={openFullscreen}
            className="p-1 rounded hover:bg-gray-100"
            title="Full screen"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1 rounded hover:bg-gray-100"
            title="Download PDF"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}
        {Document && Page && (
          <Document
            file={src}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            className="shadow-lg"
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={null}
            />
          </Document>
        )}
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && Document && Page && (
        <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
          {/* Fullscreen toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-300 min-w-[80px] text-center">
                {numPages ? `${currentPage} / ${numPages}` : 'Loading...'}
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={!numPages || currentPage >= numPages}
                className="p-1 rounded hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleZoomOut}
                disabled={scale <= 0.5}
                className="p-1 rounded hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-300 min-w-[50px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={scale >= 3.0}
                className="p-1 rounded hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <div className="w-px h-5 bg-gray-600 mx-2" />
              <button
                onClick={handleDownload}
                className="p-1 rounded hover:bg-gray-700 text-white"
                title="Download PDF"
              >
                <Download className="w-5 h-5" />
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

          {/* Fullscreen PDF Content */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-8">
            <Document
              file={src}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={null}
              className="shadow-lg"
            >
              <Page
                pageNumber={currentPage}
                scale={scale * 1.5}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={null}
              />
            </Document>
          </div>
        </div>
      )}
    </div>
    );
};
