"use client";
import React, { useState } from "react";
import Link from "next/link";

export default function HeaderNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="border-b border-black/10 dark:border-white/10 h-16 relative">
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

        {/* Mobile overlay */}
        {open && (
          <button
            aria-label="Close navigation menu"
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Nav links */}
        <nav
          className={
            open
              ? "fixed top-16 left-0 right-0 z-50 sm:static sm:z-auto bg-background sm:bg-transparent border-t border-black/10 dark:border-white/10 sm:border-0 p-4 sm:p-0 flex flex-col sm:flex-row gap-2 sm:gap-3"
              : "hidden sm:flex sm:flex-row sm:items-center sm:gap-3"
          }
        >
          <Link href="/dashboard" onClick={() => setOpen(false)} className="block py-2.5 sm:py-0">
            Dashboard
          </Link>
          <Link href="/bills/new" onClick={() => setOpen(false)} className="block py-2.5 sm:py-0">
            House Bill
          </Link>
          <Link href="/bills/advanced" onClick={() => setOpen(false)} className="block py-2.5 sm:py-0">
            Advanced Generator
          </Link>
          <Link href="/bills" onClick={() => setOpen(false)} className="block py-2.5 sm:py-0">
            Bills
          </Link>
          <Link href="/landlords" onClick={() => setOpen(false)} className="block py-2.5 sm:py-0">
            Landlords
          </Link>
        </nav>
      </div>
    </header>
  );
}
