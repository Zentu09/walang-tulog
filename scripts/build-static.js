// Vercel build step: publish ONLY the website folder (Codes/) as static files at /Codes/...
// so server.js, package.json, supabase/, etc. are never exposed.
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const out = path.join(root, "public");
const website = path.join(root, "Codes");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(website, path.join(out, "Codes"), {
    recursive: true,
    filter(source) {
        const fileName = path.basename(source);
        return fileName !== "School-Name-Masterlist.pdf" &&
            fileName !== "school_masterlist.csv";
    }
});
fs.copyFileSync(path.join(root, "index.html"), path.join(out, "index.html"));
console.log("Static site copied to public/");
