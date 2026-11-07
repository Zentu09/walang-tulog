# Supabase setup

The submission form reads the generated static list at
`Codes/Js/approved-schools.json`; school-name searching does not require an API
request. The API also checks submissions against that list. To regenerate it
after replacing `Codes/Js/school_masterlist.csv`, run `npm run extract-schools`,
commit the updated JSON, and redeploy.

1. **Create the table:** Supabase Dashboard > SQL Editor > paste `supabase/schema.sql` > Run.
2. **Add your keys:** copy `supabase/.env.example` to the project root as `.env`, then fill in
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API). `.env` is git-ignored.
3. **(Optional) Import old rows:** `node supabase/import-existing.js`
4. **Run:** `npm start` — the console prints `Storage: Supabase` when connected.

If the keys are missing, the app falls back to `data/SchoolSubmissions.xlsx`, so tests still pass.
The service_role key stays on the server only; the table has RLS on, so browsers can't read it directly.
