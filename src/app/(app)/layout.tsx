import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-black/10 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold">
            BillMate
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/bills/new">New Bill</Link>
            <Link href="/bills">Bills</Link>
            <Link href="/landlords">Landlords</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
