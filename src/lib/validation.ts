import { z } from "zod";

export const billFormSchema = z
  .object({
    period: z.string().min(3, "Select a month-year"),
    bill_mode: z.enum(["auto", "manual", "random"]),
    bill_number: z.string().optional(),
    date: z.string(),
    landlord_mode: z.enum(["select", "manual"]),
    landlord_id: z.string().uuid().optional(),
    landlord_name: z.string().optional(),
    agreement_date: z.string(),
    amount: z
      .string()
      .refine(
        (val) => !Number.isNaN(Number(val)) && Number(val) > 0,
        "Enter a valid amount"
      ),
    signature_url: z.string().optional().nullable(),
    signature_file: z.any().optional(),
  })
  .refine(
    (data) => {
      if (data.landlord_mode === "select") {
        return !!data.landlord_id && data.landlord_id.length > 0;
      }
      return !!data.landlord_name && data.landlord_name.trim().length > 0;
    },
    {
      message: "Select a landlord or enter a name",
      path: ["landlord_mode"],
    }
  );

export type BillFormInput = z.infer<typeof billFormSchema>;
