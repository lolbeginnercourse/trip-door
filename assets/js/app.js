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
  appendStylesheet("assets/css/finder-single-select.css?v=20260806-1", "finder-two-step-style");
  appendStylesheet("assets/css/hotel-detail.css?v=20260808-2", "hotel-detail-style");

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

  const venueCollator = new Intl.Collator("ja-JP", {
    usage: "sort",
    sensitivity: "base",
    numeric: true
  });

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

  function inferPrefecture(label) {
    const direct = ALL_PREFECTURES.find(prefecture => label.includes(prefecture));
    if (direct) return direct;
    return PREFECTURE_HINTS.find(([keyword]) => label.includes(keyword))?.[1] || "その他";
  }

  function installSingleSelectFinder() {
    const form = document.querySelector("[data-search-form]");
    const area = document.querySelector("[data-area-select]");
    const areaLabel = document.querySelector("[data-area-label]");
    const submit = document.querySelector("[data-search-submit]");
    const finderDescription = document.querySelector("[data-finder-description]");
    if (!form || !area || !submit || form.dataset.singleSelectInstalled === "true") return;

    form.dataset.singleSelectInstalled = "true";
    area.closest("label")?.classList.add("finder-field", "finder-field--destination");
    if (areaLabel) areaLabel.textContent = "都道府県・会場";

    const sourceOptionsByCategory = new Map();
    const selectedPrefectureByCategory = new Map();
    let activeCategory = "";
    let mode = "prefecture";
    let rendering = false;
    let passCoreChange = false;
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
      .filter(option => option.value && option.value !== "all" && !option.value.startsWith("__"))
      .map((option, index) => {
        const rawLabel = option.textContent.trim();
        const separator = rawLabel.search(/[｜|]/);
        const explicitPrefecture = separator >= 0 ? rawLabel.slice(0, separator).trim() : "";
        const venueLabel = separator >= 0 ? rawLabel.slice(separator + 1).trim() : rawLabel;
        const prefecture = explicitPrefecture || ESPORTS_PREFECTURES[option.value] || inferPrefecture(rawLabel);
        return { value: option.value, label: venueLabel, prefecture, order: index };
      });

    const captureSourceOptions = category => {
      if (!category || rendering) return false;
      const options = parseAreaOptions(category);
      if (!options.length) return false;
      sourceOptionsByCategory.set(category, options);
      return true;
    };

    const observeArea = () => {
      areaObserver?.disconnect();
      areaObserver = new MutationObserver(() => {
        if (rendering) return;
        const category = getCategory();
        if (captureSourceOptions(category)) scheduleRebuild();
        else updateButtonState();
      });
      areaObserver.observe(area, { childList: true, subtree: true });
    };

    const replaceOptions = nodes => {
      rendering = true;
      areaObserver?.disconnect();
      area.replaceChildren(...nodes);
      rendering = false;
      observeArea();
    };

    const availablePrefectures = options => new Set(options.map(option => option.prefecture));

    const renderPrefectureList = options => {
      mode = "prefecture";
      area.dataset.selectionMode = "prefecture";
      const available = availablePrefectures(options);
      const nodes = [makeOption("all", options.length ? "都道府県を選択してください" : "選択できる会場がありません")];
      const added = new Set();

      PREFECTURE_GROUPS.forEach(([groupLabel, names]) => {
        const matching = names.filter(name => available.has(name));
        if (!matching.length) return;
        const group = document.createElement("optgroup");
        group.label = groupLabel;
        matching.forEach(name => {
          const option = makeOption(`__prefecture__:${PREFECTURE_SLUGS[name] || "other"}`, name);
          option.dataset.prefecture = name;
          group.append(option);
          added.add(name);
        });
        nodes.push(group);
      });

      const remaining = [...available].filter(name => !added.has(name)).sort(venueCollator.compare);
      if (remaining.length) {
        const group = document.createElement("optgroup");
        group.label = "その他";
        remaining.forEach(name => {
          const option = makeOption(`__prefecture__:${PREFECTURE_SLUGS[name] || "other"}`, name);
          option.dataset.prefecture = name;
          group.append(option);
        });
        nodes.push(group);
      }

      replaceOptions(nodes);
      area.disabled = options.length === 0;
      area.value = "all";
      updateButtonState();
    };

    const renderVenueList = (options, prefectureName, selectedVenue = "") => {
      mode = "venue";
      area.dataset.selectionMode = "venue";
      area.dataset.prefecture = prefectureName;
      const venues = options
        .filter(option => option.prefecture === prefectureName)
        .sort((a, b) => venueCollator.compare(a.label, b.label) || a.order - b.order);
      const nodes = [
        makeOption("all", `${prefectureName}の会場を選択してください`),
        makeOption("__back__", "← 都道府県を選び直す")
      ];
      venues.forEach(venue => nodes.push(makeOption(venue.value, venue.label, venue.value === selectedVenue)));
      replaceOptions(nodes);
      area.disabled = venues.length === 0;
      area.value = venues.some(venue => venue.value === selectedVenue) ? selectedVenue : "all";
      updateButtonState();
    };

    const selectedPrefectureFromUrl = category => {
      const url = new URL(window.location.href);
      if (url.searchParams.get("category") !== category) return "";
      return SLUG_PREFECTURES[url.searchParams.get("prefecture")] || "";
    };

    const selectedVenueFromUrl = category => {
      const url = new URL(window.location.href);
      if (url.searchParams.get("category") !== category) return "";
      return url.searchParams.get("area") || url.searchParams.get("venue") || "";
    };

    const updateFinderCopy = category => {
      if (areaLabel) areaLabel.textContent = "都道府県・会場";
      if (!finderDescription) return;
      finderDescription.textContent = category === "esports"
        ? "都道府県を選び、続けて同じ欄からイベント会場を選択してください 会場は名前順で表示します"
        : "都道府県を選び、続けて同じ欄から会場を選択してください 会場は名前順で表示します";
    };

    const syncSupplementalUrl = () => {
      const category = getCategory();
      if (!category) return;
      const url = new URL(window.location.href);
      const prefectureName = area.dataset.prefecture || selectedPrefectureByCategory.get(category) || "";
      const venue = mode === "venue" && area.value !== "all" && area.value !== "__back__" ? area.value : "";

      if (prefectureName) url.searchParams.set("prefecture", PREFECTURE_SLUGS[prefectureName] || "other");
      else url.searchParams.delete("prefecture");
      if (venue) url.searchParams.set("venue", venue);
      else url.searchParams.delete("venue");

      const next = `${url.pathname}${url.search}${url.hash}`;
      const current = `${location.pathname}${location.search}${location.hash}`;
      if (next !== current) history.replaceState(history.state, "", next);
    };

    const updateButtonState = () => {
      const canSearch = Boolean(getCategory()) && mode === "venue" && !area.disabled && area.value !== "all" && area.value !== "__back__";
      submit.disabled = !canSearch;
      submit.setAttribute("aria-disabled", String(!canSearch));
      const disabledText = mode === "prefecture" ? "都道府県を選んでください" : "会場を選ぶとホテルを表示";
      if (!canSearch && submit.textContent !== disabledText) submit.textContent = disabledText;
      else if (canSearch && /都道府県を選んでください|会場を選ぶとホテルを表示/.test(submit.textContent)) submit.textContent = "条件に合うホテルを見る";
    };

    const dispatchCoreReset = () => {
      passCoreChange = true;
      area.value = "all";
      area.dispatchEvent(new Event("change", { bubbles: true }));
      passCoreChange = false;
    };

    const rebuild = () => {
      scheduled = false;
      const category = getCategory();
      if (!category) {
        activeCategory = "";
        return;
      }

      const options = sourceOptionsByCategory.get(category) || [];
      if (!options.length) {
        updateButtonState();
        return;
      }

      const categoryChanged = category !== activeCategory;
      activeCategory = category;
      updateFinderCopy(category);

      const currentValue = options.some(option => option.value === area.value) ? area.value : "";
      const urlVenue = selectedVenueFromUrl(category);
      const selectedVenue = currentValue || (options.some(option => option.value === urlVenue) ? urlVenue : "");
      const venuePrefecture = options.find(option => option.value === selectedVenue)?.prefecture || "";
      const urlPrefecture = selectedPrefectureFromUrl(category);
      const remembered = selectedPrefectureByCategory.get(category) || "";
      const selectedPrefecture = venuePrefecture || urlPrefecture || (!categoryChanged ? area.dataset.prefecture || "" : "") || remembered;

      if (selectedPrefecture && availablePrefectures(options).has(selectedPrefecture)) {
        selectedPrefectureByCategory.set(category, selectedPrefecture);
        renderVenueList(options, selectedPrefecture, selectedVenue);
      } else {
        selectedPrefectureByCategory.delete(category);
        delete area.dataset.prefecture;
        renderPrefectureList(options);
      }
      syncSupplementalUrl();
    };

    function scheduleRebuild() {
      if (scheduled) return;
      scheduled = true;
      setTimeout(rebuild, 0);
    }

    area.addEventListener("change", event => {
      if (passCoreChange) return;
      const category = getCategory();
      const options = sourceOptionsByCategory.get(category) || [];
      const value = area.value;

      if (mode === "prefecture" && value.startsWith("__prefecture__:")) {
        event.stopImmediatePropagation();
        const prefectureName = area.selectedOptions[0]?.dataset.prefecture || SLUG_PREFECTURES[value.split(":")[1]] || "";
        if (!prefectureName) return;
        selectedPrefectureByCategory.set(category, prefectureName);
        renderVenueList(options, prefectureName);
        dispatchCoreReset();
        syncSupplementalUrl();
        area.focus();
        return;
      }

      if (mode === "venue" && value === "__back__") {
        event.stopImmediatePropagation();
        selectedPrefectureByCategory.delete(category);
        delete area.dataset.prefecture;
        renderPrefectureList(options);
        dispatchCoreReset();
        const url = new URL(window.location.href);
        url.searchParams.delete("prefecture");
        url.searchParams.delete("venue");
        history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
        area.focus();
        return;
      }

      if (mode === "venue") {
        setTimeout(() => {
          syncSupplementalUrl();
          updateButtonState();
        }, 0);
      } else {
        updateButtonState();
      }
    }, true);

    form.addEventListener("submit", event => {
      if (!submit.disabled) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      area.focus();
    }, true);

    document.addEventListener("click", event => {
      const target = event.target.closest("button, a");
      if (!target) return;
      if (target.dataset.selectCategory || target.dataset.categoryTab) scheduleRebuild();
      if (target.hasAttribute("data-clear-filters")) {
        setTimeout(() => {
          const category = getCategory();
          selectedPrefectureByCategory.delete(category);
          delete area.dataset.prefecture;
          const url = new URL(window.location.href);
          url.searchParams.delete("prefecture");
          url.searchParams.delete("venue");
          history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
          scheduleRebuild();
        }, 0);
      }
    });

    window.addEventListener("popstate", () => setTimeout(scheduleRebuild, 0));

    const bodyObserver = new MutationObserver(() => scheduleRebuild());
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["data-category"] });

    const submitObserver = new MutationObserver(updateButtonState);
    submitObserver.observe(submit, { childList: true, characterData: true, subtree: true });

    observeArea();
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
    installSingleSelectFinder();
  }

  normalizeVenueUrlParameter();

  const core = document.createElement("script");
  core.src = "assets/js/app-core.js?v=20260808-2";
  core.async = false;
  core.onload = () => {
    applyTopRefresh();
    if (document.querySelector("script[data-hotel-detail-script]")) return;
    const detail = document.createElement("script");
    detail.src = "assets/js/hotel-detail.js?v=20260808-2";
    detail.async = false;
    detail.dataset.hotelDetailScript = "";
    detail.onerror = () => console.error("Hotel detail enhancement could not be loaded.");
    document.head.append(detail);
  };
  core.onerror = () => console.error("STAYSCENE core script could not be loaded.");
  document.head.append(core);
})();
