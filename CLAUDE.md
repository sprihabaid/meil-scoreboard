# CLAUDE.md — Project Instructions

## Auto-deploy workflow

After every code change in this project, always commit and push to GitHub automatically without asking. Netlify auto-deploys from the `main` branch on every push.

Steps to follow after every fix or feature:
1. `git add -A`
2. `git commit -m "<clear message describing what changed>"`
3. `git push`
4. Tell the user the commit was pushed and that Netlify will auto-deploy in 2–3 minutes.

Never wait for the user to ask before committing and pushing.

## Project context

- **Stack**: React 18 + Supabase + Tailwind CSS + Recharts
- **Hosting**: Netlify (auto-deploys from `main` on GitHub push)
- **GitHub remote**: configured with token in remote URL — `git push` works without extra auth
- **Database**: Supabase (`daily_entries`, `profiles`, `v_current_month_leaderboard` view, etc.)
- **Migration files**: `/supabase/migrations/` — run these in the Supabase SQL Editor when schema changes are needed
