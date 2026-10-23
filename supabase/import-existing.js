// One-time import of existing rows from data/SchoolSubmissions.xlsx into Supabase.
// Usage (from project root):  node supabase/import-existing.js
const path = require("node:path");
const ExcelJS = require("exceljs");
const supabase = require("./client");

const HEADERS = ["SubmissionId","School","GPA","WeekdayBed","WeekdayRise","WeekdaySleep",
    "WeekendBed","WeekendRise","WeekendSleep","PoorSleepQuality","LarkOwl","SocialJetlag"];

(async () => {
    if (!supabase.isConfigured()) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(__dirname, "..", "data", "SchoolSubmissions.xlsx"));
    const sheet = workbook.getWorksheet("Submissions");
    const rows = [];
    for (let r = 2; r <= sheet.rowCount; r += 1) {
        const row = {};
        HEADERS.forEach((h, i) => { row[h] = sheet.getCell(r, i + 1).value; });
        if (row.SubmissionId) rows.push(row);
    }
    await supabase.insertMany(rows);
    console.log(`Imported ${rows.length} row(s) (duplicates skipped).`);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
