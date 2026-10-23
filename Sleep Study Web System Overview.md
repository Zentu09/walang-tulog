# Sleep Study Web System Overview

## 1. Purpose of the system

This web system is a data-driven informational website designed to study the relationship between students' sleep habits and academic performance. Its goal is to help users understand how patterns such as bedtime, wake time, sleep duration, poor sleep quality, and chronotype might influence GPA and overall academic outcomes.

The project is built around a dataset of student responses and presents the results through a clean dashboard style interface, charts, and explanatory text.

## 2. What the whole web system does

The system does four main things:

1. Presents the study background and research goals.
   - Explains why sleep matters for students.
   - Describes the research problem, objectives, and importance of the study.

2. Shows sleep habit statistics.
   - Displays average sleep duration, common bedtime, common wake-up time, and other wellness indicators.
   - Summarizes patterns such as poor sleep quality and alcohol use.

3. Visualizes academic performance.
   - Computes the average GPA.
   - Groups students into performance ranges such as Excellent, Good, Average, and Poor.
   - Displays bar and doughnut charts for academic performance distribution.

4. Analyzes the relationship between sleep habits and GPA.
   - Lets the user choose a sleep habit from a dropdown.
   - Produces a scatter plot comparing the selected sleep variable against GPA.
   - Calculates the Pearson correlation coefficient (r).
   - Shows whether the relationship is weak, moderate, or strong.
   - Handles chronotype as a category-based comparison instead of a numeric correlation.

## 3. Main pages and sections

### Home page
The homepage introduces the research theme: "How does Sleep Affect Academic Performance?" It acts as the landing page and gives users access to the study and results.

### About Study page
This section explains:
- research background
- objectives
- research gap
- importance of the study

It frames the project as a student-focused sleep and academic performance investigation.

### Sleep Habits section
This section presents summary cards such as:
- average sleep duration
- average bedtime
- average wake-up time
- poor sleep quality score
- alcohol use category
- chronotype information

### Academic Performance section
This area shows:
- GPA range distribution
- overall performance pie chart
- average GPA value
- descriptive interpretation for the student results

### Findings section
This is the main analytical section. It uses a dropdown to select variables such as:
- Weekday Bedtime
- Weekday Rise Time
- Weekday Sleep Duration
- Weekend Bedtime
- Weekend Rise Time
- Weekend Sleep Duration
- Poor Sleep Quality
- Social Jetlag
- Chronotype (Lark/Owl/Neither)

The school-level chart uses the selected school's valid submissions and selected
sleep measure. It displays a correlation only after the project team sets an
approved minimum response count and the data passes the validity checks. The
original study summary remains based on the existing dataset.

## 4. Technologies used

The website uses:
- HTML for structure
- CSS for styling and layout
- JavaScript for interactivity and data processing
- Chart.js for graphs and trend visualization
- Font Awesome icons for UI elements
- Node.js built-in modules for the submission server
- ExcelJS for creating the submission workbook

The performance charts and Compare Sleep feature load the original CSV in the
browser. New form responses are saved in `data/SchoolSubmissions.xlsx`. The
Findings chart gets submissions for one selected school from the Node.js server.
The original `Codes/Js/SleepStudy.csv` and Compare Sleep workflow stay unchanged.

## 5. Data flow in the system

The system follows a simple workflow:

1. The page loads.
2. The existing performance charts fetch and parse the original CSV.
3. New submissions for the selected school are loaded from the server.
4. The selected sleep measure and GPA are checked for valid numerical values.
5. A school-level chart and correlation are shown only when enough valid
   responses meet the configured minimum.

The submission workflow is separate: the form sends its response to the local
Node.js server, which checks required fields, normalizes the school name, avoids
retry duplicates, and adds the response as a new row in the Excel workbook. If
the workbook does not exist yet, existing submission rows from
`data/SchoolSubmissions.csv` are copied into it. The CSV file is kept unchanged.

Important logic is handled in the JavaScript files:
- `Codes/Js/data.js` parses and cleans the CSV.
- `Codes/Js/performance.js` generates the GPA charts and summary metrics.
- `Codes/Js/findings.js` checks the selected school's submission data, enforces
  the minimum valid-response count, and generates the chart and correlation.
- `server.js` returns only the analysis fields for the selected school.
- `data/SchoolSubmissions.xlsx` stores new submissions in one worksheet, with
  one response per row.
- `Codes/Template/index.html` and `Codes/Template/study.html` provide the page structure and content.

To view submitted data, stop the server with Ctrl+C and open
`data/SchoolSubmissions.xlsx` in Excel. Close the workbook before starting the
server again so the server can save new responses.

## 6. How the data is analyzed

The site uses the GPA as the main academic outcome. It compares GPA with different sleep-related measurements:

- bedtime
- wake time
- sleep length
- poor sleep quality
- social jetlag
- chronotype

The relationship is measured using Pearson's correlation coefficient:
- close to 0 = weak/no strong linear relationship
- negative values indicate that higher values in the sleep metric are associated with lower GPA
- positive values indicate the opposite

For chronotype, the system switches to a bar chart comparing average GPA by group rather than calculating a Pearson coefficient because that variable is categorical.

## 7. Key findings reflected in the system

The original dataset summary in the website states that the sleep timing
variables had only weak relationships with GPA. It remains separate from the
new school-level analysis:

- Weekday rise time showed the strongest negative correlation with GPA at approximately -0.21.
- Other variables ranged from around -0.02 to -0.17.
- This suggests that sleep timing alone is not strongly predictive of academic performance.
- The website concludes that study habits, stress, workload, and other personal factors may matter more than sleep timing alone.

This conclusion is designed to promote balanced analysis rather than oversimplifying the relationship between sleep and grades.

### School-level data sufficiency

`Codes/Js/findings.js` contains the setting
`MINIMUM_VALID_RESPONSES_PER_SCHOOL`. It is currently `null` because the project
team has not confirmed a threshold from its research methodology. While unset,
the page reports the valid response count but does not display a school-level
chart. Once the project leader confirms the minimum, set this value to that
positive whole-number threshold. For each selected sleep measure, only records
with a valid GPA and a valid value for that measure are counted. Chronotype
comparisons also require at least two valid groups. Missing, non-numeric,
out-of-range, and non-varying data are not used to generate a misleading chart.

## 8. Report summary

### Overall assessment
This project is a well-structured academic dashboard that turns student sleep data into visual insight. It combines educational content, visual analytics, data collection, and interpretation.

### Strengths
- Clear and user-friendly design
- Strong educational framing
- Easy-to-understand charts and summaries
- Functional correlation analysis
- Insightful interpretation of data

### Limitations
- Submissions are stored in a local Excel workbook; this is not a hosted database.
- The submission server listens on the local computer and must be hosted or configured on an approved network for students on other devices.
- The original performance summary and Compare Sleep feature still use the
  static study CSV.
- Correlation does not prove causation; it only suggests relationships.

### Final conclusion
The system effectively demonstrates the idea that students' sleep habits and academic performance can be explored through data visualization and statistical interpretation. It is useful as an academic project, awareness tool, and research communication platform.

## 9. Short project summary

This web system acts as a digital sleep-study dashboard for students and researchers. It educates users about sleep habits, analyzes GPA trends, and visualizes how sleep-related variables may relate to academic performance. The project turns raw survey data into an interactive website that is both informative and easy to explore.
