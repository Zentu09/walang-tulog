const scatterColumns = [
    ["WeekdayBed", "Weekday Bedtime"],
    ["WeekdayRise", "Weekday Rise Time"],
    ["WeekdaySleep", "Weekday Sleep Duration"],
    ["WeekendBed", "Weekend Bedtime"],
    ["WeekendRise", "Weekend Rise Time"],
    ["WeekendSleep", "Weekend Sleep Duration"],
    ["PoorSleepQuality", "Poor Sleep Quality"],
    ["SocialJetlag", "Social Jetlag"]
];

const categoricalColumns = new Set(["LarkOwl"]);
let scatterChart;

function createScatterCharts(rows) {
    const select = document.getElementById("sleepHabitSelect");
    const zoomRange = document.getElementById("zoomRange");
    const resetZoom = document.getElementById("resetZoom");
    const chartLegend = document.querySelector(".chart-legend");

    function updateScatterChart() {
        const selectedColumn = select.value;
        const selectedOption = select.options[select.selectedIndex];
        const title = selectedOption.textContent;

        if (categoricalColumns.has(selectedColumn)) {
            updateChronotypeChart(title);
            return;
        }

        chartLegend.style.display = "flex";

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
                            borderColor: "#2879ee",
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
                                wheel: { enabled: false },
                                pinch: { enabled: true },
                                drag: { enabled: true },
                                mode: "xy"
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: "#dce9f8" },
                            ticks: { color: "#6681a5" }
                        },
                        y: {
                            min: 2,
                            max: 4,
                            grid: { color: "#dce9f8" },
                            ticks: { color: "#6681a5" },
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

    function updateChronotypeChart(title) {
        const groups = [...new Set(rows
            .map(row => getTextColumn(row, "LarkOwl"))
            .filter(Boolean))];
        const averages = groups.map(group => {
            const gpas = rows
                .filter(row => getTextColumn(row, "LarkOwl") === group)
                .map(row => getColumn(row, "GPA"));
            return gpas.reduce((sum, gpa) => sum + gpa, 0) / gpas.length;
        });

        if (scatterChart) {
            scatterChart.destroy();
        }

        chartLegend.style.display = "none";
        scatterChart = new Chart(document.getElementById("scatterChart"), {
            type: "bar",
            data: {
                labels: groups,
                datasets: [{
                    label: "Average GPA",
                    data: averages,
                    backgroundColor: ["#8fc4ff", "#4f91e8", "#13589c"]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        min: 2,
                        max: 4,
                        title: { display: true, text: "Average GPA" }
                    }
                },
                plugins: {
                    title: { display: true, text: `Average GPA by ${title}` }
                }
            }
        });

        document.getElementById("scatterTitle").textContent =
            `Average GPA by ${title}`;
        document.getElementById("correlationValue").textContent = "N/A";
        document.getElementById("correlationStrength").textContent =
            "Group comparison";
        document.getElementById("meaningBadge").textContent = "Group comparison";
        document.getElementById("correlationDescription").textContent =
            "Average GPA is shown separately for each chronotype group.";
        document.getElementById("correlationMeaning").textContent =
            "Chronotype is categorical, so a Pearson correlation is not appropriate.";
    }

    select.addEventListener("change", updateScatterChart);
    updateScatterChart();

    if (zoomRange && resetZoom) {
        zoomRange.oninput = () => {
            scatterChart.resetZoom();
            scatterChart.zoom(Number(zoomRange.value));
        };

        resetZoom.onclick = () => {
            scatterChart.resetZoom();
            zoomRange.value = "1";
        };
    }
}

function getCorrelationStrength(correlation) {
    const absoluteCorrelation = Math.abs(correlation);

    if (absoluteCorrelation < 0.2) return "Very weak";
    if (absoluteCorrelation < 0.4) return "Weak";
    if (absoluteCorrelation < 0.7) return "Moderate";
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
