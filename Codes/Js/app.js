document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("sleepHabitSelect")) {
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
        createScatterCharts(rows);
    } catch (error) {
        console.error(error);
        document.querySelector("#scatterCharts").innerHTML =
            "<p>Unable to load the CSV file. Run the website using Live Server.</p>";
    }
}
