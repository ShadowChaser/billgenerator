"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";

// Minimal copy of the Advanced template types for runtime use
// These align with `src/app/bills/advanced/page.tsx`
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
  value?: string; // will be overridden by form
  type: "text" | "number" | "date" | "amount" | "textarea" | "select" | "image" | "signature";
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
  lockAspect?: boolean;
  subElements?: SubElement[];
}

interface Template {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  createdAt?: string | Date;
  background?: string; // optional background image data URL
  fields: TemplateField[];
}

function isTemplate(obj: any): obj is Template {
  return obj && Array.isArray(obj.fields) && typeof obj.width === "number" && typeof obj.height === "number";
}

export default function CustomTemplateBillPage() {
  const [template, setTemplate] = useState<Template | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [hasInbox, setHasInbox] = useState(false);
  const [restoredValues, setRestoredValues] = useState(false);

  const CUSTOM_INBOX_KEY = "hrb_custom_inbox_template_v1";

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});

  // Handle template upload (expects JSON matching Template structure)
  const onUploadTemplate = async (file: File) => {
    setLoadingTemplate(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (isTemplate(data)) {
        // Initialize form values with field default values
        const init: Record<string, string> = {};
        for (const f of data.fields) {
          init[f.id] = f.value ?? "";
        }
        setFormValues(init);
        setTemplate(data);
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(CUSTOM_INBOX_KEY, JSON.stringify(data));
            setHasInbox(true);
          }
        } catch {}
      } else {
        alert("Invalid template JSON structure.");
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      alert("Failed to parse template JSON");
    } finally {
      setLoadingTemplate(false);
    }
  };

  // Load from Advanced inbox (localStorage)
  const loadFromAdvancedInbox = useCallback(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(CUSTOM_INBOX_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (isTemplate(data)) {
        const init: Record<string, string> = {};
        for (const f of data.fields) init[f.id] = f.value ?? "";
        setFormValues(init);
        setTemplate(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(CUSTOM_INBOX_KEY);
    setHasInbox(!!raw);
    if (!template && raw) {
      // Auto-load on first visit
      loadFromAdvancedInbox();
    }
  }, [template, loadFromAdvancedInbox]);

  // Update canvas size based on the preview container width (prevents squeezing)
  useEffect(() => {
    if (!template) return;
    const el = previewContainerRef.current;
    const compute = (w: number) => {
      const baseH = typeof window !== "undefined" ? window.innerHeight : template.height;
      // Slightly larger preview height across breakpoints
      const heightFrac = baseH >= 1000 ? 0.92 : baseH >= 800 ? 0.88 : 0.8;
      const availW = Math.max(240, Math.floor(w));
      const availH = Math.max(240, Math.floor(baseH * heightFrac));
      const scale = Math.min(availW / template.width, availH / template.height, 1);
      setContainerSize({ width: Math.round(template.width * scale), height: Math.round(template.height * scale) });
    };
    if (el) {
      // Initial
      compute(el.clientWidth);
      // Observe changes
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          compute(cr.width);
        }
      });
      ro.observe(el);
      const onResize = () => compute(el.clientWidth);
      window.addEventListener("resize", onResize);
      return () => {
        ro.disconnect();
        window.removeEventListener("resize", onResize);
      };
    }
  }, [template]);

  // Restore saved form values for the current template (by id)
  useEffect(() => {
    try {
      if (!template || typeof window === "undefined") return;
      const key = `${CUSTOM_INBOX_KEY}:values:${template.id}`;
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, string>;
      setFormValues((prev) => ({ ...prev, ...saved }));
      setRestoredValues(true);
      setTimeout(() => setRestoredValues(false), 2000);
    } catch {}
  }, [template]);

  // Persist form values on change for the current template
  useEffect(() => {
    try {
      if (!template || typeof window === "undefined") return;
      const key = `${CUSTOM_INBOX_KEY}:values:${template.id}`;
      window.localStorage.setItem(key, JSON.stringify(formValues));
    } catch {}
  }, [template, formValues]);

  // Render the template + values to canvas
  const renderTemplate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !template) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1;
    const cssW = containerSize?.width ?? template.width;
    const cssH = containerSize?.height ?? template.height;
    const scaleX = cssW / template.width;
    const scaleY = cssH / template.height;
    const displayScale = Math.min(scaleX, scaleY);

    canvas.style.width = `${Math.round(template.width * displayScale)}px`;
    canvas.style.height = `${Math.round(template.height * displayScale)}px`;

    const desiredW = Math.max(1, Math.floor(template.width * displayScale * dpr));
    const desiredH = Math.max(1, Math.floor(template.height * displayScale * dpr));
    if (canvas.width !== desiredW || canvas.height !== desiredH) {
      canvas.width = desiredW;
      canvas.height = desiredH;
    }
    ctx.setTransform(displayScale * dpr, 0, 0, displayScale * dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    try { (ctx as any).imageSmoothingQuality = "high"; } catch {}

    // Clear
    ctx.clearRect(0, 0, template.width, template.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, template.width, template.height);

    // Draw template background image first, if present
    const drawBackground = (cb: () => void) => {
      const bgSrc = (template as any).background as string | undefined;
      if (!bgSrc) { cb(); return; }
      const cacheKey = "__background__";
      const cached = imageCacheRef.current[cacheKey];
      const draw = (img: HTMLImageElement) => {
        try { ctx.drawImage(img, 0, 0, template.width, template.height); } catch {}
        cb();
      };
      if (cached) return draw(cached);
      const img = new Image();
      img.onload = () => { imageCacheRef.current[cacheKey] = img; draw(img); };
      img.onerror = () => cb();
      img.src = bgSrc;
    };

    // Helper for crisp strokes and aligned borders
    const px = 1 / (displayScale * dpr);
    const snap = (v: number) => Math.round(v * displayScale * dpr) / (displayScale * dpr);
    const strokeAlignedRect = (x: number, y: number, w: number, h: number, lineWidth: number) => {
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

    const renderFields = () => {
      for (const field of template.fields) {
        const value = formValues[field.id] ?? field.value ?? "";

      // Background box (skip for images with value)
      const isImg = field.type === "image" || field.type === "signature";
      if (!(isImg && value)) {
        ctx.fillStyle = field.backgroundColor || "#ffffff";
        ctx.fillRect(field.x, field.y, field.width, field.height);
      }

      if (isImg) {
        if (value) {
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
            img.src = value;
          }
        }
      } else {
        // Text-like
        ctx.fillStyle = field.textColor || "#111827";
        ctx.font = `${field.isItalic ? "italic " : ""}${field.isBold ? "bold " : ""}${field.fontSize || 14}px sans-serif`;

        const renderText = (text: string) => {
          const lines = (text || "").toString().split("\n");
          const lineHeight = Math.round((field.fontSize || 14) * 1.35);
          // Alignment
          let x = field.x + 8;
          if (field.alignment === "center") x = field.x + field.width / 2;
          if (field.alignment === "right") x = field.x + field.width - 8;
          let y = field.y + Math.min(field.height - 8, lineHeight + 8);
          for (const ln of lines) {
            const metrics = ctx.measureText(ln);
            let drawX = x;
            if (field.alignment === "center") drawX = x - metrics.width / 2;
            if (field.alignment === "right") drawX = x - metrics.width;
            ctx.fillText(ln, drawX, y);
            y += lineHeight;
            if (y > field.y + field.height - 4) break; // clip basic overflow
          }
        };

        renderText(value);
      }
      // Always draw a border so fields remain visible on the preview
      ctx.strokeStyle = field.borderColor || "#d1d5db"; // slightly darker default
      strokeAlignedRect(field.x, field.y, field.width, field.height, (field.borderWidth || 1) * 1);
      // end for loop
      }
    };

    // Ensure background is rendered before fields
    drawBackground(renderFields);
  }, [template, formValues, containerSize]);

  useEffect(() => {
    renderTemplate();
  }, [renderTemplate]);

  // Handle field changes (including file -> dataURL for images/signatures)
  const onChangeField = async (field: TemplateField, value: string | File | null) => {
    if (field.type === "image" || field.type === "signature") {
      if (value && value instanceof File) {
        const dataUrl = await fileToDataUrl(value);
        setFormValues((prev) => ({ ...prev, [field.id]: dataUrl }));
      } else if (!value) {
        setFormValues((prev) => ({ ...prev, [field.id]: "" }));
      }
    } else {
      setFormValues((prev) => ({ ...prev, [field.id]: String(value ?? "") }));
    }
  };

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Export to PDF by drawing canvas image into a PDF
  const onExportPdf = () => {
    if (!template || !canvasRef.current) return;
    const canvas = canvasRef.current;
    // Render latest just in case
    renderTemplate();
    const png = canvas.toDataURL("image/png", 1.0);

    const pdf = new jsPDF({ orientation: template.width > template.height ? "l" : "p", unit: "pt", format: [template.width, template.height] });
    pdf.addImage(png, "PNG", 0, 0, template.width, template.height);
    pdf.save(`${template.name || "bill"}.pdf`);
  };

  const fieldControls = useMemo(() => {
    if (!template) return null;
    return template.fields.map((f) => {
      const key = f.id;
      const val = formValues[key] ?? "";
      const commonLabel = (
        <span className="text-sm md:text-xs opacity-80">{f.label || key}{f.required ? " *" : ""}</span>
      );
      if (f.type === "textarea") {
        return (
          <label key={key} className="grid gap-1">
            {commonLabel}
            <textarea
              className="w-full ring-1 ring-inset rounded px-3 py-2 md:px-3 md:py-2 bg-transparent min-h-[96px] md:min-h-[80px] resize-y leading-6 text-base md:text-sm"
              value={val}
              onChange={(e) => onChangeField(f, e.target.value)}
              placeholder={f.placeholder}
            />
          </label>
        );
      }
      if (f.type === "select") {
        return (
          <label key={key} className="grid gap-1">
            {commonLabel}
            <select
              className="w-full ring-1 ring-inset rounded px-3 py-2 md:px-3 md:py-2 bg-transparent text-base md:text-sm"
              value={val}
              onChange={(e) => onChangeField(f, e.target.value)}
            >
              <option value="">Select...</option>
              {(f.options || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
        );
      }
      if (f.type === "image" || f.type === "signature") {
        return (
          <label key={key} className="grid gap-1">
            {commonLabel}
            <input
              type="file"
              accept="image/*"
              className="w-full ring-1 ring-inset rounded px-3 py-2 md:px-3 md:py-2 bg-transparent text-base md:text-sm"
              onChange={(e) => onChangeField(f, e.target.files?.[0] ?? null)}
            />
            {val ? <span className="text-xs opacity-70">Image selected</span> : null}
          </label>
        );
      }
      const inputType = f.type === "number" || f.type === "amount" ? "number" : f.type === "date" ? "date" : "text";
      return (
        <label key={key} className="grid gap-1">
          {commonLabel}
          <input
            type={inputType}
            className="w-full ring-1 ring-inset rounded px-3 py-2 md:px-3 md:py-2 bg-transparent text-base md:text-sm"
            value={val}
            onChange={(e) => onChangeField(f, e.target.value)}
            placeholder={f.placeholder}
          />
        </label>
      );
    });
  }, [template, formValues]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start md:items-center justify-between mb-4 md:mb-6 flex-col md:flex-row gap-3 md:gap-0">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Custom Template Bill</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Upload or handoff from Advanced, fill fields, preview and export.</p>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
            {hasInbox && !template && (
              <Button variant="secondary" className="w-full md:w-auto" onClick={loadFromAdvancedInbox}>
                Load from Advanced
              </Button>
            )}
            {hasInbox && (
              <Button
                variant="secondary"
                className="w-full md:w-auto"
                onClick={loadFromAdvancedInbox}
                title="Reload template from Inbox"
              >
                Reload from Inbox
              </Button>
            )}
            <label className="w-full md:w-auto">
              <span className="inline-flex items-center justify-center px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                {loadingTemplate ? "Loading..." : "Upload Template JSON"}
              </span>
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadTemplate(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <Button className="w-full md:w-auto" variant="gradient" onClick={onExportPdf} disabled={!template}>
              Export PDF
            </Button>
          </div>
        </div>

        {/* Always-visible warning/help banner */}
        <div className="mb-4 rounded-md ring-1 ring-amber-300/70 bg-amber-50 text-amber-900 p-3 shadow-sm dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-400/40">
          <div className="font-semibold text-sm">Heads up</div>
          <div className="text-xs mt-1">
            Please add either a <span className="font-medium">proper Template JSON</span> (matching the Custom Template format)
            or <Link href="/bills/advanced" className="underline">create one from the Advanced Generator</Link> and load it here.
          </div>
        </div>
        {restoredValues && (
          <div className="mb-3 text-xs rounded-md ring-1 ring-emerald-300/60 bg-emerald-50 text-emerald-900 p-2 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-500/40">
            Restored your saved field values.
          </div>
        )}

        {!template ? (
          <Card className="border border-dashed">
            <CardContent className="p-6 text-sm text-gray-600 dark:text-gray-300">
              Upload a template JSON exported from the Advanced Generator to begin, or click "Load from Advanced".
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
            {/* Form Card */}
            <Card className="border border-gray-200 dark:border-gray-700 lg:col-span-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">Fill Fields</CardTitle>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {template?.name ? (
                    <CardDescription className="truncate">{template.name}</CardDescription>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Fields: {template?.fields?.length ?? 0}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3 md:gap-4 max-h-[75vh] overflow-y-auto pr-1 scrollbar-white min-h-[200px]">
                  {template.fields && template.fields.length > 0 ? (
                    fieldControls
                  ) : (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      This template has no editable fields.
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            {/* Preview Card (sticky) */}
            <div className="lg:col-span-8 lg:sticky lg:top-6">
              <Card className="border border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base md:text-lg">Preview</CardTitle>
                  <CardDescription>Live preview of your bill</CardDescription>
                </CardHeader>
                <CardContent>
                  <div ref={previewContainerRef} className="w-full overflow-auto rounded-md bg-white dark:bg-gray-900 flex items-center justify-center p-2 sm:p-3">
                    <canvas ref={canvasRef} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
