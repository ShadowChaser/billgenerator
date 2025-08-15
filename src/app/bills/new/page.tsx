"use client";
import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { billFormSchema, type BillFormInput } from "@/lib/validation";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { Landlord, Bill } from "@/lib/types";
import {
  computeNextNumericBillNumber,
  fileToDataUrl,
  getLandlords as getLandlordsLocal,
  saveLandlord,
  saveBill,
} from "@/lib/localStore";
import PdfUpload from "@/components/PdfUpload";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const monthNames = [
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

// Keep keys in sync with advanced editor
const TEMPLATES_KEY = "hrb_templates_v1";
const LAST_TEMPLATE_KEY = "hrb_last_template_id_v1";

function buildPeriodFromDate(date: Date) {
  return format(date, "yyyy-MM");
}

function monthInputToDisplay(monthValue: string) {
  // monthValue expected: YYYY-MM
  const [y, m] = monthValue.split("-");
  const idx = Math.max(0, Math.min(11, Number(m) - 1));
  return `${monthNames[idx]}- ${y}`;
}

export default function NewBillPage() {
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const previewInnerRef = useRef<HTMLDivElement | null>(null);
  const [baseHeight, setBaseHeight] = useState(1123);
  const [signatureFileName, setSignatureFileName] = useState<string | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm({
    resolver: zodResolver(billFormSchema),
    defaultValues: {
      bill_mode: "manual",
      date: format(new Date(), "yyyy-MM-dd"),
      agreement_date: format(new Date(), "yyyy-MM-dd"),
      period: buildPeriodFromDate(new Date()),
      landlord_mode: "manual",
      landlord_name: "",
    },
  });

  // Templates from Advanced Editor (localStorage) with fields
  type TemplateField = {
    id: string;
    label: string;
    value?: string;
    type: "text" | "number" | "date" | "amount" | "textarea" | "select" | "image" | "signature";
    placeholder?: string;
    options?: string[];
    required?: boolean;
    // layout/style from advanced editor (optional)
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
  };
  type FullTemplate = {
    id: string;
    name: string;
    description?: string;
    width?: number;
    height?: number;
    fields: TemplateField[];
  };
  const [templates, setTemplates] = useState<FullTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;
  const [templateForm, setTemplateForm] = useState<Record<string, string>>({});
  const [templateErrors, setTemplateErrors] = useState<string[]>([]);

  // Map templateForm values into the existing bill form so that validation and onSubmit work
  const syncTemplateToForm = () => {
    if (!selectedTemplate) return;
    // Always ensure some defaults
    form.setValue("bill_mode", "manual");
    form.setValue("landlord_mode", form.getValues("landlord_mode") || "manual");

    for (const f of selectedTemplate.fields) {
      const raw = (templateForm[f.id] ?? "").toString().trim();
      if (!raw) continue;
      const lbl = (f.label || "").toLowerCase();

      // signature
      if ((f.type === "signature" || f.type === "image") && raw.startsWith("data:")) {
        form.setValue("signature_url", raw);
        continue;
      }

      // amount
      if (lbl.includes("amount")) {
        const digits = raw.replace(/[^0-9.\-]/g, "");
        if (digits) form.setValue("amount", digits);
        continue;
      }

      // rate
      if (lbl.includes("rate")) {
        const digits = raw.replace(/[^0-9.\-]/g, "");
        if (digits) form.setValue("rate", digits);
        continue;
      }

      // landlord name
      if (lbl.includes("landlord") && !lbl.includes("id")) {
        form.setValue("landlord_mode", "manual");
        form.setValue("landlord_name", raw);
        continue;
      }

      // period / month (expects YYYY-MM)
      if (lbl.includes("period") || lbl.includes("month")) {
        const normalized = (() => {
          // Try direct YYYY-MM
          const m1 = raw.match(/(20\d{2})[-\/](0?[1-9]|1[0-2])/);
          if (m1) return `${m1[1]}-${String(m1[2]).padStart(2, "0")}`;
          // Try Month-YYYY
          const m2 = raw.match(/([a-zA-Z]+)[^0-9]*(20\d{2})/);
          if (m2) {
            const monthNamesLower = [
              "january","february","march","april","may","june",
              "july","august","september","october","november","december",
            ];
            const idx = monthNamesLower.indexOf(m2[1].toLowerCase());
            if (idx >= 0) return `${m2[2]}-${String(idx + 1).padStart(2, "0")}`;
          }
          return "";
        })();
        if (normalized) form.setValue("period", normalized);
        continue;
      }

      // bill date
      if (lbl === "date" || lbl.includes("bill date")) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          form.setValue("date", format(d, "yyyy-MM-dd"));
        }
        continue;
      }

      // agreement date
      if (lbl.includes("agreement") && lbl.includes("date")) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          form.setValue("agreement_date", format(d, "yyyy-MM-dd"));
        }
        continue;
      }
    }
  };

  const submitFromTemplate = async () => {
    // For template preview, do not block on full bill validation (landlord_name, etc.)
    // Just sync helpful fields into RHF for later submission and render preview now.
    setTemplateErrors([]);
    syncTemplateToForm();
    await new Promise((r) => setTimeout(r, 0));
    if (selectedTemplate) {
      const html = buildTemplatePreviewHtml(selectedTemplate, templateForm);
      setPreviewHtml(html);
      return;
    }
    // Fallback: if no template somehow, run normal validation/submit
    const ok = await form.trigger();
    if (ok) {
      form.handleSubmit(onSubmit)();
    } else {
      const errs = Object.entries(form.formState.errors).map(([k, v]) => `${k}: ${(v as any)?.message || "Invalid"}`);
      setTemplateErrors(errs);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const loadTemplates = () => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(TEMPLATES_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      // eslint-disable-next-line no-console
      console.log("[NewBill] Read templates from localStorage:", Array.isArray(arr) ? arr.length : 0);
      if (Array.isArray(arr)) {
        const nextTemplates: FullTemplate[] = arr.map((t: any, tplIdx: number) => ({
          // Ensure a non-empty, stable-ish id for selection
          id: (() => {
            const raw = String(t.id ?? "").trim();
            if (raw) return raw;
            const base = (t.name ? String(t.name) : "Template").replace(/\s+/g, "-").toLowerCase();
            return `tpl-${base}-${tplIdx}`;
          })(),
          name: String(t.name ?? "Unnamed Template"),
          description: typeof t.description === "string" ? t.description : undefined,
          width: typeof t.width === "number" ? t.width : undefined,
          height: typeof t.height === "number" ? t.height : undefined,
          fields: Array.isArray(t.fields) ? t.fields.map((f: any, idx: number) => ({
            id: String((f.id ?? "") || `${(f.label ?? "Field").toString().replace(/\s+/g, "_")}_${idx}`),
            label: String(f.label ?? "Field"),
            value: typeof f.value === "string" ? f.value : "",
            type: (
              f.type === "text" ||
              f.type === "number" ||
              f.type === "date" ||
              f.type === "amount" ||
              f.type === "textarea" ||
              f.type === "select" ||
              f.type === "image" ||
              f.type === "signature"
            ) ? (f.type as TemplateField["type"]) : "text",
            placeholder: typeof f.placeholder === "string" ? f.placeholder : undefined,
            options: Array.isArray(f.options) ? f.options.map((o: any) => String(o)) : undefined,
            required: Boolean(f.required),
            x: typeof f.x === "number" ? f.x : undefined,
            y: typeof f.y === "number" ? f.y : undefined,
            width: typeof f.width === "number" ? f.width : undefined,
            height: typeof f.height === "number" ? f.height : undefined,
            fontSize: typeof f.fontSize === "number" ? f.fontSize : undefined,
            isBold: Boolean(f.isBold),
            isItalic: Boolean(f.isItalic),
            textColor: typeof f.textColor === "string" ? f.textColor : undefined,
            backgroundColor: typeof f.backgroundColor === "string" ? f.backgroundColor : undefined,
            borderColor: typeof f.borderColor === "string" ? f.borderColor : undefined,
            borderWidth: typeof f.borderWidth === "number" ? f.borderWidth : undefined,
            borderRadius: typeof f.borderRadius === "number" ? f.borderRadius : undefined,
            alignment: f.alignment === "center" || f.alignment === "right" ? f.alignment : "left",
          })) : [],
        }));

        setTemplates(nextTemplates);
        // eslint-disable-next-line no-console
        console.log("[NewBill] Normalized templates:", nextTemplates.length);

        // Auto-select last opened template if available; otherwise keep current selection if valid; else pick first
        try {
          const lastId = window.localStorage.getItem(LAST_TEMPLATE_KEY) || "";
          const hasLast = lastId && nextTemplates.some((t) => t.id === lastId);
          if (hasLast) {
            setSelectedTemplateId((prev) => (prev && prev === lastId ? prev : lastId));
            // eslint-disable-next-line no-console
            console.log("[NewBill] Selected last template id:", lastId);
          } else {
            setSelectedTemplateId((prev) => {
              if (prev && nextTemplates.some((t) => t.id === prev)) return prev;
              const fallback = nextTemplates.length > 0 ? nextTemplates[0].id : "";
              // eslint-disable-next-line no-console
              console.log("[NewBill] Selected fallback template id:", fallback);
              return fallback;
            });
          }
        } catch {}
      }
    } catch {}
  };

  // Initial load and live refresh when localStorage changes in another tab/page
  useEffect(() => {
    loadTemplates();
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === TEMPLATES_KEY) {
        // eslint-disable-next-line no-console
        console.log("[NewBill] storage event -> reload templates");
        loadTemplates();
      }
    };
    window.addEventListener("storage", onStorage);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        // eslint-disable-next-line no-console
        console.log("[NewBill] visibilitychange -> reload templates");
        loadTemplates();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Build HTML for a selected template using absolute positioning
  const buildTemplatePreviewHtml = (tpl: FullTemplate, values: Record<string, string>) => {
    const baseWidth = 794; // A4 target width used in export
    const tplWidth = Math.max(1, tpl.width ?? 794);
    const tplHeight = Math.max(1, tpl.height ?? 1123);
    const scale = baseWidth / tplWidth;
    const scaledHeight = Math.round(tplHeight * scale);
    const safePad = 16; // px padding to keep content away from page edge

    const esc = (s: string) => s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    const fieldHtml = (tpl.fields || []).map((f) => {
      const v = values[f.id] ?? f.value ?? "";
      const left = Math.round((f.x ?? 0) * scale);
      const top = Math.round((f.y ?? 0) * scale);
      const w = Math.round((f.width ?? 120) * scale);
      const h = Math.round((f.height ?? 24) * scale);
      const fs = Math.max(10, Math.round((f.fontSize ?? 14) * scale));
      const fw = f.isBold ? "bold" : "normal";
      const fi = f.isItalic ? "italic" : "normal";
      const ta = f.alignment ?? "left";
      const tc = f.textColor ?? "#000000";
      const bg = f.backgroundColor ? `background:${f.backgroundColor};` : "";
      const bw = Math.max(0, Math.round((f.borderWidth ?? 0) * scale));
      const bc = f.borderColor ?? "transparent";
      const br = Math.round((f.borderRadius ?? 0) * scale);

      if (f.type === "image" || f.type === "signature") {
        const src = typeof v === "string" ? v : "";
        return `\n<div style=\"position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;${bg}border:${bw}px solid ${bc};border-radius:${br}px;overflow:hidden;\">` +
               (src ? `<img src=\"${esc(src)}\" style=\"width:100%;height:100%;object-fit:contain;\"/>` : "") +
               `</div>`;
      }

      const text = esc(String(v ?? ""));
      return `\n<div style=\"position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;${bg}border:${bw}px solid ${bc};border-radius:${br}px;display:flex;align-items:flex-start;justify-content:${ta === "left" ? "flex-start" : ta === "center" ? "center" : "flex-end"};padding:4px 6px;overflow:hidden;box-sizing:border-box;\">` +
             `<div style=\"width:100%;color:${tc};font-size:${fs}px;font-weight:${fw};font-style:${fi};text-align:${ta};white-space:pre-wrap;word-break:break-word;line-height:1.25;\">${text}</div>` +
             `</div>`;
    }).join("");

    return `<!DOCTYPE html><html><head><meta charset=\"utf-8\"/>` +
      `<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>` +
      `</head><body style=\"margin:0;background:#f3f4f6;\">` +
      `<div style=\"width:${baseWidth}px;height:${scaledHeight}px;margin:0 auto;background:#ffffff;\">` +
      `<div style=\"position:relative;width:${baseWidth - safePad * 2}px;height:${scaledHeight - safePad * 2}px;margin:${safePad}px;box-sizing:border-box;\">` +
      `${fieldHtml}` +
      `</div>` +
      `</div>` +
      `</body></html>`;
  };

  // Initialize/merge dynamic field values whenever selected template OR templates list changes
  useEffect(() => {
    if (selectedTemplate) {
      setTemplateForm((prev) => {
        const next: Record<string, string> = { ...prev };
        // Drop keys no longer in template; add any new fields with their default value
        const validIds = new Set(selectedTemplate.fields.map((f) => f.id));
        Object.keys(next).forEach((k) => { if (!validIds.has(k)) delete next[k]; });
        selectedTemplate.fields.forEach((f) => {
          if (!(f.id in next)) next[f.id] = (f.value ?? "").toString();
        });
        return next;
      });
    } else {
      setTemplateForm({});
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    const list = getLandlordsLocal();
    setLandlords(list);
    // Default to existing if we have saved landlords, otherwise manual
    form.setValue("landlord_mode", list.length > 0 ? "existing" : "manual");
    if (list.length > 0) {
      form.setValue("landlord_id", list[0].id);
    }
  }, [form]);

  // Resize preview to fit container without cutting content
  useEffect(() => {
    const updateScale = () => {
      if (!previewHtml) return;
      const container = previewContainerRef.current;
      if (!container) return;
      const containerWidth = container.clientWidth;
      const baseWidth = 794; // A4 width at ~96dpi
      const scale = Math.min(1, containerWidth / baseWidth);
      setPreviewScale(scale);
    };
    updateScale();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }
  }, [previewHtml]);

  // Measure actual content height (unscaled) and reserve scaled space
  useEffect(() => {
    const measure = () => {
      const el = previewInnerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scaledHeight = rect.height; // current scaled height
      const computedBase = Math.max(
        1123,
        Math.round(scaledHeight / Math.max(previewScale, 0.001))
      );
      setBaseHeight(computedBase);
    };
    // Allow DOM to paint before measuring
    const r = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(r);
  }, [previewHtml, previewScale]);

  const landlordMode = form.watch("landlord_mode");
  const landlordNameManual = form.watch("landlord_name")?.trim() ?? "";
  const landlordIdExisting = form.watch("landlord_id") ?? "";

  // Auto-fill signature from existing landlord selection
  useEffect(() => {
    if (landlordMode === "existing" && landlordIdExisting) {
      const existing = landlords.find((l) => l.id === landlordIdExisting);
      if (existing?.signature_url) {
        form.setValue("signature_url", existing.signature_url);
      } else {
        form.setValue("signature_url", null);
      }
    }
    if (landlordMode === "manual") {
      // Avoid carrying over signature_url from previous existing selection
      form.setValue("signature_url", null);
    }
    // Reset displayed file name when landlord selection/mode changes
    setSignatureFileName(null);
  }, [landlordMode, landlordIdExisting, landlords, form]);

  const handleFieldsExtracted = (fields: Partial<BillFormInput>) => {
    // Set extracted fields to form
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        form.setValue(key as keyof BillFormInput, value);
      }
    });
  };

  const handleNextMonthBill = (fields: Partial<BillFormInput>) => {
    // Set next month fields to form
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        form.setValue(key as keyof BillFormInput, value);
      }
    });
  };

  async function computeNextBillNumber(): Promise<string> {
    return computeNextNumericBillNumber();
  }

  async function onSubmit(values: any) {
    setSaving(true);
    try {
      // If a template is selected, build preview from template JSON and templateForm
      // This bypasses the default bill HTML rendering
      if (selectedTemplate) {
        const html = buildTemplatePreviewHtml(selectedTemplate, templateForm);
        setPreviewHtml(html);
        setSaving(false);
        return;
      }

      let finalBillNumber = values.bill_number ?? "";
      if (!finalBillNumber) {
        // If no bill number is provided, generate a random one
        finalBillNumber = `BILL-${uuidv4().slice(0, 8).toUpperCase()}`;
      }

      let signatureUrl = values.signature_url ?? null;

      const fileList = (values as { signature_file?: FileList }).signature_file;
      const file: File | undefined = fileList?.[0];
      let signatureName: string | null = null;
      if (file) {
        signatureUrl = await fileToDataUrl(file);
        signatureName = file.name ?? null;
      }

      let landlordIdForBill: string;
      let landlordNameForPdf: string;

      if (values.landlord_mode === "existing" && values.landlord_id) {
        // Use existing landlord; if no signature uploaded this time, fallback to saved landlord signature
        const existing = landlords.find((l) => l.id === values.landlord_id);
        landlordIdForBill = values.landlord_id;
        landlordNameForPdf = existing?.name ?? "";
        if (!file && !signatureUrl && existing?.signature_url) {
          signatureUrl = existing.signature_url;
        }
      } else {
        // Manual mode: save landlord (including provided signature) to local storage
        const newLandlord: Landlord = {
          id: uuidv4(),
          name: landlordNameManual,
          address: "",
          signature_url: signatureUrl ?? undefined,
          signature_name: signatureName ?? undefined,
          created_at: new Date().toISOString(),
        };
        saveLandlord(newLandlord);
        setLandlords((prev) => [newLandlord, ...prev]);
        landlordIdForBill = newLandlord.id;
        landlordNameForPdf = newLandlord.name;
      }

      const newBill: Bill = {
        id: uuidv4(),
        bill_number: finalBillNumber,
        bill_mode: values.bill_mode,
        date: values.date,
        period: monthInputToDisplay(values.period),
        landlord_id: landlordIdForBill,
        agreement_date: values.agreement_date,
        rate: values.rate ? Number(values.rate) : undefined,
        amount: Number(values.amount),
        signature_url: signatureUrl ?? undefined,
        created_at: new Date().toISOString(),
      };

      saveBill(newBill);

      // Build preview HTML styled to match the provided sample
      const landlordName = landlordNameForPdf;
      const amountFormatted = Number(values.amount).toLocaleString("en-IN", {
        maximumFractionDigits: 0,
      });
      const rateFormatted = values.rate
        ? Number(values.rate).toLocaleString("en-IN", {
            maximumFractionDigits: 0,
          })
        : amountFormatted;
      const billDateDisplay = format(new Date(values.date), "dd-MM-yyyy");
      const agreementDisplay = format(
        new Date(values.agreement_date),
        "do MMMM yyyy"
      );
      const periodDisplay = monthInputToDisplay(values.period);
      const html = `
        <div style="position:relative; font-family:'Times New Roman', Times, serif; color:#000; width:794px; min-height:1123px; margin:0 auto; padding:24px 20px 180px 20px; background:#ffffff; box-sizing:border-box; overflow:visible;">
          <div style="text-align:center; font-weight:700; font-size:18pt; text-decoration: underline;">HOUSE RENT BILL</div>

          <div style="margin-top:20px; font-size:12pt;">
            <div style="margin-bottom:10px; font-weight:700;">PERIOD OF BILL: <span style="font-weight:700;">${periodDisplay}</span></div>
            <div style="display:flex; justify-content:space-between; max-width:560px; font-weight:700;">
              <div>BILL NO:${finalBillNumber}</div>
              <div>DATE: ${billDateDisplay}</div>
            </div>
          </div>

          <div style="margin-top:28px; font-size:12pt; line-height:1.45; max-width:100%;">
            <div style="font-size:14pt;">Sir,</div>
            <div>
              I am submitting the House rent bill of Smt. ${landlordName} (Private House) for accommodation of BtED,
              Basta as per Agreement Dtd. <strong>${agreementDisplay}</strong> BETWEEN Executive Engineer, BtED, Basta and Smt. ${landlordName} for the month of ${periodDisplay}
            </div>
          </div>

          <table style="width:100%; border-collapse:collapse; text-align:center; margin-top:22px; font-size:12pt;">
            <thead>
              <tr>
                <th style="border-bottom:1px solid #000; padding:8px 6px; text-align:left;">Description</th>
                <th style="border-bottom:1px solid #000; padding:8px 6px;">Month</th>
                <th style="border-bottom:1px solid #000; padding:8px 6px;">Rate</th>
                <th style="border-bottom:1px solid #000; padding:8px 6px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:10px 6px; text-align:left;">HOUSE RENT</td>
                <td style="padding:10px 6px;">${periodDisplay}</td>
                <td style="padding:10px 6px;">Rs.${rateFormatted}/- P.M</td>
                <td style="padding:10px 6px;">Rs.${amountFormatted}/-</td>
              </tr>
            </tbody>
          </table>

          <div style="position:absolute; right:20px; bottom:48px; text-align:right;">
            ${
              signatureUrl
                ? `<img src="${signatureUrl}" alt="Signature" style="width:180px; height:auto; display:block; margin:0 0 8px auto;">`
                : ``
            }
            <div style="font-size:12pt;">Signature of House</div>
            <div style="font-size:12pt;">Owner</div>
          </div>
        </div>`;

      setPreviewHtml(html);
    } catch (err) {
      console.error(err);
      alert("Failed to save bill");
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf() {
    if (!previewHtml) return;
    const html2pdf = (await import("html2pdf.js")).default;
    const element = document.createElement("div");
    element.innerHTML = previewHtml;
    // Fix width to A4 @ ~96dpi for sharper rasterization
    const baseWidthPx = 794;   // ~210mm at 96dpi
    const pageHeightPx = 1123; // ~297mm at 96dpi
    element.style.width = `${baseWidthPx}px`;
    element.style.margin = "0 auto";
    element.style.background = "#ffffff";
    document.body.appendChild(element);
    const scale = Math.max(2, Math.ceil((window.devicePixelRatio || 1) * 2));
    await html2pdf()
      .from(element)
      .set({
        // Small margins in px to avoid edge clipping
        margin: [16, 16, 16, 16],
        filename: `house-rent-bill-${Date.now()}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale, // high DPI render
          useCORS: true,
          scrollX: 0,
          scrollY: 0,
          backgroundColor: "#ffffff",
          // Ensure full element dimensions are captured to prevent right-edge clipping
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight,
        },
        jsPDF: {
          // Use pixel units to exactly match our HTML pixel width
          unit: "px",
          format: [baseWidthPx, pageHeightPx],
          orientation: "portrait",
          compress: true,
        },
        // Respect CSS page breaks and fallback to legacy if needed
        pagebreak: { mode: ["css", "legacy"] },
      })
      .save();
    element.remove();
  }

  return (
    <div className="grid gap-6 max-w-5xl mx-auto px-3 sm:px-4 pt-6 sm:pt-8 pb-10 sm:pb-12 overflow-x-hidden min-w-0">
      <h1 className="text-2xl font-semibold">House Rent Bill</h1>

      {/* Template (optional) selector */}
      <div className="rounded-md ring-1 ring-inset p-3 sm:p-4 grid gap-3 w-full max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold opacity-80">Template (optional)</div>
          <button
            type="button"
            className="text-xs px-2 py-1 rounded ring-1 ring-inset"
            onClick={loadTemplates}
            title="Reload templates"
          >Reload</button>
        </div>
        <label className="grid gap-1">
          <span className="text-sm">Choose a saved template</span>
          <select
            className="ring-1 ring-inset rounded px-3 py-2 bg-transparent w-full"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            onFocus={loadTemplates}
          >
            <option value="">— None (use default House Bill) —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* If a template is selected, show template UI + PdfUpload; else show the original form unchanged */}
      {selectedTemplateId ? (
        <div className="grid gap-4 w-full max-w-3xl mx-auto">
          {(() => {
            const tpl = selectedTemplate;
            return (
              <div className="rounded-md ring-1 ring-inset p-3 sm:p-4 grid gap-2">
                <div className="text-sm font-semibold">Selected Template</div>
                <div className="text-base font-medium">{tpl?.name ?? "Template"}</div>
                {tpl?.description && (
                  <div className="text-sm opacity-80">{tpl.description}</div>
                )}
              </div>
            );
          })()}

          <div className="overflow-visible">
            <PdfUpload
              onFieldsExtracted={handleFieldsExtracted}
              onNextMonthBill={handleNextMonthBill}
              disabled={saving}
            />
          </div>

          {/* Dynamic fields for selected template */}
          {selectedTemplate && (
            <div className="rounded-md ring-1 ring-inset p-3 sm:p-4 grid gap-3">
              <div className="text-sm font-semibold opacity-80">Template Fields</div>
              <div className="grid grid-cols-1 gap-3">
                {selectedTemplate.fields.map((f) => {
                  const val = templateForm[f.id] ?? "";
                  const setVal = (v: string) => setTemplateForm((prev) => ({ ...prev, [f.id]: v }));
                  if (f.type === "textarea") {
                    return (
                      <label key={f.id} className="grid gap-1">
                        <span className="text-sm">{f.label}</span>
                        <textarea
                          className="ring-1 ring-inset rounded px-3 py-2 bg-transparent w-full min-h-[84px]"
                          placeholder={f.placeholder}
                          value={val}
                          onChange={(e) => setVal(e.target.value)}
                        />
                      </label>
                    );
                  }
                  if (f.type === "select" && Array.isArray(f.options)) {
                    return (
                      <label key={f.id} className="grid gap-1">
                        <span className="text-sm">{f.label}</span>
                        <select
                          className="ring-1 ring-inset rounded px-3 py-2 bg-transparent w-full"
                          value={val}
                          onChange={(e) => setVal(e.target.value)}
                        >
                          <option value="">Select...</option>
                          {f.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </label>
                    );
                  }
                  if (f.type === "image" || f.type === "signature") {
                    return (
                      <label key={f.id} className="grid gap-1">
                        <span className="text-sm">{f.label} ({f.type})</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="ring-1 ring-inset rounded px-3 py-2 bg-transparent w-full"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => setVal(String(reader.result ?? ""));
                            reader.readAsDataURL(file);
                          }}
                        />
                        {val && (
                          <span className="text-xs opacity-70">Image selected</span>
                        )}
                      </label>
                    );
                  }
                  // text, number, date, amount -> map to input
                  const inputType = f.type === "date" ? "date" : f.type === "number" || f.type === "amount" ? "number" : "text";
                  return (
                    <label key={f.id} className="grid gap-1">
                      <span className="text-sm">{f.label}</span>
                      <input
                        className="ring-1 ring-inset rounded px-3 py-2 bg-transparent w-full"
                        type={inputType}
                        placeholder={f.placeholder}
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <button
              type="button"
              className="px-3 py-2 rounded ring-1 ring-inset"
              onClick={() => setSelectedTemplateId("")}
            >
              Back to default form
            </button>
          </div>

          {/* Validation summary for template mode */}
          {templateErrors.length > 0 && (
            <div className="rounded-md ring-1 ring-red-500/40 bg-red-500/5 p-3 sm:p-4">
              <div className="text-sm font-semibold text-red-600 mb-1">Please fix the following:</div>
              <ul className="list-disc pl-5 text-sm text-red-700 space-y-0.5">
                {templateErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions (use the same submit/preview pipeline) */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              className="px-4 py-2 rounded bg-foreground text-background disabled:opacity-50 w-full sm:w-auto"
              onClick={submitFromTemplate}
            >
              {saving ? "Saving..." : "Save & Preview"}
            </button>
            {previewHtml && (
              <button
                type="button"
                onClick={exportPdf}
                className="px-4 py-2 rounded ring-1 ring-inset w-full sm:w-auto"
              >
                Download PDF
              </button>
            )}
          </div>
        </div>
      ) : (
        <form
          className="grid gap-6 w-full max-w-3xl mx-auto min-w-0 break-words"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="overflow-visible">
            <PdfUpload
              onFieldsExtracted={handleFieldsExtracted}
              onNextMonthBill={handleNextMonthBill}
              disabled={saving}
            />
          </div>

          <div className="rounded-md ring-1 ring-inset p-3 sm:p-4 grid gap-3 sm:gap-4">
          <div className="text-sm font-semibold opacity-80">Bill details</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
            <label className="grid gap-1">
              <span className="text-sm">Period (Month)</span>
              <Controller
                name="period"
                control={form.control}
                render={({ field }) => (
                  <DatePicker
                    selected={
                      field.value ? new Date(field.value + "-01") : null
                    }
                    onChange={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(
                          2,
                          "0"
                        );
                        field.onChange(`${year}-${month}`);
                      }
                    }}
                    dateFormat="MMMM yyyy"
                    showMonthYearPicker
                    showFullMonthYearPicker
                    placeholderText="Select month and year"
                    className="ring-1 ring-inset rounded px-3 py-2 bg-transparent w-full"
                  />
                )}
              />
              {form.formState.errors.period && (
                <span className="text-xs text-red-600">
                  {form.formState.errors.period.message as string}
                </span>
              )}
            </label>
            <label className="grid gap-1">
              <span className="text-sm">Bill Date</span>
              <Controller
                name="date"
                control={form.control}
                render={({ field }) => (
                  <DatePicker
                    selected={field.value ? new Date(field.value) : null}
                    onChange={(date) => {
                      if (date) {
                        field.onChange(format(date, "yyyy-MM-dd"));
                      }
                    }}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Select date"
                    className="ring-1 ring-inset rounded px-3 py-2 bg-transparent w-full"
                  />
                )}
              />
              {form.formState.errors.date && (
                <span className="text-xs text-red-600">Date is required</span>
              )}
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:gap-4 min-w-0">
            <label className="grid gap-1">
              <span className="text-sm">Bill Number</span>
              <div className="relative">
                <input
                  className="ring-1 ring-inset rounded px-3 py-2 bg-transparent w-full pr-10"
                  placeholder="Enter bill number"
                  {...form.register("bill_number")}
                />
                <button
                  type="button"
                  onClick={() => {
                    const randomBillNumber = `BILL-${uuidv4()
                      .slice(0, 8)
                      .toUpperCase()}`;
                    form.setValue("bill_number", randomBillNumber);
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                  title="Generate random bill number"
                >
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </label>
          </div>
        </div>

        <div className="rounded-md ring-1 ring-inset p-3 sm:p-4 grid gap-3 sm:gap-4">
          <div className="text-sm font-semibold opacity-80">Landlord</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`px-3 py-1 rounded text-sm ring-1 ring-inset ${landlordMode === "existing" ? "bg-foreground text-background" : ""}`}
              onClick={() => form.setValue("landlord_mode", "existing")}
            >
              Existing
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded text-sm ring-1 ring-inset ${landlordMode === "manual" ? "bg-foreground text-background" : ""}`}
              onClick={() => form.setValue("landlord_mode", "manual")}
            >
              Manual
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
            {landlordMode === "existing" ? (
              <label className="grid gap-1">
                <span className="text-sm">Saved Landlords</span>
                <select
                  className="ring-1 ring-inset rounded px-3 py-2 bg-transparent w-full"
                  value={landlordIdExisting}
                  onChange={(e) => form.setValue("landlord_id", e.target.value)}
                >
                  {landlords.length === 0 ? (
                    <option value="" disabled>
                      No landlords saved
                    </option>
                  ) : null}
                  {landlords.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.landlord_id && (
                  <span className="text-xs text-red-600">
                    {form.formState.errors.landlord_id.message as string}
                  </span>
                )}
              </label>
            ) : (
              <label className="grid gap-1">
                <span className="text-sm">Landlord Name</span>
                <input
                  className="ring-1 ring-inset rounded px-3 py-2 bg-transparent w-full"
                  placeholder="Type landlord name"
                  {...form.register("landlord_name")}
                />
                {form.formState.errors.landlord_name && (
                  <span className="text-xs text-red-600">
                    {form.formState.errors.landlord_name.message as string}
                  </span>
                )}
              </label>
            )}

            <label className="grid gap-1">
              <span className="text-sm">Agreement Date</span>
              <Controller
                name="agreement_date"
                control={form.control}
                render={({ field }) => (
                  <DatePicker
                    selected={field.value ? new Date(field.value) : null}
                    onChange={(date) => {
                      if (date) {
                        field.onChange(format(date, "yyyy-MM-dd"));
                      }
                    }}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Select agreement date"
                    className="ring-1 ring-inset rounded px-3 py-2 bg-transparent w-full"
                  />
                )}
              />
              {form.formState.errors.agreement_date && (
                <span className="text-xs text-red-600">
                  Agreement date is required
                </span>
              )}
            </label>
          </div>
        </div>

        <div className="rounded-md ring-1 ring-inset p-3 sm:p-4 grid gap-3 sm:gap-4">
          <div className="text-sm font-semibold opacity-80">
            Payment & Signature
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
            <label className="grid gap-1">
              <span className="text-sm">Rate (Rs./P.M)</span>
              <input
                className="ring-1 ring-inset rounded px-3 py-2 bg-transparent w-full"
                placeholder="e.g. 12000"
                {...form.register("rate")}
              />
              {form.formState.errors.rate && (
                <span className="text-xs text-red-600">
                  {form.formState.errors.rate.message as string}
                </span>
              )}
            </label>
            <label className="grid gap-1">
              <span className="text-sm">Amount (Rs.)</span>
              <input
                className="ring-1 ring-inset rounded px-3 py-2 bg-transparent w-full"
                placeholder="e.g. 12000"
                {...form.register("amount")}
              />
              {form.formState.errors.amount && (
                <span className="text-xs text-red-600">
                  {form.formState.errors.amount.message as string}
                </span>
              )}
            </label>
            <label className="grid gap-1">
              <span className="text-sm">Signature Image (optional)</span>
              {/* Hidden real input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const reg = form.register("signature_file");
                  reg.onChange(e);
                  const file = e.target.files?.[0];
                  setSignatureFileName(file ? file.name : null);
                }}
              />
              {/* Visible proxy control */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="ring-1 ring-inset rounded px-3 py-2 w-full text-left bg-transparent hover:bg-foreground/5"
                aria-label="Choose signature image file"
              >
                {(() => {
                  const existing =
                    landlordMode === "existing" && landlordIdExisting
                      ? landlords.find((l) => l.id === landlordIdExisting)
                      : undefined;
                  const displayName =
                    signatureFileName || existing?.signature_name || null;
                  return (
                    <span className="opacity-80">
                      Choose File {displayName ?? "No file chosen"}
                    </span>
                  );
                })()}
              </button>
              {landlordMode === "existing" && (() => {
                const existing = landlords.find((l) => l.id === landlordIdExisting);
                if (existing?.signature_url) {
                  const name = existing.signature_name ?? null;
                  return (
                    <span className="text-xs opacity-70">
                      Using saved signature{name ? `: ${name}` : ""} from selected landlord. Upload a file to replace.
                    </span>
                  );
                }
                return null;
              })()}
            </label>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
          <button
            disabled={saving}
            className="px-4 py-2 rounded bg-foreground text-background disabled:opacity-50 w-full sm:w-auto"
            type="submit"
          >
            {saving ? "Saving..." : "Save & Preview"}
          </button>
          {previewHtml && (
            <button
              type="button"
              onClick={exportPdf}
              className="px-4 py-2 rounded ring-1 ring-inset w-full sm:w-auto"
            >
              Download PDF
            </button>
          )}
        </div>
      </form>

      )}

      {previewHtml && (
        <div className="mt-6 ring-1 ring-inset rounded p-2 sm:p-4 responsive-pane w-full max-w-3xl mx-auto">
          <div className="text-sm font-semibold mb-2">Preview</div>
          <div ref={previewContainerRef} className="w-full overflow-auto">
            {/* Reserve scaled space to prevent clipping */}
            <div
              className="mx-auto"
              style={{
                width: `${Math.round(794 * previewScale)}px`,
                height: `${Math.round(baseHeight * previewScale)}px`,
                position: "relative",
              }}
            >
              <div
                ref={previewInnerRef}
                style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                  width: "794px",
                }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
