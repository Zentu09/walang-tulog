document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("schoolSubmissionForm");
    if (!form) return;

    const submissionIdKey = "sleepStudySubmissionId";
    form.dataset.submissionId =
        sessionStorage.getItem(submissionIdKey) || crypto.randomUUID();
    sessionStorage.setItem(submissionIdKey, form.dataset.submissionId);

    form.addEventListener("submit", submitSchoolResponse);
    loadSchoolSuggestions();
});

async function loadSchoolSuggestions() {
    const schoolList = document.getElementById("schoolSuggestions");

    try {
        const response = await fetch("/api/schools");
        if (!response.ok) {
            throw new Error(`Unable to load school names (${response.status}).`);
        }

        const schools = await response.json();
        schoolList.replaceChildren();
        for (const school of schools) {
            const option = document.createElement("option");
            option.value = school;
            schoolList.append(option);
        }
    } catch (error) {
        console.error("School suggestions could not be loaded.", error);
    }
}

function timeToDatasetHours(time, isBedtime) {
    const timeParts = time.split(":");
    const hours = Number(timeParts[0]);
    const minutes = Number(timeParts[1]);
    const value = hours + minutes / 60;
    return isBedtime && hours < 12 ? value + 24 : value;
}

function calculateSleepDuration(bedtime, riseTime) {
    const duration = (riseTime - bedtime + 24) % 24;
    return duration === 0 ? 24 : duration;
}

function createSchoolSubmission(form) {
    const values = new FormData(form);
    const weekdayBedtime = timeToDatasetHours(values.get("WeekdayBed"), true);
    const weekdayRiseTime = timeToDatasetHours(values.get("WeekdayRise"), false);
    const weekendBedtime = timeToDatasetHours(values.get("WeekendBed"), true);
    const weekendRiseTime = timeToDatasetHours(values.get("WeekendRise"), false);

    return {
        SubmissionId: form.dataset.submissionId,
        School: String(values.get("school")),
        GPA: 5 - Number(values.get("PhilippineGpa")),
        WeekdayBed: weekdayBedtime,
        WeekdayRise: weekdayRiseTime,
        WeekdaySleep: calculateSleepDuration(weekdayBedtime, weekdayRiseTime),
        WeekendBed: weekendBedtime,
        WeekendRise: weekendRiseTime,
        WeekendSleep: calculateSleepDuration(weekendBedtime, weekendRiseTime),
        PoorSleepQuality: Number(values.get("PoorSleepQuality")),
        LarkOwl: values.get("LarkOwl"),
        Consent: values.get("consent") === "on"
    };
}

async function submitSchoolResponse(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const message = document.getElementById("submissionMessage");
    const button = form.querySelector('button[type="submit"]');

    message.textContent = "";
    message.removeAttribute("data-state");
    button.disabled = true;

    try {
        const response = await fetch("/api/submissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createSchoolSubmission(form))
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `Submission failed (${response.status}).`);
        }

        form.reset();
        form.dataset.submissionId = crypto.randomUUID();
        sessionStorage.setItem("sleepStudySubmissionId", form.dataset.submissionId);
        message.dataset.state = "success";
        if (result.alreadySubmitted) {
            message.textContent = `This response was already saved for ${result.school}.`;
        } else {
            message.textContent = `Your response was saved for ${result.school}.`;
        }
        await loadSchoolSuggestions();
        window.dispatchEvent(new Event("school-submission-saved"));
    } catch (error) {
        console.error("Student response could not be saved.", error);
        message.dataset.state = "error";
        if (error instanceof TypeError) {
            message.textContent =
                "Could not reach the submission server. Run npm start and open " +
                "http://127.0.0.1:3000 before submitting.";
        } else {
            message.textContent =
                `${error.message} The response was not confirmed as saved.`;
        }
    } finally {
        button.disabled = false;
    }
}
