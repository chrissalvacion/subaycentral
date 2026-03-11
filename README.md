# SubayCentral

SubayCentral is an OJT Daily Accomplishment and Time Monitoring System built with Next.js, React, Tailwind CSS, and Supabase. It is structured for Vercel deployment and supports three role-based user groups:

- Admin
- Faculty
- Intern

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
- Supabase Auth + Postgres + RLS
- Recharts for faculty reporting
- Vercel for hosting

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template and fill in your Supabase values:

```bash
copy .env.local.example .env.local
```

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

3. Run the Supabase schema in your Supabase SQL editor:

- [supabase/schema.sql](supabase/schema.sql)

4. Start the development server:

```bash
npm run dev
```

5. Open `http://localhost:3000`

## Supabase Notes

The schema includes:

- Profile extension for `auth.users`
- Programs
- Partner agencies
- Deployments
- Deployment to faculty assignments
- Intern deployment records
- Daily records
- Time records
- Feedback
- Row-level security policies by role

The `handle_new_user()` trigger auto-creates a `profiles` row when a new user is created through Supabase Auth.

## Deployment on Vercel

1. Push this project to GitHub.
2. Import the repository into Vercel.
3. Add the same environment variables from `.env.local` into the Vercel project settings.
4. Deploy.

Recommended environment variables in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Important Implementation Notes

- The admin user creation flow uses the Supabase service role key and must remain server-only.
- Pages are responsive and designed for desktop and mobile layouts.
- Authentication redirects are handled through the app proxy.
- Browser-side Supabase initialization uses safe fallbacks so production builds succeed before environment variables are attached in Vercel.

## Build Check

Production build validation completed successfully with:

```bash
npm run build
```
# subaycentral
