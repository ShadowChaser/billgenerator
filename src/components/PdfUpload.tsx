"use client";
import { useState, useRef } from "react";
import { BillFormInput } from "@/lib/validation";
import "@/lib/pdfTypes";
import { createWorker } from "tesseract.js";

interface PdfUploadProps {
  onFieldsExtracted: (fields: Partial<BillFormInput>) => void;
  onNextMonthBill?: (fields: Partial<BillFormInput>) => void;
  disabled?: boolean;
}

export default function PdfUpload({
  onFieldsExtracted,
  onNextMonthBill,
  disabled,
}: PdfUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const extractTextFromPdf = async (file: File): Promise<string> => {
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
            const ocrText = await extractTextWithOCR(pdf);
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
  };

  const extractTextWithOCR = async (pdf: any): Promise<string> => {
    console.log("Starting OCR processing...");
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
  };

  // Extract text from .docx using mammoth (runs in the browser)
  const extractTextFromDocx = async (file: File): Promise<string> => {
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
  };

  const processFile = async (file: File) => {
    const name = file.name.toLowerCase();
    const isPdf = name.endsWith(".pdf") || file.type.includes("pdf");
    const isDocx = name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isDoc = name.endsWith(".doc");
    const isImage =
      ["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".webp");

    if (!isPdf && !isDocx && !isImage) {
      setError("Please select a PDF, DOCX, or Image file (.pdf, .docx, .png, .jpg, .jpeg, .webp). Legacy .doc is not supported in-browser.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const text = isPdf
        ? await extractTextFromPdf(file)
        : isDocx
        ? await extractTextFromDocx(file)
        : isImage
        ? await extractTextFromImage(file)
        : (() => {
            if (isDoc) {
              throw new Error(
                "Legacy .doc files are not supported in the browser. Please convert to .docx or PDF."
              );
            }
            throw new Error("Unsupported file type.");
          })();
      const extractedFields = extractFieldsFromText(text);
      if (Object.keys(extractedFields).length === 0) {
        setError(
          "No relevant information found in the file. Please check if it contains bill details."
        );
      } else {
        onFieldsExtracted(extractedFields);
        localStorage.setItem("lastExtractedFields", JSON.stringify(extractedFields));
        const fieldCount = Object.keys(extractedFields).length;
        setSuccess(`Successfully extracted ${fieldCount} field(s) from the file${fileName ? `: ${fileName}` : ""}!`);
        setError(null);
      }
    } catch (err) {
      console.error("Error processing file:", err);
      if (err instanceof Error) {
        setError(`Failed to process file: ${err.message}`);
      } else {
        setError("Failed to process file. Please try again.");
      }
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isProcessing) return;
    setIsDragOver(false);
    const dt = e.dataTransfer;
    const file = dt?.files?.[0];
    if (file) {
      setFileName(file.name);
      await processFile(file);
    }
  };

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isProcessing) return;
    setIsDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isProcessing) return;
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  // Extract text from image files using Tesseract OCR
  const extractTextFromImage = async (file: File): Promise<string> => {
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
  };

  const generateNextMonthFields = (
    lastFields: Partial<BillFormInput>
  ): Partial<BillFormInput> => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11

    // Format current period as YYYY-MM
    const currentPeriod = `${currentYear}-${String(currentMonth).padStart(
      2,
      "0"
    )}`;

    // Format current date as YYYY-MM-DD
    const currentDate = `${currentYear}-${String(currentMonth).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}`;

    // Increment bill number
    let nextBillNumber = "1";
    if (lastFields.bill_number) {
      const currentNumber =
        parseInt(lastFields.bill_number.replace(/\D/g, "")) || 0;
      nextBillNumber = String(currentNumber + 1);
    }

    return {
      ...lastFields,
      period: currentPeriod,
      date: currentDate,
      bill_number: nextBillNumber,
    };
  };

  const extractFieldsFromText = (text: string): Partial<BillFormInput> => {
    const extractedFields: Partial<BillFormInput> = {};
    console.log("Starting field extraction from text length:", text.length);

    // Debug: Look for rate-related text
    const rateDebug = text.match(/rs\.?\s*[0-9,]+[^a-zA-Z]*pm/i);
    console.log("Rate debug - found text:", rateDebug);

    // Extract landlord name - look for patterns like "Smt. [Name]" or "Mr. [Name]"
    const landlordPatterns = [
      /smt\.\s+([a-zA-Z\s]+?)(?:\s*\(|$)/i,
      /mr\.\s+([a-zA-Z\s]+?)(?:\s*\(|$)/i,
      /mrs\.\s+([a-zA-Z\s]+?)(?:\s*\(|$)/i,
      /landlord[:\s]+([a-zA-Z\s]+?)(?:\s*\(|$)/i,
      /owner[:\s]+([a-zA-Z\s]+?)(?:\s*\(|$)/i,
      // More general patterns
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, // Any capitalized words (potential names)
      /([A-Z]{2,}(?:\s+[A-Z]{2,})*)/g, // ALL CAPS words (potential names)
    ];

    for (const pattern of landlordPatterns) {
      const match = text.match(pattern);
      console.log("Trying landlord pattern:", pattern.source, "Match:", match);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 2) {
          extractedFields.landlord_name = name;
          console.log("Found landlord name:", name);
          break;
        }
      }
    }

    // Extract amount - look for patterns like "Rs. 12000/-" or "Amount: 12000"
    const amountPatterns = [
      /rs\.?\s*([0-9,]+)\s*\/?-/i,
      /amount[:\s]*rs\.?\s*([0-9,]+)/i,
      /total[:\s]*rs\.?\s*([0-9,]+)/i,
      /rs\.?\s*([0-9,]+)\s*(?:rupees|rs)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const amount = match[1].replace(/,/g, "");
        if (!isNaN(Number(amount))) {
          extractedFields.amount = amount;
          break;
        }
      }
    }

    // Extract rate - look for patterns like "Rate: Rs. 12000/P.M" or "12000 P.M"
    const ratePatterns = [
      /rate[:\s]*rs\.?\s*([0-9,]+)\s*\/?p\.?m/i,
      /rs\.?\s*([0-9,]+)\s*\/?p\.?m/i,
      /([0-9,]+)\s*p\.?m/i,
      /rs\.?\s*([0-9,]+)\s*\/?pm/i, // Handle "PM" without dots
      /rs\.?\s*([0-9,]+)\s*\/?\s*pm/i, // Handle "PM" with space
      /rs\.?\s*([0-9,]+)\s*\/?\s*p\.?m/i, // Handle "P.M" with space
      /rs\.?\s*([0-9,]+)\s*\/?-\s*pm/i, // Handle "Rs.32,124/- PM" format
      /rs\.?\s*([0-9,]+)\s*\/?-\s*p\.?m/i, // Handle "Rs.32,124/- P.M" format
    ];

    for (const pattern of ratePatterns) {
      const match = text.match(pattern);
      console.log("Trying rate pattern:", pattern.source, "Match:", match);
      if (match && match[1]) {
        const rate = match[1].replace(/,/g, "");
        if (!isNaN(Number(rate))) {
          extractedFields.rate = rate;
          console.log("Found rate:", rate);
          break;
        }
      }
    }

    // Extract bill number - look for patterns like "BILL NO: 123" or "Bill Number: 123"
    const billNumberPatterns = [
      /bill\s*no[:\s]*([a-zA-Z0-9\-_]+)/i,
      /bill\s*number[:\s]*([a-zA-Z0-9\-_]+)/i,
      /invoice\s*no[:\s]*([a-zA-Z0-9\-_]+)/i,
    ];

    for (const pattern of billNumberPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        extractedFields.bill_number = match[1].trim();
        break;
      }
    }

    // Extract date - look for various date formats
    const datePatterns = [
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/g, // DD/MM/YYYY or DD-MM-YYYY
      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/g, // YYYY/MM/DD or YYYY-MM-DD
      /date[:\s]*(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/gi,
      /bill\s*date[:\s]*(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/gi,
    ];

    for (const pattern of datePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[2] && match[3]) {
          let year = match[3];
          let month = match[2];
          let day = match[1];

          // Handle YYYY-MM-DD format
          if (match[1].length === 4) {
            year = match[1];
            month = match[2];
            day = match[3];
          }

          // Ensure month and day are padded
          month = month.padStart(2, "0");
          day = day.padStart(2, "0");

          const dateStr = `${year}-${month}-${day}`;
          if (!isNaN(Date.parse(dateStr))) {
            extractedFields.date = dateStr;
            console.log("Found bill date:", dateStr);
            break;
          }
        }
      }
      if (extractedFields.date) break;
    }

    // Extract period (YYYY-MM) - context aware and format flexible
    const periodKeywords = [
      "period", "billing period", "for the month", "rent for", "for month", "for the period", "bill for", "month of"
    ];
    const monthMapShort: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12",
    };
    const monthMapLong: Record<string, string> = {
      january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
      july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
    };
    const toFullYear = (yy: string): string => {
      if (yy.length === 4) return yy;
      const n = parseInt(yy, 10);
      // Heuristic: 00..69 => 2000..2069, 70..99 => 1970..1999
      return (n >= 70 ? 1900 + n : 2000 + n).toString();
    };
    const normPeriod = (y: string, m: string): string | null => {
      const year = toFullYear(y);
      const month = String(parseInt(m, 10)).padStart(2, "0");
      const test = `${year}-${month}-01`;
      return isNaN(Date.parse(test)) ? null : `${year}-${month}`;
    };
    const findPeriodInSnippet = (snippet: string): string | null => {
      // 1) Ranges like 01/07/2024 to 31/07/2024 or 2024-07-01 - 2024-07-31
      let m = snippet.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}).{0,10}(?:to|-|–|—).{0,10}(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
      if (m) {
        // Use first date's month/year
        const first = m[1];
        let mm = first.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
        if (mm) {
          const y = toFullYear(mm[3]);
          return normPeriod(y, mm[2]);
        }
      }
      // 2) MM/YYYY or MM-YYYY
      m = snippet.match(/\b(\d{1,2})[-\/]?(\s)?(\d{2,4})\b/);
      if (m && parseInt(m[1], 10) >= 1 && parseInt(m[1], 10) <= 12) {
        const y = toFullYear(m[3]);
        return normPeriod(y, m[1]);
      }
      // 3) YYYY-MM
      m = snippet.match(/\b(\d{4})[-\/](\d{1,2})\b/);
      if (m) {
        return normPeriod(m[1], m[2]);
      }
      // 4) MonthName -? YYYY (allow optional hyphen/space variations)
      m = snippet.match(/\b([A-Za-z]{3,9})\.?\s*-?\s*(\d{2,4})\b/);
      if (m) {
        const monKey = m[1].toLowerCase();
        const mon = monthMapLong[monKey] || monthMapShort[monKey];
        if (mon) {
          const y = toFullYear(m[2]);
          return normPeriod(y, mon);
        }
      }
      // 5) YYYY MonthName
      m = snippet.match(/\b(\d{4})\s+([A-Za-z]{3,9})\b/);
      if (m) {
        const monKey = m[2].toLowerCase();
        const mon = monthMapLong[monKey] || monthMapShort[monKey];
        if (mon) return normPeriod(m[1], mon);
      }
      return null;
    };

    const lowerText = text.toLowerCase();
    let bestPeriod: string | null = null;
    for (const kw of periodKeywords) {
      let idxStart = 0;
      while (true) {
        const at = lowerText.indexOf(kw, idxStart);
        if (at === -1) break;
        const snippet = text.substring(Math.max(0, at - 50), Math.min(text.length, at + 150));
        const found = findPeriodInSnippet(snippet);
        if (found) { bestPeriod = found; break; }
        idxStart = at + kw.length;
      }
      if (bestPeriod) break;
    }

    // Fallback: scan entire text and pick the most recent-looking month
    if (!bestPeriod) {
      const candidates: string[] = [];
      const push = (p: string | null) => { if (p) candidates.push(p); };
      // Scan chunks to avoid over-matching
      const chunks = text.split(/\n|\r|\t/).slice(0, 500);
      for (const c of chunks) {
        push(findPeriodInSnippet(c));
      }
      if (candidates.length > 0) {
        // Choose the latest by date
        candidates.sort((a, b) => Date.parse(a + "-01") - Date.parse(b + "-01"));
        bestPeriod = candidates[candidates.length - 1];
      }
    }

    if (bestPeriod) {
      extractedFields.period = bestPeriod;
      console.log("Found period:", bestPeriod);
    }

    // Extract agreement date (robust): prefer date near 'agreement' or 'dtd'
    const agreementKeywords = ["agreement", "agr", "dtd", "dated", "agreement date", "agreement dtd"]; 
    const lower = text.toLowerCase();
    let bestAgreementDate: string | null = null;

    // Helper to normalize numeric dates to YYYY-MM-DD
    const normalizeYMD = (y: string, m: string, d: string) => {
      const mm = m.padStart(2, "0");
      const dd = d.padStart(2, "0");
      const dateStr = `${y}-${mm}-${dd}`;
      return isNaN(Date.parse(dateStr)) ? null : dateStr;
    };

    // Helper to try parse common patterns from a snippet
    const tryExtractDateFromSnippet = (snippet: string): string | null => {
      // 1) DD[-/]MM[-/]YYYY
      let m = snippet.match(/\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\b/);
      if (m) {
        return normalizeYMD(m[3], m[2], m[1]);
      }
      // 2) YYYY[-/]MM[-/]DD
      m = snippet.match(/\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
      if (m) {
        return normalizeYMD(m[1], m[2], m[3]);
      }
      // 3) D{1,2} Month YYYY (month words)
      const monthMap: Record<string, string> = {
        jan: "01", january: "01",
        feb: "02", february: "02",
        mar: "03", march: "03",
        apr: "04", april: "04",
        may: "05",
        jun: "06", june: "06",
        jul: "07", july: "07",
        aug: "08", august: "08",
        sep: "09", sept: "09", september: "09",
        oct: "10", october: "10",
        nov: "11", november: "11",
        dec: "12", december: "12",
      };
      m = snippet.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/);
      if (m) {
        const dd = m[1].padStart(2, "0");
        const mon = monthMap[m[2].toLowerCase()];
        if (mon) {
          return normalizeYMD(m[3], mon, dd);
        }
      }
      return null;
    };

    // Search near keywords first
    for (const kw of agreementKeywords) {
      let startIndex = 0;
      while (true) {
        const idx = lower.indexOf(kw, startIndex);
        if (idx === -1) break;
        // Look in a window around the keyword
        const snippet = text.substring(Math.max(0, idx - 30), Math.min(text.length, idx + 80));
        const found = tryExtractDateFromSnippet(snippet);
        if (found) {
          bestAgreementDate = found;
          break;
        }
        startIndex = idx + kw.length;
      }
      if (bestAgreementDate) break;
    }

    // Fallback: scan the whole text for the first reasonable date if none found by keyword
    if (!bestAgreementDate) {
      bestAgreementDate = tryExtractDateFromSnippet(text);
    }

    if (bestAgreementDate) {
      extractedFields.agreement_date = bestAgreementDate;
      console.log("Found agreement date:", bestAgreementDate);
    }

    return extractedFields;
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const name = file.name.toLowerCase();
    const isPdf = name.endsWith(".pdf") || file.type.includes("pdf");
    const isDocx = name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isDoc = name.endsWith(".doc");
    const isImage =
      ["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".webp");

    if (!isPdf && !isDocx && !isImage) {
      setError("Please select a PDF, DOCX, or Image file (.pdf, .docx, .png, .jpg, .jpeg, .webp). Legacy .doc is not supported in-browser.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const text = isPdf
        ? await extractTextFromPdf(file)
        : isDocx
        ? await extractTextFromDocx(file)
        : isImage
        ? await extractTextFromImage(file)
        : (() => {
            if (isDoc) {
              throw new Error(
                "Legacy .doc files are not supported in the browser. Please convert to .docx or PDF."
              );
            }
            throw new Error("Unsupported file type.");
          })();
      console.log(
        "Extracted text from file (length:",
        text.length,
        "):",
        JSON.stringify(text.substring(0, 500))
      ); // Log first 500 chars with length
      const extractedFields = extractFieldsFromText(text);

      if (Object.keys(extractedFields).length === 0) {
        setError(
          "No relevant information found in the file. Please check if it contains bill details."
        );
        console.log(
          "No fields extracted. Extracted text preview:",
          text.substring(0, 1000)
        );
      } else {
        onFieldsExtracted(extractedFields);
        // Save extracted fields to localStorage for next month bill
        localStorage.setItem(
          "lastExtractedFields",
          JSON.stringify(extractedFields)
        );
        const fieldCount = Object.keys(extractedFields).length;
        setSuccess(
          `Successfully extracted ${fieldCount} field(s) from the file!`
        );
        console.log("Extracted fields:", extractedFields);
        setError(null);
      }
    } catch (err) {
      console.error("Error processing file:", err);
      if (err instanceof Error) {
        setError(`Failed to process file: ${err.message}`);
      } else {
        setError("Failed to process file. Please try again.");
      }
    } finally {
      setIsProcessing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="grid gap-4 min-w-0 overflow-visible">
      <div
        role="button"
        tabIndex={0}
        aria-label="Drag and drop a file here or click to upload"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={handleDrop}
        className={`drag-zone h-24 flex items-center justify-center text-center px-4 transition-colors ${
          isDragOver ? "drag-over" : ""
        } ${disabled ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
      >
        <div>
          <div className="type-body text-[var(--text-secondary)]">
            Drag and drop a file here or click to upload
          </div>
          <div className="type-label text-[var(--text-secondary)] mt-1">
            {fileName ? `Selected: ${fileName}` : "Upload files in PDF, DOCX, or image formats"}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.png,.jpg,.jpeg,.webp"
        onChange={handleFileUpload}
        disabled={disabled || isProcessing}
        aria-label="File input for upload"
        className="sr-only"
      />

      {isProcessing && (
        <div className="text-sm text-blue-600">
          Processing file (may take longer for scanned documents)... Please wait.
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      {success && <div className="text-sm text-green-600 break-words">{success}</div>}

      {success && onNextMonthBill && (
        <button
          type="button"
          onClick={() => {
            const lastExtractedFields = JSON.parse(
              localStorage.getItem("lastExtractedFields") || "{}"
            );
            const nextMonthFields = generateNextMonthFields(lastExtractedFields);
            onNextMonthBill(nextMonthFields);
          }}
          className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
        >
          📅 Next Month Bill
        </button>
      )}

      <div className="text-xs text-gray-500 break-words">
        Upload a PDF, DOCX, or image bill to automatically extract and fill in the form fields.
        Supported formats: PDF (.pdf), Word (.docx), Images (.png, .jpg, .jpeg, .webp). Supported fields: Landlord name, amount,
        rate, bill number, dates, and period. Best results with bills generated here; scanned or complex layouts may not parse fully.
      </div>
    </div>
  );
}
