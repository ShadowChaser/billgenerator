"use client";
import { Edit3, Plus, Download, FileText, FileJson, X } from "lucide-react";

interface EditorToolbarProps {
  isEditing: boolean;
  onToggleEdit: () => void;
  onAddField?: () => void;
  onExportPdf?: () => void;
  onExportJson?: () => void;
  onUseInCustom?: () => void;
  onSaveTemplate?: () => void;
  onSave?: () => void;
  onClose: () => void;
}

export function EditorToolbar({
  isEditing,
  onToggleEdit,
  onAddField,
  onExportPdf,
  onExportJson,
  onUseInCustom,
  onSaveTemplate,
  onSave,
  onClose,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Edit Toggle */}
      <button
        onClick={onToggleEdit}
        className={`p-2 rounded transition-colors border ${
          isEditing 
            ? 'bg-blue-500 text-white hover:bg-blue-600 border-blue-600' 
            : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-300'
        }`}
        title={isEditing ? "Exit Edit Mode" : "Enter Edit Mode"}
      >
        <Edit3 size={16} />
      </button>

      {/* Add Field */}
      {onAddField && (
        <button
          onClick={onAddField}
          className="px-3 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded transition-colors border border-blue-600 font-medium"
          title="Add Field"
        >
          <Plus size={16} className="mr-1" />
          Add Field
        </button>
      )}

      {/* Export PDF */}
      <button
        onClick={onExportPdf}
        className="p-2 bg-purple-500 text-white hover:bg-purple-600 rounded transition-colors border border-purple-600"
        title="Export PDF"
      >
        <Download size={16} />
      </button>

      {/* Export JSON */}
      {onExportJson && (
        <button
          onClick={onExportJson}
          className="p-2 bg-gray-500 text-white hover:bg-gray-600 rounded transition-colors border border-gray-600"
          title="Export JSON"
        >
          <FileJson size={16} />
        </button>
      )}

      {/* Use in Custom Template */}
      {onUseInCustom && (
        <button
          onClick={onUseInCustom}
          className="px-3 py-2 bg-green-500 text-white hover:bg-green-600 rounded transition-colors border border-green-600 font-medium"
          title="Use in Custom Template"
        >
          <FileText size={16} className="mr-1" />
          Use in Custom
        </button>
      )}

      {/* Save Template */}
      {onSaveTemplate && (
        <button
          onClick={onSaveTemplate}
          className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors border border-blue-700 font-medium"
          title="Save Template"
        >
          💾 Save Template
        </button>
      )}

      {/* Save (only show in edit mode) */}
      {isEditing && onSave && (
        <button
          onClick={onSave}
          className="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded transition-colors border border-orange-700 font-medium"
        >
          Save Changes
        </button>
      )}

      {/* Close */}
      <button
        onClick={onClose}
        className="p-2 hover:bg-red-100 text-red-600 hover:text-red-700 rounded transition-colors border border-red-300 hover:border-red-400"
        title="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
}
