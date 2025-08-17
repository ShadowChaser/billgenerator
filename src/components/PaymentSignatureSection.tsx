"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import type { Landlord } from "@/lib/types";

interface PaymentSignatureSectionProps {
  form: any;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  signatureFileName: string | null;
  setSignatureFileName: (name: string | null) => void;
  landlordMode: string;
  landlordIdExisting: string | null;
  landlords: Landlord[];
  fileToDataUrl: (file: File) => Promise<string>;
}

export function PaymentSignatureSection({
  form,
  fileInputRef,
  signatureFileName,
  setSignatureFileName,
  landlordMode,
  landlordIdExisting,
  landlords,
  fileToDataUrl,
}: PaymentSignatureSectionProps) {
  return (
    <>
      <label className="grid gap-1">
        <span className="text-sm">Amount</span>
        <input
          type="number"
          placeholder="10000"
          className="w-full rounded border px-3 py-2"
          {...form.register("amount")}
        />
        {form.formState?.errors?.amount && (
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
            // Immediately set signature_url so preview uses the newly selected image
            if (file) {
              fileToDataUrl(file)
                .then((dataUrl) => {
                  form.setValue("signature_url", dataUrl);
                })
                .catch(() => {
                  // ignore
                });
            } else {
              form.setValue("signature_url", null);
            }
          }}
        />
        {/* Visible proxy control */}
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Choose signature image file"
        >
          {(() => {
            const existing =
              landlordMode === "existing" && landlordIdExisting
                ? landlords.find((l) => l.id === landlordIdExisting)
                : undefined;
            const displayName = signatureFileName || existing?.signature_name || null;
            return <span className="opacity-80">Choose File {displayName ?? "No file chosen"}</span>;
          })()}
        </Button>
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
    </>
  );
}
