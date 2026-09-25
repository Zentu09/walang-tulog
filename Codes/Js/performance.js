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
                    "#8fc4ff",
                    "#4f91e8",
                    "#13589c",
                    "#0f2967"
                ],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
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
                    "#8fc4ff",
                    "#4f91e8",
                    "#13589c",
                    "#0f2967"
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: false },
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
