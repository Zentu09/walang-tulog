document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector(".ulo");
    const toggle = header?.querySelector(".nav-toggle");
    const nav = header?.querySelector("nav");

    if (!header || !toggle || !nav) return;

    const setMenuOpen = (isOpen) => {
        header.classList.toggle("nav-open", isOpen);
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    };

    toggle.addEventListener("click", () => {
        setMenuOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    nav.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => setMenuOpen(false));
    });

    document.addEventListener("click", event => {
        if (!header.contains(event.target)) setMenuOpen(false);
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
            setMenuOpen(false);
            toggle.focus();
        }
    });

    window.matchMedia("(min-width: 781px)").addEventListener("change", () => {
        setMenuOpen(false);
    });
});