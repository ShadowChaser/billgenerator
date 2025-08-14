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

    // Extract period - look for month names and years
    const monthNames = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ];

    for (let i = 0; i < monthNames.length; i++) {
      const monthName = monthNames[i];
      const monthPattern = new RegExp(`${monthName}\\s*-?\\s*(\\d{4})`, "i");
      const match = text.match(monthPattern);
      console.log(
        "Trying period pattern:",
        monthPattern.source,
        "Match:",
        match
      );
      if (match && match[1]) {
        const year = match[1];
        const month = String(i + 1).padStart(2, "0");
        extractedFields.period = `${year}-${month}`;
        console.log("Found period:", extractedFields.period);
        break;
      }
    }

    // Extract agreement date
    const agreementPatterns = [
      /agreement\s*date[:\s]*(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/i,
      /agreement\s*dtd[:\s]*(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/i,
      /dtd[:\s]*(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/i,
    ];

    for (const pattern of agreementPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[2] && match[3]) {
        const day = match[1].padStart(2, "0");
        const month = match[2].padStart(2, "0");
        const year = match[3];
        const dateStr = `${year}-${month}-${day}`;
        if (!isNaN(Date.parse(dateStr))) {
          extractedFields.agreement_date = dateStr;
          console.log("Found agreement date:", dateStr);
          break;
        }
      }
    }

    return extractedFields;
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.includes("pdf")) {
      setError("Please select a PDF file");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const text = await extractTextFromPdf(file);
      console.log(
        "Extracted text from PDF (length:",
        text.length,
        "):",
        JSON.stringify(text.substring(0, 500))
      ); // Log first 500 chars with length
      const extractedFields = extractFieldsFromText(text);

      if (Object.keys(extractedFields).length === 0) {
        setError(
          "No relevant information found in the PDF. Please check if the PDF contains bill details."
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
          `Successfully extracted ${fieldCount} field(s) from the PDF!`
        );
        console.log("Extracted fields:", extractedFields);
        setError(null);
      }
    } catch (err) {
      console.error("Error processing PDF:", err);
      if (err instanceof Error) {
        setError(`Failed to process PDF: ${err.message}`);
      } else {
        setError("Failed to process PDF. Please try again.");
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
    <div className="rounded-md border p-4 grid gap-4">
      <div className="text-sm font-semibold opacity-80">
        Upload PDF to Auto-fill
      </div>

      <div className="grid gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          disabled={disabled || isProcessing}
          className="border rounded px-3 py-2 bg-transparent disabled:opacity-50"
        />

        {isProcessing && (
          <div className="text-sm text-blue-600">
            Processing PDF (may take longer for scanned documents)... Please
            wait.
          </div>
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}

        {success && <div className="text-sm text-green-600">{success}</div>}

        {success && onNextMonthBill && (
          <button
            type="button"
            onClick={() => {
              // Get the last extracted fields and create next month data
              const lastExtractedFields = JSON.parse(
                localStorage.getItem("lastExtractedFields") || "{}"
              );
              const nextMonthFields =
                generateNextMonthFields(lastExtractedFields);
              onNextMonthBill(nextMonthFields);
            }}
            className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
          >
            📅 Next Month Bill
          </button>
        )}

        <div className="text-xs text-gray-500">
          Upload a PDF bill to automatically extract and fill in the form
          fields. Supported fields: Landlord name, amount, rate, bill number,
          dates, and period.
        </div>
      </div>
    </div>
  );
}
