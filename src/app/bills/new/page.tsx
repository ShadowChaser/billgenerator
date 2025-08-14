"use client";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
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

function buildPeriodFromDate(date: Date) {
  return `${monthNames[date.getMonth()]}-${date.getFullYear()}`;
}

export default function NewBillPage() {
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const form = useForm<BillFormInput>({
    resolver: zodResolver(billFormSchema),
    defaultValues: {
      bill_mode: "auto",
      date: format(new Date(), "yyyy-MM-dd"),
      agreement_date: format(new Date(), "yyyy-MM-dd"),
      period: buildPeriodFromDate(new Date()),
      landlord_mode: "select",
    },
  });

  useEffect(() => {
    let ls = getLandlordsLocal();
    const existing = ls.find(
      (l) => l.name.trim().toLowerCase() === "bijayini kundu"
    );
    let seeded = existing;
    if (!existing) {
      const newL: Landlord = {
        id: uuidv4(),
        name: "Bijayini Kundu",
        address: "",
        signature_url: undefined,
        created_at: new Date().toISOString(),
      };
      saveLandlord(newL);
      seeded = newL;
      ls = [newL, ...ls];
    }
    setLandlords(ls);
    form.setValue("landlord_mode", "select");
    if (seeded) {
      form.setValue("landlord_id", seeded.id as any);
    }
  }, [form]);

  const landlordId = form.watch("landlord_id");
  const landlordMode = form.watch("landlord_mode");
  const landlordNameManual = form.watch("landlord_name")?.trim() ?? "";
  const selectedLandlord = useMemo(() => {
    return landlords.find((l) => l.id === landlordId);
  }, [landlords, landlordId]);

  async function computeNextBillNumber(): Promise<string> {
    return computeNextNumericBillNumber();
  }

  async function onSubmit(values: BillFormInput) {
    setSaving(true);
    try {
      let finalBillNumber = values.bill_number ?? "";
      if (values.bill_mode === "auto") {
        finalBillNumber = await computeNextBillNumber();
      } else if (values.bill_mode === "random") {
        finalBillNumber = `BILL-${uuidv4().slice(0, 8).toUpperCase()}`;
      }

      let signatureUrl =
        values.signature_url ?? selectedLandlord?.signature_url ?? null;

      const fileList = (values as { signature_file?: FileList }).signature_file;
      const file: File | undefined = fileList?.[0];
      if (file) {
        signatureUrl = await fileToDataUrl(file);
      }

      // Determine landlord id/name: create one if manual mode
      let landlordIdForBill = values.landlord_id as string;
      let landlordNameForPdf = selectedLandlord?.name ?? "";
      if (values.landlord_mode === "manual") {
        const newLandlord: Landlord = {
          id: uuidv4(),
          name: landlordNameManual,
          address: "",
          signature_url: undefined,
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
        period: values.period,
        landlord_id: landlordIdForBill,
        agreement_date: values.agreement_date,
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
      const billDateDisplay = format(new Date(values.date), "dd-MM-yyyy");
      const agreementDisplay = format(
        new Date(values.agreement_date),
        "do MMMM yyyy"
      );
      const periodDisplay = values.period.replace("-", "- ");
      const html = `
        <div style="position:relative; font-family:'Times New Roman', Times, serif; color:#000; width:794px; height:1123px; margin:0 auto; padding:24px 36px; background:#ffffff;">
          <div style="text-align:center; font-weight:700; font-size:18pt; text-decoration: underline;">HOUSE RENT BILL</div>

          <div style="margin-top:20px; font-size:12pt;">
            <div style="margin-bottom:10px; font-weight:700;">PERIOD OF BILL: <span style="font-weight:700;">${periodDisplay}</span></div>
            <div style="display:flex; justify-content:space-between; max-width:560px; font-weight:700;">
              <div>BILL NO:${finalBillNumber}</div>
              <div>DATE: ${billDateDisplay}</div>
            </div>
          </div>

          <div style="margin-top:28px; font-size:12pt; line-height:1.45; max-width:640px;">
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
                <td style="padding:10px 6px;">Rs.${amountFormatted}/- P.M</td>
                <td style="padding:10px 6px;">Rs.${amountFormatted}/-</td>
              </tr>
            </tbody>
          </table>

          <div style="position:absolute; right:36px; bottom:90px; text-align:right;">
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
    // Fix width to A4 at ~96dpi for sharper rasterization
    element.style.width = "794px"; // 210mm ≈ 794px @96dpi
    element.style.margin = "0 auto";
    element.style.background = "#ffffff";
    document.body.appendChild(element);
    const scale = Math.max(2, Math.ceil((window.devicePixelRatio || 1) * 2));
    await html2pdf()
      .from(element)
      .set({
        margin: 10,
        filename: `house-rent-bill-${Date.now()}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale, useCORS: true, scrollX: 0, scrollY: 0 },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
          compress: true,
        },
      })
      .save();
    element.remove();
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">New House Rent Bill</h1>

      <form
        className="grid gap-6 max-w-3xl"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="rounded-md border p-4 grid gap-4">
          <div className="text-sm font-semibold opacity-80">Bill details</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="grid gap-1">
              <span className="text-sm">Period (MONTH-YEAR)</span>
              <input
                className="border rounded px-3 py-2 bg-transparent"
                placeholder="e.g. JANUARY-2025"
                {...form.register("period")}
              />
              {form.formState.errors.period && (
                <span className="text-xs text-red-600">
                  {form.formState.errors.period.message as string}
                </span>
              )}
            </label>
            <label className="grid gap-1">
              <span className="text-sm">Bill Date</span>
              <input
                type="date"
                className="border rounded px-3 py-2 bg-transparent"
                {...form.register("date")}
              />
              {form.formState.errors.date && (
                <span className="text-xs text-red-600">Date is required</span>
              )}
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <label className="grid gap-1">
              <span className="text-sm">Bill Mode</span>
              <select
                className="border rounded px-3 py-2 bg-transparent"
                {...form.register("bill_mode")}
                onChange={(e) => {
                  form.setValue(
                    "bill_mode",
                    e.target.value as typeof form.getValues extends never
                      ? never
                      : "auto" | "manual" | "random"
                  );
                }}
              >
                <option value="auto">Auto</option>
                <option value="manual">Manual</option>
                <option value="random">Random</option>
              </select>
            </label>
            <label className="grid gap-1 sm:col-span-2">
              <span className="text-sm">
                Bill Number{" "}
                {form.watch("bill_mode") !== "manual" ? "(auto)" : "(manual)"}
              </span>
              <input
                className="border rounded px-3 py-2 bg-transparent"
                placeholder="Enter bill number"
                disabled={form.watch("bill_mode") !== "manual"}
                {...form.register("bill_number")}
              />
            </label>
          </div>
        </div>

        <div className="rounded-md border p-4 grid gap-4">
          <div className="text-sm font-semibold opacity-80">Landlord</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <div className="flex items-center gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    value="select"
                    {...form.register("landlord_mode")}
                    defaultChecked
                  />
                  Select landlord
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    value="manual"
                    {...form.register("landlord_mode")}
                  />
                  Enter name
                </label>
              </div>
              {landlordMode === "select" ? (
                <label className="grid gap-1">
                  <span className="text-sm">Landlord</span>
                  <select
                    className="border rounded px-3 py-2 bg-transparent"
                    {...form.register("landlord_id")}
                  >
                    <option value="">Select landlord</option>
                    {landlords.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  {(form.formState.errors.landlord_id ||
                    form.formState.errors.landlord_mode) && (
                    <span className="text-xs text-red-600">
                      Select a landlord
                    </span>
                  )}
                </label>
              ) : (
                <label className="grid gap-1">
                  <span className="text-sm">Landlord Name</span>
                  <input
                    className="border rounded px-3 py-2 bg-transparent"
                    placeholder="Type landlord name"
                    {...form.register("landlord_name")}
                  />
                  {(form.formState.errors.landlord_name ||
                    form.formState.errors.landlord_mode) && (
                    <span className="text-xs text-red-600">
                      Enter a landlord name
                    </span>
                  )}
                </label>
              )}
            </div>
            <label className="grid gap-1">
              <span className="text-sm">Agreement Date</span>
              <input
                type="date"
                className="border rounded px-3 py-2 bg-transparent"
                {...form.register("agreement_date")}
              />
              {form.formState.errors.agreement_date && (
                <span className="text-xs text-red-600">
                  Agreement date is required
                </span>
              )}
            </label>
          </div>
        </div>

        <div className="rounded-md border p-4 grid gap-4">
          <div className="text-sm font-semibold opacity-80">
            Payment & Signature
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="grid gap-1">
              <span className="text-sm">Amount (Rs.)</span>
              <input
                className="border rounded px-3 py-2 bg-transparent"
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
              <input
                type="file"
                accept="image/*"
                className="border rounded px-3 py-2 bg-transparent"
                {...form.register("signature_file")}
              />
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            disabled={saving}
            className="px-4 py-2 rounded bg-foreground text-background disabled:opacity-50"
            type="submit"
          >
            {saving ? "Saving..." : "Save & Preview"}
          </button>
          {previewHtml && (
            <button
              type="button"
              onClick={exportPdf}
              className="px-4 py-2 rounded border"
            >
              Download PDF
            </button>
          )}
        </div>
      </form>

      {previewHtml && (
        <div className="mt-6 border rounded p-4 responsive-pane">
          <div className="text-sm font-semibold mb-2">Preview</div>
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      )}
    </div>
  );
}
