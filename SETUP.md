# ClockDesk — Setup Guide

## Prerequisites
- Node.js 18+ (https://nodejs.org)
- A Supabase project (https://supabase.com)

## 1. Install dependencies
```bash
npm install
```

## 2. Configure environment
Copy `.env.example` to `.env` and fill in your Supabase credentials:
```bash
cp .env.example .env
```

Find your credentials in your Supabase project under **Settings → API**:
- `VITE_SUPABASE_URL` — Project URL
- `VITE_SUPABASE_ANON_KEY` — anon/public key

## 3. Run the database migration
In your Supabase project, open the **SQL Editor** and run the contents of:
```
supabase/migrations/001_initial_schema.sql
```
This creates all tables, RLS policies, indexes, and the realtime publication.

## 4. Create your first admin user
In the Supabase **Authentication → Users** panel, create a user manually, then in the **SQL Editor** run:
```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
```

## 5. Start the dev server
```bash
npm run dev
```
Open http://localhost:5173 and sign in.

## 6. Create staff accounts
From the admin portal → **Staff** → **Add staff member**. This calls `supabase.auth.admin.createUser`, which requires your project's **service_role** key. For production, move staff creation behind a Supabase Edge Function rather than calling it from the frontend.

## Architecture notes
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Backend / DB | Supabase (PostgreSQL + Auth + Realtime) |
| Routing | React Router v6 |
| Forms | React Hook Form |
| Date utilities | date-fns |

## Build for production
```bash
npm run build
```
Deploy the `dist/` folder to Vercel, Netlify, or any static host.
