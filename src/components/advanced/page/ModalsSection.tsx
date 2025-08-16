"use client";

import React from "react";
import NewTemplateChooserModal from "@/components/advanced/NewTemplateChooserModal";
import FieldEditorModal from "@/components/advanced/FieldEditorModal";
import BillPreviewModal from "@/components/advanced/BillPreviewModal";
import TemplateSettingsModal from "@/components/advanced/TemplateSettingsModal";

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
  // New template chooser
  showNewTemplateChooser: boolean;
  onCloseNewTemplateChooser: () => void;
  onCreateProfessional: () => void;
  onCreateEmpty: () => void;

  // Field editor
  showFieldEditor: boolean;
  fieldEditorMode: "create" | "edit";
  fieldEditorData: any;
  onChangeFieldEditorData: (data: any) => void;
  onSaveField: () => void;
  onCloseFieldEditor: () => void;

  // Bill preview
  showBillPreview: boolean;
  previewTemplate: TemplateLike | null;
  onCloseBillPreview: () => void;
  onExportPDF: () => void;
  onExportWord: () => void;
  onExportImage: () => void;
  onPrint: () => void;
  onEditTemplateFromPreview: () => void;
  billCanvasRef: React.RefObject<HTMLCanvasElement>;

  // Template settings
  showTemplateSettings: boolean;
  currentTemplate: TemplateLike | null;
  onCloseTemplateSettings: () => void;
  onUpdateTemplate: (patch: Partial<TemplateLike>) => void;
  onDuplicateTemplate: () => void;
}

const ModalsSection: React.FC<Props> = ({
  showNewTemplateChooser,
  onCloseNewTemplateChooser,
  onCreateProfessional,
  onCreateEmpty,
  showFieldEditor,
  fieldEditorMode,
  fieldEditorData,
  onChangeFieldEditorData,
  onSaveField,
  onCloseFieldEditor,
  showBillPreview,
  previewTemplate,
  onCloseBillPreview,
  onExportPDF,
  onExportWord,
  onExportImage,
  onPrint,
  onEditTemplateFromPreview,
  billCanvasRef,
  showTemplateSettings,
  currentTemplate,
  onCloseTemplateSettings,
  onUpdateTemplate,
  onDuplicateTemplate,
}) => {
  return (
    <>
      <NewTemplateChooserModal
        open={showNewTemplateChooser}
        onClose={onCloseNewTemplateChooser}
        onCreateProfessional={onCreateProfessional}
        onCreateEmpty={onCreateEmpty}
      />

      <FieldEditorModal
        open={showFieldEditor}
        mode={fieldEditorMode}
        data={fieldEditorData}
        onChange={onChangeFieldEditorData}
        onSave={onSaveField}
        onClose={onCloseFieldEditor}
      />

      <BillPreviewModal
        open={showBillPreview}
        template={previewTemplate}
        onClose={onCloseBillPreview}
        onExportPDF={onExportPDF}
        onExportWord={onExportWord}
        onExportImage={onExportImage}
        onPrint={onPrint}
        onEditTemplate={onEditTemplateFromPreview}
        canvasRef={billCanvasRef as React.RefObject<HTMLCanvasElement>}
      />

      <TemplateSettingsModal
        open={!!showTemplateSettings && !!currentTemplate}
        template={currentTemplate}
        onClose={onCloseTemplateSettings}
        onUpdate={onUpdateTemplate}
        onDuplicate={onDuplicateTemplate}
      />
    </>
  );
};

export default ModalsSection;
