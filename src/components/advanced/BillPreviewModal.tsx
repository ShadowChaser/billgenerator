"use client";

import React from "react";

export interface TemplateLike {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  createdAt: Date;
  fields: any[];
}

export interface BillPreviewModalProps {
  open: boolean;
  template: TemplateLike | null;
  onClose: () => void;
  onExportPDF: () => void;
  onExportWord: () => void;
  onExportImage: () => void;
  onPrint: () => void;
  onEditTemplate: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const BillPreviewModal: React.FC<BillPreviewModalProps> = ({
  open,
  template,
  onClose,
  onExportPDF,
  onExportWord,
  onExportImage,
  onPrint,
  onEditTemplate,
  canvasRef,
}) => {
  if (!open || !template) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Bill Preview - {template.name}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl">×</button>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <button onClick={onExportPDF} className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors duration-300 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Export PDF
            </button>
            <button onClick={onExportWord} className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors duration-300 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 002-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Export Word (RTF)
            </button>
            <button onClick={onExportImage} className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors duration-300 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              Export Image
            </button>
            <button onClick={onPrint} className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors duration-300 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              Print
            </button>
            <button onClick={onEditTemplate} className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors duration-300 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              Edit Template
            </button>
          </div>
        </div>

        <div className="p-6 overflow-auto max-h-[calc(90vh-200px)]">
          <div className="flex justify-center">
            <div className="border border-gray-300 rounded-lg overflow-hidden shadow-lg">
              <canvas
                ref={canvasRef}
                width={template.width}
                height={template.height}
                className="max-w-full h-auto"
                style={{ maxWidth: "100%", height: "auto", display: "block" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillPreviewModal;
