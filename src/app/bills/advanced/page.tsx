"use client";

import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import AdvancedHeader from "@/components/advanced/page/AdvancedHeader";
import TemplateManagement from "@/components/advanced/page/TemplateManagement";
import EditorSection from "@/components/advanced/page/EditorSection";
import ModalsSection from "@/components/advanced/page/ModalsSection";
import InstructionsSection from "@/components/advanced/page/InstructionsSection";
import { Template, TemplateField } from "@/lib/advancedTypes";
import { generateRTFContent } from "@/lib/advancedUtils";
import { CUSTOM_INBOX_KEY } from "@/lib/constants";
import { useTemplateCanvas } from "@/hooks/useTemplateCanvas";
import { useAdvancedTemplates } from "@/hooks/advanced/useAdvancedTemplates";
import { useUndoRedo } from "@/hooks/advanced/useUndoRedo";
import { useInlineEditing } from "@/hooks/advanced/useInlineEditing";
import { useBillPreview } from "@/hooks/advanced/useBillPreview";

// Types moved to src/lib/advancedTypes.ts

// constants moved to src/lib/constants.ts

// enforceTemplateLimit moved to src/lib/advancedUtils.ts

export default function AdvancedBillGeneratorPage() {
  const router = useRouter();
  // Templates state via hook (logic moved out, behavior unchanged)
  const {
    templates,
    setTemplates,
    currentTemplate,
    setCurrentTemplate,
    insertTemplateWithLimit,
    createFromProfessional,
    createNewTemplate,
    deleteTemplate,
    saveTemplate,
    exportTemplateJson,
    updateField,
    deleteField,
    onUploadImageForField,
  } = useAdvancedTemplates();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedField, setSelectedField] = useState<TemplateField | null>(
    null
  );
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);

  // New template chooser modal
  const [showNewTemplateChooser, setShowNewTemplateChooser] = useState(false);

  // Canvas container sizing
  const [canvasContainerSize, setCanvasContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Field editor modal
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [isFieldEditorMode, setIsFieldEditorMode] = useState<"create" | "edit">(
    "create"
  );
  const [fieldEditorData, setFieldEditorData] = useState<
    Partial<TemplateField>
  >({});

  // Inline text editing via hook
  const templateCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const {
    inlineEditField,
    inlineEditValue,
    inlineEditPosition,
    inlineInputRef,
    setInlineEditValue,
    startInlineEdit,
    finishInlineEdit,
    cancelInlineEdit,
    handleInlineKeyDown,
  } = useInlineEditing(currentTemplate, templateCanvasRef, updateField);

  // Template name inline editing
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null
  );
  const [editingTemplateName, setEditingTemplateName] = useState("");

  // Bill generation and preview via hook
  const {
    showBillPreview,
    setShowBillPreview,
    previewTemplate,
    setPreviewTemplate,
    billCanvasRef,
    renderBillToCanvas,
    generateBill,
  } = useBillPreview();

  // Undo/Redo system via hook
  const { saveStateForUndo, undo, redo } = useUndoRedo(
    currentTemplate,
    setCurrentTemplate,
    setTemplates
  );
  // Calculate responsive canvas container size
  useEffect(() => {
    const updateCanvasSize = () => {
      if (typeof window !== "undefined" && currentTemplate) {
        // Available space in the editor area
        const availW = Math.max(320, window.innerWidth - 32);
        // Use a larger height fraction on taller screens to avoid a tiny preview
        const baseH = window.innerHeight;
        const heightFrac = baseH >= 1000 ? 0.85 : baseH >= 800 ? 0.75 : 0.65;
        const availH = Math.max(240, Math.floor(baseH * heightFrac));

        // Maintain template aspect ratio by using a uniform scale
        const scale = Math.min(
          availW / currentTemplate.width,
          availH / currentTemplate.height,
          1
        );

        const width = Math.round(currentTemplate.width * scale);
        const height = Math.round(currentTemplate.height * scale);

        setCanvasContainerSize({ width, height });
      }
    };

    updateCanvasSize();
    if (typeof window !== "undefined") {
      window.addEventListener('resize', updateCanvasSize);
      return () => window.removeEventListener('resize', updateCanvasSize);
    }
  }, [currentTemplate]);

  // Helper kept: exportTemplateJson moved to hook

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
          e.preventDefault();
          redo();
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedField && isEditing) {
          e.preventDefault();
          saveStateForUndo();
          deleteField(selectedField.id);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, selectedField, isEditing, saveStateForUndo]);

  // CRUD helpers moved to hook: updateField, deleteField

  // Inline editing moved to hook

  // Canvas click/double-click now handled by hook

  // Initialize canvas hook after dependent functions are declared
  const {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onDoubleClick,
    onClick,
  } = useTemplateCanvas({
    currentTemplate,
    isEditing,
    selectedField,
    setSelectedField,
    updateField,
    saveStateForUndo,
    canvasContainerSize,
    startInlineEdit,
    canvasRef: templateCanvasRef,
    inlineEditFieldId: inlineEditField?.id || null,
  });

  // insertTemplateWithLimit moved to hook

  // createNewTemplate provided by hook; local wrapper removed

  // (Removed duplicate localStorage load effect)
  const openFieldEditor = (
    field?: TemplateField,
    mode: "create" | "edit" = "create"
  ) => {
    setIsFieldEditorMode(mode);
    if (mode === "edit" && field) setFieldEditorData({ ...field });
    else
      setFieldEditorData({
        id: `fld-${Date.now()}`,
        label: "New Field",
        value: "",
        type: "text",
        x: 100,
        y: 100,
        width: 200,
        height: 40,
        fontSize: 16,
        isBold: false,
        isItalic: false,
        textColor: "#000000",
        backgroundColor: "#ffffff",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        borderRadius: 6,
        alignment: "left",
        required: false,
        lockAspect: true,
        subElements: [],
      });
    setShowFieldEditor(true);
  };

  const saveField = () => {
    if (!currentTemplate || !fieldEditorData.id) return;
    const field = fieldEditorData as TemplateField;
    if (isFieldEditorMode === "create") {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === currentTemplate.id
            ? { ...t, fields: [...t.fields, field] }
            : t
        )
      );
      setCurrentTemplate((ct) =>
        ct ? { ...ct, fields: [...ct.fields, field] } : ct
      );
    } else {
      updateField(field.id, field);
    }
    setShowFieldEditor(false);
  };

 

const exportCurrentCanvasToPdf = () => {
  const canvas = templateCanvasRef.current;
  if (!canvas || !currentTemplate) return;

    // Render onto an offscreen canvas with generous padding to avoid edge clipping
    const pad = 24; // pixels padding around image
    const off = document.createElement("canvas");
    // Use the backing resolution of the rendered canvas for maximum sharpness
    off.width = canvas.width + pad * 2;
    off.height = canvas.height + pad * 2;
    const octx = off.getContext("2d");
    if (!octx) return;
    // White background
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, off.width, off.height);
    // Copy without smoothing to preserve sharpness
    octx.imageSmoothingEnabled = false;
    try { (octx as any).imageSmoothingQuality = "high"; } catch {}
    // Draw original canvas with padding
    octx.drawImage(canvas, pad, pad);

    const imgData = off.toDataURL("image/png"); // lossless PNG
    // Use pixel units and disable compression to avoid softening
    const pdf = new jsPDF({
      orientation: off.width > off.height ? "landscape" : "portrait",
      unit: "px",
      format: [off.width, off.height],
      compress: false,
    });
    // Slight inset and -1 size reduce to avoid PDF viewer/printer edge clipping
    pdf.addImage(imgData, "PNG", 0.5, 0.5, Math.max(1, off.width - 1), Math.max(1, off.height - 1));
    pdf.save(`${currentTemplate.name || "template"}.pdf`);
  };

  // onUploadImageForField is provided by useAdvancedTemplates hook

  // Export to PDF
  const exportToPDF = async () => {
    if (!previewTemplate || !billCanvasRef.current) return;

    try {
      // Dynamic import of jsPDF
      const { jsPDF } = await import("jspdf");

      // Re-render to ensure latest state
      renderBillToCanvas(billCanvasRef.current, previewTemplate);

      // Wait a moment for any async image loads
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Use an offscreen canvas with padding to avoid clipping
      const src = billCanvasRef.current;
      const pad = 24;
      const off = document.createElement("canvas");
      off.width = src.width + pad * 2;
      off.height = src.height + pad * 2;
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, off.width, off.height);
      octx.imageSmoothingEnabled = false;
      try { (octx as any).imageSmoothingQuality = "high"; } catch {}
      octx.drawImage(src, pad, pad);

      const imgData = off.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: off.width > off.height ? "landscape" : "portrait",
        unit: "px",
        format: [off.width, off.height],
        compress: false,
      });
      pdf.addImage(imgData, "PNG", 0.5, 0.5, Math.max(1, off.width - 1), Math.max(1, off.height - 1));

      const fileName = `${previewTemplate.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_bill.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("PDF export failed. Please try again.");
    }
  };

  // Export to Word (RTF format - opens in Word)
  const exportToWord = async () => {
    if (!previewTemplate) return;

    try {
      // Generate RTF content that opens properly in Word
      const rtfContent = generateRTFContent(previewTemplate);

      // Create blob with RTF content
      const blob = new Blob([rtfContent], {
        type: "application/rtf",
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${previewTemplate.name
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()}_bill.rtf`;
      link.click();

      // Clean up
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Word export failed:", error);
      alert("Word export failed. Please try again.");
    }
  };

  // Export as Image (PNG)
  const exportAsImage = async () => {
    if (!previewTemplate || !billCanvasRef.current) return;

    try {
      // Re-render to ensure latest state
      renderBillToCanvas(billCanvasRef.current, previewTemplate);

      // Wait for images to load
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Convert canvas to image
      const canvas = billCanvasRef.current;
      const imgData = canvas.toDataURL("image/png", 1.0);

      // Download as image
      const link = document.createElement("a");
      link.download = `${previewTemplate.name
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()}_bill.png`;
      link.href = imgData;
      link.click();
    } catch (error) {
      console.error("Image export failed:", error);
      alert("Image export failed. Please try again.");
    }
  };

  // Print bill
  const printBill = () => {
    if (!billCanvasRef.current) return;

    const canvas = billCanvasRef.current;
    const imgData = canvas.toDataURL("image/png");

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>Print Bill - ${previewTemplate?.name}</title></head>
          <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh;">
            <img src="${imgData}" style="max-width:100%; max-height:100%; object-fit:contain;" />
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Update bill preview effect moved into hook

  // deleteTemplate moved to hook

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <AdvancedHeader />

        {/* Template Management */}
        <TemplateManagement
          templates={templates as any}
          editingTemplateId={editingTemplateId}
          editingTemplateName={editingTemplateName}
          onOpenSettings={() => setShowTemplateSettings(true)}
          onCreateNew={() => setShowNewTemplateChooser(true)}
          onStartRename={(id, name) => {
            setEditingTemplateId(id);
            setEditingTemplateName(name);
          }}
          onChangeRename={(value) => setEditingTemplateName(value)}
          onCommitRename={(templateId, value) => {
            setTemplates((prev) =>
              prev.map((t) => (t.id === templateId ? { ...t, name: value } : t))
            );
            if (currentTemplate && currentTemplate.id === templateId) {
              setCurrentTemplate({ ...currentTemplate, name: value });
            }
          }}
          onCancelRename={() => {
            setEditingTemplateId(null);
            setEditingTemplateName("");
          }}
          onSetCurrent={(templateId) => {
            const t = templates.find((x) => x.id === templateId);
            if (t) setCurrentTemplate(t);
          }}
          onGenerate={(templateId) => {
            const t = templates.find((x) => x.id === templateId);
            if (t) generateBill(t);
          }}
          onDuplicate={(templateId) => {
            const template = templates.find((t) => t.id === templateId);
            if (!template) return;
            const templateCopy: Template = {
              ...template,
              id: `tpl-${Date.now()}`,
              name: `${template.name} (Copy)`,
              createdAt: new Date(),
            };
            insertTemplateWithLimit(templateCopy, {
              setAsCurrent: false,
              closeChooser: false,
            });
          }}
          onDelete={(templateId) => deleteTemplate(templateId)}
        />

        {/* Template Editor */}
        {currentTemplate && (
          <EditorSection
            template={currentTemplate as any}
            isEditing={isEditing}
            onStartEditing={() => setIsEditing(true)}
            onAddField={() => openFieldEditor(undefined, "create")}
            onExportPdf={exportCurrentCanvasToPdf}
            onExportJson={() => currentTemplate && exportTemplateJson(currentTemplate)}
            onUseInCustom={() => {
              if (!currentTemplate) return;
              try {
                const serializable: any = {
                  ...currentTemplate,
                  createdAt:
                    currentTemplate.createdAt instanceof Date
                      ? currentTemplate.createdAt.toISOString()
                      : (currentTemplate as any).createdAt,
                };
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(CUSTOM_INBOX_KEY, JSON.stringify(serializable));
                }
                router.push("/bills/custom");
              } catch {}
            }}
            onSaveTemplate={saveTemplate}
            canvasContainerSize={canvasContainerSize as any}
            canvasRef={templateCanvasRef as any}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            inlineField={inlineEditField as any}
            inlinePosition={inlineEditPosition as any}
            inlineInputRef={inlineInputRef as any}
            inlineValue={inlineEditValue}
            onInlineChange={setInlineEditValue}
            onInlineKeyDown={handleInlineKeyDown as any}
            onInlineBlur={finishInlineEdit}
            selectedFieldId={selectedField?.id || null}
            onEditField={(f) => openFieldEditor(f as any, "edit")}
            onDeleteField={(id) => {
              saveStateForUndo();
              deleteField(id);
            }}
            onUploadImage={(fieldId, file) => onUploadImageForField(fieldId, file)}
          />
        )}

        <ModalsSection
          /* New template chooser */
          showNewTemplateChooser={showNewTemplateChooser}
          onCloseNewTemplateChooser={() => setShowNewTemplateChooser(false)}
          onCreateProfessional={createFromProfessional}
          onCreateEmpty={createNewTemplate}
          /* Field editor */
          showFieldEditor={showFieldEditor}
          fieldEditorMode={isFieldEditorMode as any}
          fieldEditorData={fieldEditorData}
          onChangeFieldEditorData={setFieldEditorData}
          onSaveField={saveField}
          onCloseFieldEditor={() => setShowFieldEditor(false)}
          /* Bill preview */
          showBillPreview={showBillPreview}
          previewTemplate={(previewTemplate as any) || null}
          onCloseBillPreview={() => setShowBillPreview(false)}
          onExportPDF={exportToPDF}
          onExportWord={exportToWord}
          onExportImage={exportAsImage}
          onPrint={printBill}
          onEditTemplateFromPreview={() => {
            if (previewTemplate) {
              setCurrentTemplate(previewTemplate);
              setShowBillPreview(false);
            }
          }}
          billCanvasRef={billCanvasRef as React.RefObject<HTMLCanvasElement>}
          /* Template settings */
          showTemplateSettings={showTemplateSettings}
          currentTemplate={currentTemplate as any}
          onCloseTemplateSettings={() => setShowTemplateSettings(false)}
          onUpdateTemplate={(patch) => {
            if (!currentTemplate) return;
            saveStateForUndo();
            const updatedTemplate = { ...currentTemplate, ...patch } as Template;
            setCurrentTemplate(updatedTemplate);
            setTemplates((prev) =>
              prev.map((t) => (t.id === currentTemplate.id ? updatedTemplate : t))
            );
          }}
          onDuplicateTemplate={() => {
            if (!currentTemplate) return;
            saveStateForUndo();
            const templateCopy: Template = {
              ...currentTemplate,
              id: `tpl-${Date.now()}`,
              name: `${currentTemplate.name} (Copy)`,
              createdAt: new Date(),
            };
            insertTemplateWithLimit(templateCopy, {
              setAsCurrent: true,
              closeChooser: false,
            });
            setShowTemplateSettings(false);
          }}
        />

        {/* Instructions */}
        {!currentTemplate && <InstructionsSection />}
      </div>
    </div>
  );
}
