"use client";

import React from "react";
import { Button } from "@/components/ui/button";

// Minimal local type shape to avoid coupling for now
export interface FieldsPanelField {
  id: string;
  label: string;
  value: string;
  type:
    | "text"
    | "number"
    | "date"
    | "amount"
    | "textarea"
    | "select"
    | "image"
    | "signature";
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  alignment: "left" | "center" | "right";
}

export type OnUploadImage = (fieldId: string, file: File) => void;

interface FieldsPanelProps {
  fields: FieldsPanelField[];
  selectedFieldId?: string | null;
  onAddField: () => void;
  onEditField: (field: FieldsPanelField) => void;
  onDeleteField: (id: string) => void;
  onUploadImage?: OnUploadImage;
}

export default function FieldsPanel(props: FieldsPanelProps) {
  const { fields, selectedFieldId, onAddField, onEditField, onDeleteField, onUploadImage } = props;

  return (
    <div className="mt-4 md:mt-6">
      <div className="flex items-start md:items-center justify-between mb-3 md:mb-4 gap-2 md:gap-0 flex-col md:flex-row">
        <h4 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
          Template Fields ({fields.length})
        </h4>
        <Button className="w-full md:w-auto" onClick={onAddField}>
          ➕ Add New Field
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 max-h-96 overflow-y-auto touch-pan-y">
        {fields.map((field) => (
          <div
            key={field.id}
            className={`p-3 md:p-4 border-2 rounded-lg transition-all duration-300 touch-manipulation ${
              selectedFieldId === field.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-gray-700"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                {field.label}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{field.type}</span>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 break-words">
              {field.type === "image" || field.type === "signature" ? (
                <span className="italic">{field.value ? "Image selected" : "No image"}</span>
              ) : (
                field.value
              )}
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 space-y-1">
              <div>
                Position: ({field.x}, {field.y})
              </div>
              <div>
                Size: {field.width} × {field.height}
              </div>
              <div>
                Font: {field.fontSize}px {field.isBold ? "Bold" : ""} {field.isItalic ? "Italic" : ""}
              </div>
              <div>Align: {field.alignment}</div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button className="flex-1 sm:flex-none" size="sm" onClick={() => onEditField(field)}>
                Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onDeleteField(field.id)}>
                Delete
              </Button>
              {(field.type === "image" || field.type === "signature") && onUploadImage && (
                <label className="bg-purple-600 hover:bg-purple-700 text-white text-xs py-1 px-2 rounded cursor-pointer transition-colors duration-300">
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadImage(field.id, file);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
