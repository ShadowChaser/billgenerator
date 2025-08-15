"use client";

import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { v4 as uuidv4 } from "uuid";

// pdf.js (use CDN worker to avoid bundler issues)
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

// Use a stable CDN URL matching the installed version in package.json (pdfjs-dist@5.4.54)
GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@5.4.54/build/pdf.worker.min.mjs";

const INBOX_KEY = "hrb_custom_inbox_template_v1";

type TemplateJSON = {
  id: string;
  name: string;
  width: number; // in px at 72dpi baseline used by pdf.js viewport
  height: number;
  background?: string; // data URL (PNG)
  fields: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    w?: number;
    h?: number;
    label?: string;
    required?: boolean;
  }>;
};

export default function PdfToTemplatePage() {
  const router = useRouter();
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [docRef, setDocRef] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.5);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderSize, setRenderSize] = useState<{ width: number; height: number } | null>(null);
  const [templateName, setTemplateName] = useState<string>("Imported PDF Template");

  // Load PDF.js document when array buffer changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pdfArrayBuffer) return;
      try {
        const loadingTask = getDocument({ data: pdfArrayBuffer });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setDocRef(pdf);
        setNumPages(pdf.numPages);
        setPageNumber(1);
      } catch (e) {
        console.error("Failed to load PDF", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfArrayBuffer]);

  const onPickPdf = useCallback(async (file: File | null) => {
    if (!file) return;
    const buf = await file.arrayBuffer();
    setPdfArrayBuffer(buf);
    setTemplateName(file.name.replace(/\.pdf$/i, "") || "Imported PDF Template");
  }, []);

  const renderPage = useCallback(async () => {
    if (!docRef || !canvasRef.current) return;
    const page = await docRef.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set for device pixel ratio to improve crispness
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    await page.render({ canvasContext: ctx, viewport }).promise;
    setRenderSize({ width: viewport.width, height: viewport.height });
  }, [docRef, pageNumber, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const exportTemplateJSON = useCallback(() => {
    if (!canvasRef.current || !renderSize) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const tpl: TemplateJSON = {
      id: uuidv4(),
      name: templateName || "Imported PDF Template",
      width: Math.round(renderSize.width),
      height: Math.round(renderSize.height),
      background: dataUrl,
      fields: [],
    };

    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(templateName || "template").replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [renderSize, templateName]);

  const useInCustom = useCallback(() => {
    if (!canvasRef.current || !renderSize) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const tpl: TemplateJSON = {
      id: uuidv4(),
      name: templateName || "Imported PDF Template",
      width: Math.round(renderSize.width),
      height: Math.round(renderSize.height),
      background: dataUrl,
      fields: [],
    };
    try {
      localStorage.setItem(INBOX_KEY, JSON.stringify(tpl));
      router.push("/bills/custom");
    } catch (e) {
      console.error("Failed to stash template", e);
    }
  }, [renderSize, templateName, router]);

  return (
    <div className="container mx-auto px-3 md:px-6 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
        {/* Controls */}
        <Card className="lg:col-span-5 border border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg">PDF → Template</CardTitle>
            <CardDescription>Upload a PDF, pick a page and export a template JSON.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:gap-4">
            <label className="grid gap-1">
              <span className="text-sm md:text-xs opacity-80">Template Name</span>
              <input
                className="w-full ring-1 ring-inset rounded px-3 py-2 bg-transparent"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Imported PDF Template"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm md:text-xs opacity-80">Upload PDF</span>
              <input
                type="file"
                accept="application/pdf"
                className="w-full ring-1 ring-inset rounded px-3 py-2 bg-transparent"
                onChange={(e) => onPickPdf(e.target.files?.[0] ?? null)}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-sm md:text-xs opacity-80">Page</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, numPages || 1)}
                  className="w-full ring-1 ring-inset rounded px-3 py-2 bg-transparent"
                  value={pageNumber}
                  onChange={(e) => setPageNumber(Math.max(1, Math.min(Number(e.target.value || 1), numPages || 1)))}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm md:text-xs opacity-80">Scale</span>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="flex gap-2">
              <Button onClick={exportTemplateJSON} disabled={!renderSize}>Export JSON</Button>
              <Button variant="secondary" onClick={useInCustom} disabled={!renderSize}>Use in Custom Template</Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <div className="lg:col-span-7 lg:sticky lg:top-6">
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">Preview</CardTitle>
              <CardDescription>Rendered PDF page</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-auto rounded-md bg-white dark:bg-gray-900 flex items-center justify-center p-2 sm:p-3">
                <canvas ref={canvasRef} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
