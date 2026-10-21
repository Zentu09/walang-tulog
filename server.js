const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PROJECT_FOLDER = __dirname;
const WEBSITE_FOLDER = path.join(PROJECT_FOLDER, "Codes");
const DATA_FILE = process.env.SLEEP_STUDY_DATA_FILE ||
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

function formatCsvValue(value) {
    const text = String(value);
    if (/[",\r\n]/u.test(text)) {
        return `"${text.replace(/"/gu, '""')}"`;
    }
    return text;
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

function validateSubmission(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("The response is missing or invalid.");
    }

    if (data.Consent !== true) {
        throw new Error("Consent is required before the response can be saved.");
    }
    if (typeof data.SubmissionId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(data.SubmissionId)) {
        throw new Error("The response ID is invalid. Refresh the page and try again.");
    }

    const school = normalizeSchoolName(data.School);
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
    const csvText = await fs.readFile(DATA_FILE, "utf8");
    const rows = parseCsv(csvText);
    const header = rows[0];

    if (!header || header.join(",") !== CSV_HEADERS.join(",")) {
        throw new Error("The submissions CSV has an unexpected header.");
    }

    const submissions = [];
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const values = rows[rowIndex];
        if (values.length !== CSV_HEADERS.length) {
            throw new Error("A row in the submissions CSV has the wrong number of fields.");
        }
        const submission = {};
        for (let columnIndex = 0; columnIndex < CSV_HEADERS.length; columnIndex += 1) {
            const columnName = CSV_HEADERS[columnIndex];
            submission[columnName] = values[columnIndex];
        }
        submissions.push(submission);
    }
    return submissions;
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

        const values = [];
        for (const header of CSV_HEADERS) {
            values.push(formatCsvValue(submission[header]));
        }
        const newLine = values.join(",") + "\n";
        await fs.appendFile(DATA_FILE, newLine, "utf8");

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
    await showWebsiteFile(request, response, url.pathname);
}

async function startServer(port = PORT) {
    const dataFolder = path.dirname(DATA_FILE);
    await fs.mkdir(dataFolder, { recursive: true });

    try {
        await fs.access(DATA_FILE);
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
        await fs.writeFile(DATA_FILE, `${CSV_HEADERS.join(",")}\n`, "utf8");
    }

    await readSubmissions();

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
    startServer,
    validateSubmission
};
