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

export interface TemplateSettingsModalProps {
  open: boolean;
  template: TemplateLike | null;
  onClose: () => void;
  onUpdate: (patch: Partial<TemplateLike>) => void;
  onDuplicate: () => void;
  info?: { fieldsCount: number; createdAt: Date };
}

const TemplateSettingsModal: React.FC<TemplateSettingsModalProps> = ({
  open,
  template,
  onClose,
  onUpdate,
  onDuplicate,
  info,
}) => {
  if (!open || !template) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Template Settings</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name</label>
            <input
              type="text"
              value={template.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Enter template name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={template.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-vertical"
              placeholder="Enter template description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Width (px)</label>
              <input
                type="number"
                value={template.width}
                onChange={(e) => {
                  const newWidth = Math.max(400, parseInt(e.target.value) || 800);
                  onUpdate({ width: newWidth });
                }}
                className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                min={400}
                max={2000}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Height (px)</label>
              <input
                type="number"
                value={template.height}
                onChange={(e) => {
                  const newHeight = Math.max(400, parseInt(e.target.value) || 1120);
                  onUpdate({ height: newHeight });
                }}
                className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                min={400}
                max={2000}
              />
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Template Info</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Fields: {info?.fieldsCount ?? template.fields.length} • Created: {new Date(info?.createdAt ?? template.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors duration-300">Close</button>
          <button onClick={onDuplicate} className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors duration-300">Duplicate Template</button>
        </div>
      </div>
    </div>
  );
};

export default TemplateSettingsModal;
