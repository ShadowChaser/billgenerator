"use client";
import Link from "next/link";

export default function HeaderNav() {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
        <Link href="/" className="font-semibold">
          House Rent Bill
        </Link>
        <nav className="flex gap-3 text-sm items-center flex-wrap sm:flex-nowrap">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/bills/new">New Bill</Link>
          <Link href="/bills/advanced">Advanced Generator</Link>
          <Link href="/bills">Bills</Link>
          <Link href="/landlords">Landlords</Link>
        </nav>
      </div>
    </header>
  );
}
