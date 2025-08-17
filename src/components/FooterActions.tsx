"use client";
import React from "react";
import { Button } from "@/components/ui/button";

interface FooterActionsProps {
  saving: boolean;
  selectedTemplateId: string;
  onSaveAndPreviewTemplate: () => void;
  onSaveAndPreviewForm: () => void;
  onExportPdf: () => void;
  onExportVectorPdf: () => void;
  onPrint: () => void;
  previewHtml: string | null;
}

export function FooterActions({
  saving,
  selectedTemplateId,
  onSaveAndPreviewTemplate,
  onSaveAndPreviewForm,
  onExportPdf,
  onExportVectorPdf,
  onPrint,
  previewHtml,
}: FooterActionsProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 dark:bg-gray-900/90 supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-gray-900/70 backdrop-blur border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            disabled={saving}
            onClick={selectedTemplateId ? onSaveAndPreviewTemplate : onSaveAndPreviewForm}
          >
            {saving ? "Saving..." : "Save & Preview"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportPdf}
            title="Download PDF"
            disabled={!previewHtml}
          >
            Download PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportVectorPdf}
            title="Vector (pdf-lib) exact layout"
            disabled={!previewHtml}
          >
            Download PDF (vector)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPrint}
            title="Print preview"
            disabled={!previewHtml}
          >
            Print
          </Button>
        </div>
      </div>
    </div>
  );
}
