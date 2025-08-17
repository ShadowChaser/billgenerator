"use client";
import { useEffect, useRef, useState } from "react";
import { usePreviewLayout } from "@/hooks/usePreviewLayout";
import { useLandlordSignatureSync } from "@/hooks/useLandlordSignatureSync";
import { useBillExport } from "@/hooks/useBillExport";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { billFormSchema, type BillFormInput } from "@/lib/validation";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { Landlord, Bill } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { PreviewPanel } from "@/components/PreviewPanel";
import { PaymentSignatureSection } from "@/components/PaymentSignatureSection";
import { BillDetailsSection } from "@/components/BillDetailsSection";
import { LandlordSection } from "@/components/LandlordSection";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  computeNextNumericBillNumber,
  fileToDataUrl,
  getLandlords as getLandlordsLocal,
  saveLandlord,
  saveBill,
} from "@/lib/localStore";
import PdfUpload from "@/components/PdfUpload";

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
  const [showUploadHelp, setShowUploadHelp] = useState(false);
  const { previewContainerRef, previewInnerRef, previewScale, baseHeight } =
    usePreviewLayout(previewHtml);
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

  // Watched landlord fields (used by signature sync hook)
  const landlordMode = form.watch("landlord_mode");
  const landlordIdExisting = form.watch("landlord_id") ?? "";

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
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Landlord signature sync + file input/name management
  const { signatureFileName, setSignatureFileName, fileInputRef } =
    useLandlordSignatureSync({
      form: form as any,
      landlords,
      landlordMode,
      landlordIdExisting,
    });

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

  // Preview layout (scale/height) handled by usePreviewLayout

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

  const landlordNameManual = form.watch("landlord_name")?.trim() ?? "";

  // Signature syncing handled by useLandlordSignatureSync

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

  // Export/print handlers via hook
  const { exportPdf, printPreview, exportDefaultVectorPdf, exportTemplateVectorPdf } =
    useBillExport({
      previewHtml,
      baseHeight,
      form: form as any,
      landlords,
      selectedTemplate,
      templateForm,
    });

  return (
    <div className="min-h-screen">
      <div className="grid gap-6 max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-3 sm:px-6 pt-6 sm:pt-8 pb-20 sm:pb-24 min-w-0">
        {/* Header with primary action (non-sticky) */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base">New Bill</CardTitle>
            <CardDescription>Create, preview, and export a professional house rent bill.</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              disabled={saving}
              onClick={() => {
                if (selectedTemplateId) {
                  submitFromTemplate();
                } else {
                  formRef.current?.requestSubmit();
                }
              }}
              title="Save and update preview"
            >
              {saving ? "Saving..." : "Save & Preview"}
            </Button>
            <span className="text-xs text-gray-500">Updates the preview on the right.</span>
          </div>
        </div>

        {/* Template selector following requested pattern */}
        <Card className="w-full md:col-span-2">
          <CardHeader className="flex items-center justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="text-base">Template</CardTitle>
              <CardDescription>
                Pick a saved template or continue with the default layout.
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
          <CardContent className="space-y-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTemplateSelector((v) => !v)}
            >
              Use template
            </Button>
            {showTemplateSelector && (
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
            )}
          </CardContent>
        </Card>

        {/* If a template is selected, show template UI + PdfUpload; else show the original form unchanged */}
        <div className="grid grid-cols-12 items-start gap-5 md:gap-5 xl:gap-6">
          {selectedTemplateId ? (
            <div className="col-span-12 md:col-span-6 xl:col-span-6 flex flex-col gap-4 w-full">
              {(() => {
                const tpl = selectedTemplate;
                return (
                  <Card>
                    <CardHeader className="pb-3">
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

              <Card className="overflow-visible">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Upload</CardTitle>
                  <CardDescription>
                    Drag and drop a file here or click to upload
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <PdfUpload
                    onFieldsExtracted={handleFieldsExtracted}
                    onNextMonthBill={handleNextMonthBill}
                    disabled={saving}
                  />
                  <p className="text-xs text-gray-500 mt-2 hidden lg:block">
                    Upload files in PDF, DOCX, or image formats
                  </p>
                  <div className="lg:hidden mt-2">
                    <button
                      type="button"
                      className="text-xs text-blue-500 hover:underline"
                      onClick={() => setShowUploadHelp((v) => !v)}
                    >
                      {showUploadHelp ? "Hide details" : "Show details"}
                    </button>
                    {showUploadHelp && (
                      <p className="text-xs text-gray-500 mt-1">
                        Supported formats: PDF (.pdf), Word (.docx), Images (.png, .jpg, .jpeg, .webp). Best results with bills generated here; scanned or complex layouts may not parse fully.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Dynamic fields for selected template */}
              {selectedTemplate && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Template Fields</CardTitle>
                    <CardDescription>
                      Fill the values used to render the template.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 grid grid-cols-1 gap-4">
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

              {/* Primary action (non-sticky) */}
              <div className="pt-2">
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
            <div className="col-span-12 md:col-span-6 xl:col-span-6">
              <form
                ref={formRef}
                className="flex flex-col gap-4 w-full min-w-0 break-words"
                onSubmit={form.handleSubmit(onSubmit)}
              >
              <Card className="overflow-visible">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Upload</CardTitle>
                  <CardDescription>
                    Drag and drop a file here or click to upload
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <PdfUpload
                    onFieldsExtracted={handleFieldsExtracted}
                    onNextMonthBill={handleNextMonthBill}
                    disabled={saving}
                  />
                  <p className="text-xs text-gray-500 mt-2 hidden lg:block">
                    Upload files in PDF, DOCX, or image formats
                  </p>
                  <div className="lg:hidden mt-2">
                    <button
                      type="button"
                      className="text-xs text-blue-500 hover:underline"
                      onClick={() => setShowUploadHelp((v) => !v)}
                    >
                      {showUploadHelp ? "Hide details" : "Show details"}
                    </button>
                    {showUploadHelp && (
                      <p className="text-xs text-gray-500 mt-1">
                        Supported formats: PDF (.pdf), Word (.docx), Images (.png, .jpg, .jpeg, .webp). Best results with bills generated here; scanned or complex layouts may not parse fully.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Bill Details</CardTitle>
                  <CardDescription>
                    Set the billing month, date, and number.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
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
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Landlord</CardTitle>
                  <CardDescription>
                    Choose a saved landlord or enter details manually.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <LandlordSection
                    form={form}
                    landlordMode={landlordMode}
                    landlords={landlords}
                    landlordIdExisting={landlordIdExisting}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Payment & Signature
                  </CardTitle>
                  <CardDescription>
                    Enter rent amount and optionally attach a signature image.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
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

              {/* Primary action (non-sticky) */}
              <div className="pt-2">
                <Button disabled={saving} type="submit">
                  {saving ? "Saving..." : "Save & Preview"}
                </Button>
              </div>
              </form>
            </div>
          )}
          {previewHtml && (
            <div className="col-span-12 md:col-span-6 xl:col-span-6">
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
            </div>
          )}
        </div>

        {/* Footer removed */}
      </div>
    </div>
  );
}
