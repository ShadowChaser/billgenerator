"use client";
import { useState, useRef, useEffect } from "react";
import { ZoomControls } from "./editor/ZoomControls";
import { EditorToolbar } from "./editor/EditorToolbar";
import { EditorCanvas } from "./editor/EditorCanvas";
import { HtmlContentRenderer } from "./editor/HtmlContentRenderer";
import { PdfExporter } from "./editor/PdfExporter";

interface FullScreenPdfEditorProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
  onSave?: (content: string) => void;
  title?: string;
  onAddField?: () => void;
  onExportPdf?: () => void;
  onExportJson?: () => void;
  onUseInCustom?: () => void;
  onSaveTemplate?: () => void;
  template?: any;
  onUpdateTemplate?: (template: any) => void;
}

export default function FullScreenPdfEditorRefactored({
  isOpen,
  onClose,
  htmlContent,
  onSave,
  title = "PDF Editor",
  onAddField,
  onExportPdf,
  onExportJson,
  onUseInCustom,
  onSaveTemplate,
  template,
  onUpdateTemplate
}: FullScreenPdfEditorProps) {
  const [zoom, setZoom] = useState(1.5);
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState(htmlContent);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditableContent(htmlContent);
  }, [htmlContent]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Auto-fit zoom based on screen size
      const updateZoom = () => {
        if (containerRef.current) {
          const containerWidth = containerRef.current.clientWidth;
          const containerHeight = containerRef.current.clientHeight;
          const contentWidth = 794; // A4 width
          const contentHeight = 1123; // A4 height
          
          const widthRatio = (containerWidth - 100) / contentWidth;
          const heightRatio = (containerHeight - 100) / contentHeight;
          const optimalZoom = Math.min(widthRatio, heightRatio, 2.5);
          
          setZoom(Math.max(optimalZoom, 1.2));
        }
      };
      
      setTimeout(updateZoom, 100);
      window.addEventListener('resize', updateZoom);
      
      return () => {
        window.removeEventListener('resize', updateZoom);
      };
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 4));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1.5);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(editableContent);
    }
    setIsEditing(false);
  };

  const handleExportPdf = async () => {
    if (onExportPdf) {
      onExportPdf();
    } else {
      await PdfExporter.exportToPdf(editableContent, title);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b relative z-10">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        
        {/* Controls */}
        <div className="flex items-center gap-2">
          <ZoomControls
            zoom={zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
          />

          <EditorToolbar
            isEditing={isEditing}
            onToggleEdit={() => setIsEditing(!isEditing)}
            onAddField={onAddField}
            onExportPdf={handleExportPdf}
            onExportJson={onExportJson}
            onUseInCustom={onUseInCustom}
            onSaveTemplate={onSaveTemplate}
            onSave={handleSave}
            onClose={onClose}
          />
        </div>
      </div>

      {/* Content Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-100 p-4"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          minHeight: '100%'
        }}
      >
        <div
          className="bg-white shadow-2xl"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.2s ease-in-out',
            marginTop: '20px',
            marginBottom: zoom > 1 ? `${(zoom - 1) * 800}px` : '40px'
          }}
        >
          <EditorCanvas
            template={template}
            isEditing={isEditing}
            zoom={zoom}
            onUpdateTemplate={onUpdateTemplate}
          />
          
          <HtmlContentRenderer
            htmlContent={editableContent}
            isEditing={isEditing}
          />
        </div>
      </div>

      {/* Footer with shortcuts */}
      <div className="bg-white border-t p-2 text-xs text-gray-600 text-center">
        <span className="inline-flex items-center gap-4">
          <span>Ctrl + Mouse Wheel: Zoom</span>
          <span>Double-click: Toggle Edit Mode</span>
          <span>ESC: Close</span>
        </span>
      </div>
    </div>
  );
}
