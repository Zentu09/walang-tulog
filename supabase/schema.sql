-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

create table if not exists public.submissions (
    submission_id      uuid primary key,
    school             text not null check (char_length(school) between 2 and 120),
    gpa                double precision not null check (gpa between 0 and 4),
    weekday_bed        double precision not null,
    weekday_rise       double precision not null,
    weekday_sleep      double precision not null,
    weekend_bed        double precision not null,
    weekend_rise       double precision not null,
    weekend_sleep      double precision not null,
    poor_sleep_quality integer not null check (poor_sleep_quality >= 0),
    lark_owl           text not null check (lark_owl in ('Lark', 'Owl', 'Neither')),
    social_jetlag      double precision not null,
    created_at         timestamptz not null default now()
);

create index if not exists submissions_school_lower_idx
    on public.submissions (lower(school));

-- Lock the table down. The Node server uses the service_role key, which
-- bypasses RLS, so browsers (anon key) get no direct access at all.
alter table public.submissions enable row level security;
