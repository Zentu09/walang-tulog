const CSV_FILE = "../Js/SleepStudy.csv";

const scatterColumns = [
    ["WeekdayBed", "Weekday Bedtime"],
    ["WeekdayRise", "Weekday Rise Time"],
    ["WeekdaySleep", "Weekday Sleep Duration"],
    ["WeekendBed", "Weekend Bedtime"],
    ["WeekendRise", "Weekend Rise Time"],
    ["WeekendSleep", "Weekend Sleep Duration"]
];

document.addEventListener("DOMContentLoaded", () => {
    loadCsv();
});

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
                    "#8fc4ff", // Excellent
                    "#4f91e8", // Good
                    "#13589c", // Average
                    "#0f2967"  // Poor
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
                    "#8fc4ff", // Excellent
                    "#4f91e8", // Good
                    "#13589c", // Average
                    "#0f2967"  // Poor
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: true,
                    position: "right",
                    labels: {
                        color: "#183765",
                        padding: 16,
                        usePointStyle: true
                    }
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
    const zoomRange = document.getElementById("zoomRange");
    const resetZoom = document.getElementById("resetZoom");

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
                            backgroundColor: "rgba(79, 145, 232, 0.55)",
                            borderColor: "#8fc4ff",
                            pointRadius: 3,
                            pointHoverRadius: 5
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
                            borderColor: "#2879ee", // trend-line color
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
                        },
                        zoom: {
                            pan: {
                                enabled: true,
                                mode: "xy"
                            },
                            zoom: {
                                wheel: {
                                    enabled: false
                                },
                                pinch: {
                                    enabled: true
                                },
                                drag: {
                                    enabled: true
                                },
                                mode: "xy"
                            }
                        }
                    },

                    scales: {
                        x: {
                            grid: {
                                color: "#dce9f8"
                            },
                            ticks: {
                                color: "#6681a5"
                            }
                        },
                        y: {
                            min: 2,
                            max: 4,
                            grid: {
                                color: "#dce9f8"
                            },
                            ticks: {
                                color: "#6681a5"
                            },
                            title: {
                                display: true,
                                text: "GPA",
                                color: "#477bc3"
                            }
                        }
                    }
                }
            }
        );

        const correlation = regression.correlation;
        const strength = getCorrelationStrength(correlation);
        const direction = correlation < 0 ? "negative" : "positive";

        document.getElementById("scatterTitle").textContent =
            `GPA vs ${title}`;

        document.getElementById("correlationValue").textContent =
            correlation.toFixed(3);

        document.getElementById("correlationStrength").textContent =
            `${strength} correlation`;

        document.getElementById("meaningBadge").textContent =
            `${strength} relationship`;

        document.getElementById("correlationDescription").textContent =
            `${title} has a ${strength.toLowerCase()} ${direction} relationship with GPA.`;

        document.getElementById("correlationMeaning").textContent =
            `The points are widely scattered, indicating that ${title.toLowerCase()} has only a ${strength.toLowerCase()} relationship with GPA.`;
    }

    select.addEventListener("change", updateScatterChart);
    updateScatterChart();

    zoomRange.oninput = () => {
        scatterChart.resetZoom();
        scatterChart.zoom(Number(zoomRange.value));
    };

    resetZoom.onclick = () => {
        scatterChart.resetZoom();
        zoomRange.value = "1";
    };
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

// Prevent scrolling until the user chooses to continue.

document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector(".ulo");

    document.getElementById("exploreButton")?.addEventListener("click", () => {
        document.getElementById("about-study")?.scrollIntoView({
            behavior: "smooth"
        });
    });

    document.getElementById("resultsButton")?.addEventListener("click", () => {
        document.getElementById("performance")?.scrollIntoView({
            behavior: "smooth"
        });
    });

    const animatedElements = document.querySelectorAll(
        "section:not(.header-section), .card, .chart-card, .average-grade, .conclusion-section"
    );

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            entry.target.classList.toggle(
                "show-section",
                entry.isIntersecting
            );
        });
    }, { threshold: 0.12 });

    animatedElements.forEach(element => {
        element.classList.add("fade-section");
        observer.observe(element);
    });

    let lastScrollPosition = window.scrollY;
    let ticking = false;

    window.addEventListener("scroll", () => {
        if (ticking) return;

        window.requestAnimationFrame(() => {
            const currentPosition = window.scrollY;

            if (currentPosition <= 10 ||
                currentPosition < lastScrollPosition) {
                header?.classList.remove("header-hidden");
            } else if (currentPosition > lastScrollPosition) {
                header?.classList.add("header-hidden");
            }

            lastScrollPosition = currentPosition;
            ticking = false;
        });

        ticking = true;
    }, { passive: true });
});
