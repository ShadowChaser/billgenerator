import { useCallback, useEffect, useRef, useState } from "react";
import { Template } from "@/lib/advancedTypes";

export function useBillPreview() {
  const [showBillPreview, setShowBillPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const billCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const generateBill = (template: Template) => {
    setPreviewTemplate(template);
    setShowBillPreview(true);
  };

  const renderBillToCanvas = useCallback((canvas: HTMLCanvasElement, template: Template) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = template.width;
    canvas.height = template.height;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    template.fields.forEach((field) => {
      if (!field.value && !field.placeholder) return;

      if (field.type === "image" || field.type === "signature") {
        if (field.value) {
          const img = new Image();
          img.onload = () => {
            const iw = img.naturalWidth || img.width;
            const ih = img.naturalHeight || img.height;
            const scale = Math.min(field.width / iw, field.height / ih);
            const dw = Math.max(1, Math.floor(iw * scale));
            const dh = Math.max(1, Math.floor(ih * scale));
            const dx = field.x + (field.width - dw) / 2;
            const dy = field.y + (field.height - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
          };
          img.src = field.value;
        }
      } else {
        ctx.fillStyle = field.backgroundColor || "transparent";
        if (field.backgroundColor && field.backgroundColor !== "transparent") {
          ctx.fillRect(field.x, field.y, field.width, field.height);
        }

        if (field.borderWidth && field.borderWidth > 0) {
          ctx.strokeStyle = field.borderColor || "#e5e7eb";
          ctx.lineWidth = field.borderWidth;
          ctx.strokeRect(field.x, field.y, field.width, field.height);
        }

        ctx.fillStyle = field.textColor || "#111827";
        ctx.font = `${field.isItalic ? "italic " : ""}${field.isBold ? "bold " : ""}${field.fontSize || 16}px sans-serif`;
        ctx.textAlign = field.alignment as CanvasTextAlign;

        let tx = field.x + 8;
        if (field.alignment === "center") tx = field.x + field.width / 2;
        if (field.alignment === "right") tx = field.x + field.width - 8;

        const content = field.value || field.placeholder || "";

        if (field.type === "textarea" && content.includes("\n")) {
          const lines = content.split("\n");
          const lineHeight = (field.fontSize || 16) * 1.2;
          const totalTextHeight = lines.length * lineHeight;
          let startY = field.y + (field.height - totalTextHeight) / 2 + lineHeight / 2;

          ctx.textBaseline = "middle";
          lines.forEach((line, index) => {
            const y = startY + index * lineHeight;
            if (y >= field.y && y <= field.y + field.height) {
              ctx.fillText(line, tx, y, field.width - 16);
            }
          });
        } else {
          ctx.textBaseline = "middle";
          ctx.fillText(content, tx, field.y + field.height / 2, field.width - 16);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (showBillPreview && previewTemplate && billCanvasRef.current) {
      renderBillToCanvas(billCanvasRef.current, previewTemplate);
    }
  }, [showBillPreview, previewTemplate, renderBillToCanvas]);

  return {
    showBillPreview,
    setShowBillPreview,
    previewTemplate,
    setPreviewTemplate,
    billCanvasRef,
    renderBillToCanvas,
    generateBill,
  } as const;
}
