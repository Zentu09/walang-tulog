let latestSchoolSearchSequence = 0;
let approvedSchoolNamesPromise;

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("schoolSubmissionForm");
    if (!form) return;

    const schoolInput = document.getElementById("schoolName");
    const schoolValidation = document.getElementById("schoolNameValidation");
    let searchTimer;
    schoolInput.addEventListener("input", () => {
        window.clearTimeout(searchTimer);
        const sequence = ++latestSchoolSearchSequence;
        schoolInput.setCustomValidity("Checking the approved school list.");
        searchTimer = window.setTimeout(() => {
            loadSchoolSuggestions(schoolInput, schoolValidation, sequence);
        }, 200);
    });

    const submissionIdKey = "sleepStudySubmissionId";
    form.dataset.submissionId =
        sessionStorage.getItem(submissionIdKey) || crypto.randomUUID();
    sessionStorage.setItem(submissionIdKey, form.dataset.submissionId);

    form.addEventListener("submit", submitSchoolResponse);
    loadSchoolSuggestions(
        schoolInput,
        schoolValidation,
        ++latestSchoolSearchSequence
    );
});

async function loadSchoolSuggestions(input, message, sequence) {
    const schoolList = document.getElementById("schoolSuggestions");

    try {
        const query = input.value.normalize("NFC").trim().replace(/\s+/gu, " ");
        approvedSchoolNamesPromise ||= fetch("/Codes/Js/approved-schools.json")
            .then(response => {
                if (!response.ok) {
                    throw new Error(
                        `The approved school list could not be loaded (${response.status}).`
                    );
                }
                return response.json();
            })
            .then(schools => {
                if (!Array.isArray(schools) ||
                    !schools.every(school => typeof school === "string")) {
                    throw new Error("The approved school list has an invalid format.");
                }
                return schools;
            })
            .catch(error => {
                approvedSchoolNamesPromise = null;
                throw error;
            });
        const schools = await approvedSchoolNamesPromise;
        if (sequence !== latestSchoolSearchSequence) return;

        const normalizedQuery = query.toLocaleLowerCase("en-US");
        const exactSchool = schools.find(
            school => school.toLocaleLowerCase("en-US") === normalizedQuery
        );
        const matches = !query
            ? ["St. Lawrence University"]
            : schools.filter(
                school => school.toLocaleLowerCase("en-US").startsWith(normalizedQuery)
            ).slice(0, 50);
        if (matches.length < 50 && query) {
            for (const school of schools) {
                const key = school.toLocaleLowerCase("en-US");
                if (key.includes(normalizedQuery) && !key.startsWith(normalizedQuery) &&
                    !matches.includes(school)) {
                    matches.push(school);
                }
                if (matches.length === 50) break;
            }
        }

        schoolList.replaceChildren();
        for (const school of matches) {
            const option = document.createElement("option");
            option.value = school;
            schoolList.append(option);
        }

        if (!query) {
            input.setCustomValidity("");
            message.textContent = "Type your school's name to search the approved list.";
            message.dataset.state = "";
        } else if (exactSchool) {
            input.setCustomValidity("");
            message.textContent = "This school is on the approved list.";
            message.dataset.state = "success";
        } else if (matches.length > 0) {
            input.setCustomValidity(
                "Choose the complete approved school name from the suggestions."
            );
            message.textContent = "Choose the complete school name from the suggestions.";
            message.dataset.state = "";
        } else {
            input.setCustomValidity(
                "This school is not on the approved list. Check the spelling or contact the study team."
            );
            message.textContent =
                "No approved school matches. Check the spelling or contact the study team.";
            message.dataset.state = "error";
        }
    } catch (error) {
        console.error("School suggestions could not be loaded.", error);
        if (sequence !== latestSchoolSearchSequence) return;
        input.setCustomValidity(
            "The approved school list is unavailable. Refresh the page or contact the study team."
        );
        message.textContent =
            `The approved school list could not be loaded. Refresh the page and try again. ${error.message}`;
        message.dataset.state = "error";
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
        Consent: values.get("consent") === "on",
        SchoolConfirmed: values.get("schoolConfirmed") === "on"
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
        document.getElementById("schoolName").setCustomValidity("");
        form.dataset.submissionId = crypto.randomUUID();
        sessionStorage.setItem("sleepStudySubmissionId", form.dataset.submissionId);
        message.dataset.state = "success";
        if (result.alreadySubmitted) {
            message.textContent = `This response was already saved for ${result.school}.`;
        } else {
            message.textContent = `Your response was saved for ${result.school}.`;
        }
        await loadSchoolSuggestions(
            document.getElementById("schoolName"),
            document.getElementById("schoolNameValidation"),
            ++latestSchoolSearchSequence
        );
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
