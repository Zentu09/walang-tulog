const CSV_FILE = "../Js/SleepStudy.csv";

function parseCsv(csvText) {
    const lines = csvText
        .trim()
        .split(/\r?\n/)
        .filter(line => line.trim() !== "");

    const headers = lines[0].split(",").map(header =>
        header.trim().replace(/^"|"$/g, "")
    );

    return lines.slice(1).map(line => {
        const values = line.split(",");

        return Object.fromEntries(
            headers.map((header, index) => [
                header,
                values[index]?.trim().replace(/^"|"$/g, "")
            ])
        );
    });
}

function getColumn(row, columnName) {
    if (columnName === "SocialJetlag") {
        return row.SocialJetlag;
    }

    const requested = columnName.toLowerCase().replace(/[\s_-]/g, "");

    const actualKey = Object.keys(row).find(key =>
        key.toLowerCase().replace(/[\s_-]/g, "") === requested
    );

    if (!actualKey || row[actualKey] === undefined || row[actualKey] === "") {
        return NaN;
    }

    const value = Number(row[actualKey]);
    return Number.isFinite(value) ? value : NaN;
}

function getTextColumn(row, columnName) {
    const requested = columnName.toLowerCase().replace(/[\s_-]/g, "");
    const actualKey = Object.keys(row).find(key =>
        key.toLowerCase().replace(/[\s_-]/g, "") === requested
    );

    return actualKey ? row[actualKey]?.trim() : "";
}

function cleanRows(rows) {
    return rows
        .filter(row => Number.isFinite(getColumn(row, "GPA")))
        .map(row => {
            const weekdayRise = getColumn(row, "WeekdayRise");
            const weekendRise = getColumn(row, "WeekendRise");
            const allNighter = getColumn(row, "AllNighter");

            row.SocialJetlag = Number.isFinite(weekdayRise) &&
                Number.isFinite(weekendRise)
                ? weekendRise - weekdayRise
                : NaN;

            if (Number.isFinite(allNighter) && allNighter > 10) {
                row.AllNighter = "";
            }

            return row;
        });
}
