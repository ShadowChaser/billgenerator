"use client";
import type { Bill, Landlord } from "@/lib/types";

const LANDLORDS_KEY = "hrb_landlords";
const BILLS_KEY = "hrb_bills";

function readArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getLandlords(): Landlord[] {
  return readArray<Landlord>(LANDLORDS_KEY);
}

export function saveLandlord(newLandlord: Landlord): void {
  const list = getLandlords();
  list.unshift(newLandlord);
  writeArray(LANDLORDS_KEY, list);
}

export function getBills(): Bill[] {
  return readArray<Bill>(BILLS_KEY);
}

export function saveBill(newBill: Bill): void {
  const list = getBills();
  list.unshift(newBill);
  writeArray(BILLS_KEY, list);
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function computeNextNumericBillNumber(): string {
  const bills = getBills();
  let max = 0;
  for (const b of bills) {
    const n = Number(b.bill_number);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return String(max + 1);
}
