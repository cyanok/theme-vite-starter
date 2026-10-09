import "../css/main.css";
import "./navigation";

document
  .querySelectorAll(
    ".article-content table, .article-content iframe, .article-content object, .article-content embed",
  )
  .forEach((element) => {
    if (element.closest(".article-content-scroll")) {
      return;
    }

    const container = document.createElement("div");
    container.className = "article-content-scroll";
    container.tabIndex = 0;
    container.setAttribute("role", "region");
    const label =
      document.documentElement.dataset[
        element.tagName === "TABLE" ? "scrollTableLabel" : "scrollEmbedLabel"
      ];
    if (label) container.setAttribute("aria-label", label);
    element.before(container);
    container.append(element);
  });
