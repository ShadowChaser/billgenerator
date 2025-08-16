"use client";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onResetZoom }: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 border border-gray-300">
      <button
        onClick={onZoomOut}
        className="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700 border border-transparent hover:border-gray-300"
        title="Zoom Out"
      >
        <ZoomOut size={16} />
      </button>
      <span className="px-3 py-1 text-sm font-medium min-w-[60px] text-center text-gray-900 bg-white rounded border">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={onZoomIn}
        className="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700 border border-transparent hover:border-gray-300"
        title="Zoom In"
      >
        <ZoomIn size={16} />
      </button>
      <button
        onClick={onResetZoom}
        className="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700 border border-transparent hover:border-gray-300"
        title="Reset Zoom"
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
}
