// [column, label, kind, plain-language explainer, phrase used in the "link to GPA" note]
const COMPARISON_COLUMNS = [
    ["WeekdayBed", "Weekday bedtime", "bedtime",
        "What time you go to bed on school days.",
        "go to bed later on weekdays"],
    ["WeekdayRise", "Weekday rise time", "clock",
        "What time you wake up on school days.",
        "wake up later on weekdays"],
    ["WeekdaySleep", "Weekday sleep duration", "duration",
        "How many hours you sleep on school days.",
        "sleep longer on weekdays"],
    ["WeekendBed", "Weekend bedtime", "bedtime",
        "What time you go to bed on weekends.",
        "go to bed later on weekends"],
    ["WeekendRise", "Weekend rise time", "clock",
        "What time you wake up on weekends.",
        "wake up later on weekends"],
    ["WeekendSleep", "Weekend sleep duration", "duration",
        "How many hours you sleep on weekends.",
        "sleep longer on weekends"],
    ["SocialJetlag", "Social jetlag", "duration",
        "How much your wake-up time changes between school days and weekends. A bigger number means a bigger change.",
        "have a bigger wake-up time change between school days and weekends"]
];

let comparisonRows = [];

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("sleepComparisonForm");
    if (!form) return;

    form.addEventListener("input", updateDurationPreviews);
    form.addEventListener("submit", showSleepComparison);
    form.elements.phGpa.addEventListener("input", updateGpaConversionPreview);
    loadComparisonDataset();
});

async function loadComparisonDataset() {
    const error = document.getElementById("comparisonError");

    try {
        const response = await fetch("../Js/SleepStudy.csv");
        if (!response.ok) {
            throw new Error(`Unable to load the study dataset (${response.status}).`);
        }

        comparisonRows = prepareComparisonRows(await response.text());
        if (comparisonRows.length === 0) {
            throw new Error("The study dataset has no complete student responses to compare.");
        }
    } catch (cause) {
        console.error("Sleep comparison data could not be loaded.", cause);
        error.textContent =
            "Study data could not be loaded. Please open this page using a local web server and try again.";
        error.hidden = false;
        document.querySelector(".comparison-submit").disabled = true;
    }
}

function prepareComparisonRows(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map(value => value.trim());

    return lines.slice(1).map(line => {
        const values = line.split(",");
        return Object.fromEntries(
            headers.map((header, index) => [header, values[index]?.trim() ?? ""])
        );
    }).filter(row => {
        const isStudentRecord = row.Gender !== "" &&
            Number.isFinite(Number(row.Gender)) &&
            row.ClassYear !== "" &&
            Number.isFinite(Number(row.ClassYear));
        const hasRequiredValues = [
            "GPA",
            "WeekdayBed",
            "WeekdayRise",
            "WeekdaySleep",
            "WeekendBed",
            "WeekendRise",
            "WeekendSleep"
        ].every(column => row[column] !== "" && Number.isFinite(Number(row[column])));
        const isAllNighterOutlier = Number(row.AllNighter) === 219;

        return isStudentRecord && hasRequiredValues && !isAllNighterOutlier;
    }).map(row => {
        const student = Object.fromEntries(
            ["GPA", "WeekdayBed", "WeekdayRise", "WeekdaySleep", "WeekendBed",
                "WeekendRise", "WeekendSleep"].map(column => [column, Number(row[column])])
        );
        student.SocialJetlag = Math.abs(student.WeekendRise - student.WeekdayRise);
        return student;
    });
}

function timeToHours(value, isBedtime = false) {
    const [hours, minutes] = value.split(":").map(Number);
    const clockHours = hours + minutes / 60;
    return isBedtime && clockHours < 12 ? clockHours + 24 : clockHours;
}

function durationBetween(bedtime, riseTime) {
    const difference = (riseTime - bedtime + 24) % 24;
    return difference === 0 ? 24 : difference;
}

function updateDurationPreviews() {
    const formData = new FormData(document.getElementById("sleepComparisonForm"));
    const weekdayBed = formData.get("weekdayBed");
    const weekdayRise = formData.get("weekdayRise");
    const weekendBed = formData.get("weekendBed");
    const weekendRise = formData.get("weekendRise");

    document.getElementById("weekdayDurationPreview").textContent =
        weekdayBed && weekdayRise
            ? formatDuration(durationBetween(
                timeToHours(weekdayBed, true),
                timeToHours(weekdayRise)
            ))
            : "Enter both times";
    document.getElementById("weekendDurationPreview").textContent =
        weekendBed && weekendRise
            ? formatDuration(durationBetween(
                timeToHours(weekendBed, true),
                timeToHours(weekendRise)
            ))
            : "Enter both times";
    document.getElementById("jetlagPreview").textContent =
        weekdayRise && weekendRise
            ? formatDuration(Math.abs(
                timeToHours(weekendRise) - timeToHours(weekdayRise)
            ))
            : "Enter both rise times";
}

function formatDuration(hours) {
    const totalMinutes = Math.round(hours * 60);
    const wholeHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${wholeHours} hr${wholeHours === 1 ? "" : "s"} ${minutes} min`;
}

function formatClock(hours) {
    const totalMinutes = Math.round((hours % 24) * 60);
    const normalizedMinutes = totalMinutes % (24 * 60);
    const hour24 = Math.floor(normalizedMinutes / 60);
    const minute = normalizedMinutes % 60;
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function convertPhilippineGpaToStudyScale(value) {
    return 5 - value;
}

function updateGpaConversionPreview(event) {
    const value = event.currentTarget.value;
    const preview = document.getElementById("gpaConversionPreview");
    preview.textContent = value === ""
        ? ""
        : `Approximate comparison-scale GPA: ${convertPhilippineGpaToStudyScale(Number(value)).toFixed(2)} / 4.00`;
}

// Adds an element once (by id) before or after an anchor, and returns it.
function ensureElement(id, tag, className, anchor, position) {
    let element = document.getElementById(id);
    if (!element) {
        element = document.createElement(tag);
        element.id = id;
        element.className = className;
        anchor[position](element);
    }
    return element;
}

function renderReadingGuide(metricContainer) {
    const guide = ensureElement(
        "comparisonGuide", "p", "comparison-guide", metricContainer, "before"
    );
    guide.replaceChildren();
    const pin = document.createElement("span");
    pin.className = "guide-pin";
    pin.setAttribute("aria-hidden", "true");
    guide.append(
        "How to read the charts: each blue bar is a group of students, and a taller bar means more students. The red line ",
        pin,
        " is you."
    );
}

function renderSharedNote(metricContainer) {
    const note = ensureElement(
        "comparisonSharedNote", "p", "comparison-shared-note", metricContainer, "after"
    );
    note.textContent =
        "Good to know: in this study, sleep habits had only a small connection to GPA. Students with the same habits had very different GPAs, so these results can't tell you what your grades will be.";
}

function showSleepComparison(event) {
    event.preventDefault();
    const error = document.getElementById("comparisonError");
    error.hidden = true;

    if (comparisonRows.length === 0) {
        error.textContent = "Study data is not ready yet. Please try again in a moment.";
        error.hidden = false;
        return;
    }

    const data = new FormData(event.currentTarget);
    const philippineGpa = data.get("phGpa");
    const convertedGpa = philippineGpa === ""
        ? ""
        : convertPhilippineGpaToStudyScale(Number(philippineGpa));
    const weekdayBed = timeToHours(data.get("weekdayBed"), true);
    const weekdayRise = timeToHours(data.get("weekdayRise"));
    const weekendBed = timeToHours(data.get("weekendBed"), true);
    const weekendRise = timeToHours(data.get("weekendRise"));
    const userValues = {
        WeekdayBed: weekdayBed,
        WeekdayRise: weekdayRise,
        WeekdaySleep: durationBetween(weekdayBed, weekdayRise),
        WeekendBed: weekendBed,
        WeekendRise: weekendRise,
        WeekendSleep: durationBetween(weekendBed, weekendRise),
        SocialJetlag: Math.abs(weekendRise - weekdayRise)
    };

    const metricContainer = document.getElementById("comparisonMetrics");
    metricContainer.replaceChildren();
    renderReadingGuide(metricContainer);
    renderSharedNote(metricContainer);

    COMPARISON_COLUMNS.forEach(([column, label, kind, explainer, trend]) => {
        const sample = comparisonRows.map(row => row[column]);
        const stats = getDistributionStats(sample, userValues[column]);
        metricContainer.appendChild(createMetricCard(
            label,
            userValues[column],
            kind,
            stats,
            getCorrelation(sample, comparisonRows.map(row => row.GPA)),
            sample,
            explainer,
            trend
        ));
    });

    document.getElementById("comparisonSampleSize").textContent =
        `Based on responses from ${comparisonRows.length} students`;
    renderGpaBucket(userValues, convertedGpa, philippineGpa);
    document.getElementById("comparisonResults").hidden = false;
    document.getElementById("comparisonResults").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function getDistributionStats(values, userValue) {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const standardDeviation = Math.sqrt(
        values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
    );
    const lowerCount = values.filter(value => value < userValue).length;

    return {
        mean,
        standardDeviation,
        percentile: Math.round(lowerCount / values.length * 100),
        minimum: Math.min(...values),
        maximum: Math.max(...values)
    };
}

function getCorrelation(values, gpas) {
    const meanX = values.reduce((sum, value) => sum + value, 0) / values.length;
    const meanY = gpas.reduce((sum, value) => sum + value, 0) / gpas.length;
    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;

    values.forEach((value, index) => {
        const xDifference = value - meanX;
        const yDifference = gpas[index] - meanY;
        numerator += xDifference * yDifference;
        sumXSquared += xDifference ** 2;
        sumYSquared += yDifference ** 2;
    });

    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    return denominator === 0 ? 0 : numerator / denominator;
}

// Turns a percentile into a plain sentence.
function describePosition(percentile, kind) {
    const isDuration = kind === "duration";
    const lowWord = isDuration ? "shorter" : "earlier";
    const highWord = isDuration ? "longer" : "later";

    if (percentile <= 5) return `${capitalize(lowWord)} than almost everyone`;
    if (percentile >= 95) return `${capitalize(highWord)} than almost everyone`;
    if (percentile >= 45 && percentile <= 55) return "About the same as most students";
    if (percentile > 55) return `${capitalize(highWord)} than ${percentile} out of 100 students`;
    return `${capitalize(lowWord)} than ${100 - percentile} out of 100 students`;
}

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// One short, plain sentence about how this relates to GPA.
function describeGpaLink(correlation, trend) {
    const size = Math.abs(correlation);
    if (size < 0.1) {
        return "This made almost no difference to GPA in this study.";
    }
    const amount = size < 0.3 ? "slightly" : "somewhat";
    const direction = correlation < 0 ? "lower" : "higher";
    return `Students who ${trend} had ${amount} ${direction} GPAs on average. The difference is small, so it can't tell us much about you.`;
}

function createMetricCard(label, userValue, kind, stats, correlation, sample, explainer, trend) {
    const card = document.createElement("article");
    card.className = "metric-result";

    const heading = document.createElement("h4");
    heading.textContent = label;
    card.appendChild(heading);

    const explanation = document.createElement("p");
    explanation.className = "metric-explainer";
    explanation.textContent = explainer;
    card.appendChild(explanation);

    const summary = document.createElement("div");
    summary.className = "metric-summary";
    const result = document.createElement("strong");
    result.textContent = formatMetric(userValue, kind);
    const percentile = document.createElement("span");
    percentile.textContent = describePosition(stats.percentile, kind);
    summary.append(result, percentile);
    card.appendChild(summary);

    const feedback = document.createElement("span");
    feedback.className = "metric-feedback";
    feedback.textContent = getFeedback(userValue - stats.mean, stats.standardDeviation, kind);
    card.appendChild(feedback);
    card.appendChild(createDistributionPlot(sample, userValue, stats, kind, label));

    const disclaimer = document.createElement("p");
    disclaimer.className = "metric-disclaimer";
    disclaimer.textContent = describeGpaLink(correlation, trend);
    card.appendChild(disclaimer);
    return card;
}

function formatMetric(value, kind) {
    if (kind === "bedtime" || kind === "clock") return formatClock(value);
    return formatDuration(value);
}

function getFeedback(difference, standardDeviation, kind) {
    if (standardDeviation === 0 || Math.abs(difference) <= standardDeviation * 0.5) {
        return "Like most students";
    }

    const intensity = Math.abs(difference) <= standardDeviation * 1.5
        ? "A bit"
        : "Much";
    let direction;
    if (kind === "duration") {
        direction = difference < 0 ? "shorter" : "longer";
    } else if (kind === "bedtime" || kind === "clock") {
        direction = difference < 0 ? "earlier" : "later";
    } else {
        direction = difference < 0 ? "lower" : "higher";
    }
    return `${intensity} ${direction} than most students`;
}

function createDistributionPlot(values, userValue, stats, kind, label) {
    const plot = document.createElement("div");
    plot.className = "distribution-plot";
    plot.setAttribute("role", "img");
    plot.setAttribute(
        "aria-label",
        `Chart of how students' ${label.toLowerCase()} is spread out, with your value marked`
    );

    const binCount = 12;
    const bins = Array(binCount).fill(0);
    const range = stats.maximum - stats.minimum || 1;
    values.forEach(value => {
        const index = Math.min(
            binCount - 1,
            Math.floor((value - stats.minimum) / range * binCount)
        );
        bins[index] += 1;
    });
    const maxBin = Math.max(...bins);
    bins.forEach(count => {
        const bar = document.createElement("span");
        bar.className = "distribution-bin";
        bar.style.height = `${Math.max(4, count / maxBin * 64)}px`;
        plot.appendChild(bar);
    });

    const marker = document.createElement("span");
    marker.className = "distribution-marker";
    marker.style.left =
        `${Math.max(0, Math.min(100, (userValue - stats.minimum) / range * 100))}%`;
    plot.appendChild(marker);

    const legend = document.createElement("div");
    legend.className = "distribution-legend";
    const lower = document.createElement("span");
    const upper = document.createElement("span");
    lower.textContent = formatMetric(stats.minimum, kind);
    upper.textContent = formatMetric(stats.maximum, kind);
    legend.append(lower, upper);
    const wrapper = document.createElement("div");
    wrapper.append(plot, legend);
    return wrapper;
}

function renderGpaBucket(userValues, convertedGpa, philippineGpa) {
    const result = document.getElementById("gpaBucketResult");
    result.replaceChildren();

    const durationBucket = Math.round(userValues.WeekdaySleep);
    const jetlagBucket = Math.round(userValues.SocialJetlag);
    let radius = 0;
    let peers = [];
    do {
        peers = comparisonRows.filter(row =>
            Math.abs(Math.round(row.WeekdaySleep) - durationBucket) <= radius &&
            Math.abs(Math.round(row.SocialJetlag) - jetlagBucket) <= radius
        );
        if (peers.length >= 8 || radius >= 3) break;
        radius += 1;
    } while (radius <= 3);

    const averageGpa = peers.reduce((sum, row) => sum + row.GPA, 0) / peers.length;
    const heading = document.createElement("h4");
    heading.textContent = "Average GPA of students who sleep like you";
    result.appendChild(heading);

    const average = document.createElement("strong");
    average.className = "gpa-bucket-average";
    average.textContent = peers.length ? averageGpa.toFixed(2) : "Not available";
    result.appendChild(average);

    const hourWord = value => `hour${value === 1 ? "" : "s"}`;
    const groupDescription = document.createElement("p");
    if (peers.length) {
        const smallGroup = peers.length < 20
            ? " That's a small group, so treat this as a rough guide."
            : "";
        groupDescription.textContent =
            `This is the average GPA of ${peers.length} students who sleep about ${durationBucket} ${hourWord(durationBucket)} on school days and whose wake-up time changes by about ${jetlagBucket} ${hourWord(jetlagBucket)} on weekends.${smallGroup}`;
    } else {
        groupDescription.textContent =
            "No students in the study had a sleep pattern close to yours, so there is no average to show.";
    }
    result.appendChild(groupDescription);

    if (philippineGpa !== "") {
        const personalComparison = document.createElement("p");
        personalComparison.textContent = peers.length
            ? `Your GPA of ${Number(philippineGpa).toFixed(2)} is about ${convertedGpa.toFixed(2)} on a 4.00 scale. It's shown here only so you can compare.`
            : "Your GPA isn't saved, and there was no average to compare it with.";
        result.appendChild(personalComparison);
    }

    const disclaimer = document.createElement("p");
    disclaimer.className = "bucket-disclaimer";
    disclaimer.textContent =
        "This is just an average of other students. It can't tell you what your GPA will be.";
    result.appendChild(disclaimer);
}