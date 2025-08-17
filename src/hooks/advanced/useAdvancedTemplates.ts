import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readArrayKey, writeArrayKey } from "@/lib/localStore";
import { makeDefaultSampleTemplate } from "@/lib/sampleTemplates";
import { Template, TemplateField } from "@/lib/advancedTypes";
import {
  TEMPLATES_KEY,
  LAST_TEMPLATE_KEY,
  CUSTOM_INBOX_KEY,
  MAX_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
} from "@/lib/constants";
import { makeEmptyTemplate, duplicateFromProfessional } from "@/lib/templateFactory";

export function useAdvancedTemplates() {
  const initialSampleTemplate = useMemo(() => makeDefaultSampleTemplate(), []);

  const [templates, setTemplates] = useState<Template[]>(() => [initialSampleTemplate]);
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(() => initialSampleTemplate);

  const didRepairRef = useRef(false);

  // Load stored templates after mount
  useEffect(() => {
    try {
      const stored = readArrayKey<any>(TEMPLATES_KEY);
      if (Array.isArray(stored) && stored.length > 0) {
        const parsed: Template[] = stored.map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) }));
        setTemplates(parsed);
      }
    } catch {}
  }, []);

  // One-time repair for Professional templates with 0 fields
  useEffect(() => {
    if (didRepairRef.current) return;
    if (!templates || templates.length === 0) return;
    const needsRepair = templates.some((t) => /professional/i.test(t.name) && (!t.fields || t.fields.length === 0));
    if (!needsRepair) {
      didRepairRef.current = true;
      return;
    }
    const sample = makeDefaultSampleTemplate();
    const repaired = templates.map((t) => {
      if (/professional/i.test(t.name) && (!t.fields || t.fields.length === 0)) {
        const newFields = sample.fields.map((f) => ({
          ...f,
          id: `${f.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        }));
        return { ...t, fields: newFields } as Template;
      }
      return t;
    });
    setTemplates(repaired);
    if (currentTemplate) {
      const updatedCurrent = repaired.find((x) => x.id === currentTemplate.id) || null;
      if (updatedCurrent) setCurrentTemplate(updatedCurrent);
    }
    didRepairRef.current = true;
  }, [templates, currentTemplate]);

  // Restore last-opened template or select first
  useEffect(() => {
    if (!currentTemplate && templates.length > 0) {
      try {
        const lastId = typeof window !== "undefined" ? window.localStorage.getItem(LAST_TEMPLATE_KEY) : null;
        const found = lastId ? templates.find((t) => t.id === lastId) : null;
        setCurrentTemplate(found || templates[0]);
      } catch {
        setCurrentTemplate(templates[0]);
      }
    }
  }, [templates, currentTemplate]);

  // Persist last-opened id
  useEffect(() => {
    try {
      if (currentTemplate && typeof window !== "undefined") {
        window.localStorage.setItem(LAST_TEMPLATE_KEY, currentTemplate.id);
        // eslint-disable-next-line no-console
        console.log("[Advanced] Persisted last template id:", currentTemplate.id);
      }
    } catch {}
  }, [currentTemplate]);

  // Persist templates on change (upsert merge)
  useEffect(() => {
    try {
      const existing = readArrayKey<any>(TEMPLATES_KEY);
      const existingList: any[] = Array.isArray(existing) ? existing : [];
      const byId = new Map<string, any>(existingList.map((t: any) => [t.id, t]));
      for (const t of templates) {
        const serial = {
          ...t,
          createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : (t as any).createdAt,
        } as any;
        byId.set(t.id, serial);
      }
      const merged = Array.from(byId.values());
      writeArrayKey(TEMPLATES_KEY, merged);
      // eslint-disable-next-line no-console
      console.log("[Advanced] Wrote templates to localStorage (upsert):", merged.length);
    } catch {}
  }, [templates]);

  const insertTemplateWithLimit = useCallback(
    (newTemplate: Template, opts?: { setAsCurrent?: boolean; closeChooser?: boolean }) => {
      const { setAsCurrent = true } = opts || {};
      let baseList = templates;
      let removedId: string | null = null;
      if (baseList.length >= MAX_TEMPLATES) {
        const sorted = [...baseList].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const oldest = sorted.find((t) => t.id !== DEFAULT_TEMPLATE_ID);
        if (!oldest) return false;
        const ok = window.confirm(
          `Template limit is ${MAX_TEMPLATES}. Delete oldest template "${oldest.name}" to create a new one?`
        );
        if (!ok) return false;
        baseList = baseList.filter((p) => p.id !== oldest.id);
        removedId = oldest.id;
      }
      const next = [newTemplate, ...baseList];
      setTemplates(next);
      if (setAsCurrent) setCurrentTemplate(newTemplate);

      try {
        const serial = next.map((t) => ({
          ...t,
          createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : (t as any).createdAt,
        }));
        writeArrayKey(TEMPLATES_KEY, serial);
        if (typeof window !== "undefined" && setAsCurrent) {
          window.localStorage.setItem(LAST_TEMPLATE_KEY, newTemplate.id);
        }
        if (typeof window !== "undefined" && removedId) {
          const lastId = window.localStorage.getItem(LAST_TEMPLATE_KEY);
          if (lastId === removedId) window.localStorage.removeItem(LAST_TEMPLATE_KEY);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Failed to persist templates:", e);
      }
      return true;
    },
    [templates]
  );

  const createFromProfessional = useCallback(() => {
    const base = templates.find((t) => /professional/i.test(t.name)) || null;
    const idx = templates.length + 1;
    const newTemplate: Template = base
      ? duplicateFromProfessional(base, idx)
      : duplicateFromProfessional(makeDefaultSampleTemplate(), idx);
    insertTemplateWithLimit(newTemplate, { setAsCurrent: true, closeChooser: true });
  }, [templates, insertTemplateWithLimit]);

  const createNewTemplate = useCallback(() => {
    const idx = templates.length + 1;
    const t = makeEmptyTemplate(idx);
    insertTemplateWithLimit(t, { setAsCurrent: true, closeChooser: true });
  }, [templates, insertTemplateWithLimit]);

  const exportTemplateJson = useCallback((tpl: Template) => {
    try {
      const serializable = {
        ...tpl,
        createdAt: (tpl as any).createdAt instanceof Date ? (tpl as any).createdAt.toISOString() : (tpl as any).createdAt,
      } as any;
      const blob = new Blob([JSON.stringify(serializable, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tpl.name || "template"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export template JSON");
    }
  }, []);

  const deleteTemplate = useCallback((templateId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    setCurrentTemplate((ct) => (ct && ct.id === templateId ? null : ct));
    try {
      const existing = readArrayKey<any>(TEMPLATES_KEY);
      const list: any[] = Array.isArray(existing) ? existing : [];
      const filtered = list.filter((t: any) => t && t.id !== templateId);
      writeArrayKey(TEMPLATES_KEY, filtered);
      if (typeof window !== "undefined") {
        const lastId = window.localStorage.getItem(LAST_TEMPLATE_KEY);
        if (lastId === templateId) {
          window.localStorage.removeItem(LAST_TEMPLATE_KEY);
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to persist template deletion:", e);
    }
  }, []);

  const saveTemplate = useCallback(() => {
    try {
      const existing = readArrayKey<any>(TEMPLATES_KEY);
      const list: any[] = Array.isArray(existing) ? existing : [];
      const byId = new Map<string, any>(list.map((t: any) => [t.id, t]));
      if (currentTemplate) {
        const serial = {
          ...currentTemplate,
          createdAt:
            currentTemplate.createdAt instanceof Date
              ? currentTemplate.createdAt.toISOString()
              : (currentTemplate as any).createdAt,
        } as any;
        byId.set(currentTemplate.id, serial);
      }
      const merged = Array.from(byId.values());
      writeArrayKey(TEMPLATES_KEY, merged);
      if (typeof window !== "undefined" && currentTemplate) {
        window.localStorage.setItem(LAST_TEMPLATE_KEY, currentTemplate.id);
      }
      alert("Template saved locally.");
    } catch (e) {
      console.error(e);
      alert("Failed to save template");
    }
  }, [currentTemplate]);

  const updateField = useCallback(
    (id: string, patch: Partial<TemplateField>, saveUndo: boolean = true) => {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id !== (currentTemplate?.id || t.id)
            ? t
            : { ...t, fields: t.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }
        )
      );
      setCurrentTemplate((ct) =>
        ct && ct.id === (currentTemplate?.id || ct.id)
          ? { ...ct, fields: ct.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }
          : ct
      );
    },
    [currentTemplate]
  );

  const deleteField = useCallback(
    (id: string) => {
      if (!currentTemplate) return;
      setTemplates((prev) => prev.map((t) => (t.id === currentTemplate.id ? { ...t, fields: t.fields.filter((f) => f.id !== id) } : t)));
      setCurrentTemplate((ct) => (ct ? { ...ct, fields: ct.fields.filter((f) => f.id !== id) } : ct));
    },
    [currentTemplate]
  );

  const onUploadImageForField = useCallback(
    (fieldId: string, file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const maxWidth = 400;
          const maxHeight = 300;
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          let newWidth = img.naturalWidth;
          let newHeight = img.naturalHeight;
          if (newWidth > maxWidth) {
            newWidth = maxWidth;
            newHeight = newWidth / aspectRatio;
          }
          if (newHeight > maxHeight) {
            newHeight = maxHeight;
            newWidth = newHeight * aspectRatio;
          }
          updateField(fieldId, {
            value: dataUrl,
            width: Math.round(newWidth),
            height: Math.round(newHeight),
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [updateField]
  );

  return {
    templates,
    setTemplates,
    currentTemplate,
    setCurrentTemplate,
    insertTemplateWithLimit,
    createFromProfessional,
    createNewTemplate,
    deleteTemplate,
    saveTemplate,
    exportTemplateJson,
    updateField,
    deleteField,
    onUploadImageForField,
  } as const;
}
