"use client";
import { BillFormInput } from "@/lib/validation";

export class BillFieldExtractor {
  static extractFieldsFromText(text: string): Partial<BillFormInput> {
    const extractedFields: Partial<BillFormInput> = {};
    console.log("Starting field extraction from text length:", text.length);

    // Extract landlord name
    const landlordPatterns = [
      /smt\.\s+([a-zA-Z\s]+?)(?:\s*\(|$)/i,
      /mr\.\s+([a-zA-Z\s]+?)(?:\s*\(|$)/i,
      /mrs\.\s+([a-zA-Z\s]+?)(?:\s*\(|$)/i,
      /landlord[:\s]+([a-zA-Z\s]+?)(?:\s*\(|$)/i,
      /owner[:\s]+([a-zA-Z\s]+?)(?:\s*\(|$)/i,
    ];

    for (const pattern of landlordPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 2) {
          extractedFields.landlord_name = name;
          console.log("Found landlord name:", name);
          break;
        }
      }
    }

    // Extract amount
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

    // Extract rate
    const ratePatterns = [
      /rate[:\s]*rs\.?\s*([0-9,]+)\s*\/?p\.?m/i,
      /rs\.?\s*([0-9,]+)\s*\/?p\.?m/i,
      /([0-9,]+)\s*p\.?m/i,
      /rs\.?\s*([0-9,]+)\s*\/?pm/i,
      /rs\.?\s*([0-9,]+)\s*\/?\s*pm/i,
      /rs\.?\s*([0-9,]+)\s*\/?\s*p\.?m/i,
      /rs\.?\s*([0-9,]+)\s*\/?-\s*pm/i,
      /rs\.?\s*([0-9,]+)\s*\/?-\s*p\.?m/i,
    ];

    for (const pattern of ratePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const rate = match[1].replace(/,/g, "");
        if (!isNaN(Number(rate))) {
          extractedFields.rate = rate;
          console.log("Found rate:", rate);
          break;
        }
      }
    }

    // Extract bill number
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

    // Extract period
    extractedFields.period = this.extractPeriod(text);

    // Extract agreement date
    extractedFields.agreement_date = this.extractAgreementDate(text);

    return extractedFields;
  }

  private static extractPeriod(text: string): string | undefined {
    const findPeriodInSnippet = (snippet: string): string | null => {
      const monthMap: Record<string, string> = {
        jan: "01", january: "01", feb: "02", february: "02",
        mar: "03", march: "03", apr: "04", april: "04",
        may: "05", jun: "06", june: "06", jul: "07", july: "07",
        aug: "08", august: "08", sep: "09", sept: "09", september: "09",
        oct: "10", october: "10", nov: "11", november: "11",
        dec: "12", december: "12",
      };

      // YYYY-MM format
      let m = snippet.match(/\b(\d{4})-(\d{1,2})\b/);
      if (m) {
        const mm = m[2].padStart(2, "0");
        return `${m[1]}-${mm}`;
      }

      // Month YYYY format
      m = snippet.match(/\b([A-Za-z]{3,9})\.?\s+(\d{4})\b/);
      if (m) {
        const mon = monthMap[m[1].toLowerCase()];
        if (mon) return `${m[2]}-${mon}`;
      }

      return null;
    };

    const periodKeywords = ["period", "for the month", "month of", "billing period"];
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

    return bestPeriod || undefined;
  }

  private static extractAgreementDate(text: string): string | undefined {
    const normalizeYMD = (y: string, m: string, d: string) => {
      const mm = m.padStart(2, "0");
      const dd = d.padStart(2, "0");
      const dateStr = `${y}-${mm}-${dd}`;
      return isNaN(Date.parse(dateStr)) ? null : dateStr;
    };

    const tryExtractDateFromSnippet = (snippet: string): string | null => {
      // DD[-/]MM[-/]YYYY
      let m = snippet.match(/\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\b/);
      if (m) return normalizeYMD(m[3], m[2], m[1]);

      // YYYY[-/]MM[-/]DD
      m = snippet.match(/\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
      if (m) return normalizeYMD(m[1], m[2], m[3]);

      return null;
    };

    const agreementKeywords = ["agreement", "agr", "dtd", "dated", "agreement date", "agreement dtd"];
    const lower = text.toLowerCase();

    for (const kw of agreementKeywords) {
      let startIndex = 0;
      while (true) {
        const idx = lower.indexOf(kw, startIndex);
        if (idx === -1) break;
        const snippet = text.substring(Math.max(0, idx - 30), Math.min(text.length, idx + 80));
        const found = tryExtractDateFromSnippet(snippet);
        if (found) return found;
        startIndex = idx + kw.length;
      }
    }

    return tryExtractDateFromSnippet(text) || undefined;
  }

  static generateNextMonthFields(lastFields: Partial<BillFormInput>): Partial<BillFormInput> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const currentPeriod = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
    const currentDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    let nextBillNumber = "1";
    if (lastFields.bill_number) {
      const currentNumber = parseInt(lastFields.bill_number.replace(/\D/g, "")) || 0;
      nextBillNumber = String(currentNumber + 1);
    }

    return {
      ...lastFields,
      period: currentPeriod,
      date: currentDate,
      bill_number: nextBillNumber,
    };
  }
}
