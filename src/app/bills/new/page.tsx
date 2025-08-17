"use client";
import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { billFormSchema, type BillFormInput } from "@/lib/validation";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { Landlord, Bill } from "@/lib/types";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { PreviewPanel } from "@/components/PreviewPanel";
import { FooterActions } from "@/components/FooterActions";
import { PaymentSignatureSection } from "@/components/PaymentSignatureSection";
import { BillDetailsSection } from "@/components/BillDetailsSection";
import { LandlordSection } from "@/components/LandlordSection";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
  // Track pending file reads for template image/signature fields to avoid race conditions
  const pendingReadsRef = useRef<Promise<void>[]>([]);
  const formRef = useRef<HTMLFormElement | null>(null);

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
  const selectedTemplate =
    templates.find((t) => t.id === selectedTemplateId) || null;
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
      if (
        (f.type === "signature" || f.type === "image") &&
        raw.startsWith("data:")
      ) {
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
              "january",
              "february",
              "march",
              "april",
              "may",
              "june",
              "july",
              "august",
              "september",
              "october",
              "november",
              "december",
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
    // Ensure any pending image/signature file reads have completed before building preview
    if (pendingReadsRef.current.length > 0) {
      try {
        await Promise.all(pendingReadsRef.current);
      } catch {}
    }
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
      const errs = Object.entries(form.formState.errors).map(
        ([k, v]) => `${k}: ${(v as any)?.message || "Invalid"}`
      );
      setTemplateErrors(errs);
      if (typeof window !== "undefined")
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const loadTemplates = () => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(TEMPLATES_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      // eslint-disable-next-line no-console
      console.log(
        "[NewBill] Read templates from localStorage:",
        Array.isArray(arr) ? arr.length : 0
      );
      if (Array.isArray(arr)) {
        const nextTemplates: FullTemplate[] = arr.map(
          (t: any, tplIdx: number) => ({
            // Ensure a non-empty, stable-ish id for selection
            id: (() => {
              const raw = String(t.id ?? "").trim();
              if (raw) return raw;
              const base = (t.name ? String(t.name) : "Template")
                .replace(/\s+/g, "-")
                .toLowerCase();
              return `tpl-${base}-${tplIdx}`;
            })(),
            name: String(t.name ?? "Unnamed Template"),
            description:
              typeof t.description === "string" ? t.description : undefined,
            width: typeof t.width === "number" ? t.width : undefined,
            height: typeof t.height === "number" ? t.height : undefined,
            fields: Array.isArray(t.fields)
              ? t.fields.map((f: any, idx: number) => ({
                  id: String(
                    (f.id ?? "") ||
                      `${(f.label ?? "Field")
                        .toString()
                        .replace(/\s+/g, "_")}_${idx}`
                  ),
                  label: String(f.label ?? "Field"),
                  value: typeof f.value === "string" ? f.value : "",
                  type:
                    f.type === "text" ||
                    f.type === "number" ||
                    f.type === "date" ||
                    f.type === "amount" ||
                    f.type === "textarea" ||
                    f.type === "select" ||
                    f.type === "image" ||
                    f.type === "signature"
                      ? (f.type as TemplateField["type"])
                      : "text",
                  placeholder:
                    typeof f.placeholder === "string"
                      ? f.placeholder
                      : undefined,
                  options: Array.isArray(f.options)
                    ? f.options.map((o: any) => String(o))
                    : undefined,
                  required: Boolean(f.required),
                  x: typeof f.x === "number" ? f.x : undefined,
                  y: typeof f.y === "number" ? f.y : undefined,
                  width: typeof f.width === "number" ? f.width : undefined,
                  height: typeof f.height === "number" ? f.height : undefined,
                  fontSize:
                    typeof f.fontSize === "number" ? f.fontSize : undefined,
                  isBold: Boolean(f.isBold),
                  isItalic: Boolean(f.isItalic),
                  textColor:
                    typeof f.textColor === "string" ? f.textColor : undefined,
                  backgroundColor:
                    typeof f.backgroundColor === "string"
                      ? f.backgroundColor
                      : undefined,
                  borderColor:
                    typeof f.borderColor === "string"
                      ? f.borderColor
                      : undefined,
                  borderWidth:
                    typeof f.borderWidth === "number"
                      ? f.borderWidth
                      : undefined,
                  borderRadius:
                    typeof f.borderRadius === "number"
                      ? f.borderRadius
                      : undefined,
                  alignment:
                    f.alignment === "center" || f.alignment === "right"
                      ? f.alignment
                      : "left",
                }))
              : [],
          })
        );

        setTemplates(nextTemplates);
        // eslint-disable-next-line no-console
        console.log("[NewBill] Normalized templates:", nextTemplates.length);

        // Keep default (None) on initial load. Preserve current selection if still valid; otherwise clear.
        try {
          setSelectedTemplateId((prev) => {
            if (prev && nextTemplates.some((t) => t.id === prev)) return prev;
            // eslint-disable-next-line no-console
            console.log("[NewBill] Keeping default template selection (None)");
            return "";
          });
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
  const buildTemplatePreviewHtml = (
    tpl: FullTemplate,
    values: Record<string, string>
  ) => {
    const baseWidth = 794; // A4 target width used in export
    const tplWidth = Math.max(1, tpl.width ?? 794);
    const tplHeight = Math.max(1, tpl.height ?? 1123);
    const scale = baseWidth / tplWidth;
    const scaledHeight = Math.round(tplHeight * scale);
    const safePad = 16; // px padding to keep content away from page edge

    const esc = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const fieldHtml = (tpl.fields || [])
      .map((f) => {
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
          return (
            `\n<div style=\"position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;${bg}border:${bw}px solid ${bc};border-radius:${br}px;overflow:hidden;\">` +
            (src
              ? `<img src=\"${esc(
                  src
                )}\" style=\"width:100%;height:100%;object-fit:contain;\"/>`
              : "") +
            `</div>`
          );
        }

        const text = esc(String(v ?? ""));
        // Add a bit more bottom padding and slightly larger line-height to avoid clipping descenders
        return (
          `\n<div style=\"position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;${bg}border:${bw}px solid ${bc};border-radius:${br}px;display:flex;align-items:flex-start;justify-content:${
            ta === "left"
              ? "flex-start"
              : ta === "center"
              ? "center"
              : "flex-end"
          };padding:4px 6px 6px;overflow:hidden;box-sizing:border-box;\">` +
          `<div style=\"width:100%;color:${tc};font-size:${fs}px;font-weight:${fw};font-style:${fi};text-align:${ta};white-space:pre-wrap;word-break:break-word;line-height:1.32;\">${text}</div>` +
          `</div>`
        );
      })
      .join("");

    return (
      `<!DOCTYPE html><html><head><meta charset=\"utf-8\"/>` +
      `<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>` +
      `</head><body style=\"margin:0;background:#f3f4f6;\">` +
      `<div style=\"width:${baseWidth}px;height:${scaledHeight}px;margin:0 auto;background:#ffffff;\">` +
      `<div style=\"position:relative;width:${
        baseWidth - safePad * 2
      }px;height:${
        scaledHeight - safePad * 2
      }px;margin:${safePad}px;box-sizing:border-box;\">` +
      `${fieldHtml}` +
      `</div>` +
      `</div>` +
      `</body></html>`
    );
  };

  // Build HTML for the default House Rent Bill (non-template) used for live preview
  const buildDefaultPreviewHtml = (values: any) => {
    const landlordNameForPdf = (() => {
      if (values.landlord_mode === "existing" && values.landlord_id) {
        const existing = landlords.find((l) => l.id === values.landlord_id);
        return existing?.name ?? "";
      }
      return (values.landlord_name || "").toString();
    })();

    const amountFormatted = Number(values.amount || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    });
    const rateFormatted = (
      values.rate ? Number(values.rate) : Number(values.amount || 0)
    ).toLocaleString("en-IN", { maximumFractionDigits: 0 });
    const billDateDisplay = values.date
      ? format(new Date(values.date), "dd-MM-yyyy")
      : format(new Date(), "dd-MM-yyyy");
    const agreementDisplay = values.agreement_date
      ? format(new Date(values.agreement_date), "do MMMM yyyy")
      : format(new Date(), "do MMMM yyyy");
    const periodDisplay = monthInputToDisplay(
      values.period || buildPeriodFromDate(new Date())
    );

    let signatureUrl: string | null = values.signature_url || null;
    if (
      !signatureUrl &&
      values.landlord_mode === "existing" &&
      values.landlord_id
    ) {
      const existing = landlords.find((l) => l.id === values.landlord_id);
      if (existing?.signature_url) signatureUrl = existing.signature_url;
    }

    const billNo: string =
      values.bill_number || `BILL-${uuidv4().slice(0, 8).toUpperCase()}`;

    const html = `
        <div style="position:relative; font-family:'Times New Roman', Times, serif; color:#000; width:794px; min-height:1123px; margin:0 auto; padding:24px 20px 180px 20px; background:#ffffff; box-sizing:border-box; overflow:visible;">
          <div style="text-align:center; font-weight:700; font-size:18pt; text-decoration: underline;">HOUSE RENT BILL</div>

          <div style="margin-top:20px; font-size:12pt;">
            <div style="margin-bottom:10px; font-weight:700;">PERIOD OF BILL: <span style="font-weight:700;">${periodDisplay}</span></div>
            <div style="display:flex; align-items:center; width:100%; font-weight:700;">
              <div style="flex-shrink:0;">BILL NO: ${billNo}</div>
              <div style="margin-left:auto; text-align:right;">DATE: ${billDateDisplay}</div>
            </div>
          </div>

          <div style="margin-top:28px; font-size:12pt; line-height:1.45; max-width:100%;">
            <div style="font-size:14pt;">Sir,</div>
            <div>
              I am submitting the House rent bill of Smt. ${landlordNameForPdf} (Private House) for accommodation of BtED,
              Basta as per Agreement Dtd. <strong>${agreementDisplay}</strong> BETWEEN Executive Engineer, BtED, Basta and Smt. ${landlordNameForPdf} for the month of ${periodDisplay}
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

    return html;
  };

  // Initialize/merge dynamic field values whenever selected template OR templates list changes
  useEffect(() => {
    if (selectedTemplate) {
      setTemplateForm((prev) => {
        const next: Record<string, string> = { ...prev };
        // Drop keys no longer in template; add any new fields with their default value
        const validIds = new Set(selectedTemplate.fields.map((f) => f.id));
        Object.keys(next).forEach((k) => {
          if (!validIds.has(k)) delete next[k];
        });
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

  // Live preview: debounce updates when form or template values change
  const livePreviewTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const trigger = () => {
      if (livePreviewTimerRef.current) {
        clearTimeout(livePreviewTimerRef.current);
      }
      livePreviewTimerRef.current = window.setTimeout(() => {
        if (selectedTemplate) {
          setPreviewHtml(
            buildTemplatePreviewHtml(selectedTemplate, templateForm)
          );
        } else {
          const values = form.getValues();
          setPreviewHtml(buildDefaultPreviewHtml(values));
        }
      }, 250);
    };

    // Subscribe to all form changes
    const subscription = form.watch(() => {
      trigger();
    });

    // Trigger initially and when dependencies change
    trigger();
    return () => {
      subscription.unsubscribe?.();
      if (livePreviewTimerRef.current) {
        clearTimeout(livePreviewTimerRef.current);
      }
    };
  }, [form, selectedTemplate, selectedTemplateId, templateForm, landlords]);

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
        // Do not store signature_url on each bill to keep localStorage small
        created_at: new Date().toISOString(),
      };

      try {
        saveBill(newBill);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[NewBill] Failed to save bill (likely quota):", e);
        // Continue without blocking preview
      }

      // Build preview HTML styled to match the provided sample
      setPreviewHtml(
        buildDefaultPreviewHtml({
          ...values,
          bill_number: finalBillNumber,
          signature_url: signatureUrl,
        })
      );
    } catch (err) {
      console.error(err);
      alert("Failed to save bill");
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf() {
    if (!previewHtml) return;
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    // Create an isolated wrapper with bleed padding to ensure nothing sits on the page edge
    const wrapper = document.createElement("div");
    const bleed = 24; // px visual bleed padding (increased further)
    const baseWidthPx = 794;
    const pageHeightPx = 1123;
    wrapper.style.position = "fixed";
    wrapper.style.left = "-10000px"; // keep off-screen
    wrapper.style.top = "0";
    wrapper.style.background = "#ffffff";
    wrapper.style.padding = `${bleed}px`;
    wrapper.style.boxSizing = "border-box";
    // total width becomes baseWidthPx + bleed*2, but we'll capture entire wrapper
    const inner = document.createElement("div");
    inner.style.width = `${baseWidthPx}px`;
    inner.style.minHeight = `${pageHeightPx}px`;
    inner.style.background = "#ffffff";
    inner.innerHTML = previewHtml;
    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);

    // Render at higher DPI (~300dpi equivalent) for sharper text in the rasterized PDF
    const cssDpi = 96;
    const targetDpi = 300;
    const scale = Math.min(
      5,
      Math.ceil(
        (targetDpi / cssDpi) * Math.max(1, window.devicePixelRatio || 1)
      )
    );
    const canvas = await html2canvas(wrapper, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      windowWidth: wrapper.scrollWidth,
      windowHeight: wrapper.scrollHeight,
    });

    // Add extra safety padding around the rendered canvas before putting into PDF
    const pad = 24; // px extra around the raster (increased further)
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

    // Use PNG to avoid JPEG subsampling/compression blur
    const imgData = off.toDataURL("image/png");
    const pdf = new jsPDF({
      unit: "px",
      format: [off.width, off.height],
      orientation: off.width > off.height ? "landscape" : "portrait",
      // Disable extra compression for maximum sharpness (bigger files)
      compress: false,
    });
    // Slightly inset the image to avoid any edge clipping by PDF viewers/printers
    pdf.addImage(
      imgData,
      "PNG",
      0.5,
      0.5,
      Math.max(1, off.width - 1),
      Math.max(1, off.height - 1)
    );
    pdf.save(`house-rent-bill-${Date.now()}.pdf`);

    document.body.removeChild(wrapper);
  }

  // Vector PDF export for the default bill (non-template) using pdf-lib
  async function exportDefaultVectorPdf() {
    if (!previewHtml) return; // ensure there's something to export

    // Use same base width as preview and the measured base height
    const baseWidth = 794;
    const pageHeight = Math.max(1, baseHeight);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([baseWidth, pageHeight]);

    const fontRegular = await pdfDoc.embedStandardFont(
      StandardFonts.TimesRoman
    );
    const fontBold = await pdfDoc.embedStandardFont(
      StandardFonts.TimesRomanBold
    );

    // Helpers for drawing from top-left coordinate system
    const drawText = (
      text: string,
      x: number,
      yTop: number,
      size: number,
      opts?: {
        bold?: boolean;
        underline?: boolean;
        color?: ReturnType<typeof rgb>;
      }
    ) => {
      const font = opts?.bold ? fontBold : fontRegular;
      const ascent = font.sizeAtHeight(size);
      const y = pageHeight - (yTop + ascent);
      page.drawText(text, {
        x,
        y,
        size,
        font,
        color: opts?.color ?? rgb(0, 0, 0),
      });
      if (opts?.underline) {
        const width = font.widthOfTextAtSize(text, size);
        const underlineY = y - 2;
        page.drawLine({
          start: { x, y: underlineY },
          end: { x: x + width, y: underlineY },
          color: rgb(0, 0, 0),
          thickness: 0.8,
        });
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

    const drawTableCellText = (
      text: string,
      x: number,
      yTop: number,
      size: number,
      maxWidth: number,
      align: "left" | "center" | "right" = "left"
    ) => {
      const font = fontRegular;
      const width = font.widthOfTextAtSize(text, size);
      let tx = x;
      if (align === "center") tx = x + (maxWidth - width) / 2;
      if (align === "right") tx = x + (maxWidth - width);
      drawText(text, tx, yTop, size);
    };

    // Page background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: baseWidth,
      height: pageHeight,
      color: rgb(1, 1, 1),
    });

    // Layout paddings to match preview wrapper: padding: 24px 20px 180px 20px
    const padTop = 24;
    const padRight = 20;
    const padBottom = 180;
    const padLeft = 20;

    // Read current form values
    const values = form.getValues();
    const periodValue: string =
      values.period || buildPeriodFromDate(new Date());
    const periodDisplay = monthInputToDisplay(periodValue);
    const billNo: string =
      values.bill_number || `BILL-${uuidv4().slice(0, 8).toUpperCase()}`;
    const billDateDisplay = values.date
      ? format(new Date(values.date), "dd-MM-yyyy")
      : format(new Date(), "dd-MM-yyyy");
    const agreementDisplay = values.agreement_date
      ? format(new Date(values.agreement_date), "do MMMM yyyy")
      : format(new Date(), "do MMMM yyyy");
    const landlordName = (() => {
      if (values.landlord_mode === "existing" && values.landlord_id) {
        const existing = landlords.find((l) => l.id === values.landlord_id);
        return existing?.name || "";
      }
      return (values.landlord_name || "").toString();
    })();
    const amountNum = Number(values.amount || 0);
    const rateNum = values.rate ? Number(values.rate) : amountNum;
    const amountFormatted = amountNum.toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    });
    const rateFormatted = rateNum.toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    });

    // Title
    drawCenteredText("HOUSE RENT BILL", padTop, 18, {
      bold: true,
      underline: true,
    });

    // Period and bill details block
    let cursorY = padTop + 20 + 18; // title size ~18 plus spacing
    const blockGap = 20;
    cursorY += blockGap;
    drawText(`PERIOD OF BILL: ${periodDisplay}`, padLeft, cursorY, 12, {
      bold: true,
    });

    cursorY += 22;
    const detailsMaxW = baseWidth - padLeft - padRight - 0;
    // Left: BILL NO:, Right: DATE:
    const leftText = `BILL NO:${billNo}`;
    const rightText = `DATE: ${billDateDisplay}`;
    drawText(leftText, padLeft, cursorY, 12, { bold: true });
    const rightW = fontBold.widthOfTextAtSize(rightText, 12);
    const rightX = baseWidth - padRight - rightW;
    drawText(rightText, rightX, cursorY, 12, { bold: true });

    // Intro paragraph
    cursorY += 28;
    drawText("Sir,", padLeft, cursorY, 14);
    cursorY += 20;
    const intro = `I am submitting the House rent bill of Smt. ${landlordName} (Private House) for accommodation of BtED, Basta as per Agreement Dtd. ${agreementDisplay} BETWEEN Executive Engineer, BtED, Basta and Smt. ${landlordName} for the month of ${periodDisplay}`;
    // naive wrap for intro paragraph
    const maxTextWidth = baseWidth - padLeft - padRight;
    const words = intro.split(/\s+/);
    let line = "";
    const lineHeight = 12 * 1.45;
    const font = fontRegular;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (
        font.widthOfTextAtSize(test, 12) <= maxTextWidth ||
        line.length === 0
      ) {
        line = test;
      } else {
        drawText(line, padLeft, cursorY, 12);
        cursorY += lineHeight;
        line = w;
      }
    }
    if (line) {
      drawText(line, padLeft, cursorY, 12);
      cursorY += lineHeight;
    }

    // Table
    cursorY += 14;
    const tableX = padLeft;
    const tableYTop = cursorY;
    const tableWidth = baseWidth - padLeft - padRight;
    const col1W = Math.round(tableWidth * 0.46);
    const col2W = Math.round(tableWidth * 0.18);
    const col3W = Math.round(tableWidth * 0.18);
    const col4W = tableWidth - col1W - col2W - col3W;

    // Header row
    const headerSize = 12;
    const rowPadY = 8; // visual padding
    const cellPadX = 6;
    const headerHeight = headerSize + rowPadY + 6; // approx
    // Bottom border of header
    page.drawLine({
      start: { x: tableX, y: pageHeight - (tableYTop + headerHeight) },
      end: {
        x: tableX + tableWidth,
        y: pageHeight - (tableYTop + headerHeight),
      },
      color: rgb(0, 0, 0),
      thickness: 1,
    });
    drawTableCellText(
      "Description",
      tableX + cellPadX,
      tableYTop + rowPadY,
      headerSize,
      col1W - cellPadX * 2,
      "left"
    );
    drawTableCellText(
      "Month",
      tableX + col1W + cellPadX,
      tableYTop + rowPadY,
      headerSize,
      col2W - cellPadX * 2,
      "center"
    );
    drawTableCellText(
      "Rate",
      tableX + col1W + col2W + cellPadX,
      tableYTop + rowPadY,
      headerSize,
      col3W - cellPadX * 2,
      "center"
    );
    drawTableCellText(
      "Amount",
      tableX + col1W + col2W + col3W + cellPadX,
      tableYTop + rowPadY,
      headerSize,
      col4W - cellPadX * 2,
      "center"
    );

    // Data row
    const dataY = tableYTop + headerHeight + 10;
    const dataSize = 12;
    const dataHeight = dataSize + rowPadY + 10;
    drawTableCellText(
      "HOUSE RENT",
      tableX + cellPadX,
      dataY,
      dataSize,
      col1W - cellPadX * 2,
      "left"
    );
    drawTableCellText(
      periodDisplay,
      tableX + col1W + cellPadX,
      dataY,
      dataSize,
      col2W - cellPadX * 2,
      "center"
    );
    drawTableCellText(
      `Rs.${rateFormatted}/- P.M`,
      tableX + col1W + col2W + cellPadX,
      dataY,
      dataSize,
      col3W - cellPadX * 2,
      "center"
    );
    drawTableCellText(
      `Rs.${amountFormatted}/-`,
      tableX + col1W + col2W + col3W + cellPadX,
      dataY,
      dataSize,
      col4W - cellPadX * 2,
      "center"
    );

    // Outer table rectangle and internal column dividers (2-row table: header line already drawn)
    const tableHeight = headerHeight + dataHeight;
    const tableBottomY = tableYTop + tableHeight;
    // Outline
    page.drawRectangle({
      x: tableX,
      y: pageHeight - tableBottomY,
      width: tableWidth,
      height: tableHeight,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
    // Column dividers
    const dividerY1 = pageHeight - tableYTop;
    const dividerY2 = pageHeight - tableBottomY;
    const x1 = tableX + col1W;
    const x2 = x1 + col2W;
    const x3 = x2 + col3W;
    page.drawLine({
      start: { x: x1, y: dividerY2 },
      end: { x: x1, y: dividerY1 },
      color: rgb(0, 0, 0),
      thickness: 1,
    });
    page.drawLine({
      start: { x: x2, y: dividerY2 },
      end: { x: x2, y: dividerY1 },
      color: rgb(0, 0, 0),
      thickness: 1,
    });
    page.drawLine({
      start: { x: x3, y: dividerY2 },
      end: { x: x3, y: dividerY1 },
      color: rgb(0, 0, 0),
      thickness: 1,
    });

    // Signature block at bottom-right
    const sigBlockBottom = padBottom - 20; // keep some spacing from page bottom padding
    const sigBlockRight = padRight;
    const sigImgMaxW = 92; // smaller to match preview and reduce blur
    const sigImgMaxH = 32; // smaller height
    let sigYTop = pageHeight - sigBlockBottom - sigImgMaxH; // approximate top position for image
    let signatureUrl: string | null = values.signature_url || null;
    if (
      !signatureUrl &&
      values.landlord_mode === "existing" &&
      values.landlord_id
    ) {
      const existing = landlords.find((l) => l.id === values.landlord_id);
      if (existing?.signature_url) signatureUrl = existing.signature_url;
    }
    if (
      signatureUrl &&
      typeof signatureUrl === "string" &&
      signatureUrl.startsWith("data:image/")
    ) {
      try {
        const isPng = signatureUrl.startsWith("data:image/png");
        const bin = Uint8Array.from(
          atob(signatureUrl.split(",")[1] || ""),
          (c) => c.charCodeAt(0)
        );
        const img = isPng
          ? await pdfDoc.embedPng(bin)
          : await pdfDoc.embedJpg(bin);
        // Do not upscale; only downscale to avoid blur
        const scale = Math.min(
          1,
          sigImgMaxW / img.width,
          sigImgMaxH / img.height
        );
        const dw = img.width * scale;
        const dh = img.height * scale;
        // Center image over the signature label box (200px wide)
        const boxWidth = 200;
        const boxLeft = baseWidth - sigBlockRight - boxWidth;
        const dx = boxLeft + (boxWidth - dw) / 2;
        // Anchor the image just above the first signature label with a small gap
        const label1Top = pageHeight - padBottom + 40; // yTop used for first label
        const gap = 6; // tighter distance between image bottom and label top
        const dy = pageHeight - (label1Top - gap);
        page.drawImage(img, { x: dx, y: dy, width: dw, height: dh });
        sigYTop += dh + 8;
      } catch {}
    }
    // Signature text lines (centered within a right-aligned box)
    const labelBoxW = 200;
    const labelLeft = baseWidth - sigBlockRight - labelBoxW;
    const sigLine1 = "Signature of House";
    const sigLine2 = "Owner";
    const sig1W = fontRegular.widthOfTextAtSize(sigLine1, 12);
    const sig2W = fontRegular.widthOfTextAtSize(sigLine2, 12);
    const sig1X = labelLeft + (labelBoxW - sig1W) / 2;
    const sig2X = labelLeft + (labelBoxW - sig2W) / 2;
    drawText(sigLine1, sig1X, pageHeight - padBottom + 40, 12);
    drawText(sigLine2, sig2X, pageHeight - padBottom + 58, 12);

    // Save
    const bytes = await pdfDoc.save();
    // Create a fresh ArrayBuffer (not SharedArrayBuffer) and copy bytes
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
  }

  // Print the current preview in a clean A4 layout
  function printPreview() {
    if (!previewHtml) return;
    // Extract inner body HTML from previewHtml (falls back to raw if not present)
    const bodyMatch = previewHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const inner = bodyMatch ? bodyMatch[1] : previewHtml;

    const w = window.open("", "_blank");
    if (!w) return;
    const doc = w.document;
    const html = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <title>Print Preview</title>
        <style>
          /* Use physical units to avoid fractional scaling by the browser */
          @page { size: A4; margin: 0; }
          html, body { background: #f3f4f6; height: 100%; }
          body { margin: 0; }
          .wrap { width: 210mm; min-height: 297mm; margin: 0 auto; background: #ffffff; }
          /* Rendering hints for sharper output */
          html, body, .wrap { -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
          img { image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; }
          /* Table print normalization for sharp borders */
          .wrap table { width: 100%; border-collapse: collapse; border-spacing: 0; }
          .wrap th, .wrap td { border: 0.8pt solid #1f2937; /* dark gray close to black */ padding: 3mm 2mm; }
          .wrap thead th { border-bottom-width: 1pt; }
          .wrap tr { page-break-inside: avoid; }
          .wrap th { font-weight: 700; }
          /* Improve print fidelity */
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
        <div class=\"wrap\">${inner}</div>
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
  }

  // Schema-driven vector PDF export for selected template (uses pdf-lib)
  async function exportTemplateVectorPdf() {
    if (!selectedTemplate) {
      alert("No template selected");
      return;
    }

    // Match preview sizing exactly (see buildTemplatePreviewHtml)
    const baseWidth = 794; // px
    const tplWidth = Math.max(1, selectedTemplate.width ?? 794);
    const tplHeight = Math.max(1, selectedTemplate.height ?? 1123);
    const scale = baseWidth / tplWidth;
    const scaledHeight = Math.round(tplHeight * scale);
    const safePad = 16; // px padding used in preview

    // Build a PDF page with same dimensions as preview wrapper
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([baseWidth, scaledHeight]);

    // Prepare fonts
    const fontRegular = await pdfDoc.embedStandardFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedStandardFont(
      StandardFonts.HelveticaBold
    );

    // Helpers
    const parseColorWithOpacity = (
      s?: string
    ): { color: ReturnType<typeof rgb>; opacity: number } | null => {
      if (!s) return null;
      const val = s.trim().toLowerCase();
      if (val === "transparent") return null;
      // #rgb / #rrggbb
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
      // rgb(a)
      const m = val.match(/^rgba?\(([^)]+)\)$/);
      if (m) {
        const parts = m[1].split(",").map((p) => p.trim());
        const r = Math.min(255, Math.max(0, parseFloat(parts[0] || "0"))) / 255;
        const g = Math.min(255, Math.max(0, parseFloat(parts[1] || "0"))) / 255;
        const b = Math.min(255, Math.max(0, parseFloat(parts[2] || "0"))) / 255;
        const a =
          parts[3] !== undefined
            ? Math.min(1, Math.max(0, parseFloat(parts[3])))
            : 1;
        return { color: rgb(r, g, b), opacity: a };
      }
      return null;
    };

    const drawWrappedText = (
      text: string,
      opts: {
        x: number;
        y: number;
        maxWidth: number;
        lineHeight: number;
        fontSize: number;
        align: "left" | "center" | "right";
        bold?: boolean;
        color: ReturnType<typeof rgb>;
      }
    ) => {
      const font = opts.bold ? fontBold : fontRegular;
      // naive wrap by words within maxWidth
      const words = text.split(/\s+/);
      let line = "";
      let cursorY = opts.y; // y is top; pdf-lib draws from bottom baseline, so adjust below
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
      // draw each line
      for (let i = 0; i < lines.length; i++) {
        const s = lines[i];
        const w = font.widthOfTextAtSize(s, opts.fontSize);
        let x = opts.x;
        if (opts.align === "center") x = opts.x + (opts.maxWidth - w) / 2;
        if (opts.align === "right") x = opts.x + (opts.maxWidth - w);
        const yBaseline = scaledHeight - (cursorY + ascent); // convert top-origin to PDF bottom-origin
        page.drawText(s, {
          x,
          y: yBaseline,
          size: opts.fontSize,
          font,
          color: opts.color,
        });
        cursorY += opts.lineHeight;
      }
    };

    // Optional: draw inner background (white) to mimic preview
    page.drawRectangle({
      x: 0,
      y: 0,
      width: baseWidth,
      height: scaledHeight,
      color: rgb(1, 1, 1),
    });

    // Draw fields (scaled and inset by safePad)
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

      // Background
      if (bgParsed) {
        page.drawRectangle({
          x,
          y: scaledHeight - (y + h),
          width: w,
          height: h,
          color: bgParsed.color,
          opacity: bgParsed.opacity,
        });
      }
      // Border
      if (borderWidth > 0) {
        page.drawRectangle({
          x,
          y: scaledHeight - (y + h),
          width: w,
          height: h,
          borderColor,
          borderWidth,
          opacity: borderParsed?.opacity ?? 1,
        });
      }

      if (f.type === "image" || f.type === "signature") {
        const src = v || "";
        if (src.startsWith("data:image/")) {
          try {
            const isPng = src.startsWith("data:image/png");
            const bin = Uint8Array.from(
              atob(src.split(",")[1] || ""),
              (c) => c.charCodeAt(0)
            );
            const img = isPng
              ? await pdfDoc.embedPng(bin)
              : await pdfDoc.embedJpg(bin);
            const imgW = img.width;
            const imgH = img.height;
            // contain fit
            const scale = Math.min(w / imgW, h / imgH);
            const dw = imgW * scale;
            const dh = imgH * scale;
            const dx = x + (w - dw) / 2;
            const dy = scaledHeight - (y + (h + dh) / 2); // center vertically
            page.drawImage(img, { x: dx, y: dy, width: dw, height: dh });
          } catch {}
        }
        continue;
      }

      // Text-like fields
      const padding = 6; // inner padding
      const contentX = x + padding;
      const contentY = y + padding;
      const contentW = Math.max(1, w - padding * 2);
      const lineHeight = Math.round(fs * 1.32);
      // Split by newlines, wrap each paragraph
      const paragraphs = v.split(/\r?\n/);
      let currentY = contentY;
      for (const para of paragraphs) {
        drawWrappedText(para, {
          x: contentX,
          y: currentY,
          maxWidth: contentW,
          lineHeight,
          fontSize: fs,
          align: align,
          bold: isBold,
          color: textColor,
        });
        // advance estimate: wrap height unknown; approximate by word-wrapped length
        const font = isBold ? fontBold : fontRegular;
        const words = para.split(/\s+/);
        let line = "";
        let lines = 0;
        for (const w2 of words) {
          const t = line ? line + " " + w2 : w2;
          if (font.widthOfTextAtSize(t, fs) <= contentW || line.length === 0) {
            line = t;
          } else {
            lines += 1;
            line = w2;
          }
        }
        if (line) lines += 1;
        currentY += lines * lineHeight;
      }
    }

    const bytes = await pdfDoc.save();
    // Create a fresh ArrayBuffer (not SharedArrayBuffer) and copy bytes for Blob
    const ab2 = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab2).set(bytes);
    const blob = new Blob([ab2], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const name = (selectedTemplate.name || "template")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    a.href = url;
    a.download = `${name}_vector.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-screen overflow-hidden">
      <div className="grid gap-6 max-w-6xl mx-auto px-3 sm:px-6 pt-6 sm:pt-8 pb-28 sm:pb-32 overflow-auto min-w-0 h-full">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              House Rent Bill
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Create, preview, and export a professional house rent bill.
            </p>
          </div>
        </div>

        {/* Template (optional) selector */}
        <Card className="w-full md:col-span-2">
          <CardHeader className="flex items-center justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="text-base">Template (optional)</CardTitle>
              <CardDescription>
                Use a saved template or continue with the default layout.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadTemplates}
              title="Reload templates"
            >
              Reload
            </Button>
          </CardHeader>
          <CardContent>
            <label className="grid gap-1">
              <span className="text-sm">Choose a saved template</span>
              <select
                className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                onFocus={loadTemplates}
              >
                <option value="">— None (use default House Bill) —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </CardContent>
        </Card>

        {/* If a template is selected, show template UI + PdfUpload; else show the original form unchanged */}
        <div className="grid items-start gap-8 md:grid-cols-[3fr_4fr]">
          {selectedTemplateId ? (
            <div className="flex flex-col gap-6 w-full">
              {(() => {
                const tpl = selectedTemplate;
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Selected Template
                      </CardTitle>
                      <div className="text-base font-medium">
                        {tpl?.name ?? "Template"}
                      </div>
                      {tpl?.description && (
                        <CardDescription>{tpl.description}</CardDescription>
                      )}
                    </CardHeader>
                  </Card>
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
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Template Fields</CardTitle>
                    <CardDescription>
                      Fill the values used to render the template.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-4">
                    {selectedTemplate.fields.map((f) => {
                      const val = templateForm[f.id] ?? "";
                      const setVal = (v: string) =>
                        setTemplateForm((prev) => ({ ...prev, [f.id]: v }));
                      if (f.type === "textarea") {
                        return (
                          <label key={f.id} className="grid gap-1">
                            <span className="text-sm">{f.label}</span>
                            <textarea
                              className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[84px]"
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
                              className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              value={val}
                              onChange={(e) => setVal(e.target.value)}
                            >
                              <option value="">Select...</option>
                              {f.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      }
                      if (f.type === "image" || f.type === "signature") {
                        return (
                          <label key={f.id} className="grid gap-1">
                            <span className="text-sm">
                              {f.label} ({f.type})
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                // Wrap read in a tracked promise so submit can await completion
                                const p = new Promise<void>((resolve) => {
                                  reader.onload = () => {
                                    setVal(String(reader.result ?? ""));
                                    resolve();
                                  };
                                  reader.onerror = () => resolve();
                                });
                                pendingReadsRef.current = [
                                  ...pendingReadsRef.current,
                                  p,
                                ];
                                reader.readAsDataURL(file);
                                // Clean up this promise when done
                                p.finally(() => {
                                  pendingReadsRef.current =
                                    pendingReadsRef.current.filter(
                                      (it) => it !== p
                                    );
                                });
                              }}
                            />
                            {val && (
                              <span className="text-xs opacity-70">
                                Image selected
                              </span>
                            )}
                          </label>
                        );
                      }
                      // text, number, date, amount -> map to input
                      const inputType =
                        f.type === "date"
                          ? "date"
                          : f.type === "number" || f.type === "amount"
                          ? "number"
                          : "text";
                      return (
                        <label key={f.id} className="grid gap-1">
                          <span className="text-sm">{f.label}</span>
                          <input
                            className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            type={inputType}
                            placeholder={f.placeholder}
                            value={val}
                            onChange={(e) => setVal(e.target.value)}
                          />
                        </label>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTemplateId("")}
                >
                  Back to default form
                </Button>
              </div>

              {/* Validation summary for template mode */}
              {templateErrors.length > 0 && (
                <div className="rounded-md ring-1 ring-red-500/40 bg-red-500/5 p-3 sm:p-4">
                  <div className="text-sm font-semibold text-red-600 mb-1">
                    Please fix the following:
                  </div>
                  <ul className="list-disc pl-5 text-sm text-red-700 space-y-0.5">
                    {templateErrors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Primary action only; export/print live in the Preview toolbar */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                <Button
                  type="button"
                  disabled={saving}
                  onClick={submitFromTemplate}
                >
                  {saving ? "Saving..." : "Save & Preview"}
                </Button>
              </div>
            </div>
          ) : (
            <form
              ref={formRef}
              className="flex flex-col gap-6 w-full min-w-0 break-words"
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <div className="overflow-visible">
                <PdfUpload
                  onFieldsExtracted={handleFieldsExtracted}
                  onNextMonthBill={handleNextMonthBill}
                  disabled={saving}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Bill details</CardTitle>
                  <CardDescription>
                    Set the billing month, date, and number.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BillDetailsSection
                    form={form}
                    onGenerateBillNumber={() => {
                      const randomBillNumber = `BILL-${uuidv4()
                        .slice(0, 8)
                        .toUpperCase()}`;
                      form.setValue("bill_number", randomBillNumber);
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Landlord</CardTitle>
                  <CardDescription>
                    Choose a saved landlord or enter details manually.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LandlordSection
                    form={form}
                    landlordMode={landlordMode}
                    landlords={landlords}
                    landlordIdExisting={landlordIdExisting}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Payment & Signature
                  </CardTitle>
                  <CardDescription>
                    Enter rent amount and optionally attach a signature image.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                  <label className="grid gap-1">
                    <span className="text-sm">Rate (Rs./P.M)</span>
                    <input
                      className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g. 12000"
                      {...form.register("rate")}
                    />
                    {form.formState.errors.rate && (
                      <span className="text-xs text-red-600">
                        {form.formState.errors.rate.message as string}
                      </span>
                    )}
                  </label>
                  <PaymentSignatureSection
                    form={form}
                    fileInputRef={fileInputRef}
                    signatureFileName={signatureFileName}
                    setSignatureFileName={setSignatureFileName}
                    landlordMode={landlordMode}
                    landlordIdExisting={landlordIdExisting}
                    landlords={landlords}
                    fileToDataUrl={fileToDataUrl}
                  />
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                <Button disabled={saving} type="submit">
                  {saving ? "Saving..." : "Save & Preview"}
                </Button>
              </div>
            </form>
          )}
          {previewHtml && (
            <PreviewPanel
              title="Preview"
              previewHtml={previewHtml}
              previewScale={previewScale}
              baseHeight={baseHeight}
              previewContainerRef={previewContainerRef}
              previewInnerRef={previewInnerRef}
              onExportPdf={exportPdf}
              onExportVectorPdf={
                selectedTemplateId ? exportTemplateVectorPdf : exportDefaultVectorPdf
              }
              onPrint={printPreview}
            />
          )}
        </div>

        {/* Global sticky footer actions */}
        <FooterActions
          saving={saving}
          selectedTemplateId={selectedTemplateId}
          onSaveAndPreviewTemplate={submitFromTemplate}
          onSaveAndPreviewForm={() => formRef.current?.requestSubmit()}
          onExportPdf={exportPdf}
          onExportVectorPdf={
            selectedTemplateId ? exportTemplateVectorPdf : exportDefaultVectorPdf
          }
          onPrint={printPreview}
          previewHtml={previewHtml}
        />
      </div>
    </div>
  );
}
