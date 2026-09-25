document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("exploreButton")?.addEventListener("click", () => {
        document.getElementById("about-study")?.scrollIntoView({
            behavior: "smooth"
        });
    });

    document.getElementById("resultsButton")?.addEventListener("click", () => {
        document.getElementById("performance")?.scrollIntoView({
            behavior: "smooth"
        });
    });

    const animatedElements = document.querySelectorAll(
        "section:not(.header-section), .card, .chart-card, .average-grade, .conclusion-section"
    );

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            entry.target.classList.toggle(
                "show-section",
                entry.isIntersecting
            );
        });
    }, { threshold: 0.12 });

    animatedElements.forEach(element => {
        element.classList.add("fade-section");
        observer.observe(element);
    });

    let lastScrollPosition = window.scrollY;
    let ticking = false;
    const header = document.querySelector(".ulo");

    window.addEventListener("scroll", () => {
        if (ticking) return;

        window.requestAnimationFrame(() => {
            const currentPosition = window.scrollY;

            if (currentPosition <= 10 ||
                currentPosition < lastScrollPosition) {
                header?.classList.remove("header-hidden");
            } else if (currentPosition > lastScrollPosition) {
                header?.classList.add("header-hidden");
            }

            lastScrollPosition = currentPosition;
            ticking = false;
        });

        ticking = true;
    }, { passive: true });
});
