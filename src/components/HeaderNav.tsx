"use client";
import React, { useState } from "react";
import Link from "next/link";

export default function HeaderNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="border-b border-black/10 dark:border-white/10 h-16">
      <div className="max-w-6xl mx-auto px-4 h-full flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="font-semibold text-base sm:text-lg">
          BillMate
        </Link>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="sm:hidden inline-flex items-center p-2 rounded-md border border-black/10 dark:border-white/10 text-current"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        {/* Nav links */}
        <nav
          className={`${open ? "flex" : "hidden"} w-full flex-col gap-2 mt-3 sm:mt-0 sm:w-auto sm:flex sm:flex-row sm:items-center sm:gap-3`}
        >
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/bills/new">House Bill</Link>
          <Link href="/bills/advanced">Advanced Generator</Link>
          <Link href="/bills">Bills</Link>
          <Link href="/landlords">Landlords</Link>
        </nav>
      </div>
    </header>
  );
}
