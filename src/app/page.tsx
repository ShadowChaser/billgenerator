"use client";
import Link from "next/link";
import { motion } from "framer-motion";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 },
  },
};

const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

export default function Home() {
  return (
    <div className="relative overflow-x-hidden">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 -left-20 h-56 w-56 sm:h-72 sm:w-72 rounded-full bg-gradient-to-tr from-blue-500/20 to-teal-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-56 w-56 sm:h-72 sm:w-72 rounded-full bg-gradient-to-tr from-fuchsia-500/20 to-purple-400/20 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/10" />
      </div>

      {/* Hero Section */}
      <section className="w-full px-4 min-h-[clamp(520px,calc(100svh-4rem-1px),760px)] flex items-center justify-center py-8 sm:py-12">
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="text-center"
        >
          <motion.div variants={fadeInUp}>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs sm:text-sm opacity-80">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Instant PDF bills, zero hassle
            </span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight"
          >
            BillMate
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="mt-4 max-w-2xl mx-auto text-base sm:text-lg opacity-80"
          >
            Create professional rent bills with auto-fill, PDF/Word/Image upload parsing, and one-click export.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:justify-center"
          >
            <Link
              href="/bills/new"
              className="px-5 py-2.5 rounded-md bg-foreground text-background shadow hover:opacity-90 transition w-full sm:w-auto"
            >
              Generate Bill
            </Link>
            <Link
              href="/bills"
              className="px-5 py-2.5 rounded-md border hover:bg-foreground/5 transition w-full sm:w-auto"
            >
              View Bills
            </Link>
            <Link
              href="/landlords"
              className="px-5 py-2.5 rounded-md border hover:bg-foreground/5 transition w-full sm:w-auto"
            >
              Manage Landlords
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-4 pb-16 sm:pb-20">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6"
        >
          {[
            {
              title: "Smart Parsing",
              desc: "Auto-extract details from PDF/Word/Images. Fill the form in seconds.",
              emoji: "🤖",
            },
            {
              title: "Editable Template",
              desc: "Fine-tuned professional layout with line-break aware fields.",
              emoji: "🧾",
            },
            {
              title: "One-click PDF",
              desc: "Preview and export high-quality PDFs with correct page breaks.",
              emoji: "⚡",
            },
            {
              title: "Secure Storage",
              desc: "Save and manage bills. Quickly duplicate next month’s bill.",
              emoji: "🔒",
            },
            {
              title: "Mobile Ready",
              desc: "Optimized preview and controls for smaller screens.",
              emoji: "📱",
            },
            {
              title: "Free to Start",
              desc: "Use sample data instantly and customize anytime.",
              emoji: "🎁",
            },
          ].map((f, i) => (
            <motion.div
              key={i}
              variants={fadeInUp}
              className="rounded-xl border p-4 sm:p-5 bg-white/50 dark:bg-black/20 backdrop-blur-sm shadow-sm hover:shadow-md transition"
            >
              <div className="text-2xl">{f.emoji}</div>
              <div className="mt-3 font-semibold text-lg">{f.title}</div>
              <p className="mt-1 text-sm opacity-80">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA Strip */}
      <section className="relative">
        <div className="max-w-6xl mx-auto px-4 pb-16 sm:pb-24">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="rounded-2xl border bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="text-center sm:text-left">
              <h3 className="text-lg sm:text-2xl font-bold">
                Start generating your next bill in minutes
              </h3>
              <p className="opacity-90 text-sm sm:text-base mt-1">
                Upload last month’s bill or fill manually — we’ll handle the rest.
              </p>
            </div>
            <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-3">
              <Link
                href="/bills/new"
                className="px-5 py-2.5 rounded-md bg-white text-blue-700 font-medium shadow hover:opacity-90 transition w-full sm:w-auto"
              >
                Create Bill
              </Link>
              <Link
                href="/bills/advanced"
                className="px-5 py-2.5 rounded-md border border-white/50 text-white hover:bg-white/10 transition w-full sm:w-auto"
              >
                Advanced Template
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
