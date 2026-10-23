// Minimal Supabase (PostgREST) client using Node's built-in fetch. No extra packages.
const fs = require("node:fs");
const path = require("node:path");
const TABLE = "submissions";

// Load ../.env (if present) so you don't need any extra packages or Node flags.
try {
    for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
} catch { /* no .env file, fine */ }

function isConfigured() {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function request(method, query, body, extraHeaders = {}) {
    const url = `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${TABLE}${query}`;
    const response = await fetch(url, {
        method,
        headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            ...extraHeaders
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error(`Supabase ${method} failed (${response.status}): ${await response.text()}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

// Convert between the app's PascalCase fields and the table's snake_case columns.
const MAP = [
    ["SubmissionId", "submission_id"], ["School", "school"], ["GPA", "gpa"],
    ["WeekdayBed", "weekday_bed"], ["WeekdayRise", "weekday_rise"], ["WeekdaySleep", "weekday_sleep"],
    ["WeekendBed", "weekend_bed"], ["WeekendRise", "weekend_rise"], ["WeekendSleep", "weekend_sleep"],
    ["PoorSleepQuality", "poor_sleep_quality"], ["LarkOwl", "lark_owl"], ["SocialJetlag", "social_jetlag"]
];
const toRow = s => Object.fromEntries(MAP.map(([a, b]) => [b, s[a]]));
const fromRow = r => Object.fromEntries(MAP.map(([a, b]) => [a, r[b]]));

async function readSubmissions() {
    const rows = await request("GET", "?select=*&order=created_at.asc&limit=100000");
    return rows.map(fromRow);
}

// Returns true if inserted, false if SubmissionId already existed (retry-safe).
async function insertSubmission(submission) {
    const result = await request(
        "POST", "?on_conflict=submission_id", [toRow(submission)],
        { Prefer: "resolution=ignore-duplicates,return=representation" }
    );
    return result.length > 0;
}

async function insertMany(submissions) {
    if (!submissions.length) return;
    await request(
        "POST", "?on_conflict=submission_id", submissions.map(toRow),
        { Prefer: "resolution=ignore-duplicates,return=minimal" }
    );
}

module.exports = { isConfigured, readSubmissions, insertSubmission, insertMany };
