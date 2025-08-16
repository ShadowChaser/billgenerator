import { Template } from "@/lib/advancedTypes";

// Keep at most MAX_TEMPLATES items; if over, remove the oldest non-default templates.
// Returns the trimmed list and the removed templates.
export function enforceTemplateLimit(
  list: Template[],
  max: number,
  defaultTemplateId: string
): { list: Template[]; removed: Template[] } {
  if (list.length <= max) return { list, removed: [] };

  // Sort by createdAt ascending (oldest first)
  const sorted = [...list].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const removed: Template[] = [];
  while (sorted.length > max) {
    // Find the oldest that is not the default; if all are default-only scenario, break
    const idx = sorted.findIndex((t) => t.id !== defaultTemplateId);
    if (idx === -1) break;
    removed.push(sorted.splice(idx, 1)[0]);
  }
  return { list: sorted, removed };
}

// Generate RTF document content (opens properly in Word)
export function generateRTFContent(template: Template) {
  // RTF header with font table
  const rtfHeader = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}{\\f1 Arial;}}\n`;
  const rtfFooter = `}`;

  // Document title and header
  let rtfBody = `\\f1\\fs28\\qc\\b ${template.name}\\b0\\par\n`;
  rtfBody += `\\fs20\\qc Generated on ${new Date().toLocaleDateString()}\\par\n\\par\n\\par\n`;

  // Add each field with proper formatting
  template.fields.forEach((field) => {
    const fieldValue = field.value || (field as any).placeholder || "[Empty]";
    // Escape RTF special characters
    const escapedLabel = field.label
      .replace(/\\/g, "\\\\")
      .replace(/{/g, "\\{")
      .replace(/}/g, "\\}");
    const escapedValue = fieldValue
      .replace(/\\/g, "\\\\")
      .replace(/{/g, "\\{")
      .replace(/}/g, "\\}")
      .replace(/\n/g, "\\par\n");

    rtfBody += `\\fs22\\b ${escapedLabel}:\\b0\\par\n`;
    rtfBody += `\\fs20 ${escapedValue}\\par\n\\par\n`;
  });

  // Footer
  rtfBody += `\\par\n\\fs16\\qc\\i This document was generated using Advanced Bill Generator\\i0\\par\n`;

  return rtfHeader + rtfBody + rtfFooter;
}
