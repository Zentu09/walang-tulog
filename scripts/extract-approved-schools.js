const fs = require("node:fs/promises");
const path = require("node:path");

const projectFolder = path.join(__dirname, "..");
const sourcePath = path.join(
    projectFolder,
    "Codes",
    "Js",
    "school_masterlist.csv"
);
const outputPath = path.join(
    projectFolder,
    "Codes",
    "Js",
    "approved-schools.json"
);

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
        throw new Error("The school masterlist CSV has an unfinished quoted value.");
    }

    if (value || row.length) {
        row.push(value);
        rows.push(row);
    }
    return rows;
}

async function extractApprovedSchools() {
    const csvText = await fs.readFile(sourcePath, "utf8");
    const rows = parseCsv(csvText.replace(/^\uFEFF/u, ""));
    const headers = rows.shift();
    const schoolNameIndex = headers.indexOf("school_name_candidate");
    if (schoolNameIndex < 0) {
        throw new Error("The CSV is missing its school_name_candidate column.");
    }

    const schools = new Map();
    for (const row of rows) {
        const school = (row[schoolNameIndex] || "")
            .normalize("NFC")
            .trim()
            .replace(/\s+/gu, " ");
        if (school.length < 2 || school.length > 120) continue;

        const key = school.toLocaleLowerCase("en-US");
        if (!schools.has(key)) schools.set(key, school);
    }

    const originalSchool = "St. Lawrence University";
    schools.set(originalSchool.toLocaleLowerCase("en-US"), originalSchool);
    if (schools.size < 1000) {
        throw new Error(
            "The school masterlist CSV could not be read. Verify that it contains the expected school names."
        );
    }

    const formattedNames = [...schools.values()]
        .map(school => `  ${JSON.stringify(school)}`)
        .join(",\n");
    await fs.writeFile(outputPath, `[\n${formattedNames}\n]\n`);
    console.log(`Extracted ${schools.size} approved school names.`);
}

extractApprovedSchools().catch(error => {
    console.error("Approved school names could not be extracted.", error);
    process.exitCode = 1;
});
