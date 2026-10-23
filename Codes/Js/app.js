document.addEventListener("DOMContentLoaded", () => {
    // The findings section now uses #habitPicker instead of the old <select>.
    if (document.getElementById("habitPicker")) {
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
        setOriginalStudyRowsForSchoolFindings(rows);

        // Separate try blocks so one broken section doesn't stop the other.
        try {
            createPerformanceCharts(rows);
        } catch (error) {
            console.error("Performance charts failed:", error);
        }

        try {
            createScatterCharts(rows);
        } catch (error) {
            console.error("Findings charts failed:", error);
            showFindingsError("Something went wrong while drawing the findings charts.");
        }
    } catch (error) {
        console.error(error);
        failOriginalStudyRowsForSchoolFindings(error);
        showFindingsError("Unable to load the CSV file. Run the website using Live Server.");
    }
}

function showFindingsError(message) {
    const status = document.getElementById("fdChartStatus");

    if (status) {
        status.textContent = message;
        status.hidden = false;
    }
}