(() => {
  "use strict";

  const STYLE_URL = "assets/css/finder-tree.css?v=20260806-1";

  function loadStyle() {
    if (document.querySelector('link[data-finder-tree-style]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLE_URL;
    link.dataset.finderTreeStyle = "";
    document.head.append(link);
  }

  function enhance(select) {
    if (!select || select.dataset.treeEnhanced === "true") return;

    const field = select.closest("label");
    if (!field) return;

    select.dataset.treeEnhanced = "true";
    select.classList.add("destination-native-select");

    const root = document.createElement("div");
    root.className = "destination-tree";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "destination-tree__trigger";
    trigger.setAttribute("aria-haspopup", "tree");
    trigger.setAttribute("aria-expanded", "false");

    const triggerText = document.createElement("span");
    triggerText.className = "destination-tree__trigger-text";

    const triggerIcon = document.createElement("span");
    triggerIcon.className = "destination-tree__trigger-icon";
    triggerIcon.setAttribute("aria-hidden", "true");
    triggerIcon.textContent = "⌄";

    trigger.append(triggerText, triggerIcon);

    const panel = document.createElement("div");
    panel.className = "destination-tree__panel";
    panel.hidden = true;
    panel.setAttribute("role", "tree");
    panel.setAttribute("aria-label", "都道府県と会場を選択");

    root.append(trigger, panel);
    select.insertAdjacentElement("afterend", root);

    let keepOpen = false;
    let renderTimer = 0;

    const isOpen = () => !panel.hidden;

    const setOpen = open => {
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      root.classList.toggle("is-open", open);
      triggerIcon.textContent = open ? "⌃" : "⌄";
      if (open) render();
    };

    const currentLabel = () => {
      const option = select.selectedOptions[0];
      if (option && option.value !== "all" && option.value !== "__back__" && !option.value.startsWith("__prefecture__:")) {
        const prefecture = select.dataset.prefecture;
        return prefecture ? `${prefecture}｜${option.textContent.trim()}` : option.textContent.trim();
      }
      if (select.dataset.selectionMode === "venue" && select.dataset.prefecture) {
        return `${select.dataset.prefecture}の会場を選択してください`;
      }
      return "都道府県を選択してください";
    };

    const updateTrigger = () => {
      triggerText.textContent = currentLabel();
      trigger.disabled = select.disabled;
    };

    const makeTreeButton = ({ text, className, value, expanded, level = 1 }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.dataset.value = value;
      button.setAttribute("role", "treeitem");
      button.setAttribute("aria-level", String(level));
      if (expanded !== undefined) button.setAttribute("aria-expanded", String(expanded));
      button.textContent = text;
      return button;
    };

    const renderPrefectures = () => {
      const fragment = document.createDocumentFragment();
      const groups = [...select.children].filter(node => node.tagName === "OPTGROUP");

      if (groups.length) {
        groups.forEach(group => {
          const heading = document.createElement("p");
          heading.className = "destination-tree__group-label";
          heading.textContent = group.label;
          fragment.append(heading);

          [...group.children].forEach(option => {
            fragment.append(makeTreeButton({
              text: option.textContent.trim(),
              className: "destination-tree__prefecture",
              value: option.value,
              expanded: false
            }));
          });
        });
      } else {
        [...select.options]
          .filter(option => option.value.startsWith("__prefecture__:"))
          .forEach(option => {
            fragment.append(makeTreeButton({
              text: option.textContent.trim(),
              className: "destination-tree__prefecture",
              value: option.value,
              expanded: false
            }));
          });
      }

      if (!fragment.childNodes.length) {
        const empty = document.createElement("p");
        empty.className = "destination-tree__empty";
        empty.textContent = "選択できる都道府県がありません";
        fragment.append(empty);
      }

      panel.replaceChildren(fragment);
    };

    const renderVenues = () => {
      const prefecture = select.dataset.prefecture || "選択中の都道府県";
      const fragment = document.createDocumentFragment();

      const branch = document.createElement("div");
      branch.className = "destination-tree__branch";
      branch.setAttribute("role", "group");

      const branchButton = makeTreeButton({
        text: prefecture,
        className: "destination-tree__prefecture is-expanded",
        value: "__back__",
        expanded: true
      });
      branchButton.setAttribute("aria-label", `${prefecture}を閉じて都道府県一覧へ戻る`);
      branch.append(branchButton);

      const venueList = document.createElement("div");
      venueList.className = "destination-tree__venues";
      venueList.setAttribute("role", "group");

      [...select.options]
        .filter(option => option.value && option.value !== "all" && option.value !== "__back__" && !option.value.startsWith("__"))
        .forEach(option => {
          const button = makeTreeButton({
            text: option.textContent.trim(),
            className: "destination-tree__venue",
            value: option.value,
            level: 2
          });
          if (option.value === select.value) button.setAttribute("aria-current", "true");
          venueList.append(button);
        });

      if (!venueList.children.length) {
        const empty = document.createElement("p");
        empty.className = "destination-tree__empty";
        empty.textContent = "この都道府県に選択できる会場がありません";
        venueList.append(empty);
      }

      branch.append(venueList);
      fragment.append(branch);
      panel.replaceChildren(fragment);
    };

    function render() {
      window.clearTimeout(renderTimer);
      updateTrigger();
      if (!isOpen()) return;
      if (select.dataset.selectionMode === "venue") renderVenues();
      else renderPrefectures();
    }

    const scheduleRender = (delay = 0) => {
      window.clearTimeout(renderTimer);
      renderTimer = window.setTimeout(() => {
        render();
        if (keepOpen) setOpen(true);
      }, delay);
    };

    trigger.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setOpen(!isOpen());
    });

    panel.addEventListener("click", event => {
      const button = event.target.closest("button[data-value]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();

      const value = button.dataset.value;
      if (!value) return;

      if (value.startsWith("__prefecture__:") || value === "__back__") {
        keepOpen = true;
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        scheduleRender(10);
        window.setTimeout(() => { keepOpen = false; }, 100);
        return;
      }

      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      updateTrigger();
      setOpen(false);
      trigger.focus();
    });

    document.addEventListener("click", event => {
      if (!root.contains(event.target)) setOpen(false);
    });

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape" || !isOpen()) return;
      setOpen(false);
      trigger.focus();
    });

    select.addEventListener("focus", () => trigger.focus());
    select.addEventListener("change", () => scheduleRender(0));

    const observer = new MutationObserver(() => scheduleRender(0));
    observer.observe(select, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "data-selection-mode", "data-prefecture"]
    });

    updateTrigger();
  }

  function boot() {
    loadStyle();
    const select = document.querySelector("[data-area-select]");
    if (select && (select.dataset.selectionMode || document.querySelector('[data-search-form][data-single-select-installed="true"]'))) {
      enhance(select);
      return true;
    }
    return false;
  }

  if (!boot()) {
    const observer = new MutationObserver(() => {
      if (!boot()) return;
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  }
})();
