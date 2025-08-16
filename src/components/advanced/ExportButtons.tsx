"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface ExportButtonsProps {
  onAddField: () => void;
  onExportPdf: () => void;
  onExportJson: () => void;
  onUseInCustom: () => void;
  onSaveTemplate: () => void;
}

export default function ExportButtons(props: ExportButtonsProps) {
  const { onAddField, onExportPdf, onExportJson, onUseInCustom, onSaveTemplate } = props;

  return (
    <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
      <Button className="w-full sm:w-auto" onClick={onAddField}>
        ➕ Add Field
      </Button>
      <Button className="w-full sm:w-auto" variant="gradient" onClick={onExportPdf}>
        🖨️ Export PDF
      </Button>
      <Button className="w-full sm:w-auto" variant="secondary" onClick={onExportJson}>
        ⬇️ Export JSON
      </Button>
      <Button className="w-full sm:w-auto" variant="success" onClick={onUseInCustom}>
        🚚 Use in Custom Template
      </Button>
      <Button className="w-full sm:w-auto" variant="success" onClick={onSaveTemplate}>
        💾 Save Template
      </Button>
    </div>
  );
}
