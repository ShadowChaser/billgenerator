"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import ExportButtons from "@/components/advanced/ExportButtons";
import TemplateCanvas from "@/components/advanced/TemplateCanvas";
import FieldsPanel from "@/components/advanced/FieldsPanel";

export interface TemplateLike {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  createdAt: Date;
  fields: any[];
}

interface Props {
  template: TemplateLike;
  isEditing: boolean;
  onStartEditing: () => void;
  onAddField: () => void;
  onExportPdf: () => void;
  onExportJson: () => void;
  onUseInCustom: () => void;
  onSaveTemplate: () => void;
  // View controls
  zoom: number;
  onZoomChange: (z: number) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  gridSize: number;
  onGridSizeChange: (n: number) => void;
  // Canvas props
  canvasContainerSize: { width: number; height: number } | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onTouchStart: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  onTouchEnd: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  onClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onDoubleClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  // Inline edit
  inlineField: any;
  inlinePosition: any;
  inlineInputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  inlineValue: string;
  onInlineChange: (v: string) => void;
  onInlineKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onInlineBlur: () => void;
  // Fields panel
  selectedFieldId: string | null;
  onEditField: (f: any) => void;
  onDeleteField: (id: string) => void;
  onUploadImage: (fieldId: string, file: File) => void;
}

const EditorSection: React.FC<Props> = ({
  template,
  isEditing,
  onStartEditing,
  onAddField,
  onExportPdf,
  onExportJson,
  onUseInCustom,
  onSaveTemplate,
  // view controls
  zoom,
  onZoomChange,
  showGrid,
  onToggleGrid,
  snapToGrid,
  onToggleSnap,
  gridSize,
  onGridSizeChange,
  canvasContainerSize,
  canvasRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onClick,
  onDoubleClick,
  inlineField,
  inlinePosition,
  inlineInputRef,
  inlineValue,
  onInlineChange,
  onInlineKeyDown,
  onInlineBlur,
  selectedFieldId,
  onEditField,
  onDeleteField,
  onUploadImage,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 md:p-8 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start md:items-center justify-between mb-4 md:mb-6 flex-col md:flex-row gap-3 md:gap-0">
        <div>
          <h3 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
            {template.name || "Untitled Template"}
          </h3>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
            {template.fields.length} fields • Advanced styling enabled
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
          {!isEditing ? (
            <Button className="w-full md:w-auto" onClick={onStartEditing}>
              ✏️ Edit Template
            </Button>
          ) : (
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              <ExportButtons
                onAddField={onAddField}
                onExportPdf={onExportPdf}
                onExportJson={onExportJson}
                onUseInCustom={onUseInCustom}
                onSaveTemplate={onSaveTemplate}
              />
              <div className="flex flex-wrap items-center gap-2 md:gap-3 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-md p-2">
                {/* Zoom */}
                <label className="text-xs text-gray-600 dark:text-gray-300">
                  Zoom
                </label>
                <select
                  className="px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded"
                  value={String(zoom)}
                  onChange={(e) => onZoomChange(parseFloat(e.target.value))}
                >
                  <option value={"0.5"}>50%</option>
                  <option value={"0.75"}>75%</option>
                  <option value={"1"}>100% (Fit)</option>
                  <option value={"1.25"}>125%</option>
                  <option value={"1.5"}>150%</option>
                </select>

                {/* Grid toggle */}
                <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={showGrid} onChange={onToggleGrid} />
                  Grid
                </label>

                {/* Snap toggle */}
                <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={snapToGrid} onChange={onToggleSnap} />
                  Snap
                </label>

                {/* Grid size */}
                <label className="text-xs text-gray-600 dark:text-gray-300">Grid</label>
                <select
                  className="px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded"
                  value={String(gridSize)}
                  onChange={(e) => onGridSizeChange(parseInt(e.target.value))}
                >
                  <option value={"8"}>8px</option>
                  <option value={"12"}>12px</option>
                  <option value={"16"}>16px</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <TemplateCanvas
        templateSize={{ width: template.width, height: template.height }}
        containerSize={canvasContainerSize as any}
        canvasRef={canvasRef as any}
        isEditing={isEditing}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        inlineField={inlineField}
        inlinePosition={inlinePosition}
        inlineInputRef={inlineInputRef as any}
        inlineValue={inlineValue}
        onInlineChange={onInlineChange}
        onInlineKeyDown={onInlineKeyDown as any}
        onInlineBlur={onInlineBlur}
      />

      {isEditing && (
        <FieldsPanel
          fields={template.fields as any}
          selectedFieldId={selectedFieldId}
          onAddField={onAddField}
          onEditField={(f) => onEditField(f)}
          onDeleteField={(id) => onDeleteField(id)}
          onUploadImage={onUploadImage}
        />
      )}

      {/* Shortcuts hint */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium">Shortcuts:</span> Delete: remove field • Ctrl+Z / Ctrl+Y: undo/redo • Double‑click a text to inline edit • Esc: clear selection
      </div>
    </div>
  );
};

export default EditorSection;
