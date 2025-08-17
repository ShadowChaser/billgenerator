"use client";

import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { BillFormInput } from "@/lib/validation";
import type { Landlord } from "@/lib/types";

export function useLandlordSignatureSync(params: {
  form: UseFormReturn<BillFormInput>;
  landlords: Landlord[];
  landlordMode: string;
  landlordIdExisting: string;
}) {
  const { form, landlords, landlordMode, landlordIdExisting } = params;
  const [signatureFileName, setSignatureFileName] = useState<string | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-fill signature from existing landlord selection and reset when mode/selection changes
  useEffect(() => {
    if (landlordMode === "existing" && landlordIdExisting) {
      const existing = landlords.find((l) => l.id === landlordIdExisting);
      if (existing?.signature_url) {
        form.setValue("signature_url", existing.signature_url as any);
      } else {
        form.setValue("signature_url", null as any);
      }
    }
    if (landlordMode === "manual") {
      // Avoid carrying over signature_url from previous existing selection
      form.setValue("signature_url", null as any);
    }
    // Reset displayed file name when landlord selection/mode changes
    setSignatureFileName(null);
    // Also clear file input if present
    if (fileInputRef.current) {
      try {
        fileInputRef.current.value = "";
      } catch {}
    }
  }, [landlordMode, landlordIdExisting, landlords, form]);

  return { signatureFileName, setSignatureFileName, fileInputRef } as const;
}
