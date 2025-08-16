"use client";

export class DocxTextExtractor {
  static async extractTextFromDocx(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Dynamic import of the browser build
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - we add a module declaration for this path
      const mammoth = (await import("mammoth/mammoth.browser")) as any;
      const { value } = await (mammoth as any).extractRawText({ arrayBuffer });
      return typeof value === "string" ? value : "";
    } catch (err) {
      console.error("Error in DOCX extraction:", err);
      throw err;
    }
  }
}
