"use client";

import React from "react";
import TemplateList from "@/components/advanced/TemplateList";

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
  templates: TemplateLike[];
  editingTemplateId: string | null;
  editingTemplateName: string;
  onOpenSettings: () => void;
  onCreateNew: () => void;
  onStartRename: (id: string, name: string) => void;
  onChangeRename: (value: string) => void;
  onCommitRename: (templateId: string, value: string) => void;
  onCancelRename: () => void;
  onSetCurrent: (templateId: string) => void;
  onGenerate: (templateId: string) => void;
  onDuplicate: (templateId: string) => void;
  onDelete: (templateId: string) => void;
}

const TemplateManagement: React.FC<Props> = ({
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
}) => {
  return (
    <>
      <TemplateList
        templates={templates as any}
        editingTemplateId={editingTemplateId}
        editingTemplateName={editingTemplateName}
        onOpenSettings={onOpenSettings}
        onCreateNew={onCreateNew}
        onStartRename={onStartRename}
        onChangeRename={onChangeRename}
        onCommitRename={onCommitRename}
        onCancelRename={onCancelRename}
        onSetCurrent={onSetCurrent}
        onGenerate={onGenerate}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
      {templates.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No templates yet. Create your first advanced template to get started!
        </div>
      )}
    </>
  );
};

export default TemplateManagement;
