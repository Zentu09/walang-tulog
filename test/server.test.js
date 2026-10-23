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
        School: "ABC College",
        GPA: 3.25,
        WeekdayBed: 25,
        WeekdayRise: 9,
        WeekendBed: 26,
        WeekendRise: 10,
        PoorSleepQuality: 7,
        LarkOwl: "Neither",
        Consent: true,
        ...overrides
    };
}

test("school names share a normalized key", () => {
    assert.equal(getSchoolKey("  ABC   College "), "abc college");
    assert.equal(getSchoolKey("abc college"), "abc college");
});

test("the server validates required fields and consent", () => {
    assert.throws(
        () => validateSubmission(makeSubmission({ Consent: false })),
        /Consent is required/u
    );
    assert.throws(
        () => validateSubmission(makeSubmission({ School: " " })),
        /School name must be between 2 and 120 characters/u
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
            School: "abc college"
        }))
    });
    assert.equal(secondResponse.status, 201);
    assert.equal((await secondResponse.json()).school, "ABC College");

    const schoolsResponse = await fetch(`${baseUrl}/api/schools`);
    assert.deepEqual(await schoolsResponse.json(), ["Old School", "ABC College"]);

    const schoolDataResponse = await fetch(
        `${baseUrl}/api/school-submissions?school=abc%20college`
    );
    const schoolData = await schoolDataResponse.json();
    assert.equal(schoolDataResponse.status, 200);
    assert.equal(schoolData.length, 2);
    assert.equal(schoolData[0].School, "ABC College");
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
    assert.equal(worksheet.rowCount, 4);
    assert.equal(worksheet.getCell(2, 2).value, "Old School");
    assert.equal(worksheet.getCell(3, 2).value, "ABC College");
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
    const pageResponse = await fetch(`${baseUrl}/Codes/Template/submission.html`);
    assert.equal(pageResponse.status, 200);
    const page = await pageResponse.text();
    assert.match(page, /schoolSubmissionForm/u);

    const findingsPage = await fetch(`${baseUrl}/Codes/Template/study.html`);
    assert.equal(findingsPage.status, 200);
    assert.match(await findingsPage.text(), /id="findings"/u);

    const dataResponse = await fetch(`${baseUrl}/data/responses.xlsx`);
    assert.equal(dataResponse.status, 404);
});
