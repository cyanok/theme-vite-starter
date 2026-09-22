import "../css/main.css";

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
    container.setAttribute(
      "aria-label",
      element.tagName === "TABLE" ? "Scrollable table" : "Scrollable embedded content",
    );
    element.before(container);
    container.append(element);
  });
