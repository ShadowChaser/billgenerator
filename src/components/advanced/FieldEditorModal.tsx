"use client";

import React, { useState } from "react";

export type Alignment = "left" | "center" | "right";

export interface SubElementLike {
  id: string;
  type: "text" | "caption";
  content: string;
  position: "top" | "bottom" | "left" | "right";
  offsetX: number;
  offsetY: number;
  fontSize: number;
  textColor: string;
  isBold: boolean;
  isItalic: boolean;
}

export interface TemplateFieldLike {
  id: string;
  label: string;
  value: string;
  type: "text" | "number" | "date" | "amount" | "textarea" | "select" | "image" | "signature";
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  alignment: Alignment;
  placeholder?: string;
  options?: string[];
  required: boolean;
  lockAspect?: boolean;
  subElements?: SubElementLike[];
}

export interface FieldEditorModalProps {
  open: boolean;
  mode: "create" | "edit";
  data: Partial<TemplateFieldLike>;
  onChange: (next: Partial<TemplateFieldLike>) => void;
  onSave: () => void;
  onClose: () => void;
}

const FieldEditorModal: React.FC<FieldEditorModalProps> = ({ open, mode, data, onChange, onSave, onClose }) => {
  if (!open) return null;

  const update = (patch: Partial<TemplateFieldLike>) => onChange({ ...data, ...patch });
  const [activeTab, setActiveTab] = useState<"content" | "position" | "style" | "labels" | "advanced">("content");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-0 md:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-none md:rounded-xl p-4 md:p-6 w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:mx-4 overflow-y-auto">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{mode === "create" ? "Add New Field" : "Edit Field"}</h3>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: "content", label: "Content" },
            { id: "position", label: "Position & Size" },
            { id: "style", label: "Style" },
            { id: "labels", label: "Labels/Caption" },
            { id: "advanced", label: "Advanced" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${
                activeTab === t.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Tab */}
        {activeTab === "content" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field Label</label>
              <input
                type="text"
                value={data.label || ""}
                onChange={(e) => update({ label: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Enter field label"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field Type</label>
                <select
                  value={data.type || "text"}
                  onChange={(e) => update({ type: e.target.value as TemplateFieldLike["type"] })}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="textarea">Text Area</option>
                  <option value="select">Select</option>
                  <option value="image">Image</option>
                  <option value="signature">Signature</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alignment</label>
                <select
                  value={data.alignment || "left"}
                  onChange={(e) => update({ alignment: e.target.value as Alignment })}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>

            {/* Default value / image upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Value</label>
              {data.type === "image" || data.type === "signature" ? (
                <div className="space-y-3">
                  {data.value ? (
                    <div className="flex items-start gap-3">
                      <img src={data.value} alt="preview" className="w-32 h-20 object-contain rounded border" />
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          className="bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded"
                          onClick={() => update({ value: "" })}
                        >
                          Remove Image
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 dark:text-gray-400">No image selected</div>
                  )}
                  <label className="inline-block bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 px-3 rounded cursor-pointer">
                    Choose Image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => update({ value: reader.result as string });
                        reader.readAsDataURL(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">Supported: PNG, JPG, JPEG, WEBP</div>
                </div>
              ) : data.type === "textarea" ? (
                <textarea
                  value={data.value || ""}
                  onChange={(e) => update({ value: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-h-[100px] resize-vertical"
                  placeholder="Enter default value (use \n for line breaks)"
                  rows={4}
                />
              ) : (
                <input
                  type="text"
                  value={data.value || ""}
                  onChange={(e) => update({ value: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Enter default value"
                />
              )}
            </div>

            {/* Placeholder and Select options */}
            {data.type !== "image" && data.type !== "signature" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={data.placeholder || ""}
                    onChange={(e) => update({ placeholder: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Input placeholder"
                  />
                </div>
                {data.type === "select" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Options (comma separated)</label>
                    <input
                      type="text"
                      value={(data.options || []).join(", ")}
                      onChange={(e) => update({ options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      placeholder="e.g. Option A, Option B"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Position & Size Tab */}
        {activeTab === "position" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">X Position</label>
                <input
                  type="number"
                  value={data.x ?? 100}
                  onChange={(e) => update({ x: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Y Position</label>
                <input
                  type="number"
                  value={data.y ?? 100}
                  onChange={(e) => update({ y: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Width</label>
                <input
                  type="number"
                  value={data.width ?? 150}
                  onChange={(e) => update({ width: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Height</label>
                <input
                  type="number"
                  value={data.height ?? 40}
                  onChange={(e) => update({ height: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {(data.type === "image" || data.type === "signature") && (
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={data.lockAspect ?? true}
                  onChange={(e) => update({ lockAspect: e.target.checked })}
                  className="mr-2"
                />
                Lock Aspect Ratio
              </label>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Font Size</label>
              <input
                type="number"
                value={data.fontSize ?? 16}
                onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
                className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        )}

        {/* Style Tab */}
        {activeTab === "style" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Text Color</label>
                <input
                  type="color"
                  value={data.textColor || "#000000"}
                  onChange={(e) => update({ textColor: e.target.value })}
                  className="w-full h-10 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Background Color</label>
                <input
                  type="color"
                  value={data.backgroundColor || "#ffffff"}
                  onChange={(e) => update({ backgroundColor: e.target.value })}
                  className="w-full h-10 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Border Color</label>
                <input
                  type="color"
                  value={data.borderColor || "#e5e7eb"}
                  onChange={(e) => update({ borderColor: e.target.value })}
                  className="w-full h-10 border border-gray-300 rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Border Width</label>
                <input
                  type="number"
                  value={data.borderWidth ?? 1}
                  onChange={(e) => update({ borderWidth: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Border Radius</label>
                <input
                  type="number"
                  value={data.borderRadius ?? 6}
                  onChange={(e) => update({ borderRadius: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={data.isBold || false}
                    onChange={(e) => update({ isBold: e.target.checked })}
                    className="mr-2"
                  />
                  Bold
                </label>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={data.isItalic || false}
                    onChange={(e) => update({ isItalic: e.target.checked })}
                    className="mr-2"
                  />
                  Italic
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Labels/Caption Tab */}
        {activeTab === "labels" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Labels & Captions ({(data.subElements || []).length})</h4>
              <button
                type="button"
                onClick={() => {
                  const newSub = {
                    id: `sub-${Date.now()}`,
                    type: "caption" as const,
                    content: "New Label",
                    position: "bottom" as const,
                    offsetX: 0,
                    offsetY: 0,
                    fontSize: 12,
                    textColor: "#6b7280",
                    isBold: false,
                    isItalic: false,
                  };
                  update({ subElements: [...(data.subElements || []), newSub] });
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-1 px-3 rounded transition-colors duration-300"
              >
                + Add Label
              </button>
            </div>

            <div className="space-y-3 max-h-48 overflow-y-auto">
              {(data.subElements || []).map((subEl, index) => (
                <div key={subEl.id} className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
                      <input
                        type="text"
                        value={subEl.content}
                        onChange={(e) => {
                          const updated = [...(data.subElements || [])];
                          updated[index] = { ...subEl, content: e.target.value };
                          update({ subElements: updated });
                        }}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="Label text"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Position</label>
                      <select
                        value={subEl.position}
                        onChange={(e) => {
                          const updated = [...(data.subElements || [])];
                          updated[index] = { ...subEl, position: e.target.value as SubElementLike["position"] };
                          update({ subElements: updated });
                        }}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Font Size</label>
                      <input
                        type="number"
                        value={subEl.fontSize}
                        onChange={(e) => {
                          const updated = [...(data.subElements || [])];
                          updated[index] = { ...subEl, fontSize: parseInt(e.target.value) || 12 };
                          update({ subElements: updated });
                        }}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        min={8}
                        max={24}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
                      <input
                        type="color"
                        value={subEl.textColor}
                        onChange={(e) => {
                          const updated = [...(data.subElements || [])];
                          updated[index] = { ...subEl, textColor: e.target.value };
                          update({ subElements: updated });
                        }}
                        className="w-full h-8 border border-gray-300 rounded"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-3">
                      <label className="flex items-center text-xs text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={subEl.isBold}
                          onChange={(e) => {
                            const updated = [...(data.subElements || [])];
                            updated[index] = { ...subEl, isBold: e.target.checked };
                            update({ subElements: updated });
                          }}
                          className="mr-1"
                        />
                        Bold
                      </label>
                      <label className="flex items-center text-xs text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={subEl.isItalic}
                          onChange={(e) => {
                            const updated = [...(data.subElements || [])];
                            updated[index] = { ...subEl, isItalic: e.target.checked };
                            update({ subElements: updated });
                          }}
                          className="mr-1"
                        />
                        Italic
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const updated = (data.subElements || []).filter((_, i) => i !== index);
                        update({ subElements: updated });
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded transition-colors duration-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {(!data.subElements || data.subElements.length === 0) && (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                  No labels or captions added yet. Click "Add Label" to get started.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === "advanced" && (
          <div className="space-y-4">
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={data.required || false}
                onChange={(e) => update({ required: e.target.checked })}
                className="mr-2"
              />
              Required field
            </label>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Field ID: <span className="font-mono">{data.id}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={onSave} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300">Save Field</button>
          <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default FieldEditorModal;
