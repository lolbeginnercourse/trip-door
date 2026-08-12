(() => {
  "use strict";

  document.querySelectorAll("[data-static-back]").forEach(link => {
    link.addEventListener("click", event => {
      if (history.length <= 1) return;
      event.preventDefault();
      history.back();
    });
  });
})();
