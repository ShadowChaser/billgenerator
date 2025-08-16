"use client";
import { useState } from "react";
import { BillFormInput } from "@/lib/validation";
import { PdfTextExtractor } from "./PdfTextExtractor";
import { DocxTextExtractor } from "./DocxTextExtractor";
import { ImageTextExtractor } from "./ImageTextExtractor";
import { BillFieldExtractor } from "./BillFieldExtractor";

interface FileUploadHandlerProps {
  onFieldsExtracted: (fields: Partial<BillFormInput>) => void;
  disabled?: boolean;
}

export function useFileUploadHandler({ onFieldsExtracted, disabled }: FileUploadHandlerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const name = file.name.toLowerCase();
    const isPdf = name.endsWith(".pdf") || file.type.includes("pdf");
    const isDocx = name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isDoc = name.endsWith(".doc");
    const isImage = ["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp");

    if (!isPdf && !isDocx && !isImage) {
      setError("Please select a PDF, DOCX, or Image file (.pdf, .docx, .png, .jpg, .jpeg, .webp). Legacy .doc is not supported in-browser.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const text = isPdf
        ? await PdfTextExtractor.extractTextFromPdf(file)
        : isDocx
        ? await DocxTextExtractor.extractTextFromDocx(file)
        : isImage
        ? await ImageTextExtractor.extractTextFromImage(file)
        : (() => {
            if (isDoc) {
              throw new Error("Legacy .doc files are not supported in the browser. Please convert to .docx or PDF.");
            }
            throw new Error("Unsupported file type.");
          })();

      console.log("Extracted text from file (length:", text.length, "):", JSON.stringify(text.substring(0, 500)));
      const extractedFields = BillFieldExtractor.extractFieldsFromText(text);

      if (Object.keys(extractedFields).length === 0) {
        setError("No relevant information found in the file. Please check if it contains bill details.");
        console.log("No fields extracted. Extracted text preview:", text.substring(0, 1000));
      } else {
        onFieldsExtracted(extractedFields);
        localStorage.setItem("lastExtractedFields", JSON.stringify(extractedFields));
        const fieldCount = Object.keys(extractedFields).length;
        setSuccess(`Successfully extracted ${fieldCount} field(s) from the file!`);
        console.log("Extracted fields:", extractedFields);
        setError(null);
      }
    } catch (err) {
      console.error("Error processing file:", err);
      if (err instanceof Error) {
        setError(`Failed to process file: ${err.message}`);
      } else {
        setError("Failed to process file. Please try again.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const generateNextMonthBill = () => {
    const lastExtractedFields = JSON.parse(localStorage.getItem("lastExtractedFields") || "{}");
    const nextMonthFields = BillFieldExtractor.generateNextMonthFields(lastExtractedFields);
    onFieldsExtracted(nextMonthFields);
  };

  return {
    isProcessing,
    error,
    success,
    handleFileUpload,
    generateNextMonthBill,
  };
}
