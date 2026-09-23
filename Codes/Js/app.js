const CSV_FILE = "../Js/SleepStudy.csv";


const scatterColumns = [
    ["WeekdayBed", "Weekday Bedtime"],
    ["WeekdayRise", "Weekday Rise Time"],
    ["WeekdaySleep", "Weekday Sleep Duration"],
    ["WeekendBed", "Weekend Bedtime"],
    ["WeekendRise", "Weekend Rise Time"],
    ["WeekendSleep", "Weekend Sleep Duration"]
];

document.addEventListener("DOMContentLoaded", loadCsv);

async function loadCsv() {
    try {
        const response = await fetch(CSV_FILE);

        if (!response.ok) {
            throw new Error(`Unable to load ${CSV_FILE}`);
        }

        const csvText = await response.text();
        const rows = parseCsv(csvText);

        createPerformanceCharts(rows);
        createScatterCharts(rows);
    } catch (error) {
        console.error(error);
        document.querySelector("#scatterCharts").innerHTML =
            "<p>Unable to load the CSV file. Run the website using Live Server.</p>";
    }
}

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
    const requested = columnName.toLowerCase().replace(/[\s_-]/g, "");

    const actualKey = Object.keys(row).find(key =>
        key.toLowerCase().replace(/[\s_-]/g, "") === requested
    );

    return actualKey ? Number.parseFloat(row[actualKey]) : NaN;
}

function getGpaRange(gpa) {
    if (gpa >= 3.5) return "Excellent";
    if (gpa >= 3.0) return "Good";
    if (gpa >= 2.5) return "Average";
    return "Poor";
}

function createPerformanceCharts(rows) {
    const validGpas = rows
        .map(row => getColumn(row, "GPA"))
        .filter(Number.isFinite);

    const ranges = ["Excellent", "Good", "Average", "Poor"];

    const counts = ranges.map(range =>
        validGpas.filter(gpa => getGpaRange(gpa) === range).length
    );

    const averageGpa =
        validGpas.reduce((sum, gpa) => sum + gpa, 0) / validGpas.length;

    new Chart(document.getElementById("gpaBarChart"), {
        type: "bar",
        data: {
            labels: ranges,
            datasets: [{
                label: "Number of Students",
                data: counts,
                backgroundColor: [
                    "#42bd88",
                    "#3189df",
                    "#f2bd4b",
                    "#e35d62"
                ],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });

    new Chart(document.getElementById("gpaPieChart"), {
        type: "doughnut",
        data: {
            labels: ranges,
            datasets: [{
                data: counts,
                backgroundColor: [
                    "#42bd88",
                    "#3189df",
                    "#f2bd4b",
                    "#e35d62"
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "right"
                }
            }
        }
    });

    document.getElementById("averageGpa").textContent =
        averageGpa.toFixed(2);

    document.getElementById("averageDescription").textContent =
        `The average GPA falls under the "${getGpaRange(averageGpa)}" range.`;
}

let scatterChart;

function createScatterCharts(rows) {
    const select = document.getElementById("sleepHabitSelect");

    function updateScatterChart() {
        const selectedColumn = select.value;
        const selectedOption = select.options[select.selectedIndex];
        const title = selectedOption.textContent;

        const points = rows
            .map(row => ({
                x: getColumn(row, selectedColumn),
                y: getColumn(row, "GPA")
            }))
            .filter(point =>
                Number.isFinite(point.x) &&
                Number.isFinite(point.y)
            );

        const regression = calculateRegression(points);

        if (scatterChart) {
            scatterChart.destroy();
        }

        scatterChart = new Chart(
            document.getElementById("scatterChart"),
            {
                type: "scatter",
                data: {
                    datasets: [
                        {
                            label: "Students",
                            data: points,
                            backgroundColor: "rgba(72, 117, 180, 0.55)",
                            pointRadius: 3
                        },
                        {
                            type: "line",
                            label: "Trend line",
                            data: [
                                {
                                    x: regression.minX,
                                    y: regression.slope * regression.minX +
                                        regression.intercept
                                },
                                {
                                    x: regression.maxX,
                                    y: regression.slope * regression.maxX +
                                        regression.intercept
                                }
                            ],
                            borderColor: "#cf4545",
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `GPA vs ${title}`
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: title
                            }
                        },
                        y: {
                            min: 2,
                            max: 4,
                            title: {
                                display: true,
                                text: "GPA"
                            }
                        }
                    }
                }
            }
        );

        const strength = getCorrelationStrength(
            regression.correlation
        );

        document.getElementById("correlationResult").textContent =
            `Correlation: r = ${regression.correlation.toFixed(3)} — ` +
            `${strength} correlation.`;
    }

    select.addEventListener("change", updateScatterChart);
    updateScatterChart();
}

function getCorrelationStrength(correlation) {
    const absoluteCorrelation = Math.abs(correlation);

    if (absoluteCorrelation < 0.2) {
        return "Very weak";
    }

    if (absoluteCorrelation < 0.4) {
        return "Weak";
    }

    if (absoluteCorrelation < 0.7) {
        return "Moderate";
    }

    return "Strong";
}

function calculateRegression(points) {
    const n = points.length;
    const meanX = points.reduce((sum, point) => sum + point.x, 0) / n;
    const meanY = points.reduce((sum, point) => sum + point.y, 0) / n;

    let numerator = 0;
    let denominator = 0;
    let varianceY = 0;

    points.forEach(point => {
        numerator += (point.x - meanX) * (point.y - meanY);
        denominator += (point.x - meanX) ** 2;
        varianceY += (point.y - meanY) ** 2;
    });

    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;
    const correlation = numerator / Math.sqrt(denominator * varianceY);

    return {
        slope,
        intercept,
        correlation,
        minX: Math.min(...points.map(point => point.x)),
        maxX: Math.max(...points.map(point => point.x))
    };
}