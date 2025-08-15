"use client";
import { useEffect, useMemo, useState } from "react";
import type { Bill, Landlord } from "@/lib/types";
import { getBills, getLandlords } from "@/lib/localStore";

type BillRow = Bill & { landlord: Landlord | null };

export default function BillsListPage() {
  const [bills, setBills] = useState<BillRow[]>([]);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("");

  useEffect(() => {
    const billsData = getBills();
    const landlordsData = getLandlords();
    const landlordsById = new Map<string, Landlord>();
    landlordsData.forEach((l) => landlordsById.set(l.id, l));
    const joined: BillRow[] = billsData.map((b) => ({
      ...b,
      landlord: landlordsById.get(b.landlord_id) ?? null,
    }));
    setLandlords(landlordsData);
    setBills(joined);
  }, []);

  const filtered = useMemo(() => {
    return bills.filter((b) => {
      const byQ =
        !q ||
        b.bill_number.toLowerCase().includes(q.toLowerCase()) ||
        b.landlord?.name.toLowerCase().includes(q.toLowerCase());
      const byP = !period || b.period === period;
      return byQ && byP;
    });
  }, [bills, q, period]);

  return (
    <div className="grid gap-5 px-3 sm:px-4 pt-2 pb-8">
      <h1 className="text-2xl font-semibold">Bills</h1>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="grid gap-1 min-w-0">
          <span className="text-sm">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full border rounded px-3 py-2 bg-transparent"
            placeholder="Bill no or landlord"
          />
        </label>
        <label className="grid gap-1 min-w-0">
          <span className="text-sm">Period</span>
          <input
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full border rounded px-3 py-2 bg-transparent"
            placeholder="e.g. JANUARY-2025"
          />
        </label>
      </div>

      {/* Mobile list (cards) */}
      <div className="grid gap-2 md:hidden">
        {filtered.map((b) => (
          <div
            key={b.id}
            className="rounded-lg ring-1 ring-inset ring-gray-200 dark:ring-gray-700 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid text-sm gap-1">
                <div className="font-medium">Bill #{b.bill_number}</div>
                <div className="text-muted-foreground">{b.period}</div>
                <div className="truncate">{b.landlord?.name ?? "-"}</div>
              </div>
              <div className="text-right">
                <div className="text-sm">{b.date}</div>
                <div className="mt-1 font-semibold">Rs. {b.amount.toFixed(2)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop/tablet table */}
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-lg ring-1 ring-inset ring-gray-200 dark:ring-gray-700">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Bill No</th>
                <th className="p-2">Date</th>
                <th className="p-2">Period</th>
                <th className="p-2">Landlord</th>
                <th className="p-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b">
                  <td className="p-2 whitespace-nowrap">{b.bill_number}</td>
                  <td className="p-2 whitespace-nowrap">{b.date}</td>
                  <td className="p-2 whitespace-nowrap">{b.period}</td>
                  <td className="p-2">{b.landlord?.name ?? "-"}</td>
                  <td className="p-2 whitespace-nowrap">Rs. {b.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
