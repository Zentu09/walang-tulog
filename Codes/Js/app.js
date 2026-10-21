document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("sleepHabitSelect")) {
        createScatterCharts();
        loadCsv();
    }
});

async function loadCsv() {
    try {
        const response = await fetch(CSV_FILE);

        if (!response.ok) {
            throw new Error(`Unable to load ${CSV_FILE}`);
        }

        const csvText = await response.text();
        const rows = cleanRows(parseCsv(csvText));

        createPerformanceCharts(rows);
    } catch (error) {
        console.error(error);
    }
}
