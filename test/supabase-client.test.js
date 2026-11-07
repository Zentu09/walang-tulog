const assert = require("node:assert/strict");
const { test } = require("node:test");

test("Supabase submissions are read across all range pages", async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const previousFetch = global.fetch;
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

    const rows = Array.from({ length: 1050 }, (_, index) => ({
        submission_id: `submission-${index}`,
        school: "Example School",
        gpa: 3,
        weekday_bed: 24,
        weekday_rise: 8,
        weekday_sleep: 8,
        weekend_bed: 24,
        weekend_rise: 8,
        weekend_sleep: 8,
        poor_sleep_quality: 5,
        lark_owl: "Neither",
        social_jetlag: 0
    }));
    const requestedRanges = [];

    global.fetch = async (url, options) => {
        const range = options.headers.Range;
        requestedRanges.push(range);
        const [start, end] = range.split("-").map(Number);
        const page = rows.slice(start, end + 1);
        const actualEnd = start + page.length - 1;
        return new Response(JSON.stringify(page), {
            status: 206,
            headers: { "content-range": `${start}-${actualEnd}/${rows.length}` }
        });
    };

    try {
        const clientPath = require.resolve("../supabase/client");
        delete require.cache[clientPath];
        const { readSubmissions } = require("../supabase/client");

        const submissions = await readSubmissions();

        assert.deepEqual(requestedRanges, ["0-999", "1000-1999"]);
        assert.equal(submissions.length, 1050);
        assert.equal(submissions[1049].School, "Example School");
    } finally {
        global.fetch = previousFetch;
        if (previousUrl === undefined) delete process.env.SUPABASE_URL;
        else process.env.SUPABASE_URL = previousUrl;
        if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
        delete require.cache[require.resolve("../supabase/client")];
    }
});
