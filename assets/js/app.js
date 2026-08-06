(() => {
  "use strict";

  const appendStylesheet = (href, marker) => {
    if (document.querySelector(`link[data-${marker}]`)) return;
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = href;
    style.setAttribute(`data-${marker}`, "");
    document.head.append(style);
  };

  appendStylesheet("assets/css/top-refresh.css?v=20260806-1", "top-refresh-style");
  appendStylesheet("assets/css/finder-two-step.css?v=20260806-1", "finder-two-step-style");

  const PREFECTURE_GROUPS = [
    ["主要遠征エリア", ["東京都", "大阪府", "神奈川県", "愛知県", "千葉県", "埼玉県", "兵庫県", "福岡県"]],
    ["北海道・東北", ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"]],
    ["関東", ["茨城県", "栃木県", "群馬県"]],
    ["甲信越・北陸", ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県"]],
    ["東海", ["岐阜県", "静岡県", "三重県"]],
    ["関西", ["滋賀県", "京都府", "奈良県", "和歌山県"]],
    ["中国", ["鳥取県", "島根県", "岡山県", "広島県", "山口県"]],
    ["四国", ["徳島県", "香川県", "愛媛県", "高知県"]],
    ["九州・沖縄", ["佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]]
  ];

  const PREFECTURE_SLUGS = {
    "北海道": "hokkaido", "青森県": "aomori", "岩手県": "iwate", "宮城県": "miyagi", "秋田県": "akita", "山形県": "yamagata", "福島県": "fukushima",
    "茨城県": "ibaraki", "栃木県": "tochigi", "群馬県": "gunma", "埼玉県": "saitama", "千葉県": "chiba", "東京都": "tokyo", "神奈川県": "kanagawa",
    "新潟県": "niigata", "富山県": "toyama", "石川県": "ishikawa", "福井県": "fukui", "山梨県": "yamanashi", "長野県": "nagano",
    "岐阜県": "gifu", "静岡県": "shizuoka", "愛知県": "aichi", "三重県": "mie",
    "滋賀県": "shiga", "京都府": "kyoto", "大阪府": "osaka", "兵庫県": "hyogo", "奈良県": "nara", "和歌山県": "wakayama",
    "鳥取県": "tottori", "島根県": "shimane", "岡山県": "okayama", "広島県": "hiroshima", "山口県": "yamaguchi",
    "徳島県": "tokushima", "香川県": "kagawa", "愛媛県": "ehime", "高知県": "kochi",
    "福岡県": "fukuoka", "佐賀県": "saga", "長崎県": "nagasaki", "熊本県": "kumamoto", "大分県": "oita", "宮崎県": "miyazaki", "鹿児島県": "kagoshima", "沖縄県": "okinawa",
    "その他": "other"
  };

  const SLUG_PREFECTURES = Object.fromEntries(Object.entries(PREFECTURE_SLUGS).map(([name, slug]) => [slug, name]));
  const ALL_PREFECTURES = Object.keys(PREFECTURE_SLUGS).filter(name => name !== "その他");
  const ESPORTS_PREFECTURES = { makuhari: "千葉県", ariake: "東京都", bigsite: "東京都" };
  const PREFECTURE_HINTS = [
    ["札幌", "北海道"], ["仙台", "宮城県"], ["さいたま", "埼玉県"], ["大宮", "埼玉県"], ["幕張", "千葉県"], ["千葉", "千葉県"],
    ["横浜", "神奈川県"], ["川崎", "神奈川県"], ["有明", "東京都"], ["東京", "東京都"], ["名古屋", "愛知県"], ["静岡", "静岡県"],
    ["京都", "京都府"], ["大阪", "大阪府"], ["神戸", "兵庫県"], ["広島", "広島県"], ["高松", "香川県"], ["松山", "愛媛県"],
    ["福岡", "福岡県"], ["博多", "福岡県"], ["熊本", "熊本県"], ["鹿児島", "鹿児島県"], ["那覇", "沖縄県"]
  ];

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

  function normalizeVenueUrlParameter() {
    const url = new URL(window.location.href);
    const venue = url.searchParams.get("venue");
    if (!venue || url.searchParams.has("area")) return;
    url.searchParams.set("area", venue);
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function installTwoStepFinderMarkup() {
    const grid = document.querySelector(".finder-grid");
    const area = document.querySelector("[data-area-select]");
    const areaField = area?.closest("label");
    if (!grid || !area || !areaField) return;

    areaField.classList.add("finder-field", "finder-field--venue");
    const areaLabel = document.querySelector("[data-area-label]");
    if (areaLabel) areaLabel.textContent = "会場";

    if (document.querySelector("[data-prefecture-select]")) return;
    const prefectureField = document.createElement("label");
    prefectureField.className = "finder-field finder-field--prefecture";
    const label = document.createElement("span");
    label.textContent = "都道府県";
    const select = document.createElement("select");
    select.name = "prefecture";
    select.dataset.prefectureSelect = "";
    select.disabled = true;
    const option = document.createElement("option");
    option.value = "all";
    option.textContent = "都道府県を選択してください";
    select.append(option);
    prefectureField.append(label, select);
    grid.insertBefore(prefectureField, areaField);
  }

  function inferPrefecture(label) {
    const direct = ALL_PREFECTURES.find(prefecture => label.includes(prefecture));
    if (direct) return direct;
    return PREFECTURE_HINTS.find(([keyword]) => label.includes(keyword))?.[1] || "その他";
  }

  function installTwoStepFinder() {
    const form = document.querySelector("[data-search-form]");
    const prefecture = document.querySelector("[data-prefecture-select]");
    const area = document.querySelector("[data-area-select]");
    const areaLabel = document.querySelector("[data-area-label]");
    const submit = document.querySelector("[data-search-submit]");
    const finderDescription = document.querySelector("[data-finder-description]");
    if (!form || !prefecture || !area || !submit || form.dataset.twoStepInstalled === "true") return;
    form.dataset.twoStepInstalled = "true";

    const sourceOptionsByCategory = new Map();
    const selectedPrefectureByCategory = new Map();
    let activeCategory = null;
    let restoreFromUrl = true;
    let scheduled = false;
    let areaObserver;

    const getCategory = () => document.body.dataset.category || "";
    const makeOption = (value, label, selected = false) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = selected;
      return option;
    };

    const parseAreaOptions = category => [...area.options]
      .filter(option => option.value && option.value !== "all")
      .map((option, index) => {
        const rawLabel = option.textContent.trim();
        const separator = rawLabel.search(/[｜|]/);
        const explicitPrefecture = separator >= 0 ? rawLabel.slice(0, separator).trim() : "";
        const venueLabel = separator >= 0 ? rawLabel.slice(separator + 1).trim() : rawLabel;
        const prefectureName = explicitPrefecture || (category === "esports" ? ESPORTS_PREFECTURES[option.value] : "") || inferPrefecture(rawLabel);
        return { value: option.value, label: venueLabel, prefecture: prefectureName, order: index };
      });

    const captureSourceOptions = category => {
      if (!category) return false;
      const options = parseAreaOptions(category);
      if (!options.length) return false;
      sourceOptionsByCategory.set(category, options);
      return true;
    };

    const observeArea = () => {
      areaObserver?.disconnect();
      areaObserver = new MutationObserver(() => {
        const category = getCategory();
        if (captureSourceOptions(category)) scheduleRebuild();
        else updateButtonState();
      });
      areaObserver.observe(area, { childList: true, subtree: true });
    };

    const replaceAreaOptions = nodes => {
      areaObserver?.disconnect();
      area.replaceChildren(...nodes);
      observeArea();
    };

    const availablePrefectures = options => new Set(options.map(option => option.prefecture));

    const populatePrefectures = (options, selectedName) => {
      const available = availablePrefectures(options);
      const nodes = [makeOption("all", options.length ? "都道府県を選択してください" : "選択できる会場がありません")];
      const added = new Set();

      PREFECTURE_GROUPS.forEach(([groupLabel, names]) => {
        const groupNames = names.filter(name => available.has(name));
        if (!groupNames.length) return;
        const group = document.createElement("optgroup");
        group.label = groupLabel;
        groupNames.forEach(name => {
          const option = makeOption(PREFECTURE_SLUGS[name], name, name === selectedName);
          option.dataset.prefecture = name;
          group.append(option);
          added.add(name);
        });
        nodes.push(group);
      });

      const remaining = [...available].filter(name => !added.has(name));
      if (remaining.length) {
        const group = document.createElement("optgroup");
        group.label = "その他";
        remaining.forEach(name => {
          const slug = PREFECTURE_SLUGS[name] || "other";
          const option = makeOption(slug, name, name === selectedName);
          option.dataset.prefecture = name;
          group.append(option);
        });
        nodes.push(group);
      }

      prefecture.replaceChildren(...nodes);
      prefecture.disabled = options.length === 0;
      if (!selectedName || !available.has(selectedName)) prefecture.value = "all";
    };

    const populateVenues = (options, prefectureName, selectedVenue) => {
      if (!prefectureName) {
        replaceAreaOptions([makeOption("all", options.length ? "先に都道府県を選択してください" : "選択できる会場がありません")]);
        area.disabled = true;
        return;
      }

      const venues = options.filter(option => option.prefecture === prefectureName).sort((a, b) => a.order - b.order);
      const nodes = [makeOption("all", "会場を選択してください")];
      venues.forEach(venue => nodes.push(makeOption(venue.value, venue.label, venue.value === selectedVenue)));
      replaceAreaOptions(nodes);
      area.disabled = venues.length === 0;
      if (!venues.some(venue => venue.value === selectedVenue)) area.value = "all";
    };

    const selectedPrefectureName = () => prefecture.selectedOptions[0]?.dataset.prefecture || SLUG_PREFECTURES[prefecture.value] || "";

    const prefectureFromUrl = category => {
      const url = new URL(window.location.href);
      if (url.searchParams.get("category") !== category) return "";
      return SLUG_PREFECTURES[url.searchParams.get("prefecture")] || "";
    };

    const updateFinderCopy = category => {
      if (areaLabel) areaLabel.textContent = "会場";
      if (!finderDescription) return;
      finderDescription.textContent = category === "esports"
        ? "都道府県、イベント会場、参加スタイル、優先したい条件を選ぶと、機材移動と休息に合うホテルを表示します"
        : "都道府県、会場、観劇スタイル、優先したい条件を選ぶと、当日の動きに合うホテルを表示します";
    };

    const syncSupplementalUrl = () => {
      const category = getCategory();
      if (!category) return;
      const url = new URL(window.location.href);
      const prefectureName = selectedPrefectureName();
      const venue = !area.disabled && area.value !== "all" ? area.value : "";

      if (prefectureName) url.searchParams.set("prefecture", PREFECTURE_SLUGS[prefectureName] || "other");
      else url.searchParams.delete("prefecture");
      if (venue) url.searchParams.set("venue", venue);
      else url.searchParams.delete("venue");

      const next = `${url.pathname}${url.search}${url.hash}`;
      const current = `${location.pathname}${location.search}${location.hash}`;
      if (next !== current) history.replaceState(history.state, "", next);
    };

    const updateButtonState = () => {
      const canSearch = Boolean(getCategory()) && !area.disabled && area.value !== "all";
      submit.disabled = !canSearch;
      submit.setAttribute("aria-disabled", String(!canSearch));
      if (!canSearch && submit.textContent !== "会場を選ぶとホテルを表示") {
        submit.textContent = "会場を選ぶとホテルを表示";
      } else if (canSearch && submit.textContent === "会場を選ぶとホテルを表示") {
        submit.textContent = "条件に合うホテルを見る";
      }
    };

    const rebuild = () => {
      scheduled = false;
      const category = getCategory();
      if (!category) {
        activeCategory = null;
        return;
      }

      const categoryChanged = category !== activeCategory;
      activeCategory = category;
      const options = sourceOptionsByCategory.get(category) || [];
      const selectedVenue = area.value !== "all" ? area.value : "";
      const venuePrefecture = options.find(option => option.value === selectedVenue)?.prefecture || "";
      const rememberedPrefecture = selectedPrefectureByCategory.get(category) || "";
      const urlPrefecture = restoreFromUrl ? prefectureFromUrl(category) : "";
      const selectedName = venuePrefecture || urlPrefecture || (!categoryChanged ? selectedPrefectureName() : "") || rememberedPrefecture;
      const validName = availablePrefectures(options).has(selectedName) ? selectedName : "";

      populatePrefectures(options, validName);
      populateVenues(options, validName, selectedVenue);
      if (validName) selectedPrefectureByCategory.set(category, validName);
      else selectedPrefectureByCategory.delete(category);
      updateFinderCopy(category);
      restoreFromUrl = false;
      syncSupplementalUrl();
      updateButtonState();
    };

    function scheduleRebuild() {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(rebuild);
    }

    observeArea();

    prefecture.addEventListener("change", () => {
      const category = getCategory();
      const options = sourceOptionsByCategory.get(category) || [];
      const name = selectedPrefectureName();
      if (name) selectedPrefectureByCategory.set(category, name);
      else selectedPrefectureByCategory.delete(category);
      populateVenues(options, name, "");
      area.value = "all";
      area.dispatchEvent(new Event("change", { bubbles: true }));
      syncSupplementalUrl();
      updateButtonState();
    });

    area.addEventListener("change", () => {
      const category = getCategory();
      const options = sourceOptionsByCategory.get(category) || [];
      const matched = options.find(option => option.value === area.value);
      if (matched && selectedPrefectureName() !== matched.prefecture) {
        populatePrefectures(options, matched.prefecture);
        selectedPrefectureByCategory.set(category, matched.prefecture);
      }
      syncSupplementalUrl();
      updateButtonState();
    });

    form.addEventListener("submit", event => {
      if (!submit.disabled) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      (prefecture.value === "all" ? prefecture : area).focus();
    }, true);

    document.addEventListener("click", event => {
      const target = event.target.closest("button, a");
      if (!target) return;
      if (target.dataset.selectCategory || target.dataset.categoryTab) scheduleRebuild();
      if (target.hasAttribute("data-clear-filters")) {
        queueMicrotask(() => {
          const category = getCategory();
          selectedPrefectureByCategory.delete(category);
          const url = new URL(window.location.href);
          url.searchParams.delete("prefecture");
          url.searchParams.delete("venue");
          history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
          restoreFromUrl = false;
          rebuild();
        });
      }
    });

    window.addEventListener("popstate", () => {
      restoreFromUrl = true;
      setTimeout(scheduleRebuild, 0);
    });

    const bodyObserver = new MutationObserver(() => scheduleRebuild());
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["data-category"] });

    const submitObserver = new MutationObserver(updateButtonState);
    submitObserver.observe(submit, { childList: true, characterData: true, subtree: true });

    captureSourceOptions(getCategory());
    scheduleRebuild();
  }

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
    installTwoStepFinder();
  }

  normalizeVenueUrlParameter();
  installTwoStepFinderMarkup();

  const core = document.createElement("script");
  core.src = "assets/js/app-core.js?v=20260806-1";
  core.async = false;
  core.onload = applyTopRefresh;
  core.onerror = () => console.error("STAYSCENE core script could not be loaded.");
  document.head.append(core);
})();
