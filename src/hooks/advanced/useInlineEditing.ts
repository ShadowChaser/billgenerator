import { useEffect, useRef, useState } from "react";
import { Template, TemplateField } from "@/lib/advancedTypes";

export function useInlineEditing(
  currentTemplate: Template | null,
  templateCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  updateField: (id: string, patch: Partial<TemplateField>, saveUndo?: boolean) => void
) {
  const [inlineEditField, setInlineEditField] = useState<TemplateField | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState("");
  const [inlineEditPosition, setInlineEditPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const inlineInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const startInlineEdit = (field: TemplateField) => {
    if (field.type === "image" || field.type === "signature") return;
    const canvas = templateCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const tplW = currentTemplate?.width || rect.width;
    const tplH = currentTemplate?.height || rect.height;
    const scaleX = rect.width / tplW;
    const scaleY = rect.height / tplH;

    setInlineEditField(field);
    setInlineEditValue(field.value || "");
    setInlineEditPosition({
      x: Math.round(field.x * scaleX + rect.left),
      y: Math.round(field.y * scaleY + rect.top),
      width: Math.round(field.width * scaleX),
      height: Math.round(field.height * scaleY),
    });
  };

  const finishInlineEdit = () => {
    if (inlineEditField) {
      updateField(inlineEditField.id, { value: inlineEditValue }, true);
    }
    setInlineEditField(null);
    setInlineEditValue("");
    setInlineEditPosition(null);
  };

  const cancelInlineEdit = () => {
    setInlineEditField(null);
    setInlineEditValue("");
    setInlineEditPosition(null);
  };

  useEffect(() => {
    if (inlineEditField && inlineInputRef.current) {
      inlineInputRef.current.focus();
      if (inlineInputRef.current instanceof HTMLInputElement) {
        inlineInputRef.current.select();
      } else {
        inlineInputRef.current.setSelectionRange(0, inlineEditValue.length);
      }
    }
  }, [inlineEditField, inlineEditValue]);

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && inlineEditField?.type !== "textarea") {
      e.preventDefault();
      finishInlineEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelInlineEdit();
    }
  };

  return {
    inlineEditField,
    inlineEditValue,
    inlineEditPosition,
    inlineInputRef,
    setInlineEditValue,
    startInlineEdit,
    finishInlineEdit,
    cancelInlineEdit,
    handleInlineKeyDown,
  } as const;
}
