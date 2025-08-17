"use client";
import React from "react";
import { Button } from "@/components/ui/button";

interface PreviewPanelProps {
  title?: string;
  previewHtml: string | null;
  previewScale: number;
  baseHeight: number;
  previewContainerRef: React.RefObject<HTMLDivElement | null>;
  previewInnerRef: React.RefObject<HTMLDivElement | null>;
  onExportPdf: () => void;
  onExportVectorPdf: () => void;
  onPrint: () => void;
}

export function PreviewPanel({
  title = "Preview",
  previewHtml,
  previewScale,
  baseHeight,
  previewContainerRef,
  previewInnerRef,
  onExportPdf,
  onExportVectorPdf,
  onPrint,
}: PreviewPanelProps) {
  if (!previewHtml) return null;
  return (
    <div className="mt-6 md:mt-0 md:sticky md:top-4 border border-gray-300 dark:border-gray-700 rounded-lg p-2 sm:p-4 responsive-pane w-full max-w-3xl mx-auto h-[calc(100vh-120px)] overflow-auto bg-white dark:bg-gray-900">
      <div className="sticky top-0 z-10 bg-white/85 dark:bg-gray-900/85 supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60 backdrop-blur flex items-center justify-between gap-3 py-2 border-b border-gray-200 dark:border-gray-700 mb-2">
        <div className="text-sm font-semibold">{title}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onExportPdf} title="Download PDF">
            Download PDF
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onExportVectorPdf} title="Vector (pdf-lib) exact layout">
            Download PDF (vector)
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onPrint} title="Print preview">
            Print
          </Button>
        </div>
      </div>
      <div ref={previewContainerRef} className="w-full">
        <div
          className="mx-auto"
          style={{
            width: `${Math.round(794 * previewScale)}px`,
            height: `${Math.round(baseHeight * previewScale)}px`,
            position: "relative",
          }}
        >
          <div
            ref={previewInnerRef}
            style={{ transform: `scale(${previewScale})`, transformOrigin: "top left", width: "794px" }}
            dangerouslySetInnerHTML={{ __html: previewHtml as string }}
          />
        </div>
      </div>
    </div>
  );
}
