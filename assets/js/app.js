(() => {
  "use strict";

  const HOME_HERO = {
    label: "EVENT STAY, MADE PERSONAL",
    title: "泊まる時間も\n体験の一部に",
    lead: "会場までの近さだけでなく、開演前からイベント後までの過ごし方に合うホテルを探せます。",
    key: "KEY",
    visualText: "EVENT\nSTAY\nGUIDE"
  };

  const CATEGORIES = {
    stage: {
      heroLabel: "STAGE TRIP",
      heroTitle: "観劇の一日を\nもっと身軽に",
      heroLead: "身支度、荷物預かり、昼夜公演の間の移動まで。観劇当日の使いやすさからホテルを探せます。",
      heroKey: "CURTAIN",
      heroVisualText: "STAGE\nSTAY\nGUIDE",
      label: "STAGE TRIP", shortName: "舞台遠征", title: "観劇の一日を、時間軸で考える",
      lead: "身支度のしやすさ、荷物預かり、グッズを整理できるスペース、昼夜公演の間に戻りやすい立地。",
      description: "開演前・公演の合間・終演後まで、移動や準備がスムーズにつながるホテルを選びます。",
      visualTitle: "観劇当日の使いやすさ", visualText: "劇場からの距離だけでは分からない条件まで確認します。",
      finderTitle: "舞台遠征のホテルを条件から探す", finderDescription: "劇場やエリア、観劇スタイル、優先したい条件を選ぶと、当日の動きに合うホテルを表示します。",
      areaLabel: "劇場・エリア", styleLabel: "観劇スタイル", resultsLabel: "STAGE HOTEL LIST", resultsTitle: "観劇遠征に合うホテル",
      areas: [["all","選択してください"],["kanadevia","東京ドームシティ周辺"],["geigeki","東京芸術劇場周辺"],["budokan","日本武道館周辺"]],
      styles: [["all","選択してください"],["solo","一人遠征"],["group","友人と遠征"],["matinee","昼夜公演・複数公演"],["stay","連泊"]],
      priorities: [["all","選択してください"],["near","会場への近さ"],["baggage","荷物預かり"],["mirror","客室での身支度"],["quiet","終演後の静けさ"]],
      quick: [["near","終演後、ホテルへすぐ戻れる"],["baggage","荷物を預けやすい"],["mirror","客室で身支度しやすい"]]
    },
    esports: {
      heroLabel: "GAME EVENT",
      heroTitle: "会場から休息まで\n一つの動線に",
      heroLead: "機材・荷物の運びやすさ、机と電源、食事、入浴まで。イベント前後の動きからホテルを探せます。",
      heroKey: "READY",
      heroVisualText: "GAME\nREST\nREADY",
      label: "GAME EVENT", shortName: "eスポーツ", title: "会場から休息まで、一つの動線に",
      lead: "機材や荷物を運びやすく、イベント後の食事と休息までまとめやすい立地。",
      description: "会場へのアクセスに加え、作業しやすい机と電源、食事の取りやすさ、大浴場の有無まで比較できます。",
      visualTitle: "機材と電源", visualText: "参加・観戦スタイルに合わせて、会場の外の時間も整えます。",
      finderTitle: "eスポーツ遠征のホテルを条件から探す", finderDescription: "イベント会場、参加スタイル、優先したい条件から、機材移動と休息に合うホテルを表示します。",
      areaLabel: "イベント会場", styleLabel: "参加スタイル", resultsLabel: "GAME EVENT HOTEL LIST", resultsTitle: "eスポーツ遠征に合うホテル",
      areas: [["all","選択してください"],["makuhari","幕張メッセ"],["ariake","東京ガーデンシアター"],["bigsite","東京ビッグサイト"]],
      styles: [["all","選択してください"],["player","大会参加"],["spectator","観戦"],["device","機材を持参"],["group","複数人"],["stay","連日参加"]],
      priorities: [["all","選択してください"],["near","会場への近さ"],["desk","机と電源"],["food","食事の取りやすさ"],["bath","大浴場"]],
      quick: [["near","会場へ移動しやすい"],["food","食事を取りやすい"],["bath","大浴場で休める"]]
    },
    art: {
      heroLabel: "ART JOURNEY",
      heroTitle: "展示の余韻を\n客室へ持ち帰る",
      heroLead: "美術館を巡りやすい立地、建築や館内アート、鑑賞後の静けさからホテルを探せます。",
      heroKey: "GALLERY",
      heroVisualText: "ART\nSTAY\nJOURNEY",
      label: "ART JOURNEY", shortName: "アート巡り", title: "展示の余韻を、客室へ持ち帰る",
      lead: "美術館を巡りやすい立地、楽しめる建築や館内アート、図録を広げられる机、鑑賞後に静かに過ごせる客室。",
      description: "展示から街歩き、建築、客室での時間までを、一つの旅としてつなげます。",
      visualTitle: "ホテルまで続く、アートの時間", visualText: "鑑賞後の余韻を急がず楽しめる滞在を選びます。",
      finderTitle: "アート巡りのホテルを条件から探す", finderDescription: "巡りたいエリア、旅のスタイル、滞在中に優先したいことを選ぶと、アート旅に合うホテルを表示します。",
      areaLabel: "美術館・エリア", styleLabel: "旅のスタイル", resultsLabel: "ART JOURNEY HOTEL LIST", resultsTitle: "アート巡りに合うホテル",
      areas: [["all","選択してください"],["ueno","上野公園ミュージアム群"],["sumida","浅草・蔵前・両国"],["roppongi","六本木アートエリア"]],
      styles: [["all","選択してください"],["museum","美術館中心"],["walk","街歩き"],["hotelart","館内アート"],["solo","一人旅"],["quiet","静かな滞在"]],
      priorities: [["all","選択してください"],["station","美術館を巡りやすい"],["design","建築・館内アート"],["desk","図録を広げやすい"],["quiet","静かな客室"]],
      quick: [["station","美術館を巡りやすい"],["design","建築や館内アートを楽しめる"],["quiet","静かに過ごせる"]]
    }
  };

  const state = {
    category: null,
    hotels: [],
    visibleCount: 20,
    filters: Object.fromEntries(Object.keys(CATEGORIES).map(key => [key, { area: "all", style: "all", priorities: [], sort: "recommended", searched: false }])),
    compareIds: [],
    lastTrigger: null,
    noticeTimer: null
  };

  const q = selector => document.querySelector(selector);
  const qa = selector => [...document.querySelectorAll(selector)];
  const ui = {
    homeOnly: qa("[data-home-only]"), heroLabel: q("[data-hero-label]"), heroTitle: q("[data-hero-title]"), heroLead: q("[data-hero-lead]"),
    heroKey: q("[data-hero-key]"), heroVisualText: q("[data-hero-visual-text]"),
    experience: q("[data-experience]"), overviewLabel: q("[data-overview-label]"), overviewTitle: q("[data-overview-title]"), overviewLead: q("[data-overview-lead]"),
    overviewDescription: q("[data-overview-description]"), overviewVisualTitle: q("[data-overview-visual-title]"), overviewVisualText: q("[data-overview-visual-text]"),
    finderTitle: q("[data-finder-title]"), finderDescription: q("[data-finder-description]"), areaLabel: q("[data-area-label]"), styleLabel: q("[data-style-label]"),
    area: q("[data-area-select]"), style: q("[data-style-select]"), priority: q("[data-priority-select]"), form: q("[data-search-form]"), submit: q("[data-search-submit]"),
    quick: q("[data-quick-filters]"), active: q("[data-active-filters]"), chips: q("[data-filter-chips]"), resultsLabel: q("[data-results-label]"),
    resultsHeading: q("[data-results-heading]"), summary: q("[data-result-summary]"), resultState: q("[data-result-state]"), list: q("[data-hotel-list]"), sort: q("[data-sort]"), loadMore: q("[data-load-more]"),
    compareBar: q("[data-compare-bar]"), compareHotels: q("[data-compare-hotels]"), compareMessage: q("[data-compare-message]"), compareDialog: q("[data-compare-dialog]"), compareContent: q("[data-compare-content]"),
    detailDialog: q("[data-detail-dialog]"), detailTitle: q("[data-detail-title]"), detailContent: q("[data-detail-content]"), notice: q("[data-site-notice]"),
    menuButton: q("[data-menu-button]"), mobileMenu: q("[data-mobile-menu]"), differencesOnly: q("[data-differences-only]")
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function validHotel(item) {
    return item && typeof item.id === "string" && typeof item.name === "string" && item.isPublished !== false && (item.genre || Array.isArray(item.categories));
  }

  function normalizeHotel(item) {
    const links = item.affiliateLinks || [
      item.rakuten && { provider: "楽天トラベル", url: item.rakuten },
      item.jalan && { provider: "じゃらん", url: item.jalan }
    ].filter(Boolean);
    return {
      ...item,
      categories: item.categories || [item.genre],
      nearestStation: typeof item.nearestStation === "string" ? item.nearestStation : item.station || "情報未確認",
      affiliateLinks: links.filter(link => link && /^https:\/\//.test(link.url || "")),
      image: item.image || null,
      restScore: Number(item.restScore) || (((item.priorities || []).includes("quiet") || (item.priorities || []).includes("bath")) ? 4 : 3),
      distanceScore: Number(item.distanceScore) || ((item.priorities || []).includes("near") ? 5 : 3)
    };
  }

  function readCompare() {
    try {
      const parsed = JSON.parse(localStorage.getItem("tripDoorCompare") || "null");
      const ids = Array.isArray(parsed) ? parsed : parsed?.hotelIds;
      return Array.isArray(ids) ? [...new Set(ids.filter(id => typeof id === "string"))].slice(0, 3) : [];
    } catch { return []; }
  }

  function saveCompare() {
    try {
      localStorage.setItem("tripDoorCompare", JSON.stringify({ version: 1, hotelIds: state.compareIds, savedAt: new Date().toISOString() }));
    } catch { /* The current page remains usable without storage. */ }
  }

  function track(eventName, values = {}) {
    try {
      if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;
      window.dataLayer?.push({ event: eventName, ...values });
    } catch { /* Analytics must never stop core features. */ }
  }

  function showNotice(message) {
    clearTimeout(state.noticeTimer);
    ui.notice.textContent = message;
    ui.notice.classList.add("is-visible");
    state.noticeTimer = setTimeout(() => ui.notice.classList.remove("is-visible"), 3200);
  }

  function optionMap(category, type) {
    return new Map(CATEGORIES[category][type].map(([value, label]) => [value, label]));
  }

  function parseUrl() {
    const params = new URLSearchParams(location.search);
    const category = params.get("category");
    state.category = CATEGORIES[category] ? category : null;
    if (!state.category) return;
    const current = state.filters[state.category];
    const config = CATEGORIES[state.category];
    const area = params.get("area");
    const style = params.get("style");
    const sort = params.get("sort");
    const priorities = (params.get("priority") || "").split(",").filter(Boolean);
    current.area = optionMap(state.category, "areas").has(area) ? area : "all";
    current.style = optionMap(state.category, "styles").has(style) ? style : "all";
    current.priorities = [...new Set(priorities.filter(value => optionMap(state.category, "priorities").has(value) && value !== "all"))];
    current.sort = ["recommended", "near", "matches", "rest"].includes(sort) ? sort : "recommended";
    current.searched = [current.area !== "all", current.style !== "all", current.priorities.length > 0].some(Boolean);
  }

  function syncUrl(mode = "replace") {
    const url = new URL(location.href);
    url.hash = "";
    ["category", "area", "style", "priority", "sort"].forEach(key => url.searchParams.delete(key));
    if (state.category) {
      const current = state.filters[state.category];
      url.searchParams.set("category", state.category);
      if (current.area !== "all") url.searchParams.set("area", current.area);
      if (current.style !== "all") url.searchParams.set("style", current.style);
      if (current.priorities.length) url.searchParams.set("priority", current.priorities.join(","));
      if (current.sort !== "recommended") url.searchParams.set("sort", current.sort);
    }
    history[mode === "push" ? "pushState" : "replaceState"]({}, "", `${url.pathname}${url.search}`);
  }

  function setOptions(select, options, selected) {
    select.replaceChildren(...options.map(([value, label]) => {
      const option = el("option", "", label);
      option.value = value;
      option.selected = Array.isArray(selected) ? selected.includes(value) : selected === value;
      return option;
    }));
  }

  function renderHero(config = HOME_HERO) {
    ui.heroLabel.textContent = config.heroLabel || config.label;
    ui.heroTitle.textContent = config.heroTitle || config.title;
    ui.heroLead.textContent = config.heroLead || config.lead;
    ui.heroKey.textContent = config.heroKey || config.key;
    ui.heroVisualText.textContent = config.heroVisualText || config.visualText;
  }

  function showHome() {
    state.category = null;
    document.body.removeAttribute("data-category");
    ui.homeOnly.forEach(section => { section.hidden = false; });
    ui.experience.hidden = true;
    renderHero();
    qa("[data-category-link]").forEach(link => link.removeAttribute("aria-current"));
  }

  function selectCategory(category, { push = true, scroll = false } = {}) {
    if (!CATEGORIES[category]) return;
    state.category = category;
    state.visibleCount = 20;
    document.body.dataset.category = category;
    ui.homeOnly.forEach(section => { section.hidden = true; });
    ui.experience.hidden = false;
    const config = CATEGORIES[category];
    const current = state.filters[category];
    renderHero(config);
    ui.overviewLabel.textContent = config.label;
    ui.overviewTitle.textContent = config.title;
    ui.overviewLead.textContent = config.lead;
    ui.overviewDescription.textContent = config.description;
    ui.overviewVisualTitle.textContent = config.visualTitle;
    ui.overviewVisualText.textContent = config.visualText;
    ui.finderTitle.textContent = config.finderTitle;
    ui.finderDescription.textContent = config.finderDescription;
    ui.areaLabel.textContent = config.areaLabel;
    ui.styleLabel.textContent = config.styleLabel;
    ui.resultsLabel.textContent = config.resultsLabel;
    ui.resultsHeading.textContent = config.resultsTitle;
    setOptions(ui.area, config.areas, current.area);
    setOptions(ui.style, config.styles, current.style);
    setOptions(ui.priority, config.priorities, current.priorities[0] || "all");
    ui.sort.value = current.sort;
    qa("[data-select-category]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.selectCategory === category)));
    qa("[data-category-tab]").forEach(button => button.setAttribute("aria-selected", String(button.dataset.categoryTab === category)));
    qa("[data-category-link]").forEach(link => {
      if (link.dataset.categoryLink === category) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    renderQuick();
    renderFilters();
    renderResults();
    if (push) syncUrl("push");
    if (scroll === "top") window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    else if (scroll) ui.experience.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    track("category_select", { category });
  }

  function renderQuick() {
    const config = CATEGORIES[state.category];
    const current = state.filters[state.category];
    ui.quick.replaceChildren(...config.quick.map(([value, label]) => {
      const button = el("button", "quick-chip", label);
      button.type = "button";
      button.dataset.quick = value;
      button.setAttribute("aria-pressed", String(current.priorities.includes(value)));
      return button;
    }));
  }

  function selectedLabels() {
    const current = state.filters[state.category];
    const config = CATEGORIES[state.category];
    const values = [];
    if (current.area !== "all") values.push({ type: "area", value: current.area, label: optionMap(state.category, "areas").get(current.area) });
    if (current.style !== "all") values.push({ type: "style", value: current.style, label: optionMap(state.category, "styles").get(current.style) });
    current.priorities.forEach(value => values.push({ type: "priority", value, label: optionMap(state.category, "priorities").get(value) }));
    return values.filter(item => item.label);
  }

  function renderFilters() {
    const filters = selectedLabels();
    ui.active.hidden = filters.length === 0;
    ui.chips.replaceChildren(...filters.map(item => {
      const button = el("button", "filter-chip", `${item.label} ×`);
      button.type = "button";
      button.dataset.removeFilter = item.type;
      button.dataset.filterValue = item.value;
      button.setAttribute("aria-label", `${item.label}の条件を削除`);
      return button;
    }));
  }

  function getCategoryHotels() {
    return state.hotels.filter(hotel => hotel.categories.includes(state.category));
  }

  function matchCount(hotel, current) {
    return [current.area === "all" || hotel.venues.includes(current.area), current.style === "all" || hotel.styles.includes(current.style), ...current.priorities.map(value => hotel.priorities.includes(value))].filter(Boolean).length;
  }

  function filteredHotels() {
    const current = state.filters[state.category];
    const source = getCategoryHotels();
    const matched = source.filter(hotel => (current.area === "all" || hotel.venues.includes(current.area)) && (current.style === "all" || hotel.styles.includes(current.style)) && current.priorities.every(value => hotel.priorities.includes(value)));
    return matched.sort((a, b) => {
      if (current.sort === "near") return (b.distanceScore || 0) - (a.distanceScore || 0);
      if (current.sort === "matches") return matchCount(b, current) - matchCount(a, current);
      if (current.sort === "rest") return (b.restScore || 0) - (a.restScore || 0);
      return source.indexOf(a) - source.indexOf(b);
    });
  }

  function makeStatus(status) {
    const value = Array.isArray(status) ? { label: status[0], state: status[1] === "confirmed" ? "confirmed" : "check" } : status;
    return el("span", `status-badge status-badge--${value.state === "confirmed" ? "confirmed" : "check"}`, `${value.state === "confirmed" ? "✓ 確認済み" : "! 予約前に要確認"}・${value.label}`);
  }

  function makeExternalLink(link) {
    const anchor = el("a", "button button--secondary", `${link.provider}で確認`);
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer sponsored";
    anchor.addEventListener("click", () => track("affiliate_click", { hotel_id: anchor.closest("[data-hotel-id]")?.dataset.hotelId, provider: link.provider }));
    return anchor;
  }

  function makeHotelCard(hotel) {
    const card = el("article", "hotel-card");
    card.dataset.hotelId = hotel.id;
    const visual = el("div", "hotel-card__image");
    if (hotel.image?.src) {
      const image = new Image(800, 500);
      image.loading = "lazy";
      image.src = hotel.image.src;
      image.alt = hotel.image.alt || "ホテルの外観";
      image.addEventListener("error", () => image.replaceWith(el("span", "", "HOTEL STAY")), { once: true });
      visual.append(image);
    } else visual.append(el("span", "", "HOTEL STAY"));
    const body = el("div", "hotel-card__body");
    body.append(el("p", "hotel-card__label", CATEGORIES[state.category].shortName));
    const title = el("h3");
    const titleButton = el("button", "text-button", hotel.name);
    titleButton.type = "button";
    titleButton.dataset.openDetail = hotel.id;
    title.append(titleButton);
    body.append(title, el("p", "hotel-card__location", `${hotel.area}・${hotel.nearestStation}`), el("p", "hotel-card__role", hotel.role));
    const features = el("ul", "hotel-card__features");
    (hotel.facts || []).slice(0, 3).forEach(fact => features.append(el("li", "", fact)));
    body.append(features);
    const statuses = el("div", "status-row");
    (hotel.statuses || []).slice(0, 2).forEach(status => statuses.append(makeStatus(status)));
    body.append(statuses);
    const actions = el("div", "hotel-card__actions");
    const detail = el("button", "button button--primary", "ホテルの詳細を見る");
    detail.type = "button";
    detail.dataset.openDetail = hotel.id;
    const compare = el("button", `button button--secondary compare-toggle${state.compareIds.includes(hotel.id) ? " is-selected" : ""}`, state.compareIds.includes(hotel.id) ? "比較候補から外す" : "比較候補に追加する");
    compare.type = "button";
    compare.dataset.toggleCompare = hotel.id;
    actions.append(detail, compare);
    if (hotel.affiliateLinks.length) {
      const links = el("div", "external-links");
      hotel.affiliateLinks.slice(0, 2).forEach(link => links.append(makeExternalLink(link)));
      actions.append(links);
    }
    body.append(actions);
    card.append(visual, body);
    return card;
  }

  function renderResults() {
    if (!state.category) return;
    const current = state.filters[state.category];
    const all = getCategoryHotels();
    const matched = filteredHotels();
    const hasFilters = selectedLabels().length > 0;
    const shown = (current.searched || hasFilters ? matched : all.slice(0, 3)).slice(0, state.visibleCount);
    ui.list.replaceChildren(...shown.map(makeHotelCard));
    ui.resultState.replaceChildren();
    ui.loadMore.hidden = shown.length >= (current.searched || hasFilters ? matched.length : Math.min(all.length, 3));
    if (!current.searched && !hasFilters) {
      ui.summary.textContent = "条件を選ぶか、おすすめホテルからご覧ください。";
    } else if (matched.length) {
      ui.summary.textContent = `条件に合うホテルが${matched.length}件見つかりました。`;
    } else {
      ui.summary.textContent = "条件に合うホテルが見つかりませんでした。";
      const panel = el("div", "state-panel");
      panel.append(el("h3", "", "条件を少し変えてみてください"), el("p", "", "条件を1つ外すと、候補が見つかりやすくなります。"));
      const actions = el("div", "state-actions");
      const remove = el("button", "button button--secondary", "条件を1つ戻す");
      remove.type = "button"; remove.dataset.removeLastFilter = "";
      const clear = el("button", "button button--secondary", "すべての条件をクリア");
      clear.type = "button"; clear.dataset.clearFilters = "";
      actions.append(remove, clear); panel.append(actions); ui.resultState.append(panel);
    }
    ui.submit.textContent = matched.length ? `${matched.length}件のホテルを見る` : "条件に合うホテルを見る";
    renderFilters();
  }

  function updateFromForm() {
    const current = state.filters[state.category];
    current.area = ui.area.value;
    current.style = ui.style.value;
    const selected = ui.priority.value;
    if (selected !== "all" && !current.priorities.includes(selected)) current.priorities.push(selected);
    if (selected === "all") current.priorities = [];
    current.sort = ui.sort.value;
    renderQuick(); renderFilters(); renderResults(); syncUrl();
  }

  function clearFilters() {
    state.filters[state.category] = { area: "all", style: "all", priorities: [], sort: "recommended", searched: false };
    selectCategory(state.category, { push: false });
    syncUrl();
  }

  function toggleQuick(value) {
    const current = state.filters[state.category];
    current.priorities = current.priorities.includes(value) ? current.priorities.filter(item => item !== value) : [...new Set([...current.priorities, value])];
    current.searched = true;
    ui.priority.value = current.priorities.at(-1) || "all";
    renderQuick(); renderResults(); syncUrl();
  }

  function removeFilter(type, value) {
    const current = state.filters[state.category];
    if (type === "priority") current.priorities = current.priorities.filter(item => item !== value);
    else current[type] = "all";
    selectCategory(state.category, { push: false });
    syncUrl();
  }

  function updateCompare() {
    state.compareIds = state.compareIds.filter(id => state.hotels.some(hotel => hotel.id === id)).slice(0, 3);
    const hotels = state.compareIds.map(id => state.hotels.find(hotel => hotel.id === id)).filter(Boolean);
    ui.compareBar.hidden = hotels.length === 0;
    document.body.classList.toggle("has-compare", hotels.length > 0);
    ui.compareHotels.replaceChildren(...hotels.map(hotel => {
      const chip = el("span", "compare-hotel-chip", hotel.name);
      const remove = el("button", "", "×"); remove.type = "button"; remove.dataset.removeCompare = hotel.id; remove.setAttribute("aria-label", `${hotel.name}を比較候補から外す`); chip.append(remove); return chip;
    }));
    ui.compareMessage.textContent = hotels.length === 1 ? "比較候補（1件） あと1件追加すると比較できます" : hotels.length === 3 ? "比較候補は最大3件です" : `比較候補（${hotels.length}件）`;
    qa("[data-open-compare]").forEach(button => button.disabled = hotels.length < 2);
    qa("[data-header-compare-count]").forEach(node => node.textContent = hotels.length);
    qa("[data-mobile-compare-count]").forEach(node => node.textContent = hotels.length);
    qa("[data-toggle-compare]").forEach(button => {
      const selected = state.compareIds.includes(button.dataset.toggleCompare);
      button.textContent = selected ? "比較候補から外す" : "比較候補に追加する";
      button.classList.toggle("is-selected", selected);
    });
    saveCompare();
  }

  function toggleCompare(id) {
    if (state.compareIds.includes(id)) state.compareIds = state.compareIds.filter(item => item !== id);
    else if (state.compareIds.length >= 3) { showNotice("比較できるホテルは3件までです。比較候補から1件外してから追加してください。"); return; }
    else state.compareIds.push(id);
    updateCompare();
    track("compare_toggle", { hotel_id: id, count: state.compareIds.length });
  }

  function openDetail(id, trigger) {
    const hotel = state.hotels.find(item => item.id === id);
    if (!hotel) return;
    state.lastTrigger = trigger;
    ui.detailTitle.textContent = hotel.name;
    const layout = el("div", "detail-layout");
    const visual = el("div", "detail-visual", "HOTEL STAY");
    const content = el("div", "detail-list");
    [["このホテルが向いている人", hotel.role],["会場までの移動", `${hotel.venueLabel}・${hotel.nearestStation}`],["ホテルでの過ごし方", hotel.summary],["予約前に確認すること", (hotel.statuses || []).filter(item => (Array.isArray(item) ? item[1] : item.state) !== "confirmed").map(item => Array.isArray(item) ? item[0] : item.label).join("、") || "最新の料金・設備を予約サイトでご確認ください。"],["情報確認日", hotel.updatedAt || "情報未確認"]].forEach(([title, text]) => { const section = el("section"); section.append(el("h3", "", title), el("p", "", text || "情報未確認")); content.append(section); });
    const actions = el("div", "detail-actions");
    const compare = el("button", "button button--secondary", state.compareIds.includes(id) ? "比較候補から外す" : "比較候補に追加する"); compare.type = "button"; compare.dataset.toggleCompare = id; actions.append(compare);
    hotel.affiliateLinks.forEach(link => actions.append(makeExternalLink(link)));
    content.append(actions); layout.append(visual, content); ui.detailContent.replaceChildren(layout);
    closeOtherDialog(ui.detailDialog); ui.detailDialog.showModal(); document.body.classList.add("is-locked");
    track("hotel_detail_open", { hotel_id: id });
  }

  function valueFor(hotel, key) {
    const checks = (hotel.statuses || []).map(item => Array.isArray(item) ? item[0] : item.label);
    return { movement: `${hotel.venueLabel}・${hotel.nearestStation}`, station: hotel.nearestStation, features: (hotel.facts || []).join("／"), rest: hotel.restScore >= 4 ? "休息を取りやすい" : "予約前に客室環境を確認", suited: hotel.role, caution: checks.join("、") || "最新情報を予約前に確認" }[key];
  }

  function renderCompare() {
    const hotels = state.compareIds.map(id => state.hotels.find(hotel => hotel.id === id)).filter(Boolean);
    const rows = [["movement","会場までの移動"],["station","最寄り駅"],["features","主な設備・条件"],["rest","休みやすさ"],["suited","向いている人"],["caution","予約前の確認事項"]];
    const tableWrap = el("div", "compare-table-wrap"); const table = el("table", "compare-table"); const head = el("thead"); const headRow = el("tr"); headRow.append(el("th", "", "比較項目")); hotels.forEach(hotel => headRow.append(el("th", "", hotel.name))); head.append(headRow); table.append(head);
    const body = el("tbody"); rows.forEach(([key,label]) => { const values = hotels.map(hotel => valueFor(hotel,key)); if (ui.differencesOnly.checked && new Set(values).size === 1) return; const row = el("tr"); row.append(el("th", "", label)); values.forEach(value => row.append(el("td", "", value || "対象外"))); body.append(row); }); table.append(body); tableWrap.append(table); ui.compareContent.replaceChildren(tableWrap);
  }

  function openCompare(trigger) {
    if (state.compareIds.length < 2) { showNotice("あと1件追加すると比較できます。"); return; }
    state.lastTrigger = trigger; renderCompare(); closeOtherDialog(ui.compareDialog); ui.compareDialog.showModal(); document.body.classList.add("is-locked"); track("compare_open", { count: state.compareIds.length });
  }

  function closeOtherDialog(except) {
    [ui.detailDialog, ui.compareDialog].forEach(dialog => { if (dialog !== except && dialog.open) dialog.close(); });
  }

  function closeDialog(dialog) { if (dialog.open) dialog.close(); }

  function setMenu(open) {
    ui.mobileMenu.hidden = !open;
    ui.menuButton.setAttribute("aria-expanded", String(open));
    ui.menuButton.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    document.body.classList.toggle("is-locked", open);
  }

  document.addEventListener("click", event => {
    const target = event.target.closest("button, a");
    if (!target) return;
    if (target.dataset.selectCategory) selectCategory(target.dataset.selectCategory, { scroll: "top" });
    if (target.dataset.categoryTab) selectCategory(target.dataset.categoryTab, { scroll: false });
    if (target.dataset.quick) toggleQuick(target.dataset.quick);
    if (target.dataset.removeFilter) removeFilter(target.dataset.removeFilter, target.dataset.filterValue);
    if (target.hasAttribute("data-clear-filters")) clearFilters();
    if (target.hasAttribute("data-remove-last-filter")) { const filters = selectedLabels(); const last = filters.at(-1); if (last) removeFilter(last.type, last.value); }
    if (target.dataset.toggleCompare) toggleCompare(target.dataset.toggleCompare);
    if (target.dataset.removeCompare) toggleCompare(target.dataset.removeCompare);
    if (target.dataset.openDetail) openDetail(target.dataset.openDetail, target);
    if (target.hasAttribute("data-open-compare")) openCompare(target);
    if (target.hasAttribute("data-close-detail")) closeDialog(ui.detailDialog);
    if (target.hasAttribute("data-close-compare")) closeDialog(ui.compareDialog);
    if (target.hasAttribute("data-clear-compare")) { state.compareIds = []; updateCompare(); if (ui.compareDialog.open) ui.compareDialog.close(); }
    if (target.closest("[data-mobile-menu]")) setMenu(false);
  });

  ui.form.addEventListener("submit", event => { event.preventDefault(); const current = state.filters[state.category]; current.searched = true; updateFromForm(); q("#search-results").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); track("hotel_search", { category: state.category, count: filteredHotels().length }); });
  [ui.area, ui.style, ui.priority].forEach(select => select.addEventListener("change", updateFromForm));
  ui.sort.addEventListener("change", () => { state.filters[state.category].sort = ui.sort.value; renderResults(); syncUrl(); });
  ui.loadMore.addEventListener("click", () => { state.visibleCount += 20; renderResults(); });
  ui.differencesOnly.addEventListener("change", renderCompare);
  ui.menuButton.addEventListener("click", event => { event.stopPropagation(); setMenu(ui.mobileMenu.hidden); });
  window.addEventListener("scroll", () => q("[data-header]").classList.toggle("is-scrolled", scrollY > 24), { passive: true });
  window.addEventListener("popstate", () => { parseUrl(); if (state.category) selectCategory(state.category, { push: false }); else showHome(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !ui.mobileMenu.hidden) setMenu(false); });
  [ui.detailDialog, ui.compareDialog].forEach(dialog => {
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => { document.body.classList.remove("is-locked"); state.lastTrigger?.focus(); });
  });

  async function loadHotels() {
    const loading = el("div", "state-panel");
    loading.append(el("h3", "", "ホテル情報を読み込んでいます"), el("p", "", "少しお待ちください。"));
    ui.resultState.replaceChildren(loading);
    try {
      const response = await fetch("assets/data/hotels.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || !Array.isArray(data.hotels)) throw new Error("Invalid hotel data");
      state.hotels = data.hotels.filter(validHotel).map(normalizeHotel);
      state.compareIds = readCompare().filter(id => state.hotels.some(hotel => hotel.id === id));
      updateCompare();
      parseUrl();
      if (state.category) selectCategory(state.category, { push: false });
      else showHome();
      syncUrl();
    } catch (error) {
      console.error("Hotel data could not be loaded", error);
      if (!state.category) {
        state.category = "stage";
        selectCategory(state.category, { push: false });
      }
      ui.experience.hidden = false;
      ui.resultState.replaceChildren();
      const panel = el("div", "state-panel"); panel.append(el("h3", "", "ホテル情報を読み込めませんでした"), el("p", "", "通信環境を確認して、もう一度お試しください。")); const retry = el("button", "button button--secondary", "もう一度読み込む"); retry.type = "button"; retry.addEventListener("click", loadHotels, { once: true }); panel.append(retry); ui.resultState.append(panel);
    }
  }

  loadHotels();
})();
