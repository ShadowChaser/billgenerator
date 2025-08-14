import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">House Rent Bill Generator</h1>
        <p className="mt-3 opacity-80">
          Create, store, and export house rent bills as PDF.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link
            href="/bills/new"
            className="px-4 py-2 rounded bg-foreground text-background"
          >
            New Bill
          </Link>
          <Link href="/bills" className="px-4 py-2 rounded border">
            View Bills
          </Link>
          <Link href="/landlords" className="px-4 py-2 rounded border">
            Manage Landlords
          </Link>
        </div>
      </div>
    </div>
  );
}
