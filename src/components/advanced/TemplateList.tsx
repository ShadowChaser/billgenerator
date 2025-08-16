"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Minimal local type to avoid tight coupling during refactor
export interface TemplateListItem {
  id: string;
  name: string;
  description: string;
  createdAt: Date | string;
  fields: { id: string }[];
}

interface TemplateListProps {
  templates: TemplateListItem[];
  editingTemplateId: string | null;
  editingTemplateName: string;
  onOpenSettings: () => void;
  onCreateNew: () => void;
  onStartRename: (templateId: string, name: string) => void;
  onChangeRename: (value: string) => void;
  onCommitRename: (templateId: string, value: string) => void;
  onCancelRename: () => void;
  onSetCurrent: (templateId: string) => void;
  onGenerate: (templateId: string) => void;
  onDuplicate: (templateId: string) => void;
  onDelete: (templateId: string) => void;
}

export default function TemplateList(props: TemplateListProps) {
  const {
    templates,
    editingTemplateId,
    editingTemplateName,
    onOpenSettings,
    onCreateNew,
    onStartRename,
    onChangeRename,
    onCommitRename,
    onCancelRename,
    onSetCurrent,
    onGenerate,
    onDuplicate,
    onDelete,
  } = props;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8 border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-start md:justify-between mb-6 gap-3 md:gap-0 flex-wrap md:flex-nowrap">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Your Templates</h2>
        <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
          <Button className="w-full md:w-auto" variant="secondary" onClick={onOpenSettings}>
            ⚙️ Template Settings
          </Button>
          <Button className="w-full md:w-auto" variant="success" onClick={onCreateNew}>
            ✨ Create New Template
          </Button>
        </div>
      </div>

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {editingTemplateId === template.id ? (
                    <input
                      type="text"
                      value={editingTemplateName}
                      onChange={(e) => onChangeRename(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (editingTemplateName.trim()) {
                            onCommitRename(template.id, editingTemplateName.trim());
                          }
                          onCancelRename();
                        } else if (e.key === "Escape") {
                          onCancelRename();
                        }
                      }}
                      className="text-xl font-bold text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-2 border-blue-500 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  ) : (
                    <CardTitle className="mb-2 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                      {template.name}
                    </CardTitle>
                  )}
                  <CardDescription>{template.description}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  className="ml-3 p-2"
                  title="Rename template"
                  onClick={() => onStartRename(template.id, template.name)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 mb-6 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="font-medium">{template.fields.length} fields</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>
                    Created {new Date(template.createdAt).toISOString().slice(0, 10)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => onSetCurrent(template.id)}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit
                </Button>
                <Button variant="gradient" onClick={() => onGenerate(template.id)}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Generate
                </Button>
                <Button variant="success" onClick={() => onDuplicate(template.id)}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Duplicate
                </Button>
                <Button variant="destructive" onClick={() => onDelete(template.id)}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
