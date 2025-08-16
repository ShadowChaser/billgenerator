"use client";

import React, { useMemo } from "react";

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
    left: position.x,
    top: position.y,
    width: position.width,
    height: position.height,
    boxSizing: "border-box",
    transform: "translate3d(0, -2px, 0)",
    willChange: "transform",
  };

  const commonStyle: React.CSSProperties = {
    fontSize: `${(field.fontSize || 16) * (position.width / field.width)}px`,
    fontWeight: field.isBold ? "bold" : "normal",
    fontStyle: field.isItalic ? "italic" : "normal",
    fontFamily: "sans-serif",
    textAlign: (field.alignment || "left") as any,
    color: field.textColor || "#111827",
    backgroundColor: field.backgroundColor || "#ffffff",
  };

  // Precompute scaled font metrics by measuring with a canvas to match canvas renderer
  const scale = position.width / field.width;
  const { fontSizePx, boxHeight, verticalPad } = useMemo(() => {
    const fs = (field.fontSize || 16) * scale;
    // Build font string exactly like canvas renderer
    const fontStr = `${field.isItalic ? "italic " : ""}${field.isBold ? "bold " : ""}${fs}px sans-serif`;
    let ascent = fs * 0.8;
    let descent = fs * 0.2;
    try {
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.font = fontStr;
        const m = ctx.measureText("Mg");
        ascent = (m.actualBoundingBoxAscent || ascent);
        descent = (m.actualBoundingBoxDescent || descent);
      }
    } catch {}
    const bh = ascent + descent;
    const padScaled = 4 * scale;
    const vpad = Math.max(padScaled, (position.height - bh) / 2);
    return { fontSizePx: fs, boxHeight: bh, verticalPad: vpad };
  }, [field.fontSize, field.isBold, field.isItalic, scale, position.height]);

  // Compute horizontal padding to mirror canvas text inset rules
  const align = field.alignment || "left";
  const padHLeft = align === "left" ? 8 * scale : 0;
  const padHRight = align === "right" ? 8 * scale : 0;

  return (
    <div className="fixed z-50" style={style}>
      {field.type === "textarea" ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown as any}
          onBlur={onBlur}
          className="w-full h-full text-sm outline outline-2 outline-blue-500 rounded resize-none touch-manipulation"
          style={{
            ...commonStyle,
            // Use a small inner padding similar to canvas text padding (approx 4px scaled)
            padding: `${4 * (position.width / field.width)}px`,
          }}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown as any}
          onBlur={onBlur}
          className="w-full h-full text-sm outline outline-2 outline-blue-500 rounded touch-manipulation"
          style={{
            ...commonStyle,
            // Match canvas horizontal inset by alignment
            paddingLeft: `${padHLeft}px`,
            paddingRight: `${padHRight}px`,
            // Align baseline like canvas: use measured box height and symmetric vertical padding
            lineHeight: `${boxHeight}px`,
            paddingTop: `${verticalPad}px`,
            paddingBottom: `${verticalPad}px`,
          }}
        />
      )}
    </div>
  );
}
