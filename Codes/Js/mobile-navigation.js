document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector(".ulo");
    const toggle = header?.querySelector(".nav-toggle");
    const nav = header?.querySelector("nav");
    const dropdownToggle = nav?.querySelector(".nav-dropdown-toggle");
    const dropdownMenu = nav?.querySelector(".nav-submenu");

    if (!header || !toggle || !nav || !dropdownToggle || !dropdownMenu) return;

    const setDropdownOpen = (isOpen) => {
        dropdownToggle.setAttribute("aria-expanded", String(isOpen));
        dropdownMenu.classList.toggle("is-open", isOpen);
    };

    const setMenuOpen = (isOpen) => {
        header.classList.toggle("nav-open", isOpen);
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
        if (!isOpen) setDropdownOpen(false);
    };

    toggle.addEventListener("click", () => {
        setMenuOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    dropdownToggle.addEventListener("click", () => {
        setDropdownOpen(dropdownToggle.getAttribute("aria-expanded") !== "true");
    });

    nav.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => setMenuOpen(false));
    });

    document.addEventListener("click", event => {
        if (!header.contains(event.target)) {
            setMenuOpen(false);
        } else if (!dropdownToggle.contains(event.target) &&
            !dropdownMenu.contains(event.target)) {
            setDropdownOpen(false);
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" &&
            dropdownToggle.getAttribute("aria-expanded") === "true") {
            setDropdownOpen(false);
            dropdownToggle.focus();
        } else if (event.key === "Escape" &&
            toggle.getAttribute("aria-expanded") === "true") {
            setMenuOpen(false);
            toggle.focus();
        }
    });

    window.matchMedia("(min-width: 781px)").addEventListener("change", () => {
        setMenuOpen(false);
    });
});