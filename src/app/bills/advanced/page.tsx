"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import { readArrayKey, writeArrayKey } from "@/lib/localStore";
import AdvancedHeader from "@/components/advanced/page/AdvancedHeader";
import TemplateManagement from "@/components/advanced/page/TemplateManagement";
import EditorSection from "@/components/advanced/page/EditorSection";
import ModalsSection from "@/components/advanced/page/ModalsSection";
import InstructionsSection from "@/components/advanced/page/InstructionsSection";
import { makeDefaultSampleTemplate } from "@/lib/sampleTemplates";
import { Template, TemplateField, SubElement } from "@/lib/advancedTypes";

// Types moved to src/lib/advancedTypes.ts

const TEMPLATES_KEY = "hrb_templates_v1";
const LAST_TEMPLATE_KEY = "hrb_last_template_id_v1";
const CUSTOM_INBOX_KEY = "hrb_custom_inbox_template_v1";
const MAX_TEMPLATES = 4;
// Protect the built-in default template (initialized with id "tpl-1") from auto-deletion
const DEFAULT_TEMPLATE_ID = "tpl-1";

// Keep at most MAX_TEMPLATES items; if over, remove the oldest non-default templates.
// Returns the trimmed list and the removed templates.
function enforceTemplateLimit(list: Template[]): { list: Template[]; removed: Template[] } {
  if (list.length <= MAX_TEMPLATES) return { list, removed: [] };

  // Sort by createdAt ascending (oldest first)
  const sorted = [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const removed: Template[] = [];
  while (sorted.length > MAX_TEMPLATES) {
    // Find the oldest that is not the default; if all are default-only scenario, break
    const idx = sorted.findIndex((t) => t.id !== DEFAULT_TEMPLATE_ID);
    if (idx === -1) break;
    removed.push(sorted.splice(idx, 1)[0]);
  }
  return { list: sorted, removed };
}

type ResizeHandle = null | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

export default function AdvancedBillGeneratorPage() {
  const router = useRouter();
  // Templates state (simple local list)
  const [templates, setTemplates] = useState<Template[]>(() => {
    const sampleTemplate = makeDefaultSampleTemplate();
    // Important: don't read localStorage during initial render to avoid SSR/CSR mismatches
    // We'll load any stored templates after mount in a useEffect.
    return [sampleTemplate];
  });

  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedField, setSelectedField] = useState<TemplateField | null>(
    null
  );
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);

  // New template chooser modal
  const [showNewTemplateChooser, setShowNewTemplateChooser] = useState(false);

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasContainerSize, setCanvasContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Drag to move
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const resizeOriginRef = useRef<{
    startX: number;
    startY: number;
    field: TemplateField | null;
  }>({
    startX: 0,
    startY: 0,
    field: null,
  });

  // Field editor modal
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [isFieldEditorMode, setIsFieldEditorMode] = useState<"create" | "edit">(
    "create"
  );
  const [fieldEditorData, setFieldEditorData] = useState<
    Partial<TemplateField>
  >({});

  // Inline text editing
  const [inlineEditField, setInlineEditField] = useState<TemplateField | null>(
    null
  );
  const [inlineEditValue, setInlineEditValue] = useState("");
  const [inlineEditPosition, setInlineEditPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const inlineInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Template name inline editing
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null
  );
  const [editingTemplateName, setEditingTemplateName] = useState("");

  // Bill generation and preview
  const [showBillPreview, setShowBillPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const billCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Image cache for drawing
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});

  // Double-click timer for inline editing
  const doubleClickTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Undo/Redo system
  const [undoStack, setUndoStack] = useState<Template[]>([]);
  const [redoStack, setRedoStack] = useState<Template[]>([]);
  const maxUndoSteps = 50;

  // On mount, load any persisted templates from localStorage
  useEffect(() => {
    try {
      const stored = readArrayKey<any>(TEMPLATES_KEY);
      if (Array.isArray(stored) && stored.length > 0) {
        const parsed: Template[] = stored.map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
        }));
        setTemplates(parsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore last-opened template or select first by default
  useEffect(() => {
    if (!currentTemplate && templates.length > 0) {
      try {
        const lastId =
          typeof window !== "undefined"
            ? window.localStorage.getItem(LAST_TEMPLATE_KEY)
            : null;
        const found = lastId ? templates.find((t) => t.id === lastId) : null;
        setCurrentTemplate(found || templates[0]);
      } catch {
        setCurrentTemplate(templates[0]);
      }
    }
  }, [templates, currentTemplate]);

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

  // Persist last-opened template id
  useEffect(() => {
    try {
      if (currentTemplate && typeof window !== "undefined") {
        window.localStorage.setItem(LAST_TEMPLATE_KEY, currentTemplate.id);
        // Debug: record last selected template id writes
        // eslint-disable-next-line no-console
        console.log("[Advanced] Persisted last template id:", currentTemplate.id);
      }
    } catch {}
  }, [currentTemplate]);

  // Persist templates to localStorage whenever they change
  useEffect(() => {
    try {
      // Upsert-merge current in-memory templates into existing storage, do not overwrite
      const existing = readArrayKey<any>(TEMPLATES_KEY);
      const existingList: any[] = Array.isArray(existing) ? existing : [];

      // Build a map of existing by id
      const byId = new Map<string, any>(
        existingList.map((t: any) => [t.id, t])
      );

      // Upsert each current template
      for (const t of templates) {
        const serial = {
          ...t,
          createdAt:
            t.createdAt instanceof Date
              ? t.createdAt.toISOString()
              : (t as any).createdAt,
        } as any;
        byId.set(t.id, serial);
      }

      const merged = Array.from(byId.values());
      writeArrayKey(TEMPLATES_KEY, merged);
      // Debug: record template array writes
      // eslint-disable-next-line no-console
      console.log(
        "[Advanced] Wrote templates to localStorage (upsert):",
        merged.length
      );
    } catch {}
  }, [templates]);

  // Save state for undo/redo
  const saveStateForUndo = useCallback(() => {
    if (currentTemplate) {
      setUndoStack((prev) => {
        const clonedTemplate = {
          ...JSON.parse(JSON.stringify(currentTemplate)),
          createdAt: new Date(currentTemplate.createdAt),
        };
        const newStack = [...prev, clonedTemplate];
        return newStack.slice(-maxUndoSteps);
      });
      setRedoStack([]); // Clear redo stack when new action is performed
    }
  }, [currentTemplate, maxUndoSteps]);

  // Undo function
  const undo = useCallback(() => {
    if (undoStack.length === 0 || !currentTemplate) return;

    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    // Save current state to redo stack
    const clonedCurrent = {
      ...JSON.parse(JSON.stringify(currentTemplate)),
      createdAt: new Date(currentTemplate.createdAt),
    };
    setRedoStack((prev) => [...prev, clonedCurrent]);
    setUndoStack(newUndoStack);

    // Restore previous state
    setCurrentTemplate(previousState);
    setTemplates((prev) =>
      prev.map((t) => (t.id === previousState.id ? previousState : t))
    );
    setSelectedField(null);
  }, [undoStack, currentTemplate]);

  // Redo function
  const redo = useCallback(() => {
    if (redoStack.length === 0 || !currentTemplate) return;

    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    // Save current state to undo stack
    const clonedCurrent = {
      ...JSON.parse(JSON.stringify(currentTemplate)),
      createdAt: new Date(currentTemplate.createdAt),
    };
    setUndoStack((prev) => [...prev, clonedCurrent]);
    setRedoStack(newRedoStack);

    // Restore next state
    setCurrentTemplate(nextState);
    setTemplates((prev) =>
      prev.map((t) => (t.id === nextState.id ? nextState : t))
    );
    setSelectedField(null);
  }, [redoStack, currentTemplate]);

  // Helper: export current template to JSON file
  const exportTemplateJson = useCallback((tpl: Template) => {
    try {
      const serializable = {
        ...tpl,
        createdAt:
          (tpl as any).createdAt instanceof Date
            ? (tpl as any).createdAt.toISOString()
            : (tpl as any).createdAt,
      } as any;
      const blob = new Blob([JSON.stringify(serializable, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tpl.name || "template"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert("Failed to export template JSON");
    }
  }, []);

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

  // CRUD helpers
  const updateField = (
    id: string,
    patch: Partial<TemplateField>,
    saveUndo: boolean = true
  ) => {
    if (saveUndo) {
      saveStateForUndo();
    }

    setTemplates((prev) =>
      prev.map((t) =>
        t.id !== (currentTemplate?.id || t.id)
          ? t
          : {
              ...t,
              fields: t.fields.map((f) =>
                f.id === id ? { ...f, ...patch } : f
              ),
            }
      )
    );
    // also update local currentTemplate state reference
    setCurrentTemplate((ct) =>
      ct && ct.id === (currentTemplate?.id || ct.id)
        ? {
            ...ct,
            fields: ct.fields.map((f) =>
              f.id === id ? { ...f, ...patch } : f
            ),
          }
        : ct
    );
  };

  const deleteField = (id: string, saveUndo: boolean = false) => {
    if (!currentTemplate) return;

    if (saveUndo) {
      saveStateForUndo();
    }

    setTemplates((prev) =>
      prev.map((t) =>
        t.id === currentTemplate.id
          ? { ...t, fields: t.fields.filter((f) => f.id !== id) }
          : t
      )
    );
    setCurrentTemplate((ct) =>
      ct ? { ...ct, fields: ct.fields.filter((f) => f.id !== id) } : ct
    );
    setSelectedField(null);
  };

  // Inline editing helpers
  const startInlineEdit = (field: TemplateField) => {
    if (field.type === "image" || field.type === "signature") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Map template units to CSS pixels for overlay placement
    const tplW = currentTemplate?.width || rect.width;
    const tplH = currentTemplate?.height || rect.height;
    const scaleX = rect.width / tplW;
    const scaleY = rect.height / tplH;

    setInlineEditField(field);
    setInlineEditValue(field.value || "");
    setInlineEditPosition({
      x: field.x * scaleX + rect.left,
      y: field.y * scaleY + rect.top,
      width: field.width * scaleX,
      height: field.height * scaleY,
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

  // Focus inline input when it appears
  useEffect(() => {
    if (inlineEditField && inlineInputRef.current) {
      inlineInputRef.current.focus();
      if (inlineInputRef.current instanceof HTMLInputElement) {
        inlineInputRef.current.select();
      } else {
        inlineInputRef.current.setSelectionRange(0, inlineEditValue.length);
      }
    }
  }, [inlineEditField]);

  // Render template to canvas
  const renderTemplate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentTemplate) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Improve sharpness: match backing store to displayed CSS size * DPR
    const dpr = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1;
    // Compute display scale based on container size vs template size
    const cssW = (canvasContainerSize?.width ?? currentTemplate.width);
    const cssH = (canvasContainerSize?.height ?? currentTemplate.height);
    const displayScaleX = cssW / currentTemplate.width;
    const displayScaleY = cssH / currentTemplate.height;
    // Because we keep aspect ratio, these should be equal, but be safe
    const displayScale = Math.min(displayScaleX, displayScaleY);

    // Set canvas CSS size explicitly
    canvas.style.width = `${Math.round(currentTemplate.width * displayScale)}px`;
    canvas.style.height = `${Math.round(currentTemplate.height * displayScale)}px`;

    // Set backing resolution to CSS size * DPR
    const desiredW = Math.max(1, Math.floor(currentTemplate.width * displayScale * dpr));
    const desiredH = Math.max(1, Math.floor(currentTemplate.height * displayScale * dpr));
    if (canvas.width !== desiredW || canvas.height !== desiredH) {
      canvas.width = desiredW;
      canvas.height = desiredH;
    }
    // Reset transform and scale drawing from template units to backing store
    ctx.setTransform(displayScale * dpr, 0, 0, displayScale * dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    try { (ctx as any).imageSmoothingQuality = "high"; } catch {}

    // Helper: snap to device pixel grid for crisp 1px strokes
    const px = 1 / (displayScale * dpr);
    const snap = (v: number) => Math.round(v * displayScale * dpr) / (displayScale * dpr);
    const strokeAlignedRect = (
      x: number,
      y: number,
      w: number,
      h: number,
      lineWidth: number
    ) => {
      // Align the rect to pixel grid and offset by half the stroke width
      const lw = Math.max(px, lineWidth);
      ctx.lineWidth = lw;
      const offs = lw / 2;
      ctx.strokeRect(snap(x) + offs, snap(y) + offs, Math.max(px, snap(w) - lw), Math.max(px, snap(h) - lw));
    };

    // Clear using template-space units
    ctx.clearRect(0, 0, currentTemplate.width, currentTemplate.height);

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, currentTemplate.width, currentTemplate.height);

    // Draw fields
    for (const field of currentTemplate.fields) {
      // Box background
      if (
        !((field.type === "image" || field.type === "signature") && field.value)
      ) {
        ctx.fillStyle = field.backgroundColor || "#ffffff";
        ctx.fillRect(field.x, field.y, field.width, field.height);
        ctx.strokeStyle = field.borderColor || "#e5e7eb";
        strokeAlignedRect(
          field.x,
          field.y,
          field.width,
          field.height,
          (field.borderWidth || 1) * 1
        );
      }

      if (field.type === "image" || field.type === "signature") {
        if (field.value) {
          const cacheKey = `${field.id}`;
          const cached = imageCacheRef.current[cacheKey];
          const drawImg = (img: HTMLImageElement) => {
            // contain image within field while preserving aspect
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
        // Text-like fields
        ctx.fillStyle = field.textColor || "#111827";
        ctx.font = `${field.isItalic ? "italic " : ""}${
          field.isBold ? "bold " : ""
        }${field.fontSize || 16}px sans-serif`;
        let tx = field.x + 8;
        if (field.alignment === "center") tx = field.x + field.width / 2;
        if (field.alignment === "right") tx = field.x + field.width - 8;
        ctx.textAlign = field.alignment as CanvasTextAlign;
        const content = field.value || field.placeholder || field.label || "";

        // Handle multi-line text for textarea fields
        if (field.type === "textarea" && content.includes("\n")) {
          const pad = 4; // small vertical padding to avoid edge clipping
          const lines = content.split("\n");
          const fontSize = field.fontSize || 16;
          // Use metrics for ascent/descent if available
          const mProbe = ctx.measureText("Mg");
          const ascent = (mProbe.actualBoundingBoxAscent ?? fontSize * 0.8);
          const descent = (mProbe.actualBoundingBoxDescent ?? fontSize * 0.2);
          const boxHeight = ascent + descent;
          const lineHeight = Math.max(boxHeight * 1.1, fontSize * 1.15);
          const totalTextHeight = lines.length * lineHeight;
          let startY = field.y + Math.max(pad, (field.height - totalTextHeight) / 2);

          ctx.textBaseline = "alphabetic";
          lines.forEach((line, index) => {
            const baselineY = startY + index * lineHeight + ascent;
            // draw only if full glyph box fits
            if (baselineY + (descent) <= field.y + field.height - pad) {
              ctx.fillText(line, tx, baselineY, field.width - 16);
            }
          });
        } else {
          // Single line text using precise metrics centering
          const pad = 4;
          const fontSize = field.fontSize || 16;
          const m = ctx.measureText(content || "Mg");
          const ascent = (m.actualBoundingBoxAscent ?? fontSize * 0.8);
          const descent = (m.actualBoundingBoxDescent ?? fontSize * 0.2);
          const boxHeight = ascent + descent;
          const baselineY = field.y + Math.max(pad, (field.height - boxHeight) / 2) + ascent;
          ctx.textBaseline = "alphabetic";
          ctx.fillText(content, tx, baselineY, field.width - 16);
        }
      }

      // Draw sub-elements (labels, captions)
      if (field.subElements && field.subElements.length > 0) {
        field.subElements.forEach((subEl) => {
          ctx.fillStyle = subEl.textColor;
          ctx.font = `${subEl.isItalic ? "italic " : ""}${
            subEl.isBold ? "bold " : ""
          }${subEl.fontSize}px sans-serif`;
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

      // Selection border and resize handles
      if (selectedField?.id === field.id) {
        ctx.strokeStyle = "#007bff";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        // For image/signature fields, draw selection around actual image content
        if (
          (field.type === "image" || field.type === "signature") &&
          field.value
        ) {
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
            // If image not loaded yet, use full field area
            strokeAlignedRect(field.x - 2, field.y - 2, field.width + 4, field.height + 4, 2);
          }
        } else {
          strokeAlignedRect(field.x - 2, field.y - 2, field.width + 4, field.height + 4, 2);
        }

        ctx.setLineDash([]);
        drawResizeHandles(ctx, field);
      }
    }
  }, [currentTemplate, selectedField, canvasContainerSize]);

  useEffect(() => {
    renderTemplate();
  }, [renderTemplate]);

  // Helpers
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();

    // Map from CSS pixels to template coordinate space (ignore DPR)
    const tplW = currentTemplate?.width || rect.width;
    const tplH = currentTemplate?.height || rect.height;
    const scaleX = tplW / rect.width;
    const scaleY = tplH / rect.height;

    // Get mouse position relative to canvas (template units)
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Ensure coordinates are within template bounds
    return {
      x: Math.max(0, Math.min(x, tplW)),
      y: Math.max(0, Math.min(y, tplH)),
    };
  };

  function hitTest(px: number, py: number): TemplateField | null {
    if (!currentTemplate) return null;
    for (let i = currentTemplate.fields.length - 1; i >= 0; i--) {
      const f = currentTemplate.fields[i];

      // For image/signature fields with content, only hit test the actual image area
      if ((f.type === "image" || f.type === "signature") && f.value) {
        const cacheKey = `${f.id}`;
        const cached = imageCacheRef.current[cacheKey];
        if (cached) {
          const iw = cached.naturalWidth || cached.width;
          const ih = cached.naturalHeight || cached.height;
          const scale = Math.min(f.width / iw, f.height / ih);
          const dw = Math.max(1, Math.floor(iw * scale));
          const dh = Math.max(1, Math.floor(ih * scale));
          const dx = f.x + (f.width - dw) / 2;
          const dy = f.y + (f.height - dh) / 2;

          if (px >= dx && px <= dx + dw && py >= dy && py <= dy + dh) return f;
        } else {
          // If image not loaded yet, use full field area
          if (
            px >= f.x &&
            px <= f.x + f.width &&
            py >= f.y &&
            py <= f.y + f.height
          )
            return f;
        }
      } else {
        // For non-image fields, use full field area
        if (
          px >= f.x &&
          px <= f.x + f.width &&
          py >= f.y &&
          py <= f.y + f.height
        )
          return f;
      }
    }
    return null;
  }

  function drawResizeHandles(
    ctx: CanvasRenderingContext2D,
    field: TemplateField
  ) {
    const size = 6;
    ctx.fillStyle = "#2563eb";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;

    let handleX = field.x;
    let handleY = field.y;
    let handleWidth = field.width;
    let handleHeight = field.height;

    // For image/signature fields with content, position handles around actual image
    if ((field.type === "image" || field.type === "signature") && field.value) {
      const cacheKey = `${field.id}`;
      const cached = imageCacheRef.current[cacheKey];
      if (cached) {
        const iw = cached.naturalWidth || cached.width;
        const ih = cached.naturalHeight || cached.height;
        const scale = Math.min(field.width / iw, field.height / ih);
        const dw = Math.max(1, Math.floor(iw * scale));
        const dh = Math.max(1, Math.floor(ih * scale));
        handleX = field.x + (field.width - dw) / 2;
        handleY = field.y + (field.height - dh) / 2;
        handleWidth = dw;
        handleHeight = dh;
      }
    }

    const centers = [
      { x: handleX, y: handleY, key: "nw" },
      { x: handleX + handleWidth / 2, y: handleY, key: "n" },
      { x: handleX + handleWidth, y: handleY, key: "ne" },
      { x: handleX, y: handleY + handleHeight / 2, key: "w" },
      { x: handleX + handleWidth, y: handleY + handleHeight / 2, key: "e" },
      { x: handleX, y: handleY + handleHeight, key: "sw" },
      { x: handleX + handleWidth / 2, y: handleY + handleHeight, key: "s" },
      { x: handleX + handleWidth, y: handleY + handleHeight, key: "se" },
    ] as const;
    centers.forEach((c) => {
      ctx.fillRect(c.x - size / 2, c.y - size / 2, size, size);
      ctx.strokeRect(c.x - size / 2, c.y - size / 2, size, size);
    });
  }

  const getHandleAtPosition = (
    px: number,
    py: number,
    field: TemplateField
  ): ResizeHandle => {
    const size = 6;

    let handleX = field.x;
    let handleY = field.y;
    let handleWidth = field.width;
    let handleHeight = field.height;

    // For image/signature fields with content, use actual image dimensions for handle hit testing
    if ((field.type === "image" || field.type === "signature") && field.value) {
      const cacheKey = `${field.id}`;
      const cached = imageCacheRef.current[cacheKey];
      if (cached) {
        const iw = cached.naturalWidth || cached.width;
        const ih = cached.naturalHeight || cached.height;
        const scale = Math.min(field.width / iw, field.height / ih);
        const dw = Math.max(1, Math.floor(iw * scale));
        const dh = Math.max(1, Math.floor(ih * scale));
        handleX = field.x + (field.width - dw) / 2;
        handleY = field.y + (field.height - dh) / 2;
        handleWidth = dw;
        handleHeight = dh;
      }
    }

    const handles: {
      key: Exclude<ResizeHandle, null>;
      x: number;
      y: number;
    }[] = [
      { key: "nw", x: handleX, y: handleY },
      { key: "n", x: handleX + handleWidth / 2, y: handleY },
      { key: "ne", x: handleX + handleWidth, y: handleY },
      { key: "w", x: handleX, y: handleY + handleHeight / 2 },
      { key: "e", x: handleX + handleWidth, y: handleY + handleHeight / 2 },
      { key: "sw", x: handleX, y: handleY + handleHeight },
      { key: "s", x: handleX + handleWidth / 2, y: handleY + handleHeight },
      { key: "se", x: handleX + handleWidth, y: handleY + handleHeight },
    ];
    for (const h of handles) {
      if (Math.abs(px - h.x) <= size && Math.abs(py - h.y) <= size)
        return h.key;
    }
    return null;
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = {
      ...e,
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0,
      buttons: 1,
    } as any;
    handleMouseDown(mouseEvent);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = {
      ...e,
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0,
      buttons: 1,
    } as any;
    handleMouseMove(mouseEvent);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleMouseUp();
  };

  // Mouse/touch event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !currentTemplate) return;

    // Cancel inline editing if clicking elsewhere
    if (inlineEditField) {
      finishInlineEdit();
      return;
    }

    const { x, y } = getMousePos(e);
    const field = hitTest(x, y);

    if (field) {
      setSelectedField(field);
      const handle = getHandleAtPosition(x, y, field);
      if (handle) {
        // Save state before resizing
        saveStateForUndo();
        setIsResizing(true);
        setResizeHandle(handle);
        resizeOriginRef.current = { startX: x, startY: y, field };
      } else {
        // Save state before dragging
        saveStateForUndo();
        setIsDragging(true);
        setDragOffset({ x: x - field.x, y: y - field.y });
      }
    } else {
      setSelectedField(null);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !currentTemplate) return;
    const { x: curX, y: curY } = getMousePos(event);

    if (isDragging && selectedField) {
      const nx = curX - dragOffset.x;
      const ny = curY - dragOffset.y;
      const canvasWidth = currentTemplate.width;
      const canvasHeight = currentTemplate.height;

      // Allow moving to canvas edges (0,0) and constrain within canvas bounds
      const constrainedX = Math.max(
        0,
        Math.min(nx, canvasWidth - selectedField.width)
      );
      const constrainedY = Math.max(
        0,
        Math.min(ny, canvasHeight - selectedField.height)
      );

      // Only update if position actually changed
      if (
        selectedField.x !== constrainedX ||
        selectedField.y !== constrainedY
      ) {
        updateField(
          selectedField.id,
          { x: constrainedX, y: constrainedY },
          false
        );
      }
      return;
    }

    if (isResizing && resizeOriginRef.current.field && resizeHandle) {
      const orig = resizeOriginRef.current.field;
      const dx = curX - resizeOriginRef.current.startX;
      const dy = curY - resizeOriginRef.current.startY;

      let newX = orig.x;
      let newY = orig.y;
      let newW = orig.width;
      let newH = orig.height;

      const minSize = 20;
      const lockAspect =
        !!orig.lockAspect &&
        (orig.type === "image" || orig.type === "signature");
      const aspect = orig.width / Math.max(1, orig.height);

      const applyAspect = () => {
        if (!lockAspect) return;
        if (resizeHandle === "n" || resizeHandle === "s")
          newW = Math.max(minSize, newH * aspect);
        else if (resizeHandle === "e" || resizeHandle === "w")
          newH = Math.max(minSize, newW / aspect);
        else newH = Math.max(minSize, newW / aspect);
      };

      switch (resizeHandle) {
        case "e":
          newW = Math.max(minSize, orig.width + dx);
          applyAspect();
          break;
        case "w":
          newW = Math.max(minSize, orig.width - dx);
          // Allow moving to left edge even if width hits minimum
          if (newW === minSize) {
            newX = Math.max(0, orig.x + orig.width - minSize);
          } else {
            newX = orig.x + dx;
          }
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
          // Allow moving to left edge even if width hits minimum
          if (newW === minSize) {
            newX = Math.max(0, orig.x + orig.width - minSize);
          } else {
            newX = orig.x + dx;
          }
          applyAspect();
          break;
        case "nw":
          newW = Math.max(minSize, orig.width - dx);
          newH = Math.max(minSize, orig.height - dy);
          // Allow moving to left edge even if width hits minimum
          if (newW === minSize) {
            newX = Math.max(0, orig.x + orig.width - minSize);
          } else {
            newX = orig.x + dx;
          }
          newY = orig.y + dy;
          applyAspect();
          break;
      }

      // Apply canvas boundary constraints for resize operations
      const canvasWidth = currentTemplate.width;
      const canvasHeight = currentTemplate.height;

      // Ensure field stays within canvas bounds
      const constrainedX = Math.max(
        0,
        Math.min(newX, canvasWidth - Math.max(minSize, newW))
      );
      const constrainedY = Math.max(
        0,
        Math.min(newY, canvasHeight - Math.max(minSize, newH))
      );
      const constrainedW = Math.min(
        Math.max(minSize, newW),
        canvasWidth - constrainedX
      );
      const constrainedH = Math.min(
        Math.max(minSize, newH),
        canvasHeight - constrainedY
      );

      updateField(
        resizeOriginRef.current.field.id,
        {
          x: constrainedX,
          y: constrainedY,
          width: constrainedW,
          height: constrainedH,
        },
        false
      );
      return;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  };

  // Handle keyboard events for inline editing
  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      inlineEditField?.type !== "textarea"
    ) {
      e.preventDefault();
      finishInlineEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelInlineEdit();
    }
  };

  // Handle double-click for inline editing
  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !currentTemplate) return;

    const { x, y } = getMousePos(event);
    const field = hitTest(x, y);

    if (field && field.type !== "image" && field.type !== "signature") {
      // Cancel any pending drag/resize operations
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);

      // Clear the timer to prevent delayed drag behavior
      if (doubleClickTimerRef.current) {
        clearTimeout(doubleClickTimerRef.current);
        doubleClickTimerRef.current = null;
      }

      startInlineEdit(field);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !currentTemplate) return;
    const { x, y } = getMousePos(e);
    const field = hitTest(x, y);
    setSelectedField(field);
  };

  // Create from our professional sample (duplicate first professional or fallback to defaults)
  // Insert helper: enforces MAX_TEMPLATES with a single confirmation, never deletes default,
  // updates state and persists to localStorage. Returns true if added.
  const insertTemplateWithLimit = (newTemplate: Template, opts?: { setAsCurrent?: boolean; closeChooser?: boolean }) => {
    const { setAsCurrent = true, closeChooser = true } = opts || {};
    // Work off current in-memory list to avoid multiple confirms
    let baseList = templates;
    let removedId: string | null = null;
    if (baseList.length >= MAX_TEMPLATES) {
      const sorted = [...baseList].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const oldest = sorted.find((t) => t.id !== DEFAULT_TEMPLATE_ID);
      if (!oldest) return false;
      const ok = window.confirm(
        `Template limit is ${MAX_TEMPLATES}. Delete oldest template "${oldest.name}" to create a new one?`
      );
      if (!ok) return false;
      baseList = baseList.filter((p) => p.id !== oldest.id);
      removedId = oldest.id;
    }

    const next = [newTemplate, ...baseList];
    // Update state
    setTemplates(next);
    if (setAsCurrent) setCurrentTemplate(newTemplate);
    if (closeChooser) setShowNewTemplateChooser(false);

    // Persist to storage (serialize createdAt)
    try {
      const serial = next.map((t) => ({
        ...t,
        createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : (t as any).createdAt,
      }));
      writeArrayKey(TEMPLATES_KEY, serial);
      if (typeof window !== "undefined" && setAsCurrent) {
        window.localStorage.setItem(LAST_TEMPLATE_KEY, newTemplate.id);
      }
      // If we removed the last-used template, clear it
      if (typeof window !== "undefined" && removedId) {
        const lastId = window.localStorage.getItem(LAST_TEMPLATE_KEY);
        if (lastId === removedId) window.localStorage.removeItem(LAST_TEMPLATE_KEY);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to persist templates:", e);
    }
    return true;
  };

  const createFromProfessional = () => {
    // Try to find a professional template to duplicate
    const base = templates.find((t) => /professional/i.test(t.name)) || null;
    const idx = templates.length + 1;
    const newTemplate: Template = base
      ? {
          ...base,
          id: `tpl-${Date.now()}`,
          name: `${base.name} (${idx})`,
          description: base.description,
          width: base.width,
          height: base.height,
          createdAt: new Date(),
          fields: base.fields.map((f) => ({
            ...f,
            id: `${f.id}-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
          })),
        }
      : {
          id: `tpl-${idx}`,
          name: `Professional Template ${idx}`,
          description: "New professional template",
          width: 800,
          height: 1120,
          createdAt: new Date(),
          fields: [],
        };

    // Before adding, enforce limit with confirmation
    insertTemplateWithLimit(newTemplate, { setAsCurrent: true, closeChooser: true });
  };

  const createNewTemplate = () => {
    const idx = templates.length + 1;
    const defaultFields: TemplateField[] = [
      {
        id: `fld-customer-${Date.now()}`,
        label: "Customer Name",
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
        required: true,
        subElements: [],
      },
      {
        id: `fld-date-${Date.now() + 1}`,
        label: "Date",
        value: "",
        type: "date",
        x: 450,
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
        required: true,
        subElements: [],
      },
      {
        id: `fld-amount-${Date.now() + 2}`,
        label: "Total Amount",
        value: "$0.00",
        type: "amount",
        x: 450,
        y: 200,
        width: 200,
        height: 50,
        fontSize: 18,
        isBold: true,
        isItalic: false,
        textColor: "#059669",
        backgroundColor: "#f0fdf4",
        borderColor: "#059669",
        borderWidth: 2,
        borderRadius: 8,
        alignment: "center",
        required: true,
        subElements: [],
      },
      {
        id: `fld-description-${Date.now() + 3}`,
        label: "Description",
        value: "",
        type: "textarea",
        x: 100,
        y: 300,
        width: 600,
        height: 100,
        fontSize: 14,
        isBold: false,
        isItalic: false,
        textColor: "#374151",
        backgroundColor: "#ffffff",
        borderColor: "#d1d5db",
        borderWidth: 1,
        borderRadius: 6,
        alignment: "left",
        required: false,
        subElements: [],
      },
      {
        id: `fld-signature-${Date.now() + 4}`,
        label: "Signature",
        value: "",
        type: "signature",
        x: 100,
        y: 450,
        width: 250,
        height: 100,
        fontSize: 14,
        isBold: false,
        isItalic: false,
        textColor: "#000000",
        backgroundColor: "#ffffff",
        borderColor: "#9ca3af",
        borderWidth: 1,
        borderRadius: 6,
        alignment: "center",
        required: false,
        lockAspect: true,
        subElements: [
          {
            id: `sub-${Date.now() + 5}`,
            type: "caption",
            content: "Customer Signature",
            position: "bottom",
            offsetX: 0,
            offsetY: 10,
            fontSize: 12,
            textColor: "#6b7280",
            isBold: false,
            isItalic: true,
          },
        ],
      },
    ];

    const t: Template = {
      id: `tpl-${idx}`,
      name: `Template ${idx}`,
      description: "New advanced template with default fields",
      width: 800,
      height: 1120,
      createdAt: new Date(),
      fields: defaultFields,
    };
    // Before adding, enforce limit with confirmation
    insertTemplateWithLimit(t, { setAsCurrent: true, closeChooser: true });
  };

  // Wrapper for modal button: start an empty template and close chooser
  const createEmptyTemplate = () => {
    createNewTemplate();
  };
  // Load stored templates on mount (client-only) to avoid SSR hydration mismatches
  useEffect(() => {
    try {
      const stored = readArrayKey<any>(TEMPLATES_KEY);
      if (stored && stored.length) {
        const deserialized: Template[] = stored.map((t: any) => ({
          ...t,
          createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        }));
        setTemplates(deserialized);
      }
    } catch {}
  }, []);
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

 

const saveTemplate = () => {
  // Upsert only the current template into localStorage so others are preserved
  try {
    const existing = readArrayKey<any>(TEMPLATES_KEY);
    const list: any[] = Array.isArray(existing) ? existing : [];
    const byId = new Map<string, any>(list.map((t: any) => [t.id, t]));
    if (currentTemplate) {
      const serial = {
        ...currentTemplate,
        createdAt:
          currentTemplate.createdAt instanceof Date
            ? currentTemplate.createdAt.toISOString()
            : (currentTemplate as any).createdAt,
      } as any;
      byId.set(currentTemplate.id, serial);
    }
    const merged = Array.from(byId.values());
    writeArrayKey(TEMPLATES_KEY, merged);
    if (typeof window !== "undefined" && currentTemplate) {
      window.localStorage.setItem(LAST_TEMPLATE_KEY, currentTemplate.id);
    }
    alert("Template saved locally.");
  } catch (e) {
    console.error(e);
    alert("Failed to save template");
  }
};

const exportCurrentCanvasToPdf = () => {
  const canvas = canvasRef.current;
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

  const onUploadImageForField = (fieldId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;

      // Auto-resize field to fit image content
      const img = new Image();
      img.onload = () => {
        const maxWidth = 400; // Maximum field width
        const maxHeight = 300; // Maximum field height
        const aspectRatio = img.naturalWidth / img.naturalHeight;

        let newWidth = img.naturalWidth;
        let newHeight = img.naturalHeight;

        // Scale down if image is too large
        if (newWidth > maxWidth) {
          newWidth = maxWidth;
          newHeight = newWidth / aspectRatio;
        }
        if (newHeight > maxHeight) {
          newHeight = maxHeight;
          newWidth = newHeight * aspectRatio;
        }

        // Update field with new dimensions and image
        updateField(fieldId, {
          value: dataUrl,
          width: Math.round(newWidth),
          height: Math.round(newHeight),
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const generateBill = (template: Template) => {
    setPreviewTemplate(template);
    setShowBillPreview(true);
  };

  // Render bill to canvas for preview and PDF export
  const renderBillToCanvas = useCallback(
    (canvas: HTMLCanvasElement, template: Template) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas size
      canvas.width = template.width;
      canvas.height = template.height;

      // Clear and set background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render all fields
      template.fields.forEach((field) => {
        // Skip empty fields
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
          // Text fields
          ctx.fillStyle = field.backgroundColor || "transparent";
          if (
            field.backgroundColor &&
            field.backgroundColor !== "transparent"
          ) {
            ctx.fillRect(field.x, field.y, field.width, field.height);
          }

          // Border
          if (field.borderWidth && field.borderWidth > 0) {
            ctx.strokeStyle = field.borderColor || "#e5e7eb";
            ctx.lineWidth = field.borderWidth;
            ctx.strokeRect(field.x, field.y, field.width, field.height);
          }

          // Text
          ctx.fillStyle = field.textColor || "#111827";
          ctx.font = `${field.isItalic ? "italic " : ""}${
            field.isBold ? "bold " : ""
          }${field.fontSize || 16}px sans-serif`;
          ctx.textAlign = field.alignment as CanvasTextAlign;

          let tx = field.x + 8;
          if (field.alignment === "center") tx = field.x + field.width / 2;
          if (field.alignment === "right") tx = field.x + field.width - 8;

          const content = field.value || field.placeholder || "";

          // Handle multi-line text
          if (field.type === "textarea" && content.includes("\n")) {
            const lines = content.split("\n");
            const lineHeight = (field.fontSize || 16) * 1.2;
            const totalTextHeight = lines.length * lineHeight;
            let startY =
              field.y + (field.height - totalTextHeight) / 2 + lineHeight / 2;

            ctx.textBaseline = "middle";
            lines.forEach((line, index) => {
              const y = startY + index * lineHeight;
              if (y >= field.y && y <= field.y + field.height) {
                ctx.fillText(line, tx, y, field.width - 16);
              }
            });
          } else {
            ctx.textBaseline = "middle";
            ctx.fillText(
              content,
              tx,
              field.y + field.height / 2,
              field.width - 16
            );
          }
        }
      });
    },
    []
  );

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

  // Generate RTF document content (opens properly in Word)
  const generateRTFContent = (template: Template) => {
    // RTF header with font table
    const rtfHeader = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}{\\f1 Arial;}}\n`;
    const rtfFooter = `}`;

    // Document title and header
    let rtfBody = `\\f1\\fs28\\qc\\b ${template.name}\\b0\\par\n`;
    rtfBody += `\\fs20\\qc Generated on ${new Date().toLocaleDateString()}\\par\n\\par\n\\par\n`;

    // Add each field with proper formatting
    template.fields.forEach((field) => {
      const fieldValue = field.value || field.placeholder || "[Empty]";
      // Escape RTF special characters
      const escapedLabel = field.label
        .replace(/\\/g, "\\\\")
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}");
      const escapedValue = fieldValue
        .replace(/\\/g, "\\\\")
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}")
        .replace(/\n/g, "\\par\n");

      rtfBody += `\\fs22\\b ${escapedLabel}:\\b0\\par\n`;
      rtfBody += `\\fs20 ${escapedValue}\\par\n\\par\n`;
    });

    // Footer
    rtfBody += `\\par\n\\fs16\\qc\\i This document was generated using Advanced Bill Generator\\i0\\par\n`;

    return rtfHeader + rtfBody + rtfFooter;
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

  // Update bill preview when template changes
  useEffect(() => {
    if (showBillPreview && previewTemplate && billCanvasRef.current) {
      renderBillToCanvas(billCanvasRef.current, previewTemplate);
    }
  }, [showBillPreview, previewTemplate, renderBillToCanvas]);

  const deleteTemplate = (templateId: string) => {
    // Update UI state
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    setCurrentTemplate((ct) => (ct && ct.id === templateId ? null : ct));

    // Persist deletion in localStorage
    try {
      const existing = readArrayKey<any>(TEMPLATES_KEY);
      const list: any[] = Array.isArray(existing) ? existing : [];
      const filtered = list.filter((t: any) => t && t.id !== templateId);
      writeArrayKey(TEMPLATES_KEY, filtered);

      if (typeof window !== "undefined") {
        const lastId = window.localStorage.getItem(LAST_TEMPLATE_KEY);
        if (lastId === templateId) {
          window.localStorage.removeItem(LAST_TEMPLATE_KEY);
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to persist template deletion:", e);
    }
  };

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
            canvasRef={canvasRef as any}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleCanvasClick}
            onDoubleClick={handleDoubleClick}
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
          onCreateEmpty={createEmptyTemplate}
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
