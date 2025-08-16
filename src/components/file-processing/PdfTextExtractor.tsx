"use client";

interface PdfTextExtractorProps {
  onTextExtracted: (text: string) => void;
  onError: (error: string) => void;
}

export class PdfTextExtractor {
  static async extractTextFromPdf(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          console.log("File loaded, starting PDF processing...");
          const arrayBuffer = e.target?.result as ArrayBuffer;
          console.log("ArrayBuffer size:", arrayBuffer.byteLength);
          const pdfjsLib = await import("pdfjs-dist");

          // Set up the worker - use a local approach to avoid CORS issues
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
          console.log(
            "Worker source set to:",
            pdfjsLib.GlobalWorkerOptions.workerSrc
          );

          console.log("Loading PDF document...");
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          console.log("PDF loaded, number of pages:", pdf.numPages);
          let fullText = "";

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            console.log(`Page ${i} has ${textContent.items.length} text items`);
            const pageText = textContent.items
              .map((item: { str: string }) => item.str)
              .join(" ");
            console.log(`Page ${i} text:`, pageText.substring(0, 200));
            fullText += pageText + " ";
          }

          console.log("Total extracted text length:", fullText.length);

          // If no text was extracted, try OCR
          if (fullText.trim().length <= 1) {
            console.log("No text found, attempting OCR...");
            const ocrText = await PdfTextExtractor.extractTextWithOCR(pdf);
            resolve(ocrText);
          } else {
            resolve(fullText);
          }
        } catch (err) {
          console.error("Error in PDF extraction:", err);
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  static async extractTextWithOCR(pdf: any): Promise<string> {
    console.log("Starting OCR processing...");
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    let fullText = "";

    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        console.log(`Processing page ${i} with OCR...`);
        const page = await pdf.getPage(i);

        // Convert page to canvas
        const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render page to canvas
        await page.render({
          canvasContext: context!,
          viewport: viewport,
        }).promise;

        // Perform OCR on the canvas
        const {
          data: { text },
        } = await worker.recognize(canvas);
        console.log(`OCR result for page ${i}:`, text.substring(0, 200));
        fullText += text + " ";
      }
    } finally {
      await worker.terminate();
    }

    console.log("OCR completed, total text length:", fullText.length);
    return fullText;
  }
}
