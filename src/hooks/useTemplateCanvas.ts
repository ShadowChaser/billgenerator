import React, { useCallback, useEffect, useRef } from "react";
import { Template, TemplateField } from "@/lib/advancedTypes";
import {
  hitTestAt,
  getHandleAtPosition as getHandleAtPositionExt,
  drawResizeHandles as drawResizeHandlesExt,
} from "@/lib/canvasUtils";

// Internal type mirrors page's handle names
type ResizeHandle = null | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

interface UseTemplateCanvasParams {
  currentTemplate: Template | null;
  isEditing: boolean;
  selectedField: TemplateField | null;
  setSelectedField: (f: TemplateField | null) => void;
  updateField: (
    id: string,
    patch: Partial<TemplateField>,
    saveUndo?: boolean
  ) => void;
  saveStateForUndo: () => void;
  canvasContainerSize: { width: number; height: number } | null;
  startInlineEdit: (field: TemplateField) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  inlineEditFieldId?: string | null;
}

export function useTemplateCanvas({
  currentTemplate,
  isEditing,
  selectedField,
  setSelectedField,
  updateField,
  saveStateForUndo,
  canvasContainerSize,
  startInlineEdit,
  canvasRef: externalCanvasRef,
  inlineEditFieldId,
}: UseTemplateCanvasParams) {
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = externalCanvasRef ?? internalCanvasRef;
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});

  // Drag/resize state
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Defer starting drag until movement passes a small threshold to avoid jitter on double-click
  const pendingDragRef = useRef<{
    field: TemplateField | null;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const isResizingRef = useRef(false);
  const resizeHandleRef = useRef<ResizeHandle>(null);
  const resizeOriginRef = useRef<{
    startX: number;
    startY: number;
    field: TemplateField | null;
  }>({ startX: 0, startY: 0, field: null });
  const resizeUndoSavedRef = useRef(false);

  // Helpers
  const getMousePos = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const tplW = currentTemplate?.width || rect.width;
    const tplH = currentTemplate?.height || rect.height;
    const scaleX = tplW / rect.width;
    const scaleY = tplH / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    return {
      x: Math.max(0, Math.min(x, tplW)),
      y: Math.max(0, Math.min(y, tplH)),
    };
  };

  // Rendering
  const renderTemplate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentTemplate) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1;
    const cssW = canvasContainerSize?.width ?? currentTemplate.width;
    const cssH = canvasContainerSize?.height ?? currentTemplate.height;
    const displayScaleX = cssW / currentTemplate.width;
    const displayScaleY = cssH / currentTemplate.height;
    const displayScale = Math.min(displayScaleX, displayScaleY);

    canvas.style.width = `${Math.round(currentTemplate.width * displayScale)}px`;
    canvas.style.height = `${Math.round(currentTemplate.height * displayScale)}px`;

    const desiredW = Math.max(1, Math.floor(currentTemplate.width * displayScale * dpr));
    const desiredH = Math.max(1, Math.floor(currentTemplate.height * displayScale * dpr));
    if (canvas.width !== desiredW || canvas.height !== desiredH) {
      canvas.width = desiredW;
      canvas.height = desiredH;
    }
    ctx.setTransform(displayScale * dpr, 0, 0, displayScale * dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    try {
      (ctx as any).imageSmoothingQuality = "high";
    } catch {}

    const px = 1 / (displayScale * dpr);
    const snap = (v: number) => Math.round(v * displayScale * dpr) / (displayScale * dpr);
    const strokeAlignedRect = (
      x: number,
      y: number,
      w: number,
      h: number,
      lineWidth: number
    ) => {
      const lw = Math.max(px, lineWidth);
      ctx.lineWidth = lw;
      const offs = lw / 2;
      ctx.strokeRect(
        snap(x) + offs,
        snap(y) + offs,
        Math.max(px, snap(w) - lw),
        Math.max(px, snap(h) - lw)
      );
    };

    ctx.clearRect(0, 0, currentTemplate.width, currentTemplate.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, currentTemplate.width, currentTemplate.height);

    for (const field of currentTemplate.fields) {
      // When inline editing a text-like field, skip drawing it on the canvas to avoid double visuals
      if (
        inlineEditFieldId &&
        field.id === inlineEditFieldId &&
        !(field.type === "image" || field.type === "signature")
      ) {
        // Still optionally draw the box background/border if desired; for now skip entirely
        continue;
      }
      // Box bg (skip if image/signature with value)
      if (!((field.type === "image" || field.type === "signature") && field.value)) {
        ctx.fillStyle = field.backgroundColor || "#ffffff";
        ctx.fillRect(field.x, field.y, field.width, field.height);
        ctx.strokeStyle = field.borderColor || "#e5e7eb";
        strokeAlignedRect(field.x, field.y, field.width, field.height, (field.borderWidth || 1) * 1);
      }

      if (field.type === "image" || field.type === "signature") {
        if (field.value) {
          const cacheKey = `${field.id}`;
          const cached = imageCacheRef.current[cacheKey];
          const drawImg = (img: HTMLImageElement) => {
            const iw = img.naturalWidth || img.width;
            const ih = img.naturalHeight || img.height;
            const scale = Math.min(field.width / iw, field.height / ih);
            const dw = Math.max(1, Math.floor(iw * scale));
            const dh = Math.max(1, Math.floor(ih * scale));
            const dx = field.x + (field.width - dw) / 2;
            const dy = field.y + (field.height - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
          };
          if (cached) drawImg(cached);
          else {
            const img = new Image();
            img.onload = () => {
              imageCacheRef.current[cacheKey] = img;
              drawImg(img);
            };
            img.src = field.value;
          }
        }
      } else {
        // Text-like
        ctx.fillStyle = field.textColor || "#111827";
        ctx.font = `${field.isItalic ? "italic " : ""}${field.isBold ? "bold " : ""}${
          field.fontSize || 16
        }px sans-serif`;
        let tx = field.x + 8;
        if (field.alignment === "center") tx = field.x + field.width / 2;
        if (field.alignment === "right") tx = field.x + field.width - 8;
        ctx.textAlign = field.alignment as CanvasTextAlign;
        const content = field.value || field.placeholder || field.label || "";

        if (field.type === "textarea" && content.includes("\n")) {
          const pad = 4;
          const lines = content.split("\n");
          const fontSize = field.fontSize || 16;
          const mProbe = ctx.measureText("Mg");
          const ascent = mProbe.actualBoundingBoxAscent ?? fontSize * 0.8;
          const descent = mProbe.actualBoundingBoxDescent ?? fontSize * 0.2;
          const boxHeight = ascent + descent;
          const lineHeight = Math.max(boxHeight * 1.1, fontSize * 1.15);
          const totalTextHeight = lines.length * lineHeight;
          let startY = field.y + Math.max(pad, (field.height - totalTextHeight) / 2);
          ctx.textBaseline = "alphabetic";
          lines.forEach((line, index) => {
            const baselineY = startY + index * lineHeight + ascent;
            if (baselineY + descent <= field.y + field.height - pad) {
              ctx.fillText(line, tx, baselineY, field.width - 16);
            }
          });
        } else {
          const pad = 4;
          const fontSize = field.fontSize || 16;
          const m = ctx.measureText(content || "Mg");
          const ascent = m.actualBoundingBoxAscent ?? fontSize * 0.8;
          const descent = m.actualBoundingBoxDescent ?? fontSize * 0.2;
          const boxHeight = ascent + descent;
          const baselineY = field.y + Math.max(pad, (field.height - boxHeight) / 2) + ascent;
          ctx.textBaseline = "alphabetic";
          ctx.fillText(content, tx, baselineY, field.width - 16);
        }
      }

      // Sub-elements
      if (field.subElements && field.subElements.length > 0) {
        field.subElements.forEach((subEl) => {
          ctx.fillStyle = subEl.textColor;
          ctx.font = `${subEl.isItalic ? "italic " : ""}${subEl.isBold ? "bold " : ""}${
            subEl.fontSize
          }px sans-serif`;
          ctx.textBaseline = "top";
          ctx.textAlign = "center";

          let subX = field.x + field.width / 2 + subEl.offsetX;
          let subY = field.y + subEl.offsetY;
          switch (subEl.position) {
            case "top":
              subY = field.y - subEl.fontSize - 5 + subEl.offsetY;
              break;
            case "bottom":
              subY = field.y + field.height + 5 + subEl.offsetY;
              break;
            case "left":
              subX = field.x - 5 + subEl.offsetX;
              subY = field.y + field.height / 2 + subEl.offsetY;
              ctx.textAlign = "right";
              ctx.textBaseline = "middle";
              break;
            case "right":
              subX = field.x + field.width + 5 + subEl.offsetX;
              subY = field.y + field.height / 2 + subEl.offsetY;
              ctx.textAlign = "left";
              ctx.textBaseline = "middle";
              break;
          }
          ctx.fillText(subEl.content, subX, subY);
        });
      }

      // Selection + handles
      if (selectedField?.id === field.id) {
        ctx.strokeStyle = "#007bff";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        if ((field.type === "image" || field.type === "signature") && field.value) {
          const cacheKey = `${field.id}`;
          const cached = imageCacheRef.current[cacheKey];
          if (cached) {
            const iw = cached.naturalWidth || cached.width;
            const ih = cached.naturalHeight || cached.height;
            const scale = Math.min(field.width / iw, field.height / ih);
            const dw = Math.max(1, Math.floor(iw * scale));
            const dh = Math.max(1, Math.floor(ih * scale));
            const dx = field.x + (field.width - dw) / 2;
            const dy = field.y + (field.height - dh) / 2;
            strokeAlignedRect(dx - 2, dy - 2, dw + 4, dh + 4, 2);
          } else {
            strokeAlignedRect(field.x - 2, field.y - 2, field.width + 4, field.height + 4, 2);
          }
        } else {
          strokeAlignedRect(field.x - 2, field.y - 2, field.width + 4, field.height + 4, 2);
        }
        ctx.setLineDash([]);
        drawResizeHandlesExt(ctx, field, imageCacheRef);
      }
    }
  }, [currentTemplate, selectedField, canvasContainerSize, inlineEditFieldId]);

  useEffect(() => {
    renderTemplate();
  }, [renderTemplate]);

  // Events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !currentTemplate) return;
    const { x, y } = getMousePos(e.clientX, e.clientY);
    const field = hitTestAt(x, y, currentTemplate, imageCacheRef);
    if (field) {
      setSelectedField(field);
      const handle = getHandleAtPositionExt(x, y, field, imageCacheRef);
      if (handle) {
        isResizingRef.current = true;
        resizeHandleRef.current = handle;
        resizeOriginRef.current = { startX: x, startY: y, field };
        // Only save undo when resize actually changes dimensions (handled in move)
        resizeUndoSavedRef.current = false;
      } else {
        // Defer starting drag until movement exceeds threshold
        isDraggingRef.current = false;
        dragOffsetRef.current = { x: x - field.x, y: y - field.y };
        pendingDragRef.current = {
          field,
          startX: x,
          startY: y,
          offsetX: x - field.x,
          offsetY: y - field.y,
        };
      }
    } else {
      setSelectedField(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !currentTemplate) return;
    const { x: curX, y: curY } = getMousePos(e.clientX, e.clientY);

    // If we have a pending drag, check threshold before activating drag
    if (!isDraggingRef.current && pendingDragRef.current && selectedField) {
      const thr = 6; // pixels in template units (raised to avoid micro-drags)
      const dx0 = curX - pendingDragRef.current.startX;
      const dy0 = curY - pendingDragRef.current.startY;
      if (Math.abs(dx0) > thr || Math.abs(dy0) > thr) {
        // Activate drag now and record undo state
        isDraggingRef.current = true;
        saveStateForUndo();
        // ensure dragOffsetRef matches pending info
        dragOffsetRef.current = {
          x: pendingDragRef.current.offsetX,
          y: pendingDragRef.current.offsetY,
        };
      }
    }

    if (isDraggingRef.current && selectedField) {
      const nx = curX - dragOffsetRef.current.x;
      const ny = curY - dragOffsetRef.current.y;
      const canvasWidth = currentTemplate.width;
      const canvasHeight = currentTemplate.height;
      const constrainedX = Math.max(0, Math.min(nx, canvasWidth - selectedField.width));
      const constrainedY = Math.max(0, Math.min(ny, canvasHeight - selectedField.height));
      if (selectedField.x !== constrainedX || selectedField.y !== constrainedY) {
        updateField(selectedField.id, { x: constrainedX, y: constrainedY }, false);
      }
      return;
    }

    if (isResizingRef.current && resizeOriginRef.current.field && resizeHandleRef.current) {
      const orig = resizeOriginRef.current.field;
      const dx = curX - resizeOriginRef.current.startX;
      const dy = curY - resizeOriginRef.current.startY;
      let newX = orig.x;
      let newY = orig.y;
      let newW = orig.width;
      let newH = orig.height;
      const minSize = 20;
      const lockAspect = !!orig.lockAspect && (orig.type === "image" || orig.type === "signature");
      const aspect = orig.width / Math.max(1, orig.height);
      const applyAspect = () => {
        if (!lockAspect) return;
        if (resizeHandleRef.current === "n" || resizeHandleRef.current === "s") newW = Math.max(minSize, newH * aspect);
        else if (resizeHandleRef.current === "e" || resizeHandleRef.current === "w") newH = Math.max(minSize, newW / aspect);
        else newH = Math.max(minSize, newW / aspect);
      };
      switch (resizeHandleRef.current) {
        case "e":
          newW = Math.max(minSize, orig.width + dx);
          applyAspect();
          break;
        case "w":
          newW = Math.max(minSize, orig.width - dx);
          if (newW === minSize) newX = Math.max(0, orig.x + orig.width - minSize);
          else newX = orig.x + dx;
          applyAspect();
          break;
        case "s":
          newH = Math.max(minSize, orig.height + dy);
          applyAspect();
          break;
        case "n":
          newH = Math.max(minSize, orig.height - dy);
          newY = orig.y + dy;
          applyAspect();
          break;
        case "se":
          newW = Math.max(minSize, orig.width + dx);
          newH = Math.max(minSize, orig.height + dy);
          applyAspect();
          break;
        case "ne":
          newW = Math.max(minSize, orig.width + dx);
          newH = Math.max(minSize, orig.height - dy);
          newY = orig.y + dy;
          applyAspect();
          break;
        case "sw":
          newW = Math.max(minSize, orig.width - dx);
          newH = Math.max(minSize, orig.height + dy);
          if (newW === minSize) newX = Math.max(0, orig.x + orig.width - minSize);
          else newX = orig.x + dx;
          applyAspect();
          break;
        case "nw":
          newW = Math.max(minSize, orig.width - dx);
          newH = Math.max(minSize, orig.height - dy);
          if (newW === minSize) newX = Math.max(0, orig.x + orig.width - minSize);
          else newX = orig.x + dx;
          newY = orig.y + dy;
          applyAspect();
          break;
      }
      const canvasWidth = currentTemplate.width;
      const canvasHeight = currentTemplate.height;
      const constrainedX = Math.max(0, Math.min(newX, canvasWidth - Math.max(minSize, newW)));
      const constrainedY = Math.max(0, Math.min(newY, canvasHeight - Math.max(minSize, newH)));
      const constrainedW = Math.min(Math.max(minSize, newW), canvasWidth - constrainedX);
      const constrainedH = Math.min(Math.max(minSize, newH), canvasHeight - constrainedY);
      // Save undo only once when first effective resize change occurs
      if (!resizeUndoSavedRef.current && (orig.x !== constrainedX || orig.y !== constrainedY || orig.width !== constrainedW || orig.height !== constrainedH)) {
        saveStateForUndo();
        resizeUndoSavedRef.current = true;
      }
      updateField(orig.id, { x: constrainedX, y: constrainedY, width: constrainedW, height: constrainedH }, false);
      return;
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isResizingRef.current = false;
    resizeHandleRef.current = null;
    pendingDragRef.current = null;
    resizeOriginRef.current = { startX: 0, startY: 0, field: null };
    resizeUndoSavedRef.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const t = e.touches[0];
    handleMouseDown({ clientX: t.clientX, clientY: t.clientY } as any);
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const t = e.touches[0];
    handleMouseMove({ clientX: t.clientX, clientY: t.clientY } as any);
  };
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleMouseUp();
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !currentTemplate) return;
    const { x, y } = getMousePos(e.clientX, e.clientY);
    const field = hitTestAt(x, y, currentTemplate, imageCacheRef);
    if (field && field.type !== "image" && field.type !== "signature") {
      isDraggingRef.current = false;
      isResizingRef.current = false;
      resizeHandleRef.current = null;
      pendingDragRef.current = null;
      startInlineEdit(field);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !currentTemplate) return;
    const { x, y } = getMousePos(e.clientX, e.clientY);
    const field = hitTestAt(x, y, currentTemplate, imageCacheRef);
    setSelectedField(field);
  };

  return {
    canvasRef,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onDoubleClick: handleDoubleClick,
    onClick: handleClick,
  } as const;
}
