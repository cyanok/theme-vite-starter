export {};

const navigation = document.querySelector<HTMLElement>(".site-nav");

if (navigation) {
  navigation.classList.add("has-dropdowns");

  const positionMenus = () => {
    navigation
      .querySelectorAll<HTMLElement>(":scope > ul > li > details[open] > ul")
      .forEach((panel) => {
        panel.style.removeProperty("--menu-offset");
        if (getComputedStyle(panel).position !== "absolute") return;
        const bounds = panel.getBoundingClientRect();
        const availableWidth = document.documentElement.clientWidth;
        const offset =
          Math.max(0, 16 - bounds.left) - Math.max(0, bounds.right - availableWidth + 16);
        panel.style.setProperty("--menu-offset", `${offset}px`);
      });
  };

  navigation.addEventListener("toggle", positionMenus, true);
  window.addEventListener("resize", positionMenus);

  const closeMenus = () => {
    navigation.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((menu) => {
      menu.open = false;
    });
  };

  navigation.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !(event.target instanceof Element)) return;
    const menu = event.target.closest<HTMLDetailsElement>("details[open]");
    if (!menu) return;
    event.preventDefault();
    menu.open = false;
    menu.querySelector<HTMLElement>(":scope > summary")?.focus();
  });

  navigation.addEventListener("focusout", (event) => {
    if (event.relatedTarget instanceof Node && !navigation.contains(event.relatedTarget)) {
      closeMenus();
    }
  });

  document.addEventListener("click", (event) => {
    if (event.target instanceof Node && !navigation.contains(event.target)) closeMenus();
  });
}
