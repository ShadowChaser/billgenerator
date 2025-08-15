declare module "pdfjs-dist" {
  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }

  export interface PDFPageProxy {
    getTextContent(): Promise<TextContent>;
    getViewport(params: { scale: number }): PDFPageViewport;
    render(params: RenderParams): { promise: Promise<void> };
  }

  export interface PDFPageViewport {
    width: number;
    height: number;
  }

  export interface RenderParams {
    canvasContext: CanvasRenderingContext2D;
    viewport: PDFPageViewport;
  }

  export interface TextContent {
    items: TextItem[];
  }

  export interface TextItem {
    str: string;
    dir?: string;
    transform?: number[];
    width?: number;
    height?: number;
  }

  export interface PDFSource {
    data: ArrayBuffer;
  }

  export function getDocument(source: PDFSource): {
    promise: Promise<PDFDocumentProxy>;
  };

  export const GlobalWorkerOptions: {
    workerSrc: string;
  };
}

declare module "pdfjs-dist/build/pdf.worker.entry" {
  const workerSrc: string;
  export default workerSrc;
}
