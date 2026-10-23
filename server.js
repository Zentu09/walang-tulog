const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const ExcelJS = require("exceljs");
const supabase = require("./supabase/client");
const APPROVED_SCHOOL_NAMES = require("./Codes/Js/approved-schools.json");

const PROJECT_FOLDER = __dirname;
const WEBSITE_FOLDER = path.join(PROJECT_FOLDER, "Codes");
const DATA_FILE = process.env.SLEEP_STUDY_EXCEL_FILE ||
    path.join(PROJECT_FOLDER, "data", "SchoolSubmissions.xlsx");
const LEGACY_CSV_FILE = process.env.SLEEP_STUDY_CSV_FILE ||
    path.join(PROJECT_FOLDER, "data", "SchoolSubmissions.csv");
const PORT = Number(process.env.PORT) || 3000;

const CSV_HEADERS = [
    "SubmissionId",
    "School",
    "GPA",
    "WeekdayBed",
    "WeekdayRise",
    "WeekdaySleep",
    "WeekendBed",
    "WeekendRise",
    "WeekendSleep",
    "PoorSleepQuality",
    "LarkOwl",
    "SocialJetlag"
];
// Save one response at a time so simultaneous submissions do not overwrite each other.
let saveQueue = Promise.resolve();
let approvedSchools = new Map();
const ORIGINAL_STUDY_SCHOOL = "St. Lawrence University";

function parseCsv(csvText) {
    const rows = [];
    let row = [];
    let value = "";
    let insideQuotes = false;

    for (let index = 0; index < csvText.length; index += 1) {
        const character = csvText[index];

        if (insideQuotes && character === '"' && csvText[index + 1] === '"') {
            value += '"';
            index += 1;
        } else if (character === '"') {
            insideQuotes = !insideQuotes;
        } else if (!insideQuotes && character === ",") {
            row.push(value);
            value = "";
        } else if (!insideQuotes && (character === "\n" || character === "\r")) {
            if (character === "\r" && csvText[index + 1] === "\n") index += 1;
            row.push(value);
            rows.push(row);
            row = [];
            value = "";
        } else {
            value += character;
        }
    }

    if (insideQuotes) {
        throw new Error("The submissions CSV has an unfinished quoted value.");
    }

    if (value || row.length) {
        row.push(value);
        rows.push(row);
    }

    const nonEmptyRows = [];
    for (const csvRow of rows) {
        let rowHasData = false;
        for (const cell of csvRow) {
            if (cell !== "") {
                rowHasData = true;
                break;
            }
        }
        if (rowHasData) nonEmptyRows.push(csvRow);
    }
    return nonEmptyRows;
}

function normalizeSchoolName(value) {
    if (typeof value !== "string" || /[\u0000-\u001f\u007f]/u.test(value)) {
        throw new Error("Enter a valid school name.");
    }

    const school = value.normalize("NFC").trim().replace(/\s+/gu, " ");
    if (school.length < 2 || school.length > 120) {
        throw new Error("School name must be between 2 and 120 characters.");
    }
    return school;
}

function getSchoolKey(school) {
    return normalizeSchoolName(school).toLocaleLowerCase("en-US");
}

async function loadApprovedSchools() {
    const schools = new Map();

    if (!Array.isArray(APPROVED_SCHOOL_NAMES) ||
        APPROVED_SCHOOL_NAMES.length < 1000) {
        throw new Error(
            "The approved school list is missing or invalid. Regenerate it from the school masterlist CSV."
        );
    }

    for (const school of APPROVED_SCHOOL_NAMES) {
        const key = getSchoolKey(school);
        if (!schools.has(key)) schools.set(key, school);
    }

    schools.set(getSchoolKey(ORIGINAL_STUDY_SCHOOL), ORIGINAL_STUDY_SCHOOL);
    approvedSchools = schools;
}

function validateSubmission(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("The response is missing or invalid.");
    }

    if (data.Consent !== true) {
        throw new Error("Consent is required before the response can be saved.");
    }
    if (data.SchoolConfirmed !== true) {
        throw new Error(
            "Confirm that this is your school's complete official name before submitting."
        );
    }
    if (typeof data.SubmissionId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(data.SubmissionId)) {
        throw new Error("The response ID is invalid. Refresh the page and try again.");
    }

    const requestedSchool = normalizeSchoolName(data.School);
    const school = approvedSchools.get(getSchoolKey(requestedSchool));
    if (!school) {
        throw new Error(
            "Choose your school's exact name from the approved masterlist. If it is missing, contact the study team before submitting."
        );
    }
    const numericFields = [
        ["GPA", 0, 4],
        ["WeekdayBed", 12, 35.99],
        ["WeekdayRise", 0, 23.99],
        ["WeekendBed", 12, 35.99],
        ["WeekendRise", 0, 23.99]
    ];

    for (let i = 0; i < numericFields.length; i += 1) {
        const field = numericFields[i][0];
        const minimum = numericFields[i][1];
        const maximum = numericFields[i][2];
        if (typeof data[field] !== "number" || !Number.isFinite(data[field]) ||
            data[field] < minimum || data[field] > maximum) {
            throw new Error(`${field} must be a number from ${minimum} to ${maximum}.`);
        }
    }

    if (!Number.isSafeInteger(data.PoorSleepQuality) || data.PoorSleepQuality < 0) {
        throw new Error("Poor sleep quality must be a non-negative whole-number score.");
    }
    if (data.LarkOwl !== "Lark" && data.LarkOwl !== "Owl" &&
        data.LarkOwl !== "Neither") {
        throw new Error("Choose Lark, Owl, or Neither for chronotype.");
    }

    return {
        SubmissionId: data.SubmissionId.toLowerCase(),
        School: school,
        GPA: data.GPA,
        WeekdayBed: data.WeekdayBed,
        WeekdayRise: data.WeekdayRise,
        WeekdaySleep: calculateSleepDuration(data.WeekdayBed, data.WeekdayRise),
        WeekendBed: data.WeekendBed,
        WeekendRise: data.WeekendRise,
        WeekendSleep: calculateSleepDuration(data.WeekendBed, data.WeekendRise),
        PoorSleepQuality: data.PoorSleepQuality,
        LarkOwl: data.LarkOwl,
        SocialJetlag: Math.abs(data.WeekendRise - data.WeekdayRise)
    };
}

function calculateSleepDuration(bedtime, riseTime) {
    const duration = (riseTime - bedtime + 24) % 24;
    return duration === 0 ? 24 : duration;
}

async function readSubmissions() {
    if (supabase.isConfigured()) return supabase.readSubmissions();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(DATA_FILE);
    const worksheet = workbook.getWorksheet("Submissions");

    if (!worksheet) {
        throw new Error("The Excel workbook is missing its Submissions sheet.");
    }

    const headers = [];
    for (let column = 1; column <= CSV_HEADERS.length; column += 1) {
        headers.push(worksheet.getCell(1, column).value);
    }
    if (headers.join(",") !== CSV_HEADERS.join(",")) {
        throw new Error("The Excel workbook has an unexpected header.");
    }

    const submissions = [];
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const submission = {};
        let hasData = false;

        for (let column = 1; column <= CSV_HEADERS.length; column += 1) {
            const value = worksheet.getCell(rowNumber, column).value;
            submission[CSV_HEADERS[column - 1]] = value;
            if (value !== null && value !== undefined && value !== "") {
                hasData = true;
            }
        }

        if (hasData) {
            submissions.push(submission);
        }
    }
    return submissions;
}

function getExcelValue(column, value) {
    if (column === "SubmissionId" || column === "School" ||
        column === "LarkOwl") {
        return value;
    }
    if (value === "") return null;

    const number = Number(value);
    return Number.isFinite(number) ? number : value;
}

async function createExcelFile() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Submissions");
    worksheet.addRow(CSV_HEADERS);
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    for (let column = 1; column <= CSV_HEADERS.length; column += 1) {
        worksheet.getColumn(column).width = column === 2 ? 24 : 18;
    }

    let csvExists = true;
    try {
        await fs.access(LEGACY_CSV_FILE);
    } catch (error) {
        if (error.code === "ENOENT") {
            csvExists = false;
        } else {
            throw error;
        }
    }

    if (csvExists) {
        const csvText = await fs.readFile(LEGACY_CSV_FILE, "utf8");
        const rows = parseCsv(csvText);
        if (!rows[0] || rows[0].join(",") !== CSV_HEADERS.join(",")) {
            throw new Error("The previous submissions CSV has an unexpected header.");
        }

        for (let rowNumber = 1; rowNumber < rows.length; rowNumber += 1) {
            const values = rows[rowNumber];
            if (values.length !== CSV_HEADERS.length) {
                throw new Error(
                    "A row in the previous submissions CSV has the wrong number of fields."
                );
            }

            const excelValues = [];
            for (let column = 0; column < CSV_HEADERS.length; column += 1) {
                excelValues.push(getExcelValue(CSV_HEADERS[column], values[column]));
            }
            worksheet.addRow(excelValues);
        }
    }

    worksheet.autoFilter = {
        from: "A1",
        to: `L${worksheet.rowCount}`
    };
    await workbook.xlsx.writeFile(DATA_FILE);
}

async function initializeExcelFile() {
    if (supabase.isConfigured()) return;
    if (process.env.VERCEL) {
        throw new Error("Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel > Settings > Environment Variables.");
    }
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });

    try {
        await fs.access(DATA_FILE);
        await readSubmissions();
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
        await createExcelFile();
    }
}

async function saveSubmission(submission) {
    const save = saveQueue.then(async () => {
        const rows = await readSubmissions();
        let previousResponse = null;
        for (const row of rows) {
            if (row.SubmissionId === submission.SubmissionId) {
                previousResponse = row;
                break;
            }
        }

        if (previousResponse) {
            return {
                school: previousResponse.School,
                alreadySubmitted: true
            };
        }

        let sameSchool = null;
        for (const row of rows) {
            if (getSchoolKey(row.School) === getSchoolKey(submission.School)) {
                sameSchool = row;
                break;
            }
        }
        if (sameSchool) submission.School = sameSchool.School;

        if (supabase.isConfigured()) {
            const inserted = await supabase.insertSubmission(submission);
            return { school: submission.School, alreadySubmitted: !inserted };
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(DATA_FILE);
        const worksheet = workbook.getWorksheet("Submissions");
        const values = [];
        for (const header of CSV_HEADERS) {
            values.push(submission[header]);
        }
        worksheet.addRow(values);
        worksheet.autoFilter = {
            from: "A1",
            to: `L${worksheet.rowCount}`
        };
        await workbook.xlsx.writeFile(DATA_FILE);

        return {
            school: submission.School,
            alreadySubmitted: false
        };
    });

    saveQueue = save.then(() => undefined, () => undefined);
    return save;
}

function sendJson(response, status, data) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(data));
}

async function readRequestBody(request) {
    // On Vercel the platform may already have parsed the body.
    if (request.body !== undefined && request.body !== null) {
        if (typeof request.body === "object") return request.body;
        try {
            return JSON.parse(request.body);
        } catch {
            throw new Error("The response could not be read. Please try again.");
        }
    }

    let text = "";

    for await (const chunk of request) {
        text += chunk;
        if (Buffer.byteLength(text, "utf8") > 8192) {
            throw new Error("The response is too large.");
        }
    }

    try {
        return JSON.parse(text);
    } catch {
        throw new Error("The response could not be read. Please try again.");
    }
}

function getContentType(filePath) {
    const types = {
        ".css": "text/css; charset=utf-8",
        ".csv": "text/csv; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".ico": "image/x-icon",
        ".jpeg": "image/jpeg",
        ".jpg": "image/jpeg",
        ".json": "application/json; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".ttf": "font/ttf",
        ".woff": "font/woff",
        ".woff2": "font/woff2"
    };
    return types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function showWebsiteFile(request, response, urlPath) {
    const requestedPath = urlPath === "/"
        ? "/Codes/Template/index.html"
        : decodeURIComponent(urlPath);

    if (!requestedPath.startsWith("/Codes/")) {
        response.writeHead(404);
        response.end("Not found");
        return;
    }

    const filePath = path.resolve(
        WEBSITE_FOLDER,
        requestedPath.slice("/Codes/".length)
    );
    const relativePath = path.relative(WEBSITE_FOLDER, filePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        response.writeHead(404);
        response.end("Not found");
        return;
    }

    try {
        const file = await fs.readFile(filePath);
        response.writeHead(200, { "Content-Type": getContentType(filePath) });
        response.end(request.method === "HEAD" ? undefined : file);
    } catch (error) {
        if (error.code === "ENOENT" || error.code === "EISDIR") {
            response.writeHead(404);
            response.end("Not found");
            return;
        }
        throw error;
    }
}

async function handleRequest(request, response) {
    const url = new URL(request.url, "http://localhost");

    if (url.pathname === "/api/approved-schools" && request.method === "GET") {
        const query = url.searchParams.get("search") || "";
        if (/[\u0000-\u001f\u007f]/u.test(query) || query.length > 120) {
            sendJson(response, 400, { error: "Enter a valid school name." });
            return;
        }

        const normalizedQuery = query.normalize("NFC").trim().replace(/\s+/gu, " ");
        const queryKey = normalizedQuery.toLocaleLowerCase("en-US");
        const matches = [];
        if (!normalizedQuery) {
            matches.push(ORIGINAL_STUDY_SCHOOL);
        } else {
            const exactSchool = approvedSchools.get(queryKey);
            if (exactSchool) matches.push(exactSchool);

            for (const [key, school] of approvedSchools) {
                if (key.startsWith(queryKey) && !matches.includes(school)) {
                    matches.push(school);
                }
                if (matches.length === 50) break;
            }
            if (matches.length < 50) {
                for (const [key, school] of approvedSchools) {
                    if (key.includes(queryKey) && !key.startsWith(queryKey) &&
                        !matches.includes(school)) {
                        matches.push(school);
                    }
                    if (matches.length === 50) break;
                }
            }
        }

        sendJson(response, 200, {
            schools: matches,
            exactMatch: approvedSchools.has(queryKey)
        });
        return;
    }

    if (url.pathname === "/api/schools" && request.method === "GET") {
        const rows = await readSubmissions();
        const schools = [];

        for (const row of rows) {
            const key = getSchoolKey(row.School);
            let schoolAlreadyListed = false;

            for (const school of schools) {
                if (getSchoolKey(school) === key) {
                    schoolAlreadyListed = true;
                    break;
                }
            }

            if (!schoolAlreadyListed) {
                schools.push(row.School);
            }
        }
        sendJson(response, 200, schools);
        return;
    }

    if (url.pathname === "/api/school-submissions" && request.method === "GET") {
        let schoolKey;
        try {
            schoolKey = getSchoolKey(url.searchParams.get("school"));
        } catch (error) {
            sendJson(response, 400, { error: error.message });
            return;
        }

        const rows = await readSubmissions();
        const submissions = [];
        for (const row of rows) {
            if (getSchoolKey(row.School) === schoolKey) {
                submissions.push({
                    School: row.School,
                    GPA: row.GPA,
                    WeekdayBed: row.WeekdayBed,
                    WeekdayRise: row.WeekdayRise,
                    WeekdaySleep: row.WeekdaySleep,
                    WeekendBed: row.WeekendBed,
                    WeekendRise: row.WeekendRise,
                    WeekendSleep: row.WeekendSleep,
                    PoorSleepQuality: row.PoorSleepQuality,
                    LarkOwl: row.LarkOwl,
                    SocialJetlag: row.SocialJetlag
                });
            }
        }
        sendJson(response, 200, submissions);
        return;
    }

    if (url.pathname === "/api/submissions" && request.method === "POST") {
        let submission;
        try {
            submission = validateSubmission(await readRequestBody(request));
        } catch (error) {
            sendJson(response, 400, { error: error.message });
            return;
        }

        try {
            const result = await saveSubmission(submission);
            sendJson(response, result.alreadySubmitted ? 200 : 201, result);
        } catch (error) {
            console.error("The response could not be saved.", error);
            sendJson(response, 500, {
                error: "The response could not be saved. Please try again."
            });
        }
        return;
    }

    if (url.pathname.startsWith("/api/")) {
        sendJson(response, 404, { error: "API route not found." });
        return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405);
        response.end("Method not allowed");
        return;
    }

    if (url.pathname === "/") {
        response.writeHead(302, {
            "Location": "/Codes/Template/index.html",
            "Cache-Control": "no-store"
        });
        response.end();
        return;
    }

    await showWebsiteFile(request, response, url.pathname);
}

let preparePromise = null;
// Loads the school list once per server/function instance.
function prepare() {
    if (!preparePromise) {
        preparePromise = (async () => {
            await loadApprovedSchools();
            await initializeExcelFile();
        })().catch(error => {
            preparePromise = null;
            throw error;
        });
    }
    return preparePromise;
}

async function startServer(port = PORT) {
    await prepare();
    console.log(supabase.isConfigured()
        ? "Storage: Supabase"
        : "Storage: local Excel file (set SUPABASE_URL to use Supabase)");

    const server = http.createServer((request, response) => {
        handleRequest(request, response).catch(error => {
            console.error("The request could not be completed.", error);
            if (!response.headersSent) {
                sendJson(response, 500, {
                    error: "The request could not be completed."
                });
            } else {
                response.destroy(error);
            }
        });
    });

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
            server.off("error", reject);
            console.log(
                `Sleep Study is running at http://127.0.0.1:${server.address().port}`
            );
            resolve();
        });
    });

    return server;
}

if (require.main === module) {
    startServer().catch(error => {
        console.error("Sleep Study could not start.", error);
        process.exitCode = 1;
    });
}

module.exports = {
    getSchoolKey,
    handleRequest,
    prepare,
    startServer,
    validateSubmission
};
