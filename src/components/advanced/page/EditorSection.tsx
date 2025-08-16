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
    <div className="bg-white dark:bg-gray-8 00 rounded-xl shadow-lg p-4 md:p-8 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start md:items-center justify-between mb-4 md:mb-6 flex-col md:flex-row gap-3 md:gap-0">
        <div>
          <h3 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
            {template.name}
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
            <ExportButtons
              onAddField={onAddField}
              onExportPdf={onExportPdf}
              onExportJson={onExportJson}
              onUseInCustom={onUseInCustom}
              onSaveTemplate={onSaveTemplate}
            />
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
    </div>
  );
};

export default EditorSection;
