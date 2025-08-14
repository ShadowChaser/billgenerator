export type UUID = string;

export interface Landlord {
  id: UUID;
  name: string;
  address?: string | null;
  signature_url?: string | null;
  created_at: string;
}

export interface Bill {
  id: UUID;
  bill_number: string;
  bill_mode: "auto" | "manual" | "random";
  date: string; // ISO date
  period: string; // e.g., JANUARY-2025
  landlord_id: UUID;
  agreement_date: string; // ISO date
  rate?: number; // monthly rate
  amount: number; // total value
  signature_url?: string | null;
  created_at: string;
}
