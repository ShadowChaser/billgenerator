"use client";

import { useCallback } from "react";
import { jsPDF } from "jspdf";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { UseFormReturn } from "react-hook-form";
import type { Landlord } from "@/lib/types";

function monthInputToDisplay(monthValue: string) {
  const names = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ];
  const [y, m] = monthValue.split("-");
  const idx = Math.max(0, Math.min(11, Number(m) - 1));
  return `${names[idx]}- ${y}`;
}

export function useBillExport(params: {
  previewHtml: string | null;
  baseHeight: number;
  form: UseFormReturn<any>;
  landlords: Landlord[];
  selectedTemplate: null | {
    id: string;
    name: string;
    width?: number;
    height?: number;
    fields: Array<{
      id: string;
      label: string;
      value?: string;
      type:
        | "text"
        | "number"
        | "date"
        | "amount"
        | "textarea"
        | "select"
        | "image"
        | "signature";
      placeholder?: string;
      options?: string[];
      required?: boolean;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      fontSize?: number;
      isBold?: boolean;
      isItalic?: boolean;
      textColor?: string;
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      borderRadius?: number;
      alignment?: "left" | "center" | "right";
    }>;
  };
  templateForm: Record<string, string>;
}) {
  const { previewHtml, baseHeight, form, landlords, selectedTemplate, templateForm } = params;

  const exportPdf = useCallback(async () => {
    if (!previewHtml) return;
    // Create an isolated wrapper with bleed padding to ensure nothing sits on the page edge
    const wrapper = document.createElement("div");
    const bleed = 24;
    const baseWidthPx = 794;
    const pageHeightPx = 1123;
    wrapper.style.position = "fixed";
    wrapper.style.left = "-10000px";
    wrapper.style.top = "0";
    wrapper.style.background = "#ffffff";
    wrapper.style.padding = `${bleed}px`;
    wrapper.style.boxSizing = "border-box";
    const inner = document.createElement("div");
    inner.style.width = `${baseWidthPx}px`;
    inner.style.minHeight = `${pageHeightPx}px`;
    inner.style.background = "#ffffff";
    inner.innerHTML = previewHtml;
    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);

    const cssDpi = 96;
    const targetDpi = 300;
    const scale = Math.min(5, Math.ceil((targetDpi / cssDpi) * Math.max(1, window.devicePixelRatio || 1)));
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(wrapper, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      windowWidth: wrapper.scrollWidth,
      windowHeight: wrapper.scrollHeight,
    });

    const pad = 24;
    const off = document.createElement("canvas");
    off.width = canvas.width + pad * 2;
    off.height = canvas.height + pad * 2;
    const octx = off.getContext("2d");
    if (!octx) {
      document.body.removeChild(wrapper);
      return;
    }
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, off.width, off.height);
    octx.drawImage(canvas, pad, pad);

    const imgData = off.toDataURL("image/png");
    const pdf = new jsPDF({
      unit: "px",
      format: [off.width, off.height],
      orientation: off.width > off.height ? "landscape" : "portrait",
      compress: false,
    });
    pdf.addImage(imgData, "PNG", 0.5, 0.5, Math.max(1, off.width - 1), Math.max(1, off.height - 1));
    pdf.save(`house-rent-bill-${Date.now()}.pdf`);

    document.body.removeChild(wrapper);
  }, [previewHtml]);

  const printPreview = useCallback(() => {
    if (!previewHtml) return;
    const bodyMatch = previewHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const inner = bodyMatch ? bodyMatch[1] : previewHtml;
    const w = window.open("", "_blank");
    if (!w) return;
    const doc = w.document;
    const html = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Print Preview</title>
        <style>
          @page { size: A4; margin: 0; }
          html, body { background: #f3f4f6; height: 100%; }
          body { margin: 0; }
          .wrap { width: 210mm; min-height: 297mm; margin: 0 auto; background: #ffffff; }
          html, body, .wrap { -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
          img { image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; }
          .wrap table { width: 100%; border-collapse: collapse; border-spacing: 0; }
          .wrap th, .wrap td { border: 0.8pt solid #1f2937; padding: 3mm 2mm; }
          .wrap thead th { border-bottom-width: 1pt; }
          .wrap tr { page-break-inside: avoid; }
          .wrap th { font-weight: 700; }
          @media print {
            html, body { background: #ffffff; }
            .wrap { width: 210mm; min-height: 297mm; margin: 0 auto; }
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }
        </style>
      </head>
      <body>
        <div class="wrap">${inner}</div>
        <script>
          window.addEventListener('load', function(){
            window.focus();
            window.print();
            setTimeout(function(){ window.close(); }, 250);
          });
        <\/script>
      </body>
    </html>`;
    doc.open();
    doc.write(html);
    doc.close();
  }, [previewHtml]);

  const exportDefaultVectorPdf = useCallback(async () => {
    if (!previewHtml) return;
    const baseWidth = 794;
    const pageHeight = Math.max(1, baseHeight);
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([baseWidth, pageHeight]);
    const fontRegular = await pdfDoc.embedStandardFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedStandardFont(StandardFonts.TimesRomanBold);

    const drawText = (
      text: string,
      x: number,
      yTop: number,
      size: number,
      opts?: { bold?: boolean; underline?: boolean; color?: ReturnType<typeof rgb> }
    ) => {
      const font = opts?.bold ? fontBold : fontRegular;
      const ascent = font.sizeAtHeight(size);
      const y = pageHeight - (yTop + ascent);
      page.drawText(text, { x, y, size, font, color: opts?.color ?? rgb(0, 0, 0) });
      if (opts?.underline) {
        const width = font.widthOfTextAtSize(text, size);
        const underlineY = y - 2;
        page.drawLine({ start: { x, y: underlineY }, end: { x: x + width, y: underlineY }, color: rgb(0, 0, 0), thickness: 0.8 });
      }
    };
    const drawCenteredText = (
      text: string,
      yTop: number,
      size: number,
      opts?: { bold?: boolean; underline?: boolean }
    ) => {
      const font = opts?.bold ? fontBold : fontRegular;
      const width = font.widthOfTextAtSize(text, size);
      const x = (baseWidth - width) / 2;
      drawText(text, x, yTop, size, opts);
    };

    page.drawRectangle({ x: 0, y: 0, width: baseWidth, height: pageHeight, color: rgb(1, 1, 1) });

    const values = form.getValues();
    const periodValue: string = values.period || format(new Date(), "yyyy-MM");
    const periodDisplay = monthInputToDisplay(periodValue);
    const billNo: string = values.bill_number || `BILL-${uuidv4().slice(0, 8).toUpperCase()}`;
    const billDateDisplay = values.date ? format(new Date(values.date), "dd-MM-yyyy") : format(new Date(), "dd-MM-yyyy");
    const agreementDisplay = values.agreement_date ? format(new Date(values.agreement_date), "do MMMM yyyy") : format(new Date(), "do MMMM yyyy");
    const landlordName = (() => {
      if (values.landlord_mode === "existing" && values.landlord_id) {
        const existing = landlords.find((l) => l.id === values.landlord_id);
        return existing?.name || "";
      }
      return (values.landlord_name || "").toString();
    })();
    const amountNum = Number(values.amount || 0);
    const rateNum = values.rate ? Number(values.rate) : amountNum;
    const amountFormatted = amountNum.toLocaleString("en-IN", { maximumFractionDigits: 0 });
    const rateFormatted = rateNum.toLocaleString("en-IN", { maximumFractionDigits: 0 });

    const padTop = 24;
    const padRight = 20;
    const padBottom = 180;
    const padLeft = 20;

    drawCenteredText("HOUSE RENT BILL", padTop, 18, { bold: true, underline: true });

    let cursorY = padTop + 20 + 18;
    const blockGap = 20; cursorY += blockGap;
    drawText(`PERIOD OF BILL: ${periodDisplay}`, padLeft, cursorY, 12, { bold: true });

    cursorY += 22;
    const leftText = `BILL NO:${billNo}`;
    const rightText = `DATE: ${billDateDisplay}`;
    drawText(leftText, padLeft, cursorY, 12, { bold: true });
    const rightW = fontBold.widthOfTextAtSize(rightText, 12);
    const rightX = baseWidth - padRight - rightW;
    drawText(rightText, rightX, cursorY, 12, { bold: true });

    cursorY += 28;
    drawText("Sir,", padLeft, cursorY, 14);
    cursorY += 20;
    const intro = `I am submitting the House rent bill of Smt. ${landlordName} (Private House) for accommodation of BtED, Basta as per Agreement Dtd. ${agreementDisplay} BETWEEN Executive Engineer, BtED, Basta and Smt. ${landlordName} for the month of ${periodDisplay}`;
    const maxTextWidth = baseHeight ? baseWidth - padLeft - padRight : baseWidth - padLeft - padRight;
    const words = intro.split(/\s+/);
    let line = "";
    const lineHeight = 12 * 1.45;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (fontRegular.widthOfTextAtSize(test, 12) <= maxTextWidth || line.length === 0) {
        line = test;
      } else {
        drawText(line, padLeft, cursorY, 12);
        cursorY += lineHeight;
        line = w;
      }
    }
    if (line) { drawText(line, padLeft, cursorY, 12); cursorY += lineHeight; }

    cursorY += 14;
    const tableX = padLeft;
    const tableYTop = cursorY;
    const tableWidth = baseWidth - padLeft - padRight;
    const col1W = Math.round(tableWidth * 0.46);
    const col2W = Math.round(tableWidth * 0.18);
    const col3W = Math.round(tableWidth * 0.18);
    const col4W = tableWidth - col1W - col2W - col3W;

    const headerSize = 12;
    const rowPadY = 8;
    const cellPadX = 6;
    const headerHeight = headerSize + rowPadY + 6;
    page.drawLine({ start: { x: tableX, y: pageHeight - (tableYTop + headerHeight) }, end: { x: tableX + tableWidth, y: pageHeight - (tableYTop + headerHeight) }, color: rgb(0, 0, 0), thickness: 1 });

    const drawCell = (text: string, x: number, yTop: number, w: number, align: "left" | "center" | "right") => {
      const textW = fontRegular.widthOfTextAtSize(text, headerSize);
      let tx = x + cellPadX;
      if (align === "center") tx = x + (w - textW) / 2;
      if (align === "right") tx = x + w - textW - cellPadX;
      drawText(text, tx, yTop + rowPadY, headerSize);
    };

    drawCell("Description", tableX, tableYTop, col1W, "left");
    drawCell("Month", tableX + col1W, tableYTop, col2W, "center");
    drawCell("Rate", tableX + col1W + col2W, tableYTop, col3W, "center");
    drawCell("Amount", tableX + col1W + col2W + col3W, tableYTop, col4W, "center");

    const dataY = tableYTop + headerHeight + 10;
    const dataSize = 12;
    const dataHeight = dataSize + rowPadY + 10;

    const drawData = (text: string, x: number, yTop: number, w: number, align: "left" | "center" | "right") => {
      const textW = fontRegular.widthOfTextAtSize(text, dataSize);
      let tx = x + cellPadX;
      if (align === "center") tx = x + (w - textW) / 2;
      if (align === "right") tx = x + w - textW - cellPadX;
      drawText(text, tx, yTop, dataSize);
    };

    drawData("HOUSE RENT", tableX, dataY, col1W, "left");
    drawData(`${periodDisplay}`, tableX + col1W, dataY, col2W, "center");
    drawData(`Rs.${rateFormatted}/- P.M`, tableX + col1W + col2W, dataY, col3W, "center");
    drawData(`Rs.${amountFormatted}/-`, tableX + col1W + col2W + col3W, dataY, col4W, "center");

    const tableHeight = headerHeight + dataHeight;
    const tableBottomY = tableYTop + tableHeight;
    page.drawRectangle({ x: tableX, y: pageHeight - tableBottomY, width: tableWidth, height: tableHeight, borderColor: rgb(0, 0, 0), borderWidth: 1 });
    const dividerY1 = pageHeight - tableYTop;
    const dividerY2 = pageHeight - tableBottomY;
    const x1 = tableX + col1W; const x2 = x1 + col2W; const x3 = x2 + col3W;
    page.drawLine({ start: { x: x1, y: dividerY2 }, end: { x: x1, y: dividerY1 }, color: rgb(0, 0, 0), thickness: 1 });
    page.drawLine({ start: { x: x2, y: dividerY2 }, end: { x: x2, y: dividerY1 }, color: rgb(0, 0, 0), thickness: 1 });
    page.drawLine({ start: { x: x3, y: dividerY2 }, end: { x: x3, y: dividerY1 }, color: rgb(0, 0, 0), thickness: 1 });

    // Signature block (same logic as in page)
    const sigBlockRight = 20;
    const sigImgMaxW = 92;
    const sigImgMaxH = 32;
    let signatureUrl: string | null = (form.getValues().signature_url as any) || null;
    const values2 = form.getValues();
    if (!signatureUrl && values2.landlord_mode === "existing" && values2.landlord_id) {
      const existing = landlords.find((l) => l.id === values2.landlord_id);
      if (existing?.signature_url) signatureUrl = existing.signature_url;
    }
    if (signatureUrl && typeof signatureUrl === "string" && signatureUrl.startsWith("data:image/")) {
      try {
        const isPng = signatureUrl.startsWith("data:image/png");
        const bin = Uint8Array.from(atob(signatureUrl.split(",")[1] || ""), (c) => c.charCodeAt(0));
        const img = isPng ? await pdfDoc.embedPng(bin) : await pdfDoc.embedJpg(bin);
        const scaleImg = Math.min(1, sigImgMaxW / img.width, sigImgMaxH / img.height);
        const dw = img.width * scaleImg;
        const dh = img.height * scaleImg;
        const boxWidth = 200;
        const boxLeft = baseWidth - sigBlockRight - boxWidth;
        const dx = boxLeft + (boxWidth - dw) / 2;
        const label1Top = pageHeight - 180 + 40;
        const gap = 6;
        const dy = pageHeight - (label1Top - gap);
        page.drawImage(img, { x: dx, y: dy, width: dw, height: dh });
      } catch {}
    }
    const labelBoxW = 200;
    const labelLeft = baseWidth - sigBlockRight - labelBoxW;
    const sigLine1 = "Signature of House";
    const sigLine2 = "Owner";
    const sig1W = fontRegular.widthOfTextAtSize(sigLine1, 12);
    const sig2W = fontRegular.widthOfTextAtSize(sigLine2, 12);
    const sig1X = labelLeft + (labelBoxW - sig1W) / 2;
    const sig2X = labelLeft + (labelBoxW - sig2W) / 2;
    drawText(sigLine1, sig1X, pageHeight - 180 + 40, 12);
    drawText(sigLine2, sig2X, pageHeight - 180 + 58, 12);

    const bytes = await pdfDoc.save();
    const ab2 = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab2).set(bytes);
    const blob = new Blob([ab2], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `house-rent-bill-vector-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [previewHtml, baseHeight, form, landlords]);

  const exportTemplateVectorPdf = useCallback(async () => {
    if (!selectedTemplate) {
      alert("No template selected");
      return;
    }
    const baseWidth = 794;
    const tplWidth = Math.max(1, selectedTemplate.width ?? 794);
    const tplHeight = Math.max(1, selectedTemplate.height ?? 1123);
    const scale = baseWidth / tplWidth;
    const scaledHeight = Math.round(tplHeight * scale);
    const safePad = 16;

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([baseWidth, scaledHeight]);
    const fontRegular = await pdfDoc.embedStandardFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold);

    const parseColorWithOpacity = (s?: string): { color: ReturnType<typeof rgb>; opacity: number } | null => {
      if (!s) return null;
      const val = s.trim().toLowerCase();
      if (val === "transparent") return null;
      if (/^#?[0-9a-f]{3}$/i.test(val)) {
        const hex = val.replace("#", "");
        const r = parseInt(hex[0] + hex[0], 16) / 255;
        const g = parseInt(hex[1] + hex[1], 16) / 255;
        const b = parseInt(hex[2] + hex[2], 16) / 255;
        return { color: rgb(r, g, b), opacity: 1 };
      }
      if (/^#?[0-9a-f]{6}$/i.test(val)) {
        const hex = val.replace("#", "");
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        return { color: rgb(r, g, b), opacity: 1 };
      }
      const m = val.match(/^rgba?\(([^)]+)\)$/);
      if (m) {
        const parts = m[1].split(",").map((p) => p.trim());
        const r = Math.min(255, Math.max(0, parseFloat(parts[0] || "0"))) / 255;
        const g = Math.min(255, Math.max(0, parseFloat(parts[1] || "0"))) / 255;
        const b = Math.min(255, Math.max(0, parseFloat(parts[2] || "0"))) / 255;
        const a = parts[3] !== undefined ? Math.min(1, Math.max(0, parseFloat(parts[3]))) : 1;
        return { color: rgb(r, g, b), opacity: a };
      }
      return null;
    };

    const drawWrappedText = (
      text: string,
      opts: { x: number; y: number; maxWidth: number; lineHeight: number; fontSize: number; align: "left" | "center" | "right"; bold?: boolean; color: ReturnType<typeof rgb> }
    ) => {
      const font = opts.bold ? fontBold : fontRegular;
      const words = text.split(/\s+/);
      let line = "";
      let cursorY = opts.y;
      const lines: string[] = [];
      for (const w of words) {
        const test = line ? line + " " + w : w;
        const width = font.widthOfTextAtSize(test, opts.fontSize);
        if (width <= opts.maxWidth || line.length === 0) {
          line = test;
        } else {
          lines.push(line);
          line = w;
        }
      }
      if (line) lines.push(line);
      const ascent = font.sizeAtHeight(opts.fontSize);
      for (let i = 0; i < lines.length; i++) {
        const s = lines[i];
        const w = font.widthOfTextAtSize(s, opts.fontSize);
        let x = opts.x;
        if (opts.align === "center") x = opts.x + (opts.maxWidth - w) / 2;
        if (opts.align === "right") x = opts.x + (opts.maxWidth - w);
        const yBaseline = scaledHeight - (cursorY + ascent);
        page.drawText(s, { x, y: yBaseline, size: opts.fontSize, font, color: opts.color });
        cursorY += opts.lineHeight;
      }
    };

    page.drawRectangle({ x: 0, y: 0, width: baseWidth, height: scaledHeight, color: rgb(1, 1, 1) });

    for (const f of selectedTemplate.fields) {
      const v = (templateForm[f.id] ?? f.value ?? "").toString();
      const x = Math.round((f.x ?? 0) * scale) + safePad;
      const y = Math.round((f.y ?? 0) * scale) + safePad;
      const w = Math.max(1, Math.round((f.width ?? 120) * scale));
      const h = Math.max(1, Math.round((f.height ?? 24) * scale));
      const fs = Math.max(8, Math.round((f.fontSize ?? 12) * scale));
      const isBold = Boolean(f.isBold);
      const align = f.alignment ?? "left";
      const textParsed = parseColorWithOpacity(f.textColor || "#000000");
      const textColor = textParsed?.color || rgb(0, 0, 0);
      const bgParsed = parseColorWithOpacity(f.backgroundColor);
      const borderWidth = Math.max(0, Math.round((f.borderWidth ?? 0) * scale));
      const borderParsed = parseColorWithOpacity(f.borderColor);
      const borderColor = borderParsed?.color || rgb(0, 0, 0);

      if (bgParsed) {
        page.drawRectangle({ x, y: scaledHeight - (y + h), width: w, height: h, color: bgParsed.color, opacity: bgParsed.opacity });
      }
      if (borderWidth > 0) {
        page.drawRectangle({ x, y: scaledHeight - (y + h), width: w, height: h, borderColor, borderWidth, opacity: borderParsed?.opacity ?? 1 });
      }

      if (f.type === "image" || f.type === "signature") {
        const src = v || "";
        if (src.startsWith("data:image/")) {
          try {
            const isPng = src.startsWith("data:image/png");
            const bin = Uint8Array.from(atob(src.split(",")[1] || ""), (c) => c.charCodeAt(0));
            const img = isPng ? await pdfDoc.embedPng(bin) : await pdfDoc.embedJpg(bin);
            const imgW = img.width;
            const imgH = img.height;
            const scaleImg = Math.min(w / imgW, h / imgH);
            const dw = imgW * scaleImg;
            const dh = imgH * scaleImg;
            const dx = x + (w - dw) / 2;
            const dy = scaledHeight - (y + (h + dh) / 2);
            page.drawImage(img, { x: dx, y: dy, width: dw, height: dh });
          } catch {}
        }
        continue;
      }

      const padding = 6;
      const contentX = x + padding;
      const contentY = y + padding;
      const contentW = Math.max(1, w - padding * 2);
      const lineHeight = Math.round(fs * 1.32);
      const paragraphs = v.split(/\r?\n/);
      let currentY = contentY;
      for (const para of paragraphs) {
        drawWrappedText(para, { x: contentX, y: currentY, maxWidth: contentW, lineHeight, fontSize: fs, align, bold: isBold, color: textColor });
        const fontUse = isBold ? fontBold : fontRegular;
        const words = para.split(/\s+/);
        let line2 = "";
        let lines = 0;
        for (const w2 of words) {
          const t = line2 ? line2 + " " + w2 : w2;
          if (fontUse.widthOfTextAtSize(t, fs) <= contentW || line2.length === 0) {
            line2 = t;
          } else {
            lines += 1; line2 = w2;
          }
        }
        if (line2) lines += 1;
        currentY += lines * lineHeight;
      }
    }

    const bytes = await pdfDoc.save();
    const ab2 = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab2).set(bytes);
    const blob = new Blob([ab2], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const name = (selectedTemplate.name || "template").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    a.href = url;
    a.download = `${name}_vector.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [selectedTemplate, templateForm]);

  return { exportPdf, printPreview, exportDefaultVectorPdf, exportTemplateVectorPdf } as const;
}
