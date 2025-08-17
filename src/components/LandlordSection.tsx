"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Controller } from "react-hook-form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import type { Landlord } from "@/lib/types";

interface LandlordSectionProps {
  form: any;
  landlordMode: string;
  landlords: Landlord[];
  landlordIdExisting: string | null;
}

export function LandlordSection({ form, landlordMode, landlords, landlordIdExisting }: LandlordSectionProps) {
  return (
    <div className="">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={landlordMode === "existing" ? "default" : "outline"}
          size="sm"
          onClick={() => form.setValue("landlord_mode", "existing")}
        >
          Existing
        </Button>
        <Button
          type="button"
          variant={landlordMode === "manual" ? "default" : "outline"}
          size="sm"
          onClick={() => form.setValue("landlord_mode", "manual")}
        >
          Manual
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0 mt-3">
        {landlordMode === "existing" ? (
          <label className="grid gap-1">
            <span className="text-sm">Saved Landlords</span>
            <select
              className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={landlordIdExisting ?? ""}
              onChange={(e) => form.setValue("landlord_id", e.target.value)}
            >
              {landlords.length === 0 ? (
                <option value="" disabled>
                  No landlords saved
                </option>
              ) : null}
              {landlords.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            {form.formState?.errors?.landlord_id && (
              <span className="text-xs text-red-600">
                {form.formState.errors.landlord_id.message as string}
              </span>
            )}
          </label>
        ) : (
          <label className="grid gap-1">
            <span className="text-sm">Landlord Name</span>
            <input
              className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Type landlord name"
              {...form.register("landlord_name")}
            />
            {form.formState?.errors?.landlord_name && (
              <span className="text-xs text-red-600">
                {form.formState.errors.landlord_name.message as string}
              </span>
            )}
          </label>
        )}

        <label className="grid gap-1">
          <span className="text-sm">Agreement Date</span>
          <Controller
            name="agreement_date"
            control={form.control}
            render={({ field }) => (
              <DatePicker
                selected={field.value ? new Date(field.value) : null}
                onChange={(date) => {
                  if (date) {
                    field.onChange(format(date, "yyyy-MM-dd"));
                  }
                }}
                dateFormat="dd/MM/yyyy"
                placeholderText="Select agreement date"
                className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-background px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          />
          {form.formState?.errors?.agreement_date && (
            <span className="text-xs text-red-600">Agreement date is required</span>
          )}
        </label>
      </div>
    </div>
  );
}
