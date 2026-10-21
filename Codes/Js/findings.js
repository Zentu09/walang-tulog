// Set this after the project leader approves the minimum response count.
const MINIMUM_VALID_RESPONSES_PER_SCHOOL = null;
let scatterChart;

function createScatterCharts() {
    const schoolSelect = document.getElementById("schoolFilter");
    const select = document.getElementById("sleepHabitSelect");
    const zoomRange = document.getElementById("zoomRange");
    const resetZoom = document.getElementById("resetZoom");
    const chartLegend = document.querySelector(".chart-legend");
    const canvas = document.getElementById("scatterChart");
    const findingsMessage = document.getElementById("findingsMessage");
    let rows = [];
    const isCompactViewport = () => window.matchMedia(
        "(max-width: 780px), (max-height: 500px) and (orientation: landscape) and (max-width: 1000px)"
    ).matches;

    function showMessage(message) {
        if (scatterChart) {
            scatterChart.destroy();
            scatterChart = null;
        }

        chartLegend.style.display = "none";
        canvas.style.display = "none";
        findingsMessage.textContent = message;
        findingsMessage.style.display = "flex";
        document.getElementById("scatterTitle").textContent =
            "School data is not ready to display";
        document.getElementById("correlationValue").textContent = "N/A";
        document.getElementById("correlationStrength").textContent =
            "Not available";
        document.getElementById("meaningBadge").textContent = "Not available";
        document.getElementById("correlationDescription").textContent = message;
        document.getElementById("correlationMeaning").textContent = message;
    }

    function showChart() {
        findingsMessage.textContent = "";
        findingsMessage.style.display = "none";
        canvas.style.display = "block";
    }

    function validNumber(value, column) {
        if (value === undefined || value === null || String(value).trim() === "") {
            return null;
        }

        const number = Number(value);
        if (isNaN(number)) return null;

        if (column === "GPA" && (number < 0 || number > 4)) return null;
        if ((column === "WeekdayBed" || column === "WeekendBed") &&
            (number < 12 || number > 35.99)) return null;
        if ((column === "WeekdayRise" || column === "WeekendRise") &&
            (number < 0 || number > 23.99)) return null;
        if ((column === "WeekdaySleep" || column === "WeekendSleep" ||
            column === "SocialJetlag") && (number < 0 || number > 24)) return null;
        if (column === "PoorSleepQuality" &&
            (!Number.isInteger(number) || number < 0)) {
            return null;
        }

        return number;
    }

    function getValidPoints(column) {
        const points = [];

        for (let i = 0; i < rows.length; i += 1) {
            const x = validNumber(rows[i][column], column);
            const y = validNumber(rows[i].GPA, "GPA");

            if (x !== null && y !== null) {
                points.push({ x: x, y: y });
            }
        }

        return points;
    }

    function getEligibilityMessage(points) {
        if (MINIMUM_VALID_RESPONSES_PER_SCHOOL === null) {
            return `This analysis has ${points.length} valid responses. ` +
                "School charts are disabled until the study team sets a " +
                "methodology-approved minimum response count.";
        }
        if (!Number.isInteger(MINIMUM_VALID_RESPONSES_PER_SCHOOL) ||
            MINIMUM_VALID_RESPONSES_PER_SCHOOL < 1) {
            return "Set the minimum response count to an approved whole number " +
                "greater than zero.";
        }
        if (points.length < MINIMUM_VALID_RESPONSES_PER_SCHOOL) {
            return `This analysis has ${points.length} valid responses, but needs ` +
                `${MINIMUM_VALID_RESPONSES_PER_SCHOOL} before it can be displayed. ` +
                "More valid student responses are needed.";
        }

        return "";
    }

    function hasDifferentValues(points, column) {
        if (points.length < 2) return false;

        const firstValue = points[0][column];
        for (let i = 1; i < points.length; i += 1) {
            if (points[i][column] !== firstValue) {
                return true;
            }
        }
        return false;
    }

    function updateScatterChart() {
        const selectedColumn = select.value;
        const selectedOption = select.options[select.selectedIndex];
        const title = selectedOption.textContent;

        if (selectedColumn === "LarkOwl") {
            updateChronotypeChart(title);
            return;
        }

        const points = getValidPoints(selectedColumn);
        const message = getEligibilityMessage(points);
        if (message) {
            showMessage(message);
            return;
        }
        if (!hasDifferentValues(points, "x") ||
            !hasDifferentValues(points, "y")) {
            showMessage(
                "There are enough valid responses, but the selected values do " +
                "not vary enough to produce a meaningful comparison."
            );
            return;
        }

        showChart();
        chartLegend.style.display = "flex";

        const regression = calculateRegression(points);
        if (!Number.isFinite(regression.correlation)) {
            showMessage(
                "The selected values do not produce a valid correlation. " +
                "More varied valid responses are needed."
            );
            return;
        }

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
                            pointRadius: isCompactViewport() ? 4 : 3,
                            pointHoverRadius: isCompactViewport() ? 6 : 5
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
                    font: { size: isCompactViewport() ? 14 : 12 },
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
        const validRows = [];
        const groups = [];
        const points = [];

        for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i];
            const gpa = validNumber(row.GPA, "GPA");

            if ((row.LarkOwl === "Lark" || row.LarkOwl === "Owl" ||
                row.LarkOwl === "Neither") && gpa !== null) {
                validRows.push(row);
                points.push({ x: row.LarkOwl, y: gpa });

                let groupAlreadyAdded = false;
                for (const group of groups) {
                    if (group === row.LarkOwl) {
                        groupAlreadyAdded = true;
                        break;
                    }
                }
                if (!groupAlreadyAdded) {
                    groups.push(row.LarkOwl);
                }
            }
        }

        const message = getEligibilityMessage(points);
        if (message) {
            showMessage(message);
            return;
        }

        if (groups.length < 2) {
            showMessage(
                "At least two chronotype groups with valid GPA values are needed " +
                "for a meaningful comparison."
            );
            return;
        }
        const averages = [];
        for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
            let totalGpa = 0;
            let groupCount = 0;

            for (let rowIndex = 0; rowIndex < validRows.length; rowIndex += 1) {
                if (validRows[rowIndex].LarkOwl === groups[groupIndex]) {
                    totalGpa += validNumber(validRows[rowIndex].GPA, "GPA");
                    groupCount += 1;
                }
            }
            averages.push(totalGpa / groupCount);
        }

        showChart();
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
                font: { size: isCompactViewport() ? 14 : 12 },
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

    async function loadSelectedSchool() {
        const school = schoolSelect.value;
        if (!school) {
            rows = [];
            showMessage("No school responses are available yet.");
            return;
        }

        showMessage("Loading valid responses for this school...");
        try {
            const response = await fetch(
                `/api/school-submissions?school=${encodeURIComponent(school)}`
            );
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `Unable to load school data (${response.status}).`);
            }
            if (!Array.isArray(result)) {
                throw new Error("The school data response has an unexpected format.");
            }

            rows = result;
            updateScatterChart();
        } catch (error) {
            console.error("School responses could not be loaded.", error);
            showMessage(
                "Could not load school responses. Start the website with npm start " +
                "and try again."
            );
        }
    }

    async function loadSchools() {
        try {
            const response = await fetch("/api/schools");
            const schools = await response.json();
            if (!response.ok) {
                throw new Error(`Unable to load schools (${response.status}).`);
            }
            if (!Array.isArray(schools)) {
                throw new Error("The school list response has an unexpected format.");
            }

            schoolSelect.replaceChildren();
            for (const school of schools) {
                const option = document.createElement("option");
                option.value = school;
                option.textContent = school;
                schoolSelect.append(option);
            }

            if (schools.length === 0) {
                const option = document.createElement("option");
                option.value = "";
                option.textContent = "No schools have responses yet";
                schoolSelect.append(option);
                showMessage("No school responses are available yet.");
                return;
            }

            await loadSelectedSchool();
        } catch (error) {
            console.error("School names could not be loaded.", error);
            schoolSelect.replaceChildren();
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "Unable to load schools";
            schoolSelect.append(option);
            showMessage(
                "Could not load the school list. Start the website with npm start " +
                "and try again."
            );
        }
    }

    schoolSelect.addEventListener("change", loadSelectedSchool);
    select.addEventListener("change", updateScatterChart);
    window.addEventListener("school-submission-saved", loadSchools);
    loadSchools();

    if (zoomRange && resetZoom) {
        zoomRange.oninput = () => {
            if (scatterChart) {
                scatterChart.resetZoom();
                scatterChart.zoom(Number(zoomRange.value));
            }
        };

        resetZoom.onclick = () => {
            if (scatterChart) scatterChart.resetZoom();
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
    let totalX = 0;
    let totalY = 0;
    for (const point of points) {
        totalX += point.x;
        totalY += point.y;
    }

    const meanX = totalX / n;
    const meanY = totalY / n;

    let numerator = 0;
    let denominator = 0;
    let varianceY = 0;
    let minX = points[0].x;
    let maxX = points[0].x;

    for (const point of points) {
        numerator += (point.x - meanX) * (point.y - meanY);
        denominator += (point.x - meanX) ** 2;
        varianceY += (point.y - meanY) ** 2;
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
    }

    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;
    const correlation = numerator / Math.sqrt(denominator * varianceY);

    return {
        slope,
        intercept,
        correlation,
        minX,
        maxX
    };
}
