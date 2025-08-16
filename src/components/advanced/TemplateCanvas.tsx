"use client";

import React from "react";
import InlineTextEditor from "@/components/advanced/InlineTextEditor";

export interface SizeLike {
  width: number;
  height: number;
}

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

interface TemplateCanvasProps {
  templateSize: SizeLike;
  containerSize?: SizeLike | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isEditing: boolean;
  // Mouse/touch handlers
  onMouseDown: React.MouseEventHandler<HTMLCanvasElement>;
  onMouseMove: React.MouseEventHandler<HTMLCanvasElement>;
  onMouseUp: React.MouseEventHandler<HTMLCanvasElement>;
  onTouchStart: React.TouchEventHandler<HTMLCanvasElement>;
  onTouchMove: React.TouchEventHandler<HTMLCanvasElement>;
  onTouchEnd: React.TouchEventHandler<HTMLCanvasElement>;
  onClick: React.MouseEventHandler<HTMLCanvasElement>;
  onDoubleClick: React.MouseEventHandler<HTMLCanvasElement>;
  // Inline editing props
  inlineField?: InlineEditFieldLike | null;
  inlinePosition?: InlineEditPosition | null;
  inlineInputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  inlineValue: string;
  onInlineChange: (next: string) => void;
  onInlineKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onInlineBlur: () => void;
}

export default function TemplateCanvas(props: TemplateCanvasProps) {
  const {
    templateSize,
    containerSize,
    canvasRef,
    isEditing,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onClick,
    onDoubleClick,
    inlineField,
    inlinePosition,
    inlineInputRef,
    inlineValue,
    onInlineChange,
    onInlineKeyDown,
    onInlineBlur,
  } = props;

  return (
    <div className="flex justify-center mb-4 md:mb-6 overflow-auto px-2">
      <div
        className="relative bg-white border border-gray-200 rounded-md shadow-sm max-w-full"
        style={{
          width: containerSize?.width || templateSize.width,
          height: containerSize?.height || templateSize.height,
        }}
      >
        <canvas
          ref={canvasRef}
          width={templateSize.width}
          height={templateSize.height}
          className="absolute top-0 left-0 w-full h-full border-0 md:border-2 md:border-gray-300 rounded-md"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          style={{
            cursor: isEditing ? "move" : "default",
            touchAction: "none",
          }}
        />

        {inlineField && inlinePosition && (
          <InlineTextEditor
            field={inlineField as any}
            position={inlinePosition}
            value={inlineValue}
            inputRef={inlineInputRef as any}
            onChange={onInlineChange}
            onKeyDown={onInlineKeyDown as any}
            onBlur={onInlineBlur}
          />
        )}
      </div>
    </div>
  );
}
