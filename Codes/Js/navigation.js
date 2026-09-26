document.addEventListener("DOMContentLoaded", () => {
    const navLinks = [...document.querySelectorAll(".ulo nav a")];
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    const setActiveLink = (sectionId) => {
        navLinks.forEach(link => {
            const linkUrl = new URL(link.href, window.location.href);
            const isActive = linkUrl.pathname.split("/").pop() === currentPage &&
                linkUrl.hash === `#${sectionId}`;

            link.classList.toggle("active", isActive);
            if (isActive) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    };

    if (currentPage === "index.html") {
        setActiveLink("home");
    } else {
        const sections = [...document.querySelectorAll("main section, body > section[id]")];
        const updateActiveSection = () => {
            const headerOffset = 100;
            const currentSection = sections.reduce((activeSection, section) => {
                return section.getBoundingClientRect().top <= headerOffset
                    ? section
                    : activeSection;
            }, sections[0]);

            if (currentSection) {
                setActiveLink(currentSection.id);
            }
        };

        updateActiveSection();
        window.addEventListener("scroll", updateActiveSection, { passive: true });
    }

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

    const header = document.querySelector(".ulo");
    let isNavigating = false;
    let navigationTimeout;

    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            isNavigating = true;
            header?.classList.remove("header-hidden");
            clearTimeout(navigationTimeout);
            navigationTimeout = setTimeout(() => {
                isNavigating = false;
            }, 800);
        });
    });

    let lastScrollPosition = window.scrollY;
    let ticking = false;

    window.addEventListener("scroll", () => {
        if (ticking) return;

        window.requestAnimationFrame(() => {
            const currentPosition = window.scrollY;

            if (!isNavigating) {
                if (currentPosition <= 10 ||
                    currentPosition < lastScrollPosition) {
                    header?.classList.remove("header-hidden");
                } else if (currentPosition > lastScrollPosition) {
                    header?.classList.add("header-hidden");
                }
            }

            lastScrollPosition = currentPosition;
            ticking = false;
        });

        ticking = true;
    }, { passive: true });

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

});
