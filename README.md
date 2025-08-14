## House Rent Bill Generator – MVP

Modern web app to create, store, and export house rent bills as PDF with digital signatures, powered by Next.js and Supabase.

### Tech Stack

- Next.js 15 (App Router), React 19, TypeScript, Tailwind v4
- Supabase (Auth, Postgres, Storage)
- react-hook-form + Zod (forms + validation)
- html2pdf.js + html2canvas + jsPDF (client-side PDF export)

### What’s Implemented

- Bill creation form: period, bill number mode (auto/manual/random), date, landlord, agreement date, amount, signature upload
- Bill storage: saves to DB; signature images stored in Supabase Storage
- Search/filter: by month/period, landlord, bill number
- PDF export: client-side, matches the sample layout and places signature image correctly
- Signature management: default signature per landlord; can override per bill
- Basic auth: email magic-link sign-in; header shows sign-in/out state

### Project Structure

- `src/app/page.tsx` – Home (CTA to core pages)
- `src/app/dashboard/page.tsx` – Placeholder dashboard
- `src/app/bills/new/page.tsx` – Create bill, preview, export PDF
- `src/app/bills/page.tsx` – Bills list with search & filter
- `src/app/landlords/page.tsx` – Manage landlords and default signatures
- `src/app/login/page.tsx` – Magic-link login
- `src/components/HeaderNav.tsx` – Global header + navigation + auth state
- `src/lib/supabaseClient.ts` – Supabase client (safe when env is missing)
- `src/lib/types.ts` – TypeScript types for DB entities
- `src/lib/validation.ts` – Zod schema for bill form
- `supabase.sql` – SQL to create required tables

### Database Schema (Supabase)

Run `supabase.sql` in the Supabase SQL editor.

- `landlords`

  - `id` uuid PK
  - `name` text not null
  - `address` text
  - `signature_url` text (public URL to signature image)
  - `created_at` timestamp default now()

- `bills`
  - `id` uuid PK
  - `bill_number` text not null
  - `bill_mode` text in ('auto','manual','random')
  - `date` date not null
  - `period` text not null (e.g., 'JANUARY-2025')
  - `landlord_id` uuid FK -> landlords(id)
  - `agreement_date` date not null
  - `amount` numeric not null
  - `signature_url` text (either landlord default or uploaded per bill)
  - `created_at` timestamp default now()

Storage: create a bucket named `public` with public read for signature images.

### Environment Variables

Create `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Install & Run

```bash
npm install
npm run dev
# open http://localhost:3000
```

### User Flow

1. Sign in with email (magic link) via `/login`. Header will display session state.
2. Create a landlord in `/landlords` (optionally upload a default signature).
3. Create a bill in `/bills/new`:
   - Select period and dates
   - Choose bill number mode:
     - Auto: last numeric bill + 1
     - Manual: you type it
     - Random: `BILL-XXXXXXXX`
   - Select landlord
   - Set amount
   - Optionally upload a new signature for this bill
   - Save & Preview, then Download PDF
4. View/search bills in `/bills` by bill number/landlord and filter by period.

### PDF Generation

Client-side export using `html2pdf.js` to render an HTML layout that closely matches the provided format:

- Header: HOUSE RENT BILL
- Fields: Period, Bill No, Date
- Body: Paragraph referencing landlord and agreement date
- Table: Description/Month/Rate/Amount
- Signature block: image positioned below text

If you require precise print fidelity (e.g., exact margins, DPI), we can add a server route that renders the same layout with Puppeteer and returns a PDF.

### Code Highlights

- Strict types: all core entities (`Bill`, `Landlord`) are typed in `src/lib/types.ts`
- Safe Supabase client: when env vars missing, calls throw an explicit error instead of failing at build-time (`src/lib/supabaseClient.ts`)
- Zod validation for form input: `src/lib/validation.ts`

### Extending the MVP

- Authentication guards and RLS policies (Supabase) for multi-user isolation
- Edit/delete landlords and bills; view bill details page
- Server-rendered PDFs (Puppeteer) with exact print layout
- Better bill number strategies (per landlord sequence, year-based numbering)
- Role-based access, audit logs

### Scripts

- `npm run dev` – start development server
- `npm run build` – production build
- `npm start` – start production server
- `npm run lint` – ESLint

### Notes

- Images are displayed using `img` for simplicity in preview tables. Consider `next/image` for production performance.
- Ensure the Supabase Storage bucket `public` has public read enabled so signature images can render in PDFs.
