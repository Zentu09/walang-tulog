/* ==========================================================
   Findings section
   Depends on (from data.js): getColumn, getTextColumn,
   applySleepStudyChartTheme.
   Called from app.js: createScatterCharts(rows)
   ========================================================== */

let originalStudyRowsForSchoolFindings = null;
let originalStudyRowsLoadError = null;
const originalStudyRowsWaiters = [];

function setOriginalStudyRowsForSchoolFindings(rows) {
    originalStudyRowsForSchoolFindings = rows;
    originalStudyRowsLoadError = null;
    originalStudyRowsWaiters.splice(0).forEach(waiter => waiter.resolve(rows));
}

function failOriginalStudyRowsForSchoolFindings(error) {
    originalStudyRowsLoadError = error;
    originalStudyRowsWaiters.splice(0).forEach(waiter => waiter.reject(error));
}

function waitForOriginalStudyRowsForSchoolFindings() {
    if (Array.isArray(originalStudyRowsForSchoolFindings)) {
        return Promise.resolve(originalStudyRowsForSchoolFindings);
    }
    if (originalStudyRowsLoadError) {
        return Promise.reject(originalStudyRowsLoadError);
    }
    return new Promise((resolve, reject) => {
        originalStudyRowsWaiters.push({ resolve, reject });
    });
}

function getCorrelationStrength(correlation) {
    const absolute = Math.abs(correlation);

    if (absolute < 0.2) return "Very weak";
    if (absolute < 0.4) return "Weak";
    if (absolute < 0.7) return "Moderate";
    return "Strong";
}

function calculateRegression(points) {
    const n = points.length;
    const empty = {
        slope: NaN, intercept: NaN, correlation: NaN,
        minX: NaN, maxX: NaN, n
    };

    if (n < 3) return empty;

    let sumX = 0;
    let sumY = 0;
    let minX = Infinity;
    let maxX = -Infinity;

    for (const point of points) {
        sumX += point.x;
        sumY += point.y;
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
    }

    const meanX = sumX / n;
    const meanY = sumY / n;
    let numerator = 0;
    let varianceX = 0;
    let varianceY = 0;

    for (const point of points) {
        numerator += (point.x - meanX) * (point.y - meanY);
        varianceX += (point.x - meanX) ** 2;
        varianceY += (point.y - meanY) ** 2;
    }

    // No spread in x or y means a correlation can't be calculated.
    if (!(varianceX > 0) || !(varianceY > 0)) return empty;

    const slope = numerator / varianceX;

    return {
        slope,
        intercept: meanY - slope * meanX,
        correlation: numerator / Math.sqrt(varianceX * varianceY),
        minX,
        maxX,
        n
    };
}

function createScatterCharts(rows) {
    const $ = id => document.getElementById(id);
    const root = $("findings");
    const picker = $("habitPicker");
    const canvas = $("scatterChart");

    if (!root || !picker || !canvas) return;

    setOriginalStudyRowsForSchoolFindings(rows);

    const HABITS = [
        { key: "WeekdayBed", group: "Timing", kind: "clock", step: 1,
            label: "Weekday bedtime", more: "Later weekday bedtimes",
            axis: "Weekday bedtime" },
        { key: "WeekdayRise", group: "Timing", kind: "clock", step: 1,
            label: "Weekday rise time", more: "Later weekday rise times",
            axis: "Weekday rise time" },
        { key: "WeekendBed", group: "Timing", kind: "clock", step: 1,
            label: "Weekend bedtime", more: "Later weekend bedtimes",
            axis: "Weekend bedtime" },
        { key: "WeekendRise", group: "Timing", kind: "clock", step: 1,
            label: "Weekend rise time", more: "Later weekend rise times",
            axis: "Weekend rise time" },
        { key: "SocialJetlag", group: "Timing", kind: "jetlag", step: 1,
            label: "Social jetlag", more: "More social jetlag",
            axis: "Social jetlag (weekend rise time minus weekday rise time, in hours)" },
        { key: "WeekdaySleep", group: "Duration", kind: "duration", step: 1,
            label: "Weekday sleep duration", more: "Longer weekday sleep",
            axis: "Weekday sleep duration" },
        { key: "WeekendSleep", group: "Duration", kind: "duration", step: 1,
            label: "Weekend sleep duration", more: "Longer weekend sleep",
            axis: "Weekend sleep duration" },
        { key: "PoorSleepQuality", group: "Quality and chronotype", kind: "score",
            label: "Poor sleep quality", more: "Higher poor-sleep scores (worse sleep)",
            axis: "Poor sleep quality score (higher means worse sleep)" },
        { key: "LarkOwl", group: "Quality and chronotype", kind: "category",
            label: "Chronotype" }
    ];

    const compactQuery = window.matchMedia(
        "(max-width: 780px), (max-height: 500px) and (orientation: landscape) and (max-width: 1000px)"
    );
    const isCompact = () => compactQuery.matches;
    const cssVar = name => getComputedStyle(root).getPropertyValue(name).trim();

    const fmtPlain = value => `${value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)}`;
    const fmtSigned = value => `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(2)}`;

    function formatClock(value) {
        const t = ((value % 24) + 24) % 24;
        let hours = Math.floor(t);
        let minutes = Math.round((t - hours) * 60);

        if (minutes === 60) {
            hours = (hours + 1) % 24;
            minutes = 0;
        }

        return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
    }

    function formatDuration(value) {
        const total = Math.round(value * 60);
        const hours = Math.floor(total / 60);
        const minutes = total % 60;
        return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
    }

    function formatValue(habit, value) {
        if (habit.kind === "clock") return formatClock(value);
        if (habit.kind === "duration") return formatDuration(value);
        if (habit.kind === "jetlag") {
            const sign = value > 0 ? "+" : value < 0 ? "−" : "";
            return `${sign}${Math.abs(value).toFixed(1)} h`;
        }
        return String(Number(value.toFixed(2)));
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    /* ---------- Data ---------- */

    const gpas = rows.map(row => getColumn(row, "GPA")).filter(Number.isFinite);
    const gpaMin = gpas.length ? Math.min(2, Math.floor(Math.min(...gpas) * 2) / 2) : 2;

    const stats = {};
    HABITS.filter(habit => habit.kind !== "category").forEach(habit => {
        const points = rows
            .map(row => ({ x: getColumn(row, habit.key), y: getColumn(row, "GPA") }))
            .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));

        stats[habit.key] = { points, regression: calculateRegression(points) };
    });

    const ranked = HABITS
        .filter(habit => habit.kind !== "category")
        .map(habit => ({ habit, r: stats[habit.key].regression.correlation }))
        .filter(item => Number.isFinite(item.r))
        .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    /* ---------- State and elements ---------- */

    let chart = null;
    let current = HABITS[0].key;

    const zoomRange = $("zoomRange");
    const resetButton = $("resetZoom");

    function setStatus(message) {
        const status = $("fdChartStatus");
        status.textContent = message || "";
        status.hidden = !message;
    }

    function destroyChart() {
        if (chart) {
            chart.destroy();
            chart = null;
        }
        if (zoomRange) zoomRange.value = "1";
    }

    function setActiveButtons() {
        root.querySelectorAll("[data-habit]").forEach(button => {
            button.setAttribute("aria-pressed", String(button.dataset.habit === current));
        });
    }

    function setGauge(correlation) {
        const wrap = $("fdGaugeWrap");
        const valid = Number.isFinite(correlation);

        wrap.hidden = !valid;
        if (!valid) return;

        const half = Math.abs(correlation) * 50;
        const fill = $("fdGaugeFill");

        fill.style.left = correlation < 0 ? `${50 - half}%` : "50%";
        fill.style.width = `${half}%`;
        fill.classList.toggle("is-neg", correlation < 0);
        $("fdGaugeMarker").style.left = `${50 + correlation * 50}%`;
        $("fdGauge").setAttribute(
            "aria-label",
            `Correlation of ${fmtSigned(correlation)} on a scale from −1 to +1`
        );
    }

    function setResult(result) {
        $("scatterTitle").textContent = result.title;
        $("fdResultLabel").textContent = result.label;
        $("correlationValue").textContent = result.value;
        $("correlationStrength").textContent = result.strength;
        $("correlationDescription").textContent = result.description;
        $("correlationMeaning").textContent = result.meaning;
        $("meaningBadge").textContent = result.badge;
        setGauge(result.gauge);
    }

    /* ---------- Scatter chart ---------- */

    function renderScatter(habit) {
        const { points, regression } = stats[habit.key];
        const title = `GPA vs ${habit.label.toLowerCase()}`;

        destroyChart();

        if (!Number.isFinite(regression.correlation)) {
            setStatus("Not enough data to chart this habit.");
            setResult({
                title,
                label: "Pearson's r",
                value: "N/A",
                strength: "Not enough data",
                description: "There aren't enough valid responses to calculate a correlation.",
                meaning: "Try another habit.",
                badge: "No result",
                gauge: NaN
            });
            return;
        }

        setStatus("");
        $("fdLegend").hidden = false;
        $("fdZoom").hidden = false;
        $("fdChartNote").hidden = true;


        const trendAt = x => regression.slope * x + regression.intercept;
        const compact = isCompact();

        chart = new Chart(canvas, {
            type: "scatter",
            data: {
                datasets: [
                    {
                        label: "Students",
                        data: points,
                        backgroundColor: cssVar("--fd-point"),
                        borderColor: cssVar("--fd-point-edge"),
                        borderWidth: 1,
                        pointRadius: compact ? 4 : 3.5,
                        pointHoverRadius: compact ? 6 : 5
                    },
                    {
                        type: "line",
                        label: "Trend line",
                        data: [
                            { x: regression.minX, y: trendAt(regression.minX) },
                            { x: regression.maxX, y: trendAt(regression.maxX) }
                        ],
                        borderColor: cssVar("--fd-trend"),
                        borderWidth: 2.5,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                font: { size: compact ? 13 : 12 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        filter: item => item.datasetIndex === 0,
                        callbacks: {
                            title: () => "",
                            label: context => [
                                `${habit.label}: ${formatValue(habit, context.parsed.x)}`,
                                `GPA: ${context.parsed.y.toFixed(2)}`
                            ]
                        }
                    },
                    zoom: {
                        limits: {
                            x: { min: "original", max: "original" },
                            y: { min: "original", max: "original" }
                        },
                        pan: {
                            enabled: true,
                            mode: "xy",
                            // Only pan once zoomed in, so touch scrolling still works on the page.
                            onPanStart: ({ chart: target }) =>
                                typeof target.isZoomedOrPanned === "function"
                                    ? target.isZoomedOrPanned()
                                    : true
                        },
                        zoom: {
                            wheel: { enabled: true, modifierKey: "ctrl" },
                            pinch: { enabled: true },
                            drag: { enabled: false },
                            mode: "xy"
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: habit.axis },
                        ticks: {
                            stepSize: habit.step,
                            callback: value => formatValue(habit, Number(value))
                        }
                    },
                    y: {
                        min: gpaMin,
                        max: 4,
                        title: { display: true, text: "GPA" }
                    }
                }
            }
        });

        applySleepStudyChartTheme(chart);
        chart.update("none");

        const r = regression.correlation;
        const strength = getCorrelationStrength(r);
        const direction = r < 0 ? "negative" : "positive";
        const gpaDirection = r < 0 ? "lower" : "higher";
        const explained = r * r * 100;
        const meanings = {
            "Very weak": `${habit.more} barely tell us anything about GPA. Students with similar ${habit.label.toLowerCase()} still ended up with very different grades.`,
            "Weak": `${habit.more} tend to go with slightly ${gpaDirection} GPA, but many students don't follow the pattern.`,
            "Moderate": `${habit.more} tend to go with noticeably ${gpaDirection} GPA, though other factors still matter.`,
            "Strong": `${habit.more} go with clearly ${gpaDirection} GPA.`
        };

        setResult({
            title,
            label: "Pearson's r",
            value: fmtPlain(r),
            strength: `${strength} correlation`,
            description: `${habit.label} has a ${strength.toLowerCase()} ${direction} relationship with GPA, based on ${regression.n} students.`,
            meaning: meanings[strength],
            badge: explained < 1
                ? "Explains less than 1% of the differences in GPA"
                : `Explains about ${Math.round(explained)}% of the differences in GPA`,
            gauge: r
        });
    }

    /* ---------- Chronotype chart ---------- */

    function renderChronotype(habit) {
        const order = ["lark", "neither", "owl"];
        const byGroup = new Map();

        rows.forEach(row => {
            const group = getTextColumn(row, "LarkOwl");
            const gpa = getColumn(row, "GPA");

            if (!group || !Number.isFinite(gpa)) return;
            if (!byGroup.has(group)) byGroup.set(group, []);
            byGroup.get(group).push(gpa);
        });

        const groups = [...byGroup.entries()]
            .map(([name, values]) => ({
                name,
                n: values.length,
                average: values.reduce((sum, value) => sum + value, 0) / values.length
            }))
            .sort((a, b) => {
                const rankA = order.indexOf(a.name.toLowerCase());
                const rankB = order.indexOf(b.name.toLowerCase());
                return (rankA === -1 ? 99 : rankA) - (rankB === -1 ? 99 : rankB);
            });

        destroyChart();

        if (groups.length < 2) {
            setStatus("Not enough chronotype groups to compare.");
            setResult({
                title: "Average GPA by chronotype",
                label: "Gap between groups",
                value: "N/A",
                strength: "Not enough data",
                description: "At least two chronotype groups are needed.",
                meaning: "Try another habit.",
                badge: "No result",
                gauge: NaN
            });
            return;
        }

        setStatus("");
        $("fdLegend").hidden = true;
        $("fdZoom").hidden = true;

        const note = $("fdChartNote");
        note.textContent = `The vertical axis starts at ${gpaMin.toFixed(1)} so small differences are visible.`;
        note.hidden = false;

        const palette = [cssVar("--fd-bar-1"), cssVar("--fd-bar-2"), cssVar("--fd-bar-3")];

        chart = new Chart(canvas, {
            type: "bar",
            data: {
                labels: groups.map(group => [group.name, `${group.n} students`]),
                datasets: [{
                    label: "Average GPA",
                    data: groups.map(group => group.average),
                    backgroundColor: groups.map((_, index) => palette[index % palette.length]),
                    borderRadius: 8,
                    maxBarThickness: 120
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                font: { size: isCompact() ? 13 : 12 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context =>
                                `Average GPA: ${context.parsed.y.toFixed(2)} (${groups[context.dataIndex].n} students)`
                        }
                    }
                },
                scales: {
                    y: {
                        min: gpaMin,
                        max: 4,
                        title: { display: true, text: "Average GPA" }
                    }
                }
            }
        });

        applySleepStudyChartTheme(chart);
        chart.update("none");

        const sorted = [...groups].sort((a, b) => b.average - a.average);
        const top = sorted[0];
        const bottom = sorted[sorted.length - 1];
        const gap = top.average - bottom.average;

        setResult({
            title: "Average GPA by chronotype",
            label: "Gap between groups",
            value: gap.toFixed(2),
            strength: "Group comparison",
            description: `Highest average GPA: ${top.name} (${top.average.toFixed(2)}). Lowest: ${bottom.name} (${bottom.average.toFixed(2)}).`,
            meaning: `The gap is ${gap.toFixed(2)} GPA points. Chronotype is a category, so Pearson's r doesn't apply and the groups are compared by their averages instead.`,
            badge: "Group comparison",
            gauge: NaN
        });
    }

    /* ---------- Rendering ---------- */

    function render() {
        const habit = HABITS.find(item => item.key === current);

        if (habit.kind === "category") {
            renderChronotype(habit);
        } else {
            renderScatter(habit);
        }

        setActiveButtons();
    }

    function select(key) {
        current = key;
        render();
    }

    function buildPicker() {
        [...new Set(HABITS.map(habit => habit.group))].forEach(group => {
            const wrapper = el("div", "fd-group");
            const chips = el("div", "fd-chips");

            wrapper.appendChild(el("span", "fd-group-name", group));

            HABITS.filter(habit => habit.group === group).forEach(habit => {
                const button = el("button", "fd-chip", habit.label);
                button.type = "button";
                button.dataset.habit = habit.key;
                button.addEventListener("click", () => select(habit.key));
                chips.appendChild(button);
            });

            wrapper.appendChild(chips);
            picker.appendChild(wrapper);
        });
    }

    function buildRanking() {
        const list = $("fdRankList");
        const scale = 0.5;

        list.replaceChildren();

        ranked.forEach(({ habit, r }) => {
            const item = el("li");
            const button = el("button", "fd-rank-row");
            const bar = el("span", "fd-rank-bar");
            const fill = el("span", `fd-rank-fill${r < 0 ? " is-neg" : ""}`);
            const half = Math.min(1, Math.abs(r) / scale) * 50;

            fill.style.left = r < 0 ? `${50 - half}%` : "50%";
            fill.style.width = `${half}%`;
            bar.appendChild(fill);

            button.type = "button";
            button.dataset.habit = habit.key;
            button.appendChild(el("span", "fd-rank-name", habit.label));
            button.appendChild(bar);
            button.appendChild(el("span", "fd-rank-value", fmtSigned(r)));
            button.addEventListener("click", () => {
                select(habit.key);
                $("fdMain").scrollIntoView({ behavior: "smooth", block: "start" });
            });

            item.appendChild(button);
            list.appendChild(item);
        });
    }

    function buildConclusion() {
        const title = $("fdConclusionTitle");
        const body = $("fdConclusionBody");

        $("fdSampleSize").textContent = rows.length;

        if (!ranked.length) {
            title.textContent = "No correlations to report";
            body.textContent = "The data didn't contain enough valid responses.";
            return;
        }

        const strongest = ranked[0];
        const values = ranked.map(item => item.r);
        const lowest = Math.min(...values);
        const highest = Math.max(...values);
        const peak = Math.abs(strongest.r);

        const headline =
            peak < 0.2 ? "Sleep habits have a very weak link to GPA" :
            peak < 0.4 ? "Sleep habits have a weak link to GPA" :
            peak < 0.7 ? "Some sleep habits have a moderate link to GPA" :
            "At least one sleep habit has a strong link to GPA";

        const followUp = peak < 0.4
            ? "On their own, none of these habits strongly predicts academic performance. Study habits, course workload, stress, and personal circumstances may matter more."
            : "At least one habit shows a meaningful link, but a correlation alone can't show that it causes better or worse grades.";

        title.textContent = headline;
        body.replaceChildren(
            el("p", "", `Across ${rows.length} students, correlations with GPA ranged from ${fmtSigned(lowest)} to ${fmtSigned(highest)}. ${strongest.habit.label} showed the strongest relationship (r = ${fmtSigned(strongest.r)}).`),
            el("p", "", followUp)
        );
    }

    /* ---------- Zoom controls ---------- */

    if (zoomRange) {
        zoomRange.addEventListener("input", () => {
            if (!chart || chart.config.type !== "scatter") return;
            if (typeof chart.zoom !== "function") return;

            chart.resetZoom("none");

            const factor = Number(zoomRange.value);
            if (factor > 1) chart.zoom(factor);
        });
    }

    if (resetButton) {
        resetButton.addEventListener("click", () => {
            if (chart && typeof chart.resetZoom === "function") chart.resetZoom();
            if (zoomRange) zoomRange.value = "1";
        });
    }

    /* ---------- Start ---------- */

    buildPicker();
    buildRanking();
    buildConclusion();
    render();

    // Redraw with the right colors when the theme changes.
    window.addEventListener("sleep-study-theme-change", render);
}

function initializeSchoolFindings() {
    const schoolsElement = document.getElementById("schoolFindingsSchools");
    const measureElement = document.getElementById("schoolSleepMeasure");
    const statusElement = document.getElementById("schoolFindingsStatus");
    const canvas = document.getElementById("schoolScatterChart");
    const chartContainer = document.getElementById("schoolChartContainer");

    if (!schoolsElement || !measureElement || !statusElement ||
        !canvas || !chartContainer) return;

    // Set only after the research team approves a threshold in its methodology.
    const MINIMUM_VALID_RESPONSES_PER_SCHOOL = null;
    const ORIGINAL_DATASET_SCHOOL = "St. Lawrence University (original study dataset)";
    const measures = {
        WeekdaySleep: {
            label: "Weekday sleep duration (hours)",
            valid: value => value > 0 && value <= 24
        },
        WeekendSleep: {
            label: "Weekend sleep duration (hours)",
            valid: value => value > 0 && value <= 24
        },
        PoorSleepQuality: {
            label: "Poor sleep quality score (higher means worse quality)",
            valid: value => value >= 0
        },
        SocialJetlag: {
            label: "Social jetlag (hours)",
            valid: value => value >= -24 && value <= 24
        }
    };
    const colors = ["#2563c9", "#a45bc4", "#df8b24", "#17866b", "#c84d58"];
    const cache = new Map();
    let chart = null;
    let requestNumber = 0;

    function setStatus(message, state) {
        statusElement.textContent = message;
        if (state) statusElement.dataset.state = state;
        else statusElement.removeAttribute("data-state");
    }

    function numericValue(value) {
        if (typeof value === "number") {
            return Number.isFinite(value) ? value : null;
        }
        if (typeof value !== "string" || value.trim() === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function selectedSchools() {
        return [...schoolsElement.querySelectorAll('input[type="checkbox"]:checked')]
            .map(input => input.value);
    }

    function loadSchool(school) {
        if (school === ORIGINAL_DATASET_SCHOOL) {
            return waitForOriginalStudyRowsForSchoolFindings();
        }
        if (cache.has(school)) return cache.get(school);

        const request = fetch(
            `/api/school-submissions?school=${encodeURIComponent(school)}`
        ).then(async response => {
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || `Unable to load ${school}.`);
            }
            const rows = await response.json();
            if (!Array.isArray(rows)) {
                throw new Error(`The response data for ${school} is invalid.`);
            }
            return rows;
        }).catch(error => {
            cache.delete(school);
            throw error;
        });
        cache.set(school, request);
        return request;
    }

    function makePoints(rows, measure, metricKey) {
        return rows.flatMap(row => {
            const gpa = numericValue(row.GPA);
            const sleepValue = numericValue(row[metricKey]);
            if (gpa === null || gpa < 0 || gpa > 4 ||
                sleepValue === null || !measure.valid(sleepValue)) {
                return [];
            }
            return [{ x: sleepValue, y: gpa }];
        });
    }

    async function renderSelectedSchools() {
        const currentRequest = ++requestNumber;
        chartContainer.hidden = true;
        if (chart) {
            chart.destroy();
            chart = null;
        }

        const selected = selectedSchools();
        const measure = measures[measureElement.value];
        if (!selected.length) {
            setStatus("Select one or more schools to view their responses.");
            return;
        }

        setStatus("Checking valid responses…");

        try {
            const metricKey = measureElement.value;
            const schoolData = await Promise.all(selected.map(async school => {
                const rows = await loadSchool(school);
                const points = makePoints(rows, measure, metricKey);
                return {
                    school,
                    points,
                    regression: calculateRegression(points)
                };
            }));
            if (currentRequest !== requestNumber) return;

            const originalDatasetNote = selected.includes(ORIGINAL_DATASET_SCHOOL)
                ? " This selection uses the original St. Lawrence University study dataset."
                : "";

            if (!Number.isSafeInteger(MINIMUM_VALID_RESPONSES_PER_SCHOOL) ||
                MINIMUM_VALID_RESPONSES_PER_SCHOOL < 1) {
                setStatus("");
                return;
            }

            const required = Math.max(3, MINIMUM_VALID_RESPONSES_PER_SCHOOL);
            const insufficient = schoolData.filter(item =>
                item.points.length < required ||
                !Number.isFinite(item.regression.correlation)
            );
            if (insufficient.length) {
                const details = insufficient.map(item => {
                    const issue = item.points.length < required
                        ? `${item.points.length} valid responses`
                        : "no meaningful variation in the selected values";
                    return `${item.school} (${issue})`;
                });
                setStatus(
                    `${details.join(", ")}. At least ${required} valid paired responses ` +
                    "with variation in both measures are needed; no chart is shown."
                );
                return;
            }

            const datasets = schoolData.map((item, index) => ({
                label: item.school,
                data: item.points,
                backgroundColor: colors[index % colors.length],
                borderColor: colors[index % colors.length],
                pointRadius: 4,
                pointHoverRadius: 6
            }));

            chart = new Chart(canvas, {
                type: "scatter",
                data: { datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: "bottom" },
                        title: {
                            display: true,
                            text: `${measure.label} vs GPA by school`
                        },
                        tooltip: {
                            callbacks: {
                                label: context =>
                                    `${context.dataset.label}: ${measure.label} ` +
                                    `${context.parsed.x.toFixed(2)}, GPA ` +
                                    `${context.parsed.y.toFixed(2)}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: measure.label }
                        },
                        y: {
                            min: 0,
                            max: 4,
                            title: { display: true, text: "GPA (0–4 scale)" }
                        }
                    }
                }
            });
            chartContainer.hidden = false;
            if (typeof applySleepStudyChartTheme === "function") {
                applySleepStudyChartTheme(chart);
                chart.update("none");
            }

            const correlations = schoolData.map(item =>
                `${item.school}: r = ${item.regression.correlation.toFixed(2)} ` +
                `(n = ${item.points.length})`
            );
            setStatus(
                `${correlations.join("; ")}. Correlations describe associations ` +
                `in these submissions.${originalDatasetNote} They do not establish causation.`
            );
        } catch (error) {
            if (currentRequest !== requestNumber) return;
            console.error("School findings could not be loaded.", error);
            setStatus(
                `School findings could not be loaded: ${error.message}. ` +
                "Check the server and reload the page.",
                "error"
            );
        }
    }

    function addSchoolChoice(school, index, checked = false) {
        const label = document.createElement("label");
        label.className = "fd-school-choice";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = school;
        checkbox.id = `school-finding-${index}`;
        checkbox.checked = checked;
        checkbox.addEventListener("change", renderSelectedSchools);

        const name = document.createElement("span");
        name.textContent = school;
        label.append(checkbox, name);
        schoolsElement.append(label);
    }

    async function loadSchools() {
        try {
            const response = await fetch("/api/schools");
            if (!response.ok) {
                throw new Error(`Unable to load school names (${response.status}).`);
            }
            const schools = await response.json();
            if (!Array.isArray(schools) ||
                schools.some(school => typeof school !== "string")) {
                throw new Error("The school list returned by the server is invalid.");
            }

            schoolsElement.replaceChildren();
            schools.forEach(addSchoolChoice);
            if (!schools.length) {
                setStatus("");
                return;
            }
            setStatus("");
        } catch (error) {
            console.error("School list could not be loaded.", error);
            schoolsElement.replaceChildren();
            addSchoolChoice(ORIGINAL_DATASET_SCHOOL, 0, true);
            setStatus(
                `School submissions could not be loaded: ${error.message}. ` +
                "Showing the original St. Lawrence University dataset instead."
            );
            renderSelectedSchools();
        }
    }

    measureElement.addEventListener("change", renderSelectedSchools);
    loadSchools();
}

document.addEventListener("DOMContentLoaded", initializeSchoolFindings);