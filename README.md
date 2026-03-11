# SubayCentral

SubayCentral is an OJT Daily Accomplishment and Time Monitoring System built with Next.js, React, Tailwind CSS, and Supabase.

For local development, the project supports SQLite-first mode so you can run without setting up Supabase first.

## Core Features

### Admin

- Account management for faculty and interns
- Program management
- Partner agency management
- Deployment management
- Multi-faculty assignment per deployment
- Account settings

### Faculty

- Dashboard overview
- View assigned interns
- Assign interns to partner agencies
- Review intern profiles, time logs, and daily records
- Submit intern feedback
- View monthly reports
- Account settings

### Intern

- Home dashboard with current deployment
- Daily accomplishment records by month
- Daily time in and time out records
- View faculty feedback
- View profile, start date, and expected end date
- Account settings

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- SQLite (local development mode)
- Supabase Auth + Postgres + RLS (production mode)
- Recharts for faculty reporting
- Vercel for hosting

## Local Setup (SQLite-first)

1. Install dependencies:

```bash
npm install
```

2. Copy env template:

```bash
copy .env.local.example .env.local
```

3. Start local SQLite mode:

```bash
npm run dev:sqlite
```

SQLite mode creates and seeds `dev.sqlite` automatically.

Demo login accounts (password for all: `password123`):

- `admin@subaycentral.local`
- `faculty@subaycentral.local`
- `intern@subaycentral.local`

4. Open `http://localhost:3000`

## Local Setup (Supabase mode)

If you want to use Supabase locally instead of SQLite:

1. Set these values in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

2. Remove or comment out:

- `DEV_DB=sqlite`
- `NEXT_PUBLIC_DEV_DB=sqlite`

3. Run schema in Supabase SQL Editor:

- `supabase/schema.sql`

4. Start dev server:

```bash
npm run dev
```

## Deployment on Vercel

1. Push this project to GitHub.
2. Import the repository into Vercel.
3. Set environment variables in Vercel project settings.
4. Deploy.

Production variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Build Check

```bash
npm run build
```
