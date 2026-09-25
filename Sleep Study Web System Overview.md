# Sleep Study Web System Overview

## 1. Purpose of the system

This web system is a static, data-driven informational website designed to study the relationship between students' sleep habits and academic performance. Its goal is to help users understand how patterns such as bedtime, wake time, sleep duration, poor sleep quality, and chronotype might influence GPA and overall academic outcomes.

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

The graph updates dynamically based on the selected habit and displays the computed relationship to GPA.

## 4. Technologies used

The website is a frontend-only application built with:
- HTML for structure
- CSS for styling and layout
- JavaScript for interactivity and data processing
- Chart.js for graphs and trend visualization
- Font Awesome icons for UI elements

The project does not use a backend database or server-side processing. Instead, it loads a CSV file locally in the browser and performs all calculations on the client side.

## 5. Data flow in the system

The system follows a simple workflow:

1. The page loads.
2. The JavaScript checks whether the sleep habit selector exists.
3. It fetches the CSV file from the local project folder.
4. The CSV is parsed into rows and normalized.
5. The rows are cleaned and transformed.
6. GPA charts are generated.
7. Scatter plots are generated based on the selected sleep variable.
8. Correlation values are computed and displayed.

Important logic is handled in the JavaScript files:
- `Codes/Js/data.js` parses and cleans the CSV.
- `Codes/Js/performance.js` generates the GPA charts and summary metrics.
- `Codes/Js/findings.js` generates the scatter plots and computes correlation strength.
- `Codes/Template/index.html` and `Codes/Template/study.html` provide the page structure and content.

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

The platform’s own findings section states that the sleep timing variables had only weak relationships with GPA. In the dataset used by the project:

- Weekday rise time showed the strongest negative correlation with GPA at approximately -0.21.
- Other variables ranged from around -0.02 to -0.17.
- This suggests that sleep timing alone is not strongly predictive of academic performance.
- The website concludes that study habits, stress, workload, and other personal factors may matter more than sleep timing alone.

This conclusion is designed to promote balanced analysis rather than oversimplifying the relationship between sleep and grades.

## 8. Report summary

### Overall assessment
This project is a well-structured academic dashboard that turns student sleep data into visual insight. It successfully combines educational content, visual analytics, and interpretation in one static website.

### Strengths
- Clear and user-friendly design
- Strong educational framing
- Easy-to-understand charts and summaries
- Functional correlation analysis
- Insightful interpretation of data

### Limitations
- It is a front-end-only application with no backend or actual user login/system database.
- It relies on a static CSV dataset rather than live survey data.
- Correlation does not prove causation; it only suggests relationships.

### Final conclusion
The system effectively demonstrates the idea that students' sleep habits and academic performance can be explored through data visualization and statistical interpretation. It is useful as an academic project, awareness tool, and research communication platform.

## 9. Short project summary

This web system acts as a digital sleep-study dashboard for students and researchers. It educates users about sleep habits, analyzes GPA trends, and visualizes how sleep-related variables may relate to academic performance. The project turns raw survey data into an interactive website that is both informative and easy to explore.
