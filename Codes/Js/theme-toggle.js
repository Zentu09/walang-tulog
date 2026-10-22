document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.querySelector(".theme-toggle");

    if (!toggle) return;

    const icon = toggle.querySelector("i");
    const label = toggle.querySelector("span");
    const setTheme = (isDark) => {
        document.documentElement.dataset.theme = isDark ? "dark" : "light";
        toggle.setAttribute(
            "aria-label",
            isDark ? "Switch to light mode" : "Switch to dark mode"
        );

        if (icon) {
            icon.classList.toggle("fa-moon", isDark);
            icon.classList.toggle("fa-sun", !isDark);
        }

        if (label) label.textContent = isDark ? "Night Owl" : "Morning Lark";
        window.dispatchEvent(new Event("sleep-study-theme-change"));
    };

    setTheme(localStorage.getItem("sleep-study-theme") === "dark");

    toggle.addEventListener("click", () => {
        const isDark = document.documentElement.dataset.theme !== "dark";
        setTheme(isDark);
        localStorage.setItem("sleep-study-theme", isDark ? "dark" : "light");
    });
});
