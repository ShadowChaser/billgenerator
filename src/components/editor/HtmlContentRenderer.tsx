"use client";

interface HtmlContentRendererProps {
  htmlContent: string;
  isEditing: boolean;
}

export function HtmlContentRenderer({ htmlContent, isEditing }: HtmlContentRendererProps) {
  if (isEditing) return null;

  return (
    <div
      style={{
        width: '794px',
        minHeight: '1123px',
        userSelect: 'text'
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
