(() => {
  "use strict";

  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "assets/css/top-refresh.css?v=20260806-1";
  document.head.append(style);

  const stageIcon = `
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M9 16c7 0 13-2 18-6v23c0 11-7 19-18 22C-2 52-9 44-9 33V10c5 4 11 6 18 6Z" transform="translate(16 0)" />
      <path d="M18 27c2-2 4-3 6-3M36 24c2 0 4 1 6 3M21 39c5 4 11 4 16 0" />
      <path d="M37 13c6 1 12 0 18-3v22c0 9-5 16-13 20M42 25c2-1 4-1 6 0M45 36c3 2 6 2 9 0" />
    </svg>`;

  const gameIcon = `
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M20 23h24c7 0 12 5 14 12l3 11c1 5-4 9-8 6l-9-7H20l-9 7c-4 3-9-1-8-6l3-11c2-7 7-12 14-12Z" />
      <path d="M19 31v10M14 36h10M42 33h.1M49 39h.1M27 23l3-7h8l3 7" />
    </svg>`;

  function updateCards() {
    const stage = document.querySelector('[data-select-category="stage"]');
    const esports = document.querySelector('[data-select-category="esports"]');

    if (stage) {
      const title = stage.querySelector("strong");
      const action = stage.querySelector(".category-card__action");
      const visual = stage.querySelector(".category-card__visual");
      if (title) title.textContent = "舞台・2.5次元のホテルを探す";
      if (action) action.innerHTML = 'ホテルを探す <b aria-hidden="true">→</b>';
      if (visual) visual.innerHTML = stageIcon;
    }

    if (esports) {
      const title = esports.querySelector("strong");
      const action = esports.querySelector(".category-card__action");
      const visual = esports.querySelector(".category-card__visual");
      if (title) title.textContent = "ゲームイベントのホテルを探す";
      if (action) action.innerHTML = 'ホテルを探す <b aria-hidden="true">→</b>';
      if (visual) visual.innerHTML = gameIcon;
    }
  }

  function addBenefits() {
    const cards = document.querySelector("[data-category-cards]");
    if (!cards || document.querySelector(".benefit-strip")) return;

    const strip = document.createElement("div");
    strip.className = "benefit-strip";
    strip.setAttribute("aria-label", "ホテル検索の特徴");
    strip.innerHTML = `
      <div class="benefit-item">
        <span class="benefit-icon" aria-hidden="true">近</span>
        <div><strong>会場に近いホテルが見つかる</strong><p>徒歩・最寄り駅・乗換えなどから検索できます</p></div>
      </div>
      <div class="benefit-item">
        <span class="benefit-icon" aria-hidden="true">時</span>
        <div><strong>予定に合わせて選べる</strong><p>チェックインや終演後の動きから絞り込めます</p></div>
      </div>
      <div class="benefit-item">
        <span class="benefit-icon" aria-hidden="true">休</span>
        <div><strong>快適な滞在をサポート</strong><p>荷物預かりや休息の条件まで比較できます</p></div>
      </div>`;
    cards.insertAdjacentElement("afterend", strip);
  }

  function updateMobileCompare() {
    const button = document.querySelector(".mobile-actions [data-open-compare]");
    if (!button) return;
    const count = button.querySelector("span");
    button.replaceChildren(document.createTextNode("比較検討 "));
    if (count) button.append(count);
    button.setAttribute("aria-label", "比較候補を開く");
  }

  function installDirectFinderNavigation() {
    document.addEventListener("click", event => {
      const card = event.target.closest("[data-select-category]");
      if (!card) return;

      const nativeScrollTo = window.scrollTo;
      window.scrollTo = function (options, ...rest) {
        if (options && typeof options === "object" && options.top === 0) return;
        return nativeScrollTo.call(window, options, ...rest);
      };

      setTimeout(() => {
        window.scrollTo = nativeScrollTo;
        document.querySelector("#finder-heading")?.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "start"
        });
      }, 0);
    }, true);
  }

  function applyTopRefresh() {
    updateCards();
    addBenefits();
    updateMobileCompare();
    installDirectFinderNavigation();
  }

  const core = document.createElement("script");
  core.src = "assets/js/app-core.js?v=20260806-1";
  core.async = false;
  core.onload = applyTopRefresh;
  core.onerror = () => console.error("STAYSCENE core script could not be loaded.");
  document.head.append(core);
})();
