import { Template, TemplateField } from "@/lib/advancedTypes";
import type React from "react";

/**
 * Hit test template fields to find the top-most field under (px, py)
 */
export function hitTestAt(
  px: number,
  py: number,
  currentTemplate: Template | null,
  imageCache: React.MutableRefObject<Record<string, HTMLImageElement | HTMLCanvasElement>>
): TemplateField | null {
  if (!currentTemplate) return null;
  for (let i = currentTemplate.fields.length - 1; i >= 0; i--) {
    const f = currentTemplate.fields[i];

    if ((f.type === "image" || f.type === "signature") && f.value) {
      const cacheKey = `${f.id}`;
      const cached = imageCache.current[cacheKey];
      if (cached) {
        const iw = cached instanceof HTMLImageElement ? (cached.naturalWidth || cached.width) : cached.width;
        const ih = cached instanceof HTMLImageElement ? (cached.naturalHeight || cached.height) : cached.height;
        const scale = Math.min(f.width / iw, f.height / ih);
        const dw = Math.max(1, Math.floor(iw * scale));
        const dh = Math.max(1, Math.floor(ih * scale));
        const dx = f.x + (f.width - dw) / 2;
        const dy = f.y + (f.height - dh) / 2;
        if (px >= dx && px <= dx + dw && py >= dy && py <= dy + dh) return f;
      } else {
        if (px >= f.x && px <= f.x + f.width && py >= f.y && py <= f.y + f.height)
          return f;
      }
    } else {
      if (px >= f.x && px <= f.x + f.width && py >= f.y && py <= f.y + f.height)
        return f;
    }
  }
  return null;
}

/**
 * Return which resize handle is under the point, or null
 */
export function getHandleAtPosition(
  px: number,
  py: number,
  field: TemplateField,
  imageCache: React.MutableRefObject<Record<string, HTMLImageElement | HTMLCanvasElement>>
): null | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" {
  const size = 6;

  let handleX = field.x;
  let handleY = field.y;
  let handleWidth = field.width;
  let handleHeight = field.height;

  if ((field.type === "image" || field.type === "signature") && field.value) {
    const cacheKey = `${field.id}`;
    const cached = imageCache.current[cacheKey];
    if (cached) {
      const iw = cached instanceof HTMLImageElement ? (cached.naturalWidth || cached.width) : cached.width;
      const ih = cached instanceof HTMLImageElement ? (cached.naturalHeight || cached.height) : cached.height;
      const scale = Math.min(field.width / iw, field.height / ih);
      const dw = Math.max(1, Math.floor(iw * scale));
      const dh = Math.max(1, Math.floor(ih * scale));
      const dx = field.x + (field.width - dw) / 2;
      const dy = field.y + (field.height - dh) / 2;
      handleX = dx;
      handleY = dy;
      handleWidth = dw;
      handleHeight = dh;
    }
  }

  const handles = [
    { key: "nw", x: handleX, y: handleY },
    { key: "n", x: handleX + handleWidth / 2, y: handleY },
    { key: "ne", x: handleX + handleWidth, y: handleY },
    { key: "w", x: handleX, y: handleY + handleHeight / 2 },
    { key: "e", x: handleX + handleWidth, y: handleY + handleHeight / 2 },
    { key: "sw", x: handleX, y: handleY + handleHeight },
    { key: "s", x: handleX + handleWidth / 2, y: handleY + handleHeight },
    { key: "se", x: handleX + handleWidth, y: handleY + handleHeight },
  ] as const;

  for (const h of handles) {
    if (Math.abs(px - h.x) <= size && Math.abs(py - h.y) <= size) return h.key;
  }
  return null;
}

/**
 * Draw resize handles for a field on the given context
 */
export function drawResizeHandles(
  ctx: CanvasRenderingContext2D,
  field: TemplateField,
  imageCache: React.MutableRefObject<Record<string, HTMLImageElement | HTMLCanvasElement>>
) {
  const size = 6;
  ctx.fillStyle = "#2563eb";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;

  let handleX = field.x;
  let handleY = field.y;
  let handleWidth = field.width;
  let handleHeight = field.height;

  if ((field.type === "image" || field.type === "signature") && field.value) {
    const cacheKey = `${field.id}`;
    const cached = imageCache.current[cacheKey];
    if (cached) {
      const iw = cached instanceof HTMLImageElement ? (cached.naturalWidth || cached.width) : cached.width;
      const ih = cached instanceof HTMLImageElement ? (cached.naturalHeight || cached.height) : cached.height;
      const scale = Math.min(field.width / iw, field.height / ih);
      const dw = Math.max(1, Math.floor(iw * scale));
      const dh = Math.max(1, Math.floor(ih * scale));
      const dx = field.x + (field.width - dw) / 2;
      const dy = field.y + (field.height - dh) / 2;
      handleX = dx;
      handleY = dy;
      handleWidth = dw;
      handleHeight = dh;
    }
  }

  const centers = [
    { x: handleX, y: handleY, key: "nw" },
    { x: handleX + handleWidth / 2, y: handleY, key: "n" },
    { x: handleX + handleWidth, y: handleY, key: "ne" },
    { x: handleX, y: handleY + handleHeight / 2, key: "w" },
    { x: handleX + handleWidth, y: handleY + handleHeight / 2, key: "e" },
    { x: handleX, y: handleY + handleHeight, key: "sw" },
    { x: handleX + handleWidth / 2, y: handleY + handleHeight, key: "s" },
    { x: handleX + handleWidth, y: handleY + handleHeight, key: "se" },
  ] as const;

  centers.forEach((c) => {
    ctx.fillRect(c.x - size / 2, c.y - size / 2, size, size);
    ctx.strokeRect(c.x - size / 2, c.y - size / 2, size, size);
  });
}
