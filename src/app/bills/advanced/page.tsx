"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import jsPDF from "jspdf";
import { readArrayKey, writeArrayKey } from "@/lib/localStore";

// Types
interface SubElement {
  id: string;
  type: "text" | "caption";
  content: string;
  position: "top" | "bottom" | "left" | "right";
  offsetX: number;
  offsetY: number;
  fontSize: number;
  textColor: string;
  isBold: boolean;
  isItalic: boolean;
}

interface TemplateField {
  id: string;
  label: string;
  value: string;
  type:
    | "text"
    | "number"
    | "date"
    | "amount"
    | "textarea"
    | "select"
    | "image"
    | "signature";
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  alignment: "left" | "center" | "right";
  placeholder?: string;
  options?: string[];
  required: boolean;
  lockAspect?: boolean; // maintain aspect ratio during resize for image/signature
  subElements?: SubElement[]; // additional text elements like labels, captions
}

interface Template {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  createdAt: Date;
  fields: TemplateField[];
}

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
    const sampleTemplate: Template = {
      id: "tpl-1",
      name: "Professional Invoice Template",
      description:
        "A complete invoice template with company header, client details, and itemized billing",
      width: 800,
      height: 1120,
      createdAt: new Date(),
      fields: [
        // Company Header
        {
          id: "company-name",
          label: "Company Name",
          value: "Your Company Name",
          type: "text",
          x: 50,
          y: 30,
          width: 300,
          height: 40,
          fontSize: 24,
          isBold: true,
          isItalic: false,
          textColor: "#1f2937",
          backgroundColor: "transparent",
          borderColor: "transparent",
          borderWidth: 0,
          borderRadius: 0,
          alignment: "left",
          required: true,
        },
        {
          id: "company-address",
          label: "Company Address",
          value:
            "123 Business Street\nCity, State 12345\nPhone: (555) 123-4567\nEmail: info@company.com",
          type: "textarea",
          x: 50,
          y: 80,
          width: 300,
          height: 80,
          fontSize: 12,
          isBold: false,
          isItalic: false,
          textColor: "#6b7280",
          backgroundColor: "transparent",
          borderColor: "transparent",
          borderWidth: 0,
          borderRadius: 0,
          alignment: "left",
          required: false,
        },
        // Invoice Title
        {
          id: "invoice-title",
          label: "Invoice Title",
          value: "INVOICE",
          type: "text",
          x: 500,
          y: 30,
          width: 250,
          height: 50,
          fontSize: 32,
          isBold: true,
          isItalic: false,
          textColor: "#dc2626",
          backgroundColor: "transparent",
          borderColor: "transparent",
          borderWidth: 0,
          borderRadius: 0,
          alignment: "right",
          required: true,
        },
        // Invoice Details
        {
          id: "invoice-number",
          label: "Invoice Number",
          value: "INV-001",
          type: "text",
          x: 500,
          y: 90,
          width: 250,
          height: 30,
          fontSize: 14,
          isBold: false,
          isItalic: false,
          textColor: "#374151",
          backgroundColor: "transparent",
          borderColor: "transparent",
          borderWidth: 0,
          borderRadius: 0,
          alignment: "right",
          required: true,
        },
        {
          id: "invoice-date",
          label: "Invoice Date",
          value: new Date().toLocaleDateString(),
          type: "date",
          x: 500,
          y: 130,
          width: 250,
          height: 30,
          fontSize: 14,
          isBold: false,
          isItalic: false,
          textColor: "#374151",
          backgroundColor: "transparent",
          borderColor: "transparent",
          borderWidth: 0,
          borderRadius: 0,
          alignment: "right",
          required: true,
        },
        // Bill To Section
        {
          id: "bill-to-label",
          label: "Bill To Label",
          value: "Bill To:",
          type: "text",
          x: 50,
          y: 200,
          width: 100,
          height: 30,
          fontSize: 16,
          isBold: true,
          isItalic: false,
          textColor: "#1f2937",
          backgroundColor: "transparent",
          borderColor: "transparent",
          borderWidth: 0,
          borderRadius: 0,
          alignment: "left",
          required: false,
        },
        {
          id: "client-details",
          label: "Client Details",
          value:
            "Client Company Name\nClient Address Line 1\nClient Address Line 2\nCity, State ZIP\nPhone: (555) 987-6543",
          type: "textarea",
          x: 50,
          y: 240,
          width: 350,
          height: 100,
          fontSize: 14,
          isBold: false,
          isItalic: false,
          textColor: "#374151",
          backgroundColor: "#f9fafb",
          borderColor: "#d1d5db",
          borderWidth: 1,
          borderRadius: 4,
          alignment: "left",
          required: true,
        },
        // Table Header Row
        {
          id: "header-description",
          label: "Header Description",
          value: "Description",
          type: "text",
          x: 50,
          y: 380,
          width: 350,
          height: 35,
          fontSize: 14,
          isBold: true,
          isItalic: false,
          textColor: "#ffffff",
          backgroundColor: "#4b5563",
          borderColor: "#374151",
          borderWidth: 1,
          borderRadius: 0,
          alignment: "left",
          required: false,
        },
        {
          id: "header-qty",
          label: "Header Qty",
          value: "Qty",
          type: "text",
          x: 400,
          y: 380,
          width: 80,
          height: 35,
          fontSize: 14,
          isBold: true,
          isItalic: false,
          textColor: "#ffffff",
          backgroundColor: "#4b5563",
          borderColor: "#374151",
          borderWidth: 1,
          borderRadius: 0,
          alignment: "center",
          required: false,
        },
        {
          id: "header-rate",
          label: "Header Rate",
          value: "Rate",
          type: "text",
          x: 480,
          y: 380,
          width: 120,
          height: 35,
          fontSize: 14,
          isBold: true,
          isItalic: false,
          textColor: "#ffffff",
          backgroundColor: "#4b5563",
          borderColor: "#374151",
          borderWidth: 1,
          borderRadius: 0,
          alignment: "center",
          required: false,
        },
        {
          id: "header-amount",
          label: "Header Amount",
          value: "Amount",
          type: "text",
          x: 600,
          y: 380,
          width: 150,
          height: 35,
          fontSize: 14,
          isBold: true,
          isItalic: false,
          textColor: "#ffffff",
          backgroundColor: "#4b5563",
          borderColor: "#374151",
          borderWidth: 1,
          borderRadius: 0,
          alignment: "center",
          required: false,
        },
        // Item 1 Row
        {
          id: "item1-description",
          label: "Item 1 Description",
          value: "Professional Services - Web Development",
          type: "text",
          x: 50,
          y: 415,
          width: 350,
          height: 30,
          fontSize: 12,
          isBold: false,
          isItalic: false,
          textColor: "#374151",
          backgroundColor: "#ffffff",
          borderColor: "#e5e7eb",
          borderWidth: 1,
          borderRadius: 0,
          alignment: "left",
          required: false,
        },
        {
          id: "item1-qty",
          label: "Item 1 Qty",
          value: "1",
          type: "text",
          x: 400,
          y: 415,
          width: 80,
          height: 30,
          fontSize: 12,
          isBold: false,
          isItalic: false,
          textColor: "#374151",
          backgroundColor: "#ffffff",
          borderColor: "#e5e7eb",
          borderWidth: 1,
          borderRadius: 0,
          alignment: "center",
          required: false,
        },
        {
          id: "item1-rate",
          label: "Item 1 Rate",
          value: "$1,500.00",
          type: "text",
          x: 480,
          y: 415,
          width: 120,
          height: 30,
          fontSize: 12,
          isBold: false,
          isItalic: false,
          textColor: "#374151",
          backgroundColor: "#ffffff",
          borderColor: "#e5e7eb",
          borderWidth: 1,
          borderRadius: 0,
          alignment: "right",
          required: false,
        },
        {
          id: "item1-amount",
          label: "Item 1 Amount",
          value: "$1,500.00",
          type: "text",
          x: 600,
          y: 415,
          width: 150,
          height: 30,
          fontSize: 12,
          isBold: false,
          isItalic: false,
          textColor: "#374151",
          backgroundColor: "#ffffff",
          borderColor: "#e5e7eb",
          borderWidth: 1,
          borderRadius: 0,
          alignment: "right",
          required: false,
        },
        // Item 2 Row
        {
          id: "item2-description",
          label: "Item 2 Description",
          value: "Design Consultation",
          type: "text",
          x: 50,
          y: 445,
          width: 350,
          height: 30,
          fontSize: 12,
          isBold: false,
          isItalic: false,
          textColor: "#374151",
          backgroundColor: "#f9fafb",
          borderColor: "#e5e7eb",
          borderWidth: 1,
          borderRadius: 0,
          alignment: "left",
          required: false,
        },
        {
          id: "item2-qty",
          label: "Item 2 Qty",
          value: "2",
          type: "text",
          x: 400,
          y: 445,
          width: 80,
          height: 30,
          fontSize: 12,
          isBold: false,
          isItalic: false,
          textColor: "#374151",
          backgroundColor: "#f9fafb",
          borderColor: "#e5e7eb",
          borderWidth: 1,
          borderRadius: 0,
          alignment: "center",
          required: false,
        },
        {
          id: "item2-rate",
          label: "Item 2 Rate",
          value: "$250.00",
          type: "text",
          x: 480,
          y: 445,
          width: 120,
          height: 30,
          fontSize: 12,
          isBold: false,
          isItalic: false,
          textColor: "#374151",
          backgroundColor: "#f9fafb",
          borderColor: "#e5e7eb",
          borderWidth: 1,
          borderRadius: 0,
          alignment: "right",
          required: false,
        },
        {
          id: "item2-amount",
          label: "Item 2 Amount",
          value: "$500.00",
          type: "text",
          x: 600,
          y: 445,
          width: 150,
          height: 30,
          fontSize: 12,
          isBold: false,
          isItalic: false,
          textColor: "#374151",
          backgroundColor: "#f9fafb",
          borderColor: "#e5e7eb",
          borderWidth: 1,
          borderRadius: 0,
          alignment: "right",
          required: false,
        },
        // Totals Section
        {
          id: "subtotal",
          label: "Subtotal",
          value: "Subtotal: $2,000.00",
          type: "text",
          x: 500,
          y: 520,
          width: 250,
          height: 30,
          fontSize: 14,
          isBold: false,
          isItalic: false,
          textColor: "#374151",
          backgroundColor: "transparent",
          borderColor: "transparent",
          borderWidth: 0,
          borderRadius: 0,
          alignment: "right",
          required: false,
        },
        {
          id: "tax",
          label: "Tax",
          value: "Tax (8.25%): $165.00",
          type: "text",
          x: 500,
          y: 555,
          width: 250,
          height: 30,
          fontSize: 14,
          isBold: false,
          isItalic: false,
          textColor: "#374151",
          backgroundColor: "transparent",
          borderColor: "transparent",
          borderWidth: 0,
          borderRadius: 0,
          alignment: "right",
          required: false,
        },
        {
          id: "total",
          label: "Total Amount",
          value: "Total: $2,165.00",
          type: "amount",
          x: 500,
          y: 590,
          width: 250,
          height: 40,
          fontSize: 18,
          isBold: true,
          isItalic: false,
          textColor: "#dc2626",
          backgroundColor: "#fef2f2",
          borderColor: "#dc2626",
          borderWidth: 2,
          borderRadius: 4,
          alignment: "right",
          required: true,
        },
        // Payment Terms
        {
          id: "payment-terms",
          label: "Payment Terms",
          value:
            "Payment Terms:\n• Payment is due within 30 days of invoice date\n• Late payments may incur a 1.5% monthly service charge\n• Please include invoice number with payment\n\nThank you for your business!",
          type: "textarea",
          x: 50,
          y: 680,
          width: 700,
          height: 120,
          fontSize: 12,
          isBold: false,
          isItalic: false,
          textColor: "#6b7280",
          backgroundColor: "#f9fafb",
          borderColor: "#d1d5db",
          borderWidth: 1,
          borderRadius: 4,
          alignment: "left",
          required: false,
        },
      ],
    };
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
  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill: boolean,
    stroke: boolean
  ) => {
    const r = Math.min(radius || 0, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  };

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
    const f = hitTest(x, y);
    setSelectedField(f);
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
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">
            🚀 Advanced Template Builder
          </h1>
          <p className="text-base md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-2">
            Create professional bill templates with advanced styling,
            positioning, and customization options!
          </p>
        </div>

        {/* Template Management */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-start md:justify-between mb-6 gap-3 md:gap-0 flex-wrap md:flex-nowrap">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
              Your Templates
            </h2>
            <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
              <Button
                className="w-full md:w-auto"
                variant="secondary"
                onClick={() => setShowTemplateSettings(true)}
              >
                ⚙️ Template Settings
              </Button>
              <Button
                className="w-full md:w-auto"
                variant="success"
                onClick={() => setShowNewTemplateChooser(true)}
              >
                ✨ Create New Template
              </Button>
            </div>
          </div>

          {/* Templates List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="group hover:shadow-lg transition-all duration-300 overflow-hidden"
              >
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {editingTemplateId === template.id ? (
                        <input
                          type="text"
                          value={editingTemplateName}
                          onChange={(e) =>
                            setEditingTemplateName(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (editingTemplateName.trim()) {
                                setTemplates((prev) =>
                                  prev.map((t) =>
                                    t.id === template.id
                                      ? {
                                          ...t,
                                          name: editingTemplateName.trim(),
                                        }
                                      : t
                                  )
                                );
                                if (
                                  currentTemplate &&
                                  currentTemplate.id === template.id
                                ) {
                                  setCurrentTemplate((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          name: editingTemplateName.trim(),
                                        }
                                      : null
                                  );
                                }
                              }
                              setEditingTemplateId(null);
                              setEditingTemplateName("");
                            } else if (e.key === "Escape") {
                              setEditingTemplateId(null);
                              setEditingTemplateName("");
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
                      onClick={() => {
                        setEditingTemplateId(template.id);
                        setEditingTemplateName(template.name);
                      }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
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
                      <span className="font-medium">
                        {template.fields.length} fields
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>
                        Created{" "}
                        {new Date(template.createdAt)
                          .toISOString()
                          .slice(0, 10)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={() => setCurrentTemplate(template)}>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      Edit
                    </Button>
                    <Button
                      variant="gradient"
                      onClick={() => generateBill(template)}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Generate
                    </Button>
                    <Button
                      variant="success"
                      onClick={() => {
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
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Duplicate
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => deleteTemplate(template.id)}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
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

          {templates.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No templates yet. Create your first advanced template to get
              started!
            </div>
          )}
        </div>

        {/* Template Editor */}
        {currentTemplate && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 md:p-8 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start md:items-center justify-between mb-4 md:mb-6 flex-col md:flex-row gap-3 md:gap-0">
              <div>
                <h3 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
                  {currentTemplate.name}
                </h3>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
                  {currentTemplate.fields.length} fields • Advanced styling
                  enabled
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
                {!isEditing ? (
                  <Button
                    className="w-full md:w-auto"
                    onClick={() => setIsEditing(true)}
                  >
                    ✏️ Edit Template
                  </Button>
                ) : (
                  <>
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => openFieldEditor(undefined, "create")}
                    >
                      ➕ Add Field
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      variant="gradient"
                      onClick={exportCurrentCanvasToPdf}
                    >
                      🖨️ Export PDF
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      variant="secondary"
                      onClick={() => currentTemplate && exportTemplateJson(currentTemplate)}
                    >
                      ⬇️ Export JSON
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      variant="success"
                      onClick={() => {
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
                    >
                      🚚 Use in Custom Template
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      variant="success"
                      onClick={saveTemplate}
                    >
                      💾 Save Template
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Template Canvas */}
            <div className="flex justify-center mb-4 md:mb-6 overflow-auto px-2">
              <div
                className="relative bg-white border border-gray-200 rounded-md shadow-sm max-w-full"
                style={{
                  width: canvasContainerSize?.width || currentTemplate.width,
                  height: canvasContainerSize?.height || currentTemplate.height,
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={currentTemplate.width}
                  height={currentTemplate.height}
                  className="absolute top-0 left-0 w-full h-full border-0 md:border-2 md:border-gray-300 rounded-md"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onClick={handleCanvasClick}
                  onDoubleClick={handleDoubleClick}
                  style={{
                    cursor: isEditing ? "move" : "default",
                    touchAction: "none",
                  }}
                />

                {/* Inline Text Editing Overlay */}
                {inlineEditField && inlineEditPosition && (
                  <div
                    className="fixed z-50"
                    style={{
                      left: typeof window !== "undefined" ? Math.max(8, Math.min(inlineEditPosition.x, window.innerWidth - inlineEditPosition.width - 8)) : inlineEditPosition.x,
                      top: typeof window !== "undefined" ? Math.max(8, Math.min(inlineEditPosition.y, window.innerHeight - inlineEditPosition.height - 8)) : inlineEditPosition.y,
                      width: typeof window !== "undefined" ? Math.min(inlineEditPosition.width, window.innerWidth - 16) : inlineEditPosition.width,
                      height: typeof window !== "undefined" ? Math.min(inlineEditPosition.height, window.innerHeight - 16) : inlineEditPosition.height,
                    }}
                  >
                    {inlineEditField.type === "textarea" ? (
                      <textarea
                        ref={
                          inlineInputRef as React.RefObject<HTMLTextAreaElement>
                        }
                        value={inlineEditValue}
                        onChange={(e) => setInlineEditValue(e.target.value)}
                        onKeyDown={handleInlineKeyDown}
                        onBlur={finishInlineEdit}
                        className="w-full h-full p-2 text-sm border-2 border-blue-500 rounded resize-none touch-manipulation"
                        style={{
                          fontSize: `${
                            (inlineEditField.fontSize || 16) *
                            (inlineEditPosition.width / inlineEditField.width)
                          }px`,
                          fontWeight: inlineEditField.isBold
                            ? "bold"
                            : "normal",
                          fontStyle: inlineEditField.isItalic
                            ? "italic"
                            : "normal",
                          textAlign: inlineEditField.alignment as any,
                          color: inlineEditField.textColor || "#111827",
                          backgroundColor:
                            inlineEditField.backgroundColor || "#ffffff",
                        }}
                      />
                    ) : (
                      <input
                        ref={
                          inlineInputRef as React.RefObject<HTMLInputElement>
                        }
                        type="text"
                        value={inlineEditValue}
                        onChange={(e) => setInlineEditValue(e.target.value)}
                        onKeyDown={handleInlineKeyDown}
                        onBlur={finishInlineEdit}
                        className="w-full h-full p-2 text-sm border-2 border-blue-500 rounded touch-manipulation"
                        style={{
                          fontSize: `${
                            (inlineEditField.fontSize || 16) *
                            (inlineEditPosition.width / inlineEditField.width)
                          }px`,
                          fontWeight: inlineEditField.isBold
                            ? "bold"
                            : "normal",
                          fontStyle: inlineEditField.isItalic
                            ? "italic"
                            : "normal",
                          textAlign: inlineEditField.alignment as any,
                          color: inlineEditField.textColor || "#111827",
                          backgroundColor:
                            inlineEditField.backgroundColor || "#ffffff",
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Fields Panel */}
            {isEditing && (
              <div className="mt-4 md:mt-6">
                <div className="flex items-start md:items-center justify-between mb-3 md:mb-4 gap-2 md:gap-0 flex-col md:flex-row">
                  <h4 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                    Template Fields ({currentTemplate.fields.length})
                  </h4>
                  <Button
                    className="w-full md:w-auto"
                    onClick={() => openFieldEditor(undefined, "create")}
                  >
                    ➕ Add New Field
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 max-h-96 overflow-y-auto touch-pan-y">
                  {currentTemplate.fields.map((field) => (
                    <div
                      key={field.id}
                      className={`p-3 md:p-4 border-2 rounded-lg transition-all duration-300 touch-manipulation ${
                        selectedField?.id === field.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                          {field.label}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {field.type}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 break-words">
                        {field.type === "image" ||
                        field.type === "signature" ? (
                          <span className="italic">
                            {field.value ? "Image selected" : "No image"}
                          </span>
                        ) : (
                          field.value
                        )}
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 space-y-1">
                        <div>
                          Position: ({field.x}, {field.y})
                        </div>
                        <div>
                          Size: {field.width} × {field.height}
                        </div>
                        <div>
                          Font: {field.fontSize}px {field.isBold ? "Bold" : ""}{" "}
                          {field.isItalic ? "Italic" : ""}
                        </div>
                        <div>Align: {field.alignment}</div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          className="flex-1 sm:flex-none"
                          size="sm"
                          onClick={() => openFieldEditor(field, "edit")}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            saveStateForUndo();
                            deleteField(field.id);
                          }}
                        >
                          Delete
                        </Button>
                        {(field.type === "image" ||
                          field.type === "signature") && (
                          <label className="bg-purple-600 hover:bg-purple-700 text-white text-xs py-1 px-2 rounded cursor-pointer transition-colors duration-300">
                            Upload Image
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) onUploadImageForField(field.id, file);
                                e.currentTarget.value = "";
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* New Template Chooser Modal */}
        {showNewTemplateChooser && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-0 md:p-6">
            <div className="bg-white dark:bg-gray-800 rounded-none md:rounded-xl p-4 md:p-6 w-full h-full md:h-auto md:max-w-2xl md:mx-4 overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                  Create New Template
                </h3>
                <button
                  aria-label="Close chooser"
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                  onClick={() => setShowNewTemplateChooser(false)}
                >
                  ✖
                </button>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Choose how you want to start your template.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-2 hover:border-blue-500 transition-colors">
                  <CardHeader>
                    <CardTitle>Professional Template</CardTitle>
                    <CardDescription>
                      Start from a polished, pre-filled invoice layout
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Includes company header, client details, itemized table,
                      and payment terms.
                    </p>
                    <Button className="w-full" onClick={createFromProfessional}>
                      Use Professional
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-2 hover:border-green-500 transition-colors">
                  <CardHeader>
                    <CardTitle>Empty Canvas</CardTitle>
                    <CardDescription>
                      Start from scratch with a blank page
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Perfect if you want full control over layout and fields.
                    </p>
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={createEmptyTemplate}
                    >
                      Start Empty
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setShowNewTemplateChooser(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Field Editor Modal */}
        {showFieldEditor && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-0 md:p-6">
            <div className="bg-white dark:bg-gray-800 rounded-none md:rounded-xl p-4 md:p-6 w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:mx-4 overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {isFieldEditorMode === "create"
                  ? "Add New Field"
                  : "Edit Field"}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Basic Settings */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Field Label
                    </label>
                    <input
                      type="text"
                      value={fieldEditorData.label || ""}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          label: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      placeholder="Enter field label"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Field Type
                    </label>
                    <select
                      value={fieldEditorData.type || "text"}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          type: e.target.value as TemplateField["type"],
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="amount">Amount</option>
                      <option value="textarea">Text Area</option>
                      <option value="select">Select</option>
                      <option value="image">Image</option>
                      <option value="signature">Signature</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Default Value
                    </label>
                    {fieldEditorData.type === "image" ||
                    fieldEditorData.type === "signature" ? (
                      <div className="space-y-3">
                        {fieldEditorData.value ? (
                          <div className="flex items-start gap-3">
                            <img
                              src={fieldEditorData.value}
                              alt="preview"
                              className="w-32 h-20 object-contain rounded border"
                            />
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                className="bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded"
                                onClick={() =>
                                  setFieldEditorData({
                                    ...fieldEditorData,
                                    value: "",
                                  })
                                }
                              >
                                Remove Image
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            No image selected
                          </div>
                        )}
                        <label className="inline-block bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 px-3 rounded cursor-pointer">
                          Choose Image
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () =>
                                setFieldEditorData({
                                  ...fieldEditorData,
                                  value: reader.result as string,
                                });
                              reader.readAsDataURL(file);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          Supported: PNG, JPG, JPEG, WEBP
                        </div>
                      </div>
                    ) : fieldEditorData.type === "textarea" ? (
                      <textarea
                        value={fieldEditorData.value || ""}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            value: e.target.value,
                          })
                        }
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-h-[100px] resize-vertical"
                        placeholder="Enter default value (use \n for line breaks)"
                        rows={4}
                      />
                    ) : (
                      <input
                        type="text"
                        value={fieldEditorData.value || ""}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            value: e.target.value,
                          })
                        }
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="Enter default value"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Alignment
                    </label>
                    <select
                      value={fieldEditorData.alignment || "left"}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          alignment: e.target.value as any,
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

                {/* Position & Size */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        X Position
                      </label>
                      <input
                        type="number"
                        value={fieldEditorData.x || 100}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            x: parseInt(e.target.value),
                          })
                        }
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Y Position
                      </label>
                      <input
                        type="number"
                        value={fieldEditorData.y || 100}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            y: parseInt(e.target.value),
                          })
                        }
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Width
                      </label>
                      <input
                        type="number"
                        value={fieldEditorData.width || 150}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            width: parseInt(e.target.value),
                          })
                        }
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Height
                      </label>
                      <input
                        type="number"
                        value={fieldEditorData.height || 40}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            height: parseInt(e.target.value),
                          })
                        }
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>

                  {(fieldEditorData.type === "image" ||
                    fieldEditorData.type === "signature") && (
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={fieldEditorData.lockAspect ?? true}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            lockAspect: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      Lock Aspect Ratio
                    </label>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Font Size
                    </label>
                    <input
                      type="number"
                      value={fieldEditorData.fontSize || 16}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          fontSize: parseInt(e.target.value),
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Sub-elements (Labels/Captions) */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Labels & Captions (
                    {(fieldEditorData.subElements || []).length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const newSubElement: SubElement = {
                        id: `sub-${Date.now()}`,
                        type: "caption",
                        content: "New Label",
                        position: "bottom",
                        offsetX: 0,
                        offsetY: 0,
                        fontSize: 12,
                        textColor: "#6b7280",
                        isBold: false,
                        isItalic: false,
                      };
                      setFieldEditorData({
                        ...fieldEditorData,
                        subElements: [
                          ...(fieldEditorData.subElements || []),
                          newSubElement,
                        ],
                      });
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-1 px-3 rounded transition-colors duration-300"
                  >
                    + Add Label
                  </button>
                </div>

                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {(fieldEditorData.subElements || []).map((subEl, index) => (
                    <div
                      key={subEl.id}
                      className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Content
                          </label>
                          <input
                            type="text"
                            value={subEl.content}
                            onChange={(e) => {
                              const updated = [
                                ...(fieldEditorData.subElements || []),
                              ];
                              updated[index] = {
                                ...subEl,
                                content: e.target.value,
                              };
                              setFieldEditorData({
                                ...fieldEditorData,
                                subElements: updated,
                              });
                            }}
                            className="w-full text-sm border border-gray-300 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            placeholder="Label text"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Position
                          </label>
                          <select
                            value={subEl.position}
                            onChange={(e) => {
                              const updated = [
                                ...(fieldEditorData.subElements || []),
                              ];
                              updated[index] = {
                                ...subEl,
                                position: e.target
                                  .value as SubElement["position"],
                              };
                              setFieldEditorData({
                                ...fieldEditorData,
                                subElements: updated,
                              });
                            }}
                            className="w-full text-sm border border-gray-300 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          >
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Font Size
                          </label>
                          <input
                            type="number"
                            value={subEl.fontSize}
                            onChange={(e) => {
                              const updated = [
                                ...(fieldEditorData.subElements || []),
                              ];
                              updated[index] = {
                                ...subEl,
                                fontSize: parseInt(e.target.value) || 12,
                              };
                              setFieldEditorData({
                                ...fieldEditorData,
                                subElements: updated,
                              });
                            }}
                            className="w-full text-sm border border-gray-300 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            min="8"
                            max="24"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Color
                          </label>
                          <input
                            type="color"
                            value={subEl.textColor}
                            onChange={(e) => {
                              const updated = [
                                ...(fieldEditorData.subElements || []),
                              ];
                              updated[index] = {
                                ...subEl,
                                textColor: e.target.value,
                              };
                              setFieldEditorData({
                                ...fieldEditorData,
                                subElements: updated,
                              });
                            }}
                            className="w-full h-8 border border-gray-300 rounded"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-3">
                          <label className="flex items-center text-xs text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={subEl.isBold}
                              onChange={(e) => {
                                const updated = [
                                  ...(fieldEditorData.subElements || []),
                                ];
                                updated[index] = {
                                  ...subEl,
                                  isBold: e.target.checked,
                                };
                                setFieldEditorData({
                                  ...fieldEditorData,
                                  subElements: updated,
                                });
                              }}
                              className="mr-1"
                            />
                            Bold
                          </label>
                          <label className="flex items-center text-xs text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={subEl.isItalic}
                              onChange={(e) => {
                                const updated = [
                                  ...(fieldEditorData.subElements || []),
                                ];
                                updated[index] = {
                                  ...subEl,
                                  isItalic: e.target.checked,
                                };
                                setFieldEditorData({
                                  ...fieldEditorData,
                                  subElements: updated,
                                });
                              }}
                              className="mr-1"
                            />
                            Italic
                          </label>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = (
                              fieldEditorData.subElements || []
                            ).filter((_, i) => i !== index);
                            setFieldEditorData({
                              ...fieldEditorData,
                              subElements: updated,
                            });
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded transition-colors duration-300"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {(!fieldEditorData.subElements ||
                    fieldEditorData.subElements.length === 0) && (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                      No labels or captions added yet. Click "Add Label" to get
                      started.
                    </div>
                  )}
                </div>
              </div>

              {/* Styling Options */}
              <div className="mt-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Styling Options
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Text Color
                    </label>
                    <input
                      type="color"
                      value={fieldEditorData.textColor || "#000000"}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          textColor: e.target.value,
                        })
                      }
                      className="w-full h-10 border border-gray-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Background Color
                    </label>
                    <input
                      type="color"
                      value={fieldEditorData.backgroundColor || "#ffffff"}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          backgroundColor: e.target.value,
                        })
                      }
                      className="w-full h-10 border border-gray-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Border Color
                    </label>
                    <input
                      type="color"
                      value={fieldEditorData.borderColor || "#e5e7eb"}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          borderColor: e.target.value,
                        })
                      }
                      className="w-full h-10 border border-gray-300 rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Border Width
                    </label>
                    <input
                      type="number"
                      value={fieldEditorData.borderWidth || 1}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          borderWidth: parseInt(e.target.value),
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Border Radius
                    </label>
                    <input
                      type="number"
                      value={fieldEditorData.borderRadius || 6}
                      onChange={(e) =>
                        setFieldEditorData({
                          ...fieldEditorData,
                          borderRadius: parseInt(e.target.value),
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={fieldEditorData.isBold || false}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            isBold: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      Bold
                    </label>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={fieldEditorData.isItalic || false}
                        onChange={(e) =>
                          setFieldEditorData({
                            ...fieldEditorData,
                            isItalic: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      Italic
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveField}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
                >
                  Save Field
                </button>
                <button
                  onClick={() => setShowFieldEditor(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bill Preview Modal */}
        {showBillPreview && previewTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Bill Preview - {previewTemplate.name}
                  </h3>
                  <button
                    onClick={() => setShowBillPreview(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                  >
                    ×
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    onClick={exportToPDF}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors duration-300 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Export PDF
                  </button>
                  <button
                    onClick={exportToWord}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors duration-300 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Export Word (RTF)
                  </button>
                  <button
                    onClick={exportAsImage}
                    className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors duration-300 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Export Image
                  </button>
                  <button
                    onClick={printBill}
                    className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors duration-300 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                      />
                    </svg>
                    Print
                  </button>
                  <button
                    onClick={() => {
                      setCurrentTemplate(previewTemplate);
                      setShowBillPreview(false);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors duration-300 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit Template
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-auto max-h-[calc(90vh-200px)]">
                <div className="flex justify-center">
                  <div className="border border-gray-300 rounded-lg overflow-hidden shadow-lg">
                    <canvas
                      ref={billCanvasRef}
                      width={previewTemplate.width}
                      height={previewTemplate.height}
                      className="max-w-full h-auto"
                      style={{
                        maxWidth: "100%",
                        height: "auto",
                        display: "block",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Template Settings Modal */}
        {showTemplateSettings && currentTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Template Settings
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={currentTemplate.name}
                    onChange={(e) => {
                      saveStateForUndo();
                      const updatedTemplate = {
                        ...currentTemplate,
                        name: e.target.value,
                      };
                      setCurrentTemplate(updatedTemplate);
                      setTemplates((prev) =>
                        prev.map((t) =>
                          t.id === currentTemplate.id ? updatedTemplate : t
                        )
                      );
                    }}
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Enter template name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={currentTemplate.description}
                    onChange={(e) => {
                      saveStateForUndo();
                      const updatedTemplate = {
                        ...currentTemplate,
                        description: e.target.value,
                      };
                      setCurrentTemplate(updatedTemplate);
                      setTemplates((prev) =>
                        prev.map((t) =>
                          t.id === currentTemplate.id ? updatedTemplate : t
                        )
                      );
                    }}
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-vertical"
                    placeholder="Enter template description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Width (px)
                    </label>
                    <input
                      type="number"
                      value={currentTemplate.width}
                      onChange={(e) => {
                        saveStateForUndo();
                        const newWidth = Math.max(
                          400,
                          parseInt(e.target.value) || 800
                        );
                        const updatedTemplate = {
                          ...currentTemplate,
                          width: newWidth,
                        };
                        setCurrentTemplate(updatedTemplate);
                        setTemplates((prev) =>
                          prev.map((t) =>
                            t.id === currentTemplate.id ? updatedTemplate : t
                          )
                        );
                      }}
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      min="400"
                      max="2000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Height (px)
                    </label>
                    <input
                      type="number"
                      value={currentTemplate.height}
                      onChange={(e) => {
                        saveStateForUndo();
                        const newHeight = Math.max(
                          400,
                          parseInt(e.target.value) || 1120
                        );
                        const updatedTemplate = {
                          ...currentTemplate,
                          height: newHeight,
                        };
                        setCurrentTemplate(updatedTemplate);
                        setTemplates((prev) =>
                          prev.map((t) =>
                            t.id === currentTemplate.id ? updatedTemplate : t
                          )
                        );
                      }}
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      min="400"
                      max="2000"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Template Info
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Fields: {currentTemplate.fields.length} • Created:{" "}
                    {currentTemplate.createdAt.toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowTemplateSettings(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors duration-300"
                >
                  Close
                </button>
                <button
                  onClick={() => {
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
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors duration-300"
                >
                  Duplicate Template
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!currentTemplate && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              Advanced Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🎨</span>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Advanced Styling
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Custom colors, fonts, borders, and positioning
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🖱️</span>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Drag & Drop
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Visual field positioning and resizing
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚙️</span>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Professional
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Create business-ready bill templates
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
