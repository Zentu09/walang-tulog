// Vercel serverless entry: every /api/* request is handled by the same code as server.js.
const { handleRequest, prepare } = require("../server");

module.exports = async (request, response) => {
    try {
        await prepare();
        await handleRequest(request, response);
    } catch (error) {
        console.error("API request failed.", error);
        if (!response.headersSent) {
            response.statusCode = 500;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify({ error: "The request could not be completed." }));
        }
    }
};
