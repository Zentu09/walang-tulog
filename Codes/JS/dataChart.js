const csvInput = document.getElementById('csvInput');
const dropZone = document.getElementById('dropZone');
const fileNameEl = document.getElementById('fileName');
const controls = document.getElementById('controls');
const labelSelect = document.getElementById('labelCol');
const valueSelect = document.getElementById('valueCol');
const chartWrap = document.getElementById('chartWrap');
const errorMsg = document.getElementById('errorMsg');
const canvas = document.getElementById('chartCanvas');

let parsedRows = [];
let columns = [];
let chartInstance = null;

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = msg ? 'block' : 'none';
}

function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showError('Please choose a .csv file.');
        return;
    }
    showError('');
    fileNameEl.textContent = file.name;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: function (results) {
            if (!results.data.length) {
                showError('That CSV looks empty.');
                return;
            }
            parsedRows = results.data;
            columns = results.meta.fields || Object.keys(results.data[0]);
            populateColumnSelectors();
            controls.style.display = 'flex';
            drawChart();
        },
        error: function (err) {
            showError('Could not parse this file: ' + err.message);
        }
    });
}

function populateColumnSelectors() {
    labelSelect.innerHTML = '';
    valueSelect.innerHTML = '';
    columns.forEach(function (col) {
        const opt1 = document.createElement('option');
        opt1.value = col;
        opt1.textContent = col;
        labelSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = col;
        opt2.textContent = col;
        valueSelect.appendChild(opt2);
    });

    const numericCol = columns.find(function (col) {
        return parsedRows.some(function (row) { return typeof row[col] === 'number'; });
    });
    const textCol = columns.find(function (col) { return col !== numericCol; });

    if (textCol) labelSelect.value = textCol;
    if (numericCol) valueSelect.value = numericCol;
}

function drawChart() {
    const labelCol = labelSelect.value;
    const valueCol = valueSelect.value;
    if (!labelCol || !valueCol) return;

    const labels = parsedRows.map(function (row) { return row[labelCol]; });
    const values = parsedRows.map(function (row) {
        const v = row[valueCol];
        return typeof v === 'number' ? v : parseFloat(v) || 0;
    });

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: valueCol,
                data: values,
                backgroundColor: '#071D5E',
                borderRadius: 4,
                maxBarThickness: 48
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    chartWrap.style.display = 'block';
}

csvInput.addEventListener('change', function (e) {
    handleFile(e.target.files[0]);
});

labelSelect.addEventListener('change', drawChart);
valueSelect.addEventListener('change', drawChart);

['dragover', 'dragenter'].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropZone.classList.add('drag');
    });
});
['dragleave', 'drop'].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropZone.classList.remove('drag');
    });
});
dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFile(file);
});