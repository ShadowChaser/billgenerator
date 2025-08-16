"use client";

interface StatusMessageProps {
  type: "error" | "success" | "processing" | "warning";
  message: string;
  className?: string;
}

export function StatusMessage({ type, message, className = "" }: StatusMessageProps) {
  const baseClasses = "text-sm break-words";
  
  const typeClasses = {
    error: "text-red-600",
    success: "text-green-600", 
    processing: "text-blue-600",
    warning: "text-amber-600"
  };

  return (
    <div className={`${baseClasses} ${typeClasses[type]} ${className}`}>
      {message}
    </div>
  );
}
