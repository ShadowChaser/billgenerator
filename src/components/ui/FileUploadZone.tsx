"use client";
import { useRef } from "react";

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  isProcessing?: boolean;
  accept?: string;
  className?: string;
}

export function FileUploadZone({
  onFileSelect,
  disabled,
  isProcessing,
  accept = ".pdf,.docx,.png,.jpg,.jpeg,.webp",
  className = "",
}: FileUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={`grid gap-2 min-w-0 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled || isProcessing}
        className="ring-1 ring-inset rounded px-3 py-2 bg-transparent disabled:opacity-50 w-full"
      />
    </div>
  );
}
