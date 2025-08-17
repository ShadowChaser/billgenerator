"use client";
import React from "react";
import { Controller } from "react-hook-form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";

interface BillDetailsSectionProps {
  form: any;
  onGenerateBillNumber: () => void;
}

export function BillDetailsSection({ form, onGenerateBillNumber }: BillDetailsSectionProps) {
  return (
    <div className="">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
        <label className="grid gap-1">
          <span className="text-sm">Period (Month)</span>
          <Controller
            name="period"
            control={form.control}
            render={({ field }) => (
              <DatePicker
                selected={field.value ? new Date(field.value + "-01") : null}
                onChange={(date) => {
                  if (date) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, "0");
                    field.onChange(`${year}-${month}`);
                  }
                }}
                dateFormat="MMMM yyyy"
                showMonthYearPicker
                showFullMonthYearPicker
                placeholderText="Select month and year"
                className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          />
          {form.formState?.errors?.period && (
            <span className="text-xs text-red-600">
              {form.formState.errors.period.message as string}
            </span>
          )}
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Bill Date</span>
          <Controller
            name="date"
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
                placeholderText="Select date"
                className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          />
          {form.formState?.errors?.date && (
            <span className="text-xs text-red-600">Date is required</span>
          )}
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Bill Number</span>
          <div className="relative">
            <input
              className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
              placeholder="Enter bill number"
              {...form.register("bill_number")}
            />
            <button
              type="button"
              onClick={onGenerateBillNumber}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              title="Generate random bill number"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </label>
      </div>
    </div>
  );
}
