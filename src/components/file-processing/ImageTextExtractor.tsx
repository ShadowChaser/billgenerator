"use client";
import { createWorker } from "tesseract.js";

export class ImageTextExtractor {
  static async extractTextFromImage(file: File): Promise<string> {
    const worker = await createWorker("eng");
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Load the image into a canvas for consistent OCR input
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
        img.src = dataUrl;
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      ctx?.drawImage(img, 0, 0);

      const { data: { text } } = await worker.recognize(canvas);
      return text || "";
    } finally {
      await worker.terminate();
    }
  }
}
