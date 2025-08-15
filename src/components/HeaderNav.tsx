"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

export default function HeaderNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const items = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/bills/new", label: "House Bill" },
    { href: "/bills/advanced", label: "Advanced" },
    { href: "/bills/custom", label: "Custom" },
    { href: "/bills", label: "Bills" },
    { href: "/landlords", label: "Landlords" },
  ];

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));

  const linkClass = (href: string) => {
    const active = isActive(href);
    const base =
      "relative overflow-hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60";
    const rest = active
      ? "text-white border-transparent shadow-sm"
      : "border-black/10 dark:border-white/10 hover:bg-foreground/5 dark:hover:bg-white/5";
    return `${base} ${rest}`;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.1 },
    },
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 26 } },
  } as const;

  return (
    <header className="border-b border-black/10 dark:border-white/10 h-14 sm:h-16 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-full flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="font-semibold text-base sm:text-lg tracking-tight">
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
        <motion.nav
          className={
            open
              ? "fixed top-14 sm:top-auto left-0 right-0 z-50 sm:static sm:z-auto bg-background sm:bg-transparent border-t border-black/10 dark:border-white/10 sm:border-0 p-4 sm:p-0 flex flex-col sm:flex-row gap-2 sm:gap-2"
              : "hidden sm:flex sm:flex-row sm:items-center sm:gap-2"
          }
          initial="hidden"
          animate="show"
          variants={containerVariants}
        >
          {items.map((it) => {
            const active = isActive(it.href);
            return (
              <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className={linkClass(it.href)}>
                {/* Animated gradient sweep for active */}
                {active && (
                  <motion.div
                    aria-hidden
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(59,130,246,0.7) 0%, rgba(45,212,191,0.7) 50%, rgba(99,102,241,0.7) 100%)",
                      backgroundSize: "250% 100%",
                      filter: "saturate(105%)",
                    }}
                    animate={{ backgroundPosition: ["0% 0%", "100% 0%"] }}
                    transition={{ duration: 3.2, ease: "linear", repeat: Infinity }}
                  />
                )}
                <motion.span
                  variants={itemVariants}
                  whileHover={{ y: -1, scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="inline-flex items-center relative z-10"
                >
                  {it.label}
                </motion.span>
              </Link>
            );
          })}
        </motion.nav>
      </div>
    </header>
  );
}
