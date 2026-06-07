# MEIL Sales Scoreboard — Setup Guide
## One-time setup. Follow in order. Takes ~30 minutes.

---

## STEP 1 — Create Supabase Project

1. Go to **https://supabase.com** → Sign up (free)
2. Click **New Project**
3. Fill in:
   - **Name:** meil-scoreboard
   - **Database password:** Choose a strong password (save it somewhere)
   - **Region:** Southeast Asia (Singapore) — closest to India
4. Wait ~2 minutes for project to provision

---

## STEP 2 — Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open the file: `supabase/migrations/001_initial_schema.sql`
4. Copy the entire contents and paste into the SQL Editor
5. Click **Run** (green button)
6. You should see: "Success. No rows returned"

If you get an error, check that you pasted the full file and try again.

---

## STEP 3 — Get Your API Keys

1. In Supabase dashboard → **Project Settings** (gear icon, bottom left)
2. Click **API** in the settings menu
3. Copy two values:
   - **Project URL** (looks like: `https://abcdefgh.supabase.co`)
   - **anon / public** key (long string starting with `eyJ...`)

---

## STEP 4 — Configure the App

1. In the project folder, find `.env.example`
2. Create a copy called `.env` (same folder)
3. Fill in your values:
   ```
   REACT_APP_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJ...your key here...
   ```
4. Save the file

---

## STEP 5 — Create the First Superadmin User

1. In Supabase dashboard → **Authentication** → **Users**
2. Click **Invite User** or **Add User**
3. Enter your email and a temporary password
4. Note the **User UID** (UUID shown in the users table)
5. Go back to **SQL Editor** → New Query
6. Run this (replace with your actual values):
   ```sql
   INSERT INTO public.profiles (id, full_name, email, role)
   VALUES (
     'PASTE-YOUR-UUID-HERE',
     'Spriha',
     'your@email.com',
     'superadmin'
   );
   ```
7. Click Run

This makes you the first superadmin. You can add all other users from within the app.

---

## STEP 6 — Run the App Locally (to test)

You need Node.js installed. Check: `node --version` in terminal.

```bash
# In the project folder:
npm install
npm start
```

Opens at http://localhost:3000
Sign in with the email/password you created in Step 5.

---

## STEP 7 — Deploy to Netlify

1. Push the project to a GitHub repository (create one at github.com)
2. Go to **https://netlify.com** → Sign up with GitHub
3. Click **Add new site** → **Import an existing project** → GitHub
4. Select your repository
5. Build settings (should auto-detect):
   - Build command: `npm run build`
   - Publish directory: `build`
6. Click **Add environment variables** before deploying:
   - `REACT_APP_SUPABASE_URL` = your Supabase URL
   - `REACT_APP_SUPABASE_ANON_KEY` = your anon key
7. Click **Deploy site**
8. Your app will be live at a URL like: `https://meil-scoreboard.netlify.app`

You can set a custom domain later in Netlify settings.

---

## STEP 8 — Add Team Members

Once you're logged in as superadmin:
1. Go to **Admin → Manage Users**
2. Click **Add User**
3. Fill in name, email, role
4. The system sends them an invite email
5. They set their password via the link

Roles available:
- **Superadmin** — full access (you, Rahul Mangal, Gaurav Bhatt)
- **Admin** — data entry + KRA approval (Rupam Mondal)
- **Data Entry** — input only, no approvals
- **Sales Manager** — view all, no data entry
- **Salesperson** — own scorecard + KRA log (Amol, Varun, Mahesh)

---

## What's Been Built (Session 1)

✅ Complete database schema (all tables, RLS, audit log, gamification)
✅ Role-based auth with flexible permissions
✅ Login page
✅ App layout with sidebar navigation
✅ Home dashboard (live leaderboard summary, team MT bar, recognition feed, streaks)
✅ Routing structure (all pages scaffolded)
✅ Netlify deploy config

## What's Coming (Session 2+)

🔲 Full leaderboard — all 7 competitions with Most Improved toggle (WoW/MoM/Week N)
🔲 Individual scorecard — ranks, badges, level, personal bests, rivalry display
🔲 Data entry panel — fast daily entry for admin
🔲 KRA log — salesperson self-entry + admin approval
🔲 Team panel — MTD/QTD/YTD, plant-wise MT, charts
🔲 Hall of Fame — monthly badges
🔲 Target manager
🔲 User manager with permission toggles
🔲 Audit log viewer
🔲 Auto gamification engine (badge awards, level-ups, recognition feed events)
🔲 Month-end snapshot + monthly report card
🔲 WhatsApp share card generator
🔲 Rivalry mode

---

## Folder Structure

```
meil-scoreboard/
├── public/
│   ├── index.html
│   └── manifest.json
├── src/
│   ├── components/
│   │   └── shared/
│   │       └── AppLayout.js       ← Sidebar + navigation
│   ├── context/
│   │   └── AuthContext.js         ← Auth + permissions
│   ├── lib/
│   │   └── supabase.js            ← DB client + helpers
│   ├── pages/
│   │   ├── LoginPage.js
│   │   ├── Dashboard.js           ← Home screen
│   │   └── admin/                 ← Admin pages (coming next)
│   └── styles/
│       └── global.css
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql ← Run this in Supabase
├── .env.example                   ← Copy to .env and fill in
├── netlify.toml                   ← Auto deploy config
└── package.json
```
