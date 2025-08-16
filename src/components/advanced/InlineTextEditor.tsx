"use client";

import React from "react";

export interface InlineEditFieldLike {
  type: "text" | "number" | "date" | "amount" | "textarea" | "select" | "image" | "signature";
  width: number;
  fontSize?: number;
  isBold?: boolean;
  isItalic?: boolean;
  alignment?: "left" | "center" | "right";
  textColor?: string;
  backgroundColor?: string;
}

export interface InlineEditPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface InlineTextEditorProps {
  field: InlineEditFieldLike;
  position: InlineEditPosition;
  value: string;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  onChange: (next: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
}

export default function InlineTextEditor(props: InlineTextEditorProps) {
  const { field, position, value, inputRef, onChange, onKeyDown, onBlur } = props;

  const style: React.CSSProperties = {
    left:
      typeof window !== "undefined"
        ? Math.max(8, Math.min(position.x, window.innerWidth - position.width - 8))
        : position.x,
    top:
      typeof window !== "undefined"
        ? Math.max(8, Math.min(position.y, window.innerHeight - position.height - 8))
        : position.y,
    width:
      typeof window !== "undefined"
        ? Math.min(position.width, window.innerWidth - 16)
        : position.width,
    height:
      typeof window !== "undefined"
        ? Math.min(position.height, window.innerHeight - 16)
        : position.height,
  };

  const commonStyle: React.CSSProperties = {
    fontSize: `${(field.fontSize || 16) * (position.width / field.width)}px`,
    fontWeight: field.isBold ? "bold" : "normal",
    fontStyle: field.isItalic ? "italic" : "normal",
    textAlign: (field.alignment || "left") as any,
    color: field.textColor || "#111827",
    backgroundColor: field.backgroundColor || "#ffffff",
  };

  return (
    <div className="fixed z-50" style={style}>
      {field.type === "textarea" ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown as any}
          onBlur={onBlur}
          className="w-full h-full p-2 text-sm border-2 border-blue-500 rounded resize-none touch-manipulation"
          style={commonStyle}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown as any}
          onBlur={onBlur}
          className="w-full h-full p-2 text-sm border-2 border-blue-500 rounded touch-manipulation"
          style={commonStyle}
        />
      )}
    </div>
  );
}
