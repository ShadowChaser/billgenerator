"use client";
import { BillFormInput } from "@/lib/validation";
import { useFileUploadHandler } from "./file-processing/FileUploadHandler";
import { FileUploadZone } from "./ui/FileUploadZone";
import { StatusMessage } from "./ui/StatusMessage";

interface PdfUploadProps {
  onFieldsExtracted: (fields: Partial<BillFormInput>) => void;
  onNextMonthBill?: (fields: Partial<BillFormInput>) => void;
  disabled?: boolean;
}

export default function PdfUploadRefactored({
  onFieldsExtracted,
  onNextMonthBill,
  disabled,
}: PdfUploadProps) {
  const {
    isProcessing,
    error,
    success,
    handleFileUpload,
    generateNextMonthBill,
  } = useFileUploadHandler({ onFieldsExtracted, disabled });

  return (
    <div className="rounded-md ring-1 ring-inset p-4 grid gap-4 min-w-0 overflow-visible">
      <div className="text-sm font-semibold opacity-80">
        Auto-fill from PDF, Word, or Image (.pdf, .docx, .png, .jpg, .jpeg, .webp)
      </div>
      
      <div className="text-xs rounded-md ring-1 ring-amber-300 bg-amber-50 text-amber-800 p-3 flex items-start gap-2 break-words">
        <span className="select-none">⚠️</span>
        <div>
          <div className="font-semibold">Important</div>
          <div>
            Uploads work best with bills generated from this page. Other PDFs/Word/images may not be detected correctly.
            If parsing fails or results look wrong, please fill the form manually.
          </div>
        </div>
      </div>

      <FileUploadZone
        onFileSelect={handleFileUpload}
        disabled={disabled}
        isProcessing={isProcessing}
      />

      {isProcessing && (
        <StatusMessage
          type="processing"
          message="Processing file (may take longer for scanned documents)... Please wait."
        />
      )}

      {error && <StatusMessage type="error" message={error} />}

      {success && <StatusMessage type="success" message={success} />}

      {success && onNextMonthBill && (
        <button
          type="button"
          onClick={generateNextMonthBill}
          className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
        >
          📅 Next Month Bill
        </button>
      )}

      <div className="text-xs text-gray-500 break-words">
        Upload a PDF, DOCX, or image bill to automatically extract and fill in the form fields.
        Supported formats: PDF (.pdf), Word (.docx), Images (.png, .jpg, .jpeg, .webp). Supported fields: Landlord name, amount,
        rate, bill number, dates, and period. Best results with bills generated here; scanned or complex layouts may not parse fully.
      </div>
    </div>
  );
}
