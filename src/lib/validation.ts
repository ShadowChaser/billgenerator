import { z } from "zod";

export const billFormSchema = z
  .object({
    period: z.string().min(3, "Select a month-year"),
    bill_mode: z.enum(["auto", "manual", "random"]),
    bill_number: z.string().optional(),
    date: z.string(),
    landlord_mode: z.enum(["manual", "existing"]),
    landlord_id: z.string().uuid().optional(),
    landlord_name: z.string().optional(),
    agreement_date: z.string(),
    rate: z
      .string()
      .refine(
        (val) => !Number.isNaN(Number(val)) && Number(val) > 0,
        "Enter a valid rate"
      )
      .optional(),
    amount: z
      .string()
      .refine(
        (val) => !Number.isNaN(Number(val)) && Number(val) > 0,
        "Enter a valid amount"
      ),
    signature_url: z.string().optional().nullable(),
    signature_file: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.landlord_mode === "manual") {
      if (!data.landlord_name || data.landlord_name.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a landlord name",
          path: ["landlord_name"],
        });
      }
    } else if (data.landlord_mode === "existing") {
      if (!data.landlord_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select a saved landlord",
          path: ["landlord_id"],
        });
      }
    }
  });

export type BillFormInput = z.infer<typeof billFormSchema>;
