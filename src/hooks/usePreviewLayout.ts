"use client";

import { useEffect, useRef, useState } from "react";

// Manages preview container refs, scale, and computed base height based on content
export function usePreviewLayout(previewHtml: string | null) {
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const previewInnerRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [baseHeight, setBaseHeight] = useState(1123);

  // Resize preview to fit container without cutting content
  useEffect(() => {
    const updateScale = () => {
      if (!previewHtml) return;
      const container = previewContainerRef.current;
      if (!container) return;
      const containerWidth = container.clientWidth;
      const baseWidth = 794; // A4 width at ~96dpi
      const scale = Math.min(1, containerWidth / baseWidth);
      setPreviewScale(scale);
    };
    updateScale();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }
  }, [previewHtml]);

  // Measure actual content height (unscaled) and reserve scaled space
  useEffect(() => {
    const measure = () => {
      const el = previewInnerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scaledHeight = rect.height; // current scaled height
      const computedBase = Math.max(
        1123,
        Math.round(scaledHeight / Math.max(previewScale, 0.001))
      );
      setBaseHeight(computedBase);
    };
    // Allow DOM to paint before measuring
    const r = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(r);
  }, [previewHtml, previewScale]);

  return { previewContainerRef, previewInnerRef, previewScale, baseHeight };
}
