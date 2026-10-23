const fs = require("node:fs/promises");
const path = require("node:path");

const projectFolder = path.join(__dirname, "..");
const sourcePath = path.join(
    projectFolder,
    "Codes",
    "Js",
    "School-Name-Masterlist.pdf"
);
const outputPath = path.join(
    projectFolder,
    "Codes",
    "Js",
    "approved-schools.json"
);

async function extractApprovedSchools() {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await getDocument({
        data: new Uint8Array(await fs.readFile(sourcePath)),
        useSystemFonts: true,
        disableFontFace: true,
        verbosity: 0
    }).promise;
    const schools = new Set();

    try {
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
            const page = await document.getPage(pageNumber);
            const content = await page.getTextContent();

            for (const item of content.items) {
                const schoolColumnX = item.transform[4];
                if (schoolColumnX < 185 || schoolColumnX >= 309) continue;

                const match = item.str.trim().match(/^\d{6}\s+(.+)$/u);
                if (!match) continue;

                const school = match[1].normalize("NFC").trim().replace(/\s+/gu, " ");
                if (school.length >= 2 && school.length <= 120) schools.add(school);
            }
        }
    } finally {
        await document.destroy();
    }

    if (schools.size < 1000) {
        throw new Error(
            "The school masterlist could not be read. Verify that the PDF contains the expected school list."
        );
    }

    await fs.writeFile(outputPath, `${JSON.stringify([...schools], null, 2)}\n`);
    console.log(`Extracted ${schools.size} approved school names.`);
}

extractApprovedSchools().catch(error => {
    console.error("Approved school names could not be extracted.", error);
    process.exitCode = 1;
});
