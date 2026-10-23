const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test, before, after } = require("node:test");
const ExcelJS = require("exceljs");

const temporaryFolder = fs.mkdtempSync(path.join(os.tmpdir(), "sleep-study-test-"));
const excelFile = path.join(temporaryFolder, "responses.xlsx");
const csvFile = path.join(temporaryFolder, "old-responses.csv");
process.env.SLEEP_STUDY_EXCEL_FILE = excelFile;
process.env.SLEEP_STUDY_CSV_FILE = csvFile;

const oldCsvContent = [
    "SubmissionId,School,GPA,WeekdayBed,WeekdayRise,WeekdaySleep,WeekendBed,WeekendRise,WeekendSleep,PoorSleepQuality,LarkOwl,SocialJetlag",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,Old School,3,25,9,8,26,10,8,5,Lark,1"
].join("\n") + "\n";
fs.writeFileSync(csvFile, oldCsvContent, "utf8");

const { startServer, validateSubmission, getSchoolKey } = require("../server");

let server;
let baseUrl;

before(async () => {
    server = await startServer(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    const serverClosed = new Promise(resolve => server.close(resolve));
    if (server.closeAllConnections) server.closeAllConnections();
    await serverClosed;
    fs.rmSync(temporaryFolder, { recursive: true, force: true });
});

function makeSubmission(overrides = {}) {
    return {
        SubmissionId: "11111111-1111-4111-8111-111111111111",
        School: "Bacarra CES",
        GPA: 3.25,
        WeekdayBed: 25,
        WeekdayRise: 9,
        WeekendBed: 26,
        WeekendRise: 10,
        PoorSleepQuality: 7,
        LarkOwl: "Neither",
        Consent: true,
        SchoolConfirmed: true,
        ...overrides
    };
}

test("school names share a normalized key", () => {
    assert.equal(getSchoolKey("  Bacarra   CES "), "bacarra ces");
    assert.equal(getSchoolKey("bacarra ces"), "bacarra ces");
});

test("the server validates required fields and consent", () => {
    assert.throws(
        () => validateSubmission(makeSubmission({ Consent: false })),
        /Consent is required/u
    );
    assert.throws(
        () => validateSubmission(makeSubmission({ SchoolConfirmed: false })),
        /complete official name/u
    );
    assert.throws(
        () => validateSubmission(makeSubmission({ School: " " })),
        /School name must be between 2 and 120 characters/u
    );
    assert.throws(
        () => validateSubmission(makeSubmission({ School: "blue banana orange" })),
        /approved masterlist/u
    );
    assert.equal(
        validateSubmission(makeSubmission({ School: "  bACARRA   cES " })).School,
        "Bacarra CES"
    );
    assert.equal(
        validateSubmission(makeSubmission({ School: "St. Lawrence University" })).School,
        "St. Lawrence University"
    );
    assert.throws(
        () => validateSubmission(makeSubmission({ GPA: 5 })),
        /GPA must be a number/u
    );
    assert.throws(
        () => validateSubmission(makeSubmission({ PoorSleepQuality: -1 })),
        /non-negative whole-number score/u
    );
});

test("the approved-school search verifies CSV names and the original study school", async () => {
    const pdfSchoolResponse = await fetch(
        `${baseUrl}/api/approved-schools?search=${encodeURIComponent("bacarra   ces")}`
    );
    const pdfSchools = await pdfSchoolResponse.json();
    assert.equal(pdfSchoolResponse.status, 200);
    assert.equal(pdfSchools.exactMatch, true);
    assert.ok(pdfSchools.schools.includes("Bacarra CES"));

    const originalSchoolResponse = await fetch(
        `${baseUrl}/api/approved-schools?search=${encodeURIComponent("st. lawrence university")}`
    );
    const originalSchool = await originalSchoolResponse.json();
    assert.equal(originalSchool.exactMatch, true);
    assert.ok(originalSchool.schools.includes("St. Lawrence University"));
});

test("the submission endpoint rejects schools outside the approved list", async () => {
    const response = await fetch(`${baseUrl}/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeSubmission({
            SubmissionId: "33333333-3333-4333-8333-333333333333",
            School: "blue banana orange"
        }))
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /approved masterlist/u);
});

test("Vercel uses a writable temporary Excel fallback without Supabase config", async () => {
    const previousVercel = process.env.VERCEL;
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const previousExcelFile = process.env.SLEEP_STUDY_EXCEL_FILE;
    const previousCsvFile = process.env.SLEEP_STUDY_CSV_FILE;

    try {
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        process.env.VERCEL = "1";

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sleep-study-vercel-"));
        const excelFile = path.join(tempDir, "SchoolSubmissions.xlsx");
        const csvFile = path.join(tempDir, "SchoolSubmissions.csv");
        process.env.SLEEP_STUDY_EXCEL_FILE = excelFile;
        process.env.SLEEP_STUDY_CSV_FILE = csvFile;

        delete require.cache[require.resolve("../server")];
        const { prepare } = require("../server");
        await prepare();

        assert.ok(fs.existsSync(excelFile));
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(excelFile);
        assert.equal(workbook.getWorksheet("Submissions").rowCount, 1);
    } finally {
        if (previousVercel === undefined) delete process.env.VERCEL;
        else process.env.VERCEL = previousVercel;
        if (previousUrl === undefined) delete process.env.SUPABASE_URL;
        else process.env.SUPABASE_URL = previousUrl;
        if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
        if (previousExcelFile === undefined) delete process.env.SLEEP_STUDY_EXCEL_FILE;
        else process.env.SLEEP_STUDY_EXCEL_FILE = previousExcelFile;
        if (previousCsvFile === undefined) delete process.env.SLEEP_STUDY_CSV_FILE;
        else process.env.SLEEP_STUDY_CSV_FILE = previousCsvFile;
        delete require.cache[require.resolve("../server")];
        const { startServer } = require("../server");
        assert.equal(typeof startServer, "function");
    }
});

test("responses append, reuse school spelling, and ignore retry duplicates", async () => {
    const firstResponse = await fetch(`${baseUrl}/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeSubmission())
    });
    assert.equal(firstResponse.status, 201);

    const duplicateResponse = await fetch(`${baseUrl}/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeSubmission())
    });
    assert.equal(duplicateResponse.status, 200);
    assert.equal((await duplicateResponse.json()).alreadySubmitted, true);

    const secondResponse = await fetch(`${baseUrl}/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeSubmission({
            SubmissionId: "22222222-2222-4222-8222-222222222222",
            School: "bacarra ces"
        }))
    });
    assert.equal(secondResponse.status, 201);
    assert.equal((await secondResponse.json()).school, "Bacarra CES");

    for (let index = 0; index < 48; index += 1) {
        const response = await fetch(`${baseUrl}/api/submissions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(makeSubmission({
                SubmissionId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
            }))
        });
        assert.equal(response.status, 201);
    }

    const schoolsResponse = await fetch(`${baseUrl}/api/schools`);
    assert.deepEqual(await schoolsResponse.json(), ["Bacarra CES"]);

    const schoolDataResponse = await fetch(
        `${baseUrl}/api/school-submissions?school=bacarra%20ces`
    );
    const schoolData = await schoolDataResponse.json();
    assert.equal(schoolDataResponse.status, 200);
    assert.equal(schoolData.length, 50);
    assert.equal(schoolData[0].School, "Bacarra CES");
    assert.equal(schoolData[0].GPA, 3.25);
    assert.equal("SubmissionId" in schoolData[0], false);

    const otherSchoolResponse = await fetch(
        `${baseUrl}/api/school-submissions?school=Other%20School`
    );
    assert.deepEqual(await otherSchoolResponse.json(), []);

    const invalidSchoolResponse = await fetch(
        `${baseUrl}/api/school-submissions?school=`
    );
    assert.equal(invalidSchoolResponse.status, 400);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelFile);
    const worksheet = workbook.getWorksheet("Submissions");
    assert.equal(worksheet.rowCount, 52);
    assert.equal(worksheet.getCell(2, 2).value, "Old School");
    assert.equal(worksheet.getCell(3, 2).value, "Bacarra CES");
    assert.equal(worksheet.getCell(3, 3).value, 3.25);
    assert.equal(fs.readFileSync(csvFile, "utf8"), oldCsvContent);
});

test("saved sleep durations use the values derived by the server", () => {
    const submission = validateSubmission(makeSubmission());
    assert.equal(submission.WeekdaySleep, 8);
    assert.equal(submission.WeekendSleep, 8);
    assert.equal(submission.SocialJetlag, 1);
});

test("the website is served but the private submissions file is not", async () => {
    const rootResponse = await fetch(baseUrl, { redirect: "manual" });
    assert.equal(rootResponse.status, 302);
    assert.equal(
        rootResponse.headers.get("location"),
        "/Codes/Template/index.html"
    );

    const approvedListResponse = await fetch(
        `${baseUrl}/Codes/Js/approved-schools.json`
    );
    assert.equal(approvedListResponse.status, 200);
    assert.match(
        approvedListResponse.headers.get("content-type"),
        /application\/json/u
    );
    const approvedNames = await approvedListResponse.json();
    assert.ok(approvedNames.includes("Bacarra CES"));
    assert.ok(approvedNames.includes("St. Lawrence University"));

    const submissionScriptResponse = await fetch(
        `${baseUrl}/Codes/Js/schoolSubmission.js`
    );
    assert.equal(submissionScriptResponse.status, 200);
    const submissionScript = await submissionScriptResponse.text();
    assert.match(submissionScript, /\/Codes\/Js\/approved-schools\.json/u);
    assert.doesNotMatch(submissionScript, /\/api\/approved-schools/u);

    const pageResponse = await fetch(`${baseUrl}/Codes/Template/submission.html`);
    assert.equal(pageResponse.status, 200);
    const page = await pageResponse.text();
    assert.match(page, /schoolSubmissionForm/u);
    assert.match(page, /approved list/u);
    assert.match(page, /schoolNameValidation/u);
    assert.match(page, /schoolConfirmed/u);
    assert.match(page, /naturally alert earlier in the day/u);
    assert.match(page, /naturally more alert later in the day/u);

    const findingsPage = await fetch(`${baseUrl}/Codes/Template/study.html`);
    assert.equal(findingsPage.status, 200);
    const findings = await findingsPage.text();
    assert.match(findings, /id="findings"/u);
    assert.match(findings, /id="schoolFindingsSchools"/u);
    assert.match(findings, /id="schoolFindingsSchoolOptions"/u);
    assert.match(findings, /Choose a school to filter these findings/u);
    assert.match(findings, /id="scatterChart"/u);
    assert.doesNotMatch(findings, /schoolScatterChart/u);

    const comparisonPage = await fetch(`${baseUrl}/Codes/Template/comparison.html`);
    assert.equal(comparisonPage.status, 200);
    const comparison = await comparisonPage.text();
    assert.match(comparison, /id="sleepComparisonForm"/u);
    assert.match(comparison, /id="comparisonDataset"/u);

    for (const pagePath of [
        "/Codes/Template/index.html",
        "/Codes/Template/study.html",
        "/Codes/Template/submission.html",
        "/Codes/Template/comparison.html"
    ]) {
        const response = await fetch(`${baseUrl}${pagePath}`);
        const html = await response.text();
        assert.equal(response.status, 200);
        assert.match(html, /class="nav-dropdown-toggle"/u);
        assert.match(html, /href="(?:study\.html)?#?about-study"/u);
        assert.match(html, /href="(?:study\.html)?#?sleep-habits"/u);
        assert.match(html, /href="(?:study\.html)?#?performance"/u);
        assert.match(html, /href="(?:study\.html)?#?findings"/u);
    }

    const dataResponse = await fetch(`${baseUrl}/data/responses.xlsx`);
    assert.equal(dataResponse.status, 404);
});
