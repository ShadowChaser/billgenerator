"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type ResizeHandle = null | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

export default function AdvancedBillGeneratorPage() {
  // Templates state (simple local list)
  const [templates, setTemplates] = useState<Template[]>(() => {
    const initial: Template = {
      id: "tpl-1",
      name: "Default Template",
      description: "A starter template",
      width: 800,
      height: 1120,
      createdAt: new Date(),
      fields: [],
    };
    return [initial];
  });

  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedField, setSelectedField] = useState<TemplateField | null>(null);
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Drag to move
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const resizeOriginRef = useRef<{ startX: number; startY: number; field: TemplateField | null }>({
    startX: 0,
    startY: 0,
    field: null,
  });

  // Field editor modal
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [isFieldEditorMode, setIsFieldEditorMode] = useState<"create" | "edit">("create");
  const [fieldEditorData, setFieldEditorData] = useState<Partial<TemplateField>>({});

  // Image cache for drawing
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});

  // Select first template by default
  useEffect(() => {
    if (!currentTemplate && templates.length > 0) setCurrentTemplate(templates[0]);
  }, [templates, currentTemplate]);

  // CRUD helpers
  const updateField = (id: string, patch: Partial<TemplateField>) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id !== (currentTemplate?.id || t.id)
          ? t
          : {
              ...t,
              fields: t.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
            }
      )
    );
    // also update local currentTemplate state reference
    setCurrentTemplate((ct) =>
      ct && ct.id === (currentTemplate?.id || ct.id)
        ? { ...ct, fields: ct.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }
        : ct
    );
  };

  const deleteField = (id: string) => {
    if (!currentTemplate) return;
    setTemplates((prev) =>
      prev.map((t) => (t.id === currentTemplate.id ? { ...t, fields: t.fields.filter((f) => f.id !== id) } : t))
    );
    setCurrentTemplate((ct) => (ct ? { ...ct, fields: ct.fields.filter((f) => f.id !== id) } : ct));
    setSelectedField(null);
  };

  // Render template to canvas
  const renderTemplate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentTemplate) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw fields
    for (const field of currentTemplate.fields) {
      // Box background
      if (!((field.type === "image" || field.type === "signature") && field.value)) {
        ctx.fillStyle = field.backgroundColor || "#ffffff";
        ctx.fillRect(field.x, field.y, field.width, field.height);
        ctx.strokeStyle = field.borderColor || "#e5e7eb";
        ctx.lineWidth = field.borderWidth || 1;
        ctx.strokeRect(field.x, field.y, field.width, field.height);
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
        ctx.font = `${field.isItalic ? "italic " : ""}${field.isBold ? "bold " : ""}${field.fontSize || 16}px sans-serif`;
        ctx.textBaseline = "middle";
        let tx = field.x + 8;
        if (field.alignment === "center") tx = field.x + field.width / 2;
        if (field.alignment === "right") tx = field.x + field.width - 8;
        ctx.textAlign = field.alignment as CanvasTextAlign;
        const content = field.value || field.placeholder || field.label || "";
        ctx.fillText(content, tx, field.y + field.height / 2, field.width - 16);
      }

      // Draw sub-elements (labels, captions)
      if (field.subElements && field.subElements.length > 0) {
        field.subElements.forEach((subEl) => {
          ctx.fillStyle = subEl.textColor;
          ctx.font = `${subEl.isItalic ? "italic " : ""}${subEl.isBold ? "bold " : ""}${subEl.fontSize}px sans-serif`;
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
            ctx.strokeRect(dx - 2, dy - 2, dw + 4, dh + 4);
          } else {
            ctx.strokeRect(field.x - 2, field.y - 2, field.width + 4, field.height + 4);
          }
        } else {
          ctx.strokeRect(field.x - 2, field.y - 2, field.width + 4, field.height + 4);
        }
        
        ctx.setLineDash([]);
        drawResizeHandles(ctx, field);
      }
    }
  }, [currentTemplate, selectedField]);

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
    
    // Calculate scale factors in case of any CSS scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Get mouse position relative to canvas
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // Ensure coordinates are within canvas bounds
    return {
      x: Math.max(0, Math.min(x, canvas.width)),
      y: Math.max(0, Math.min(y, canvas.height))
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
          if (px >= f.x && px <= f.x + f.width && py >= f.y && py <= f.y + f.height) return f;
        }
      } else {
        // For non-image fields, use full field area
        if (px >= f.x && px <= f.x + f.width && py >= f.y && py <= f.y + f.height) return f;
      }
    }
    return null;
  }

  function drawResizeHandles(ctx: CanvasRenderingContext2D, field: TemplateField) {
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
  };

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
    
    const handles: { key: Exclude<ResizeHandle, null>; x: number; y: number }[] = [
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
      if (Math.abs(px - h.x) <= size && Math.abs(py - h.y) <= size) return h.key;
    }
    return null;
  };

  // Mouse handlers
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !currentTemplate) return;
    const { x, y } = getMousePos(event);
    const clickedField = hitTest(x, y);
    if (clickedField) {
      setSelectedField(clickedField);
      const handle = getHandleAtPosition(x, y, clickedField);
      if (handle) {
        setIsResizing(true);
        setResizeHandle(handle);
        resizeOriginRef.current = { startX: x, startY: y, field: { ...clickedField } };
      } else {
        setIsDragging(true);
        setDragOffset({ x: x - clickedField.x, y: y - clickedField.y });
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
      // Allow moving to canvas edges (0,0) and constrain within canvas bounds
      const canvasWidth = currentTemplate.width;
      const canvasHeight = currentTemplate.height;
      
      // Allow fields to be positioned exactly at the edges
      const constrainedX = Math.max(0, Math.min(nx, canvasWidth - selectedField.width));
      const constrainedY = Math.max(0, Math.min(ny, canvasHeight - selectedField.height));
      
      // Only update if position actually changed
      if (selectedField.x !== constrainedX || selectedField.y !== constrainedY) {
        updateField(selectedField.id, { x: constrainedX, y: constrainedY });
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
      const lockAspect = !!orig.lockAspect && (orig.type === "image" || orig.type === "signature");
      const aspect = orig.width / Math.max(1, orig.height);

      const applyAspect = () => {
        if (!lockAspect) return;
        if (resizeHandle === "n" || resizeHandle === "s") newW = Math.max(minSize, newH * aspect);
        else if (resizeHandle === "e" || resizeHandle === "w") newH = Math.max(minSize, newW / aspect);
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
      const constrainedX = Math.max(0, Math.min(newX, canvasWidth - Math.max(minSize, newW)));
      const constrainedY = Math.max(0, Math.min(newY, canvasHeight - Math.max(minSize, newH)));
      const constrainedW = Math.min(Math.max(minSize, newW), canvasWidth - constrainedX);
      const constrainedH = Math.min(Math.max(minSize, newH), canvasHeight - constrainedY);
      
      updateField(orig.id, { 
        x: constrainedX, 
        y: constrainedY, 
        width: constrainedW, 
        height: constrainedH 
      });
      return;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    resizeOriginRef.current = { startX: 0, startY: 0, field: null };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !currentTemplate) return;
    const { x, y } = getMousePos(e);
    const f = hitTest(x, y);
    setSelectedField(f);
  };


  const createNewTemplate = () => {
    const idx = templates.length + 1;
    const defaultFields: TemplateField[] = [
      {
        id: `fld-customer-${Date.now()}`,
        label: "Customer Name",
        value: "",
        type: "text",
        x: 50,
        y: 100,
        width: 300,
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
        subElements: []
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
        subElements: []
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
        subElements: []
      },
      {
        id: `fld-description-${Date.now() + 3}`,
        label: "Description",
        value: "",
        type: "textarea",
        x: 50,
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
        subElements: []
      },
      {
        id: `fld-signature-${Date.now() + 4}`,
        label: "Signature",
        value: "",
        type: "signature",
        x: 50,
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
            isItalic: true
          }
        ]
      }
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
    setTemplates((prev) => [t, ...prev]);
    setCurrentTemplate(t);
  };

  const openFieldEditor = (field?: TemplateField, mode: "create" | "edit" = "create") => {
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
      setTemplates((prev) => prev.map((t) => (t.id === currentTemplate.id ? { ...t, fields: [...t.fields, field] } : t)));
      setCurrentTemplate((ct) => (ct ? { ...ct, fields: [...ct.fields, field] } : ct));
    } else {
      updateField(field.id, field);
    }
    setShowFieldEditor(false);
  };

  const saveTemplate = () => {
    // local only, already synced to state
    alert("Template saved locally.");
  };

  const exportCurrentCanvasToPdf = () => {
    alert("Export to PDF not implemented in this demo.");
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
          height: Math.round(newHeight)
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const generateBill = (template: Template) => {
    const billData = template.fields.reduce((acc, f) => {
      acc[f.label] = f.value;
      return acc;
    }, {} as Record<string, string>);
    console.log("Generated bill data:", billData);
    alert("Bill generated! Check console for data.");
  };

  const deleteTemplate = (templateId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    setCurrentTemplate((ct) => (ct && ct.id === templateId ? null : ct));
    setSelectedField(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">🚀 Advanced Template Builder</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Create professional bill templates with advanced styling, positioning, and customization options!
          </p>
        </div>

        {/* Template Management */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Templates</h2>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTemplateSettings(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
              >
                ⚙️ Template Settings
              </button>
              <button
                onClick={createNewTemplate}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
              >
                ✨ Create New Template
              </button>
            </div>
          </div>

          {/* Templates List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div key={template.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{template.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{template.description}</p>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {template.fields.length} fields • Created {template.createdAt.toLocaleDateString()}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentTemplate(template)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-3 rounded transition-colors duration-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => generateBill(template)}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-sm py-1 px-3 rounded transition-colors duration-300"
                  >
                    Generate Bill
                  </button>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm py-1 px-3 rounded transition-colors duration-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {templates.length === 0 && (
            <div className="text-center py-8 text-gray-500">No templates yet. Create your first advanced template to get started!</div>
          )}
        </div>

        {/* Template Editor */}
        {currentTemplate && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{currentTemplate.name}</h3>
                <p className="text-gray-600 dark:text-gray-400">{currentTemplate.fields.length} fields • Advanced styling enabled</p>
              </div>

              <div className="flex gap-3">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
                  >
                    ✏️ Edit Template
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => openFieldEditor(undefined, "create")}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
                    >
                      ➕ Add Field
                    </button>
                    <button
                      onClick={exportCurrentCanvasToPdf}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
                    >
                      🖨️ Export PDF
                    </button>
                    <button
                      onClick={saveTemplate}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
                    >
                      💾 Save Template
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300"
                    >
                      ❌ Cancel Editing
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Template Canvas */}
            <div className="flex justify-center mb-6 overflow-auto">
              <div 
                className="relative bg-white"
                style={{
                  width: currentTemplate.width,
                  height: currentTemplate.height,
                  minWidth: currentTemplate.width,
                  minHeight: currentTemplate.height
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={currentTemplate.width}
                  height={currentTemplate.height}
                  className="absolute top-0 left-0 w-full h-full border-2 border-gray-300 rounded-lg"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onClick={handleCanvasClick}
                  style={{ 
                    cursor: isEditing ? "move" : "default",
                    touchAction: 'none'
                  }}
                />

                {isEditing && (
                  <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg border">
                    <p className="text-xs text-gray-600 dark:text-gray-400">💡 Drag fields to reposition • Click to select</p>
                  </div>
                )}
              </div>
            </div>

            {/* Fields Panel */}
            {isEditing && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Template Fields ({currentTemplate.fields.length})</h4>
                  <button
                    onClick={() => openFieldEditor(undefined, "create")}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 px-4 rounded-lg transition-colors duration-300"
                  >
                    ➕ Add New Field
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {currentTemplate.fields.map((field) => (
                    <div
                      key={field.id}
                      className={`p-4 border-2 rounded-lg transition-all duration-300 ${
                        selectedField?.id === field.id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{field.type}</span>
                      </div>

                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {field.type === "image" || field.type === "signature" ? (
                          <span className="italic">{field.value ? "Image selected" : "No image"}</span>
                        ) : (
                          field.value
                        )}
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 space-y-1">
                        <div>Position: ({field.x}, {field.y})</div>
                        <div>Size: {field.width} × {field.height}</div>
                        <div>
                          Font: {field.fontSize}px {field.isBold ? "Bold" : ""} {field.isItalic ? "Italic" : ""}
                        </div>
                        <div>Align: {field.alignment}</div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => openFieldEditor(field, "edit")}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded transition-colors duration-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteField(field.id)}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded transition-colors duration-300"
                        >
                          Delete
                        </button>
                        {(field.type === "image" || field.type === "signature") && (
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

        {/* Field Editor Modal */}
        {showFieldEditor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {isFieldEditorMode === "create" ? "Add New Field" : "Edit Field"}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Basic Settings */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field Label</label>
                    <input
                      type="text"
                      value={fieldEditorData.label || ""}
                      onChange={(e) => setFieldEditorData({ ...fieldEditorData, label: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      placeholder="Enter field label"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field Type</label>
                    <select
                      value={fieldEditorData.type || "text"}
                      onChange={(e) => setFieldEditorData({ ...fieldEditorData, type: e.target.value as TemplateField["type"] })}
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Value</label>
                    {fieldEditorData.type === "image" || fieldEditorData.type === "signature" ? (
                      <div className="space-y-3">
                        {fieldEditorData.value ? (
                          <div className="flex items-start gap-3">
                            <img src={fieldEditorData.value} alt="preview" className="w-32 h-20 object-contain rounded border" />
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                className="bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded"
                                onClick={() => setFieldEditorData({ ...fieldEditorData, value: "" })}
                              >
                                Remove Image
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 dark:text-gray-400">No image selected</div>
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
                              reader.onload = () => setFieldEditorData({ ...fieldEditorData, value: reader.result as string });
                              reader.readAsDataURL(file);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">Supported: PNG, JPG, JPEG, WEBP</div>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={fieldEditorData.value || ""}
                        onChange={(e) => setFieldEditorData({ ...fieldEditorData, value: e.target.value })}
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="Enter default value"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alignment</label>
                    <select
                      value={fieldEditorData.alignment || "left"}
                      onChange={(e) => setFieldEditorData({ ...fieldEditorData, alignment: e.target.value as any })}
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">X Position</label>
                      <input
                        type="number"
                        value={fieldEditorData.x || 100}
                        onChange={(e) => setFieldEditorData({ ...fieldEditorData, x: parseInt(e.target.value) })}
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Y Position</label>
                      <input
                        type="number"
                        value={fieldEditorData.y || 100}
                        onChange={(e) => setFieldEditorData({ ...fieldEditorData, y: parseInt(e.target.value) })}
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Width</label>
                      <input
                        type="number"
                        value={fieldEditorData.width || 150}
                        onChange={(e) => setFieldEditorData({ ...fieldEditorData, width: parseInt(e.target.value) })}
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Height</label>
                      <input
                        type="number"
                        value={fieldEditorData.height || 40}
                        onChange={(e) => setFieldEditorData({ ...fieldEditorData, height: parseInt(e.target.value) })}
                        className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>

                  {(fieldEditorData.type === "image" || fieldEditorData.type === "signature") && (
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={fieldEditorData.lockAspect ?? true}
                        onChange={(e) => setFieldEditorData({ ...fieldEditorData, lockAspect: e.target.checked })}
                        className="mr-2"
                      />
                      Lock Aspect Ratio
                    </label>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Font Size</label>
                    <input
                      type="number"
                      value={fieldEditorData.fontSize || 16}
                      onChange={(e) => setFieldEditorData({ ...fieldEditorData, fontSize: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Sub-elements (Labels/Captions) */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Labels & Captions ({(fieldEditorData.subElements || []).length})
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
                        isItalic: false
                      };
                      setFieldEditorData({
                        ...fieldEditorData,
                        subElements: [...(fieldEditorData.subElements || []), newSubElement]
                      });
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-1 px-3 rounded transition-colors duration-300"
                  >
                    + Add Label
                  </button>
                </div>
                
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {(fieldEditorData.subElements || []).map((subEl, index) => (
                    <div key={subEl.id} className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Content
                          </label>
                          <input
                            type="text"
                            value={subEl.content}
                            onChange={(e) => {
                              const updated = [...(fieldEditorData.subElements || [])];
                              updated[index] = { ...subEl, content: e.target.value };
                              setFieldEditorData({ ...fieldEditorData, subElements: updated });
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
                              const updated = [...(fieldEditorData.subElements || [])];
                              updated[index] = { ...subEl, position: e.target.value as SubElement["position"] };
                              setFieldEditorData({ ...fieldEditorData, subElements: updated });
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
                              const updated = [...(fieldEditorData.subElements || [])];
                              updated[index] = { ...subEl, fontSize: parseInt(e.target.value) || 12 };
                              setFieldEditorData({ ...fieldEditorData, subElements: updated });
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
                              const updated = [...(fieldEditorData.subElements || [])];
                              updated[index] = { ...subEl, textColor: e.target.value };
                              setFieldEditorData({ ...fieldEditorData, subElements: updated });
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
                                const updated = [...(fieldEditorData.subElements || [])];
                                updated[index] = { ...subEl, isBold: e.target.checked };
                                setFieldEditorData({ ...fieldEditorData, subElements: updated });
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
                                const updated = [...(fieldEditorData.subElements || [])];
                                updated[index] = { ...subEl, isItalic: e.target.checked };
                                setFieldEditorData({ ...fieldEditorData, subElements: updated });
                              }}
                              className="mr-1"
                            />
                            Italic
                          </label>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (fieldEditorData.subElements || []).filter((_, i) => i !== index);
                            setFieldEditorData({ ...fieldEditorData, subElements: updated });
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded transition-colors duration-300"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {(!fieldEditorData.subElements || fieldEditorData.subElements.length === 0) && (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                      No labels or captions added yet. Click "Add Label" to get started.
                    </div>
                  )}
                </div>
              </div>

              {/* Styling Options */}
              <div className="mt-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Styling Options</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Text Color</label>
                    <input
                      type="color"
                      value={fieldEditorData.textColor || "#000000"}
                      onChange={(e) => setFieldEditorData({ ...fieldEditorData, textColor: e.target.value })}
                      className="w-full h-10 border border-gray-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Background Color</label>
                    <input
                      type="color"
                      value={fieldEditorData.backgroundColor || "#ffffff"}
                      onChange={(e) => setFieldEditorData({ ...fieldEditorData, backgroundColor: e.target.value })}
                      className="w-full h-10 border border-gray-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Border Color</label>
                    <input
                      type="color"
                      value={fieldEditorData.borderColor || "#e5e7eb"}
                      onChange={(e) => setFieldEditorData({ ...fieldEditorData, borderColor: e.target.value })}
                      className="w-full h-10 border border-gray-300 rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Border Width</label>
                    <input
                      type="number"
                      value={fieldEditorData.borderWidth || 1}
                      onChange={(e) => setFieldEditorData({ ...fieldEditorData, borderWidth: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Border Radius</label>
                    <input
                      type="number"
                      value={fieldEditorData.borderRadius || 6}
                      onChange={(e) => setFieldEditorData({ ...fieldEditorData, borderRadius: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={fieldEditorData.isBold || false}
                        onChange={(e) => setFieldEditorData({ ...fieldEditorData, isBold: e.target.checked })}
                        className="mr-2"
                      />
                      Bold
                    </label>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={fieldEditorData.isItalic || false}
                        onChange={(e) => setFieldEditorData({ ...fieldEditorData, isItalic: e.target.checked })}
                        className="mr-2"
                      />
                      Italic
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={saveField} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300">
                  Save Field
                </button>
                <button onClick={() => setShowFieldEditor(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-300">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!currentTemplate && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">Advanced Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🎨</span>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Advanced Styling</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Custom colors, fonts, borders, and positioning</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🖱️</span>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Drag & Drop</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Visual field positioning and resizing</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚙️</span>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Professional</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Create business-ready bill templates</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
