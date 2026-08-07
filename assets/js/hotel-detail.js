(() => {
  "use strict";

  const q = selector => document.querySelector(selector);
  const dialog = q("[data-detail-dialog]");
  const title = q("[data-detail-title]");
  const content = q("[data-detail-content]");
  if (!dialog || !title || !content) return;

  const kicker = dialog.querySelector(".section-kicker");
  let details = new Map();
  let hotels = new Map();
  let lastTrigger = null;

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };

  const isUrl = value => {
    try {
      const url = new URL(value, location.href);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  };

  const modeLabel = mode => ({
    walk: "徒歩",
    rail: "電車",
    bus: "バス",
    taxi: "タクシー",
    mixed: "複合経路",
    unknown: "アクセス"
  }[mode] || "アクセス");

  const formatCheckedAt = value => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10).replaceAll("-", "/");
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }).format(date);
  };

  const readCompareIds = () => {
    try {
      const raw = JSON.parse(localStorage.getItem("tripDoorCompare") || "null");
      const ids = Array.isArray(raw) ? raw : raw?.hotelIds;
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  };

  const statusChecks = hotel => {
    const labels = [];
    (hotel?.statuses || []).forEach(item => {
      const label = Array.isArray(item) ? item[0] : item?.label;
      const state = Array.isArray(item) ? item[1] : item?.state;
      if (label && state !== "confirmed") labels.push(String(label));
    });
    if (!labels.length) labels.push("宿泊日当日の料金・空室");
    if (!labels.some(label => label.includes("キャンセル"))) labels.push("プランごとのキャンセル条件");
    return [...new Set(labels)].slice(0, 6);
  };

  const fallbackDetail = hotel => ({
    id: hotel?.id,
    hotelName: hotel?.name || "ホテル",
    venueName: hotel?.venueLabel || "会場",
    venueId: hotel?.venueId || null,
    rank: hotel?.rank || null,
    coverage: "limited",
    availability: "active",
    access: {
      heroMin: null,
      mode: "unknown",
      routeSteps: hotel?.accessEstimate ? [{ kind: "note", label: `一覧データのアクセス目安: ${hotel.accessEstimate}` }] : [],
      note: "詳細データを取得できなかったため、確定した合計所要時間は表示していません"
    },
    stay: {
      priceEstimate: hotel?.priceEstimate || null,
      priceRange: hotel?.priceRangeEstimate || null,
      plan: hotel?.planEstimate || null,
      roomType: hotel?.roomTypeEstimate || null,
      cancellation: hotel?.cancellationEstimate || null
    },
    fit: { role: hotel?.role || null, summary: hotel?.summary || null },
    bookingChecks: statusChecks(hotel),
    checkedAt: hotel?.researchedAt || hotel?.updatedAt || null,
    sources: []
  });

  const loadData = (async () => {
    const [detailResult, hotelResult] = await Promise.allSettled([
      fetch("assets/data/hotel-details.json", { cache: "no-cache", headers: { Accept: "application/json" } }).then(async response => {
        if (!response.ok) throw new Error(`hotel-details HTTP ${response.status}`);
        return response.json();
      }),
      fetch("assets/data/hotels.json", { cache: "no-cache", headers: { Accept: "application/json" } }).then(async response => {
        if (!response.ok) throw new Error(`hotels HTTP ${response.status}`);
        return response.json();
      })
    ]);

    if (detailResult.status === "fulfilled") {
      const records = detailResult.value?.records;
      if (records && typeof records === "object") details = new Map(Object.entries(records));
    } else {
      console.warn("Hotel detail data could not be loaded", detailResult.reason);
    }

    if (hotelResult.status === "fulfilled") {
      const rows = hotelResult.value?.hotels;
      if (Array.isArray(rows)) hotels = new Map(rows.filter(item => item?.id).map(item => [item.id, item]));
    } else {
      console.warn("Base hotel data could not be loaded for detail fallback", hotelResult.reason);
    }
  })();

  const section = (heading, className = "") => {
    const node = el("section", `hd-section${className ? ` ${className}` : ""}`);
    node.append(el("h3", "hd-section__title", heading));
    return node;
  };

  const renderAvailability = detail => {
    if (detail.availability !== "closed") return null;
    const alert = el("div", "hd-alert hd-alert--danger");
    alert.setAttribute("role", "alert");
    alert.append(
      el("strong", "", "営業終了情報があります"),
      el("p", "", "この施設は予約候補として使用せず、別の候補ホテルを選んでください")
    );
    return alert;
  };

  const renderAccessHero = detail => {
    const access = detail.access || {};
    const card = el("section", `hd-access${detail.coverage === "limited" ? " hd-access--limited" : ""}`);
    const copy = el("div", "hd-access__copy");
    copy.append(el("p", "hd-access__eyebrow", `${detail.venueName}へのアクセス`));

    if (Number.isFinite(access.heroMin)) {
      const time = el("p", "hd-access__time");
      time.append(el("span", "", "約"), el("strong", "", String(access.heroMin)), el("span", "", "分"));
      copy.append(time, el("p", "hd-access__caption", "ホテルから会場までの確認済み目安"));
    } else {
      copy.append(
        el("h3", "hd-access__limited-title", "確認できたアクセス情報"),
        el("p", "hd-access__caption", "未確認区間は合算せず、確認できた情報だけを表示しています")
      );
    }

    const badge = el("span", "hd-mode-badge", modeLabel(access.mode));
    card.append(copy, badge);

    const facts = el("div", "hd-access-facts");
    const addFact = (label, value) => {
      if (!value) return;
      const item = el("div", "hd-access-fact");
      item.append(el("span", "hd-access-fact__label", label), el("strong", "", value));
      facts.append(item);
    };
    if (Number.isFinite(access.hotelWalkMin) && access.hotelStation) addFact(`${access.hotelStation}駅まで`, `徒歩${access.hotelWalkMin}分`);
    if (Number.isFinite(access.transferCount)) addFact("乗換", `${access.transferCount}回`);
    if (access.venueStation) addFact("会場最寄り", `${access.venueStation}駅`);
    if (Number.isFinite(access.venueWalkMin)) addFact("駅から会場", `徒歩${access.venueWalkMin}分`);
    if (facts.childElementCount) card.append(facts);

    if (access.note) card.append(el("p", "hd-access__note", access.note));
    return card;
  };

  const renderRoute = detail => {
    const steps = Array.isArray(detail.access?.routeSteps) ? detail.access.routeSteps : [];
    if (!steps.length) return null;
    const block = section("会場までの行き方", "hd-route-section");
    const route = el("ol", "hd-route");
    steps.forEach(step => {
      const item = el("li", `hd-route__step hd-route__step--${step.kind || "note"}`);
      const marker = el("span", "hd-route__marker", step.kind === "travel" ? modeLabel(step.mode) : step.kind === "place" ? "●" : "i");
      const body = el("div", "hd-route__body");
      if (step.kind === "travel") {
        const heading = el("div", "hd-route__travel-head");
        heading.append(el("strong", "", step.label || modeLabel(step.mode)));
        if (Number.isFinite(step.minutes)) heading.append(el("span", "hd-route__minutes", `${step.minutes}分`));
        body.append(heading);
        if (step.detail) body.append(el("p", "", step.detail));
      } else {
        body.append(step.kind === "place" ? el("strong", "", step.label) : el("p", "", step.label));
      }
      item.append(marker, body);
      route.append(item);
    });
    block.append(route);
    return block;
  };

  const renderStay = detail => {
    const stay = detail.stay || {};
    const items = [
      ["料金目安", stay.priceEstimate],
      ["想定価格帯", stay.priceRange],
      ["想定プラン", stay.plan],
      ["部屋タイプ", stay.roomType],
      ["キャンセル", stay.cancellation]
    ].filter(([, value]) => value);
    if (!items.length) return null;

    const block = section("宿泊条件の目安");
    const grid = el("dl", "hd-info-grid");
    items.forEach(([label, value]) => {
      const item = el("div", "hd-info-grid__item");
      item.append(el("dt", "", label), el("dd", "", value));
      grid.append(item);
    });
    block.append(grid, el("p", "hd-section__footnote", "料金・プラン・キャンセル条件は宿泊日と予約プランにより変わります"));
    return block;
  };

  const renderFit = detail => {
    const role = detail.fit?.role;
    const summary = detail.fit?.summary;
    if (!role && !summary) return null;
    const block = section("このホテルが向いている人");
    if (role) block.append(el("p", "hd-fit__lead", role));
    if (summary && summary !== role) block.append(el("p", "hd-fit__summary", summary));
    return block;
  };

  const renderChecks = detail => {
    const checks = Array.isArray(detail.bookingChecks) && detail.bookingChecks.length
      ? detail.bookingChecks
      : ["宿泊日当日の料金・空室", "プランごとのキャンセル条件"];
    const block = section("予約前に確認すること");
    const list = el("ul", "hd-checks");
    checks.forEach(check => list.append(el("li", "", check)));
    block.append(list);
    return block;
  };

  const renderSources = detail => {
    const sources = Array.isArray(detail.sources) ? detail.sources.filter(source => source?.label && isUrl(source.url)) : [];
    const checkedAt = formatCheckedAt(detail.checkedAt);
    if (!sources.length && !checkedAt) return null;

    const disclosure = el("details", "hd-sources");
    disclosure.append(el("summary", "", "情報の確認元・確認日"));
    const inside = el("div", "hd-sources__inside");
    if (checkedAt) inside.append(el("p", "hd-checked-at", `最終確認: ${checkedAt}`));
    if (sources.length) {
      const list = el("ul", "hd-source-list");
      sources.forEach(source => {
        const item = el("li");
        const link = el("a", "", source.label);
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        item.append(link);
        list.append(item);
      });
      inside.append(list);
    }
    disclosure.append(inside);
    return disclosure;
  };

  const directAffiliateLinks = hotel => {
    const candidates = Array.isArray(hotel?.affiliateLinks) ? hotel.affiliateLinks : [
      hotel?.rakuten ? { provider: "楽天トラベル", url: hotel.rakuten } : null,
      hotel?.jalan ? { provider: "じゃらん", url: hotel.jalan } : null
    ];
    return (candidates || [])
      .filter(link => link?.provider && isUrl(link.url))
      .slice(0, 2);
  };

  const fetchAffiliateLinks = async hotel => {
    const direct = directAffiliateLinks(hotel);
    if (direct.length) return direct;
    if (!hotel?.name) return [];
    try {
      const params = new URLSearchParams({ name: hotel.name });
      if (hotel.rakutenHotelNo) params.set("rakutenHotelNo", hotel.rakutenHotelNo);
      if (hotel.jalanYadNo) params.set("jalanYadNo", hotel.jalanYadNo);
      const response = await fetch(`/api/affiliate-links?${params}`, { headers: { Accept: "application/json" } });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data.links) ? data.links.filter(link => link?.provider && isUrl(link.url)).slice(0, 2) : [];
    } catch {
      return [];
    }
  };

  const renderActions = async (container, detail, hotel) => {
    const actions = el("div", "hd-actions");
    const compareSelected = readCompareIds().includes(detail.id);
    const compare = el("button", "button button--secondary hd-actions__compare", compareSelected ? "比較候補から外す" : "比較候補に追加する");
    compare.type = "button";
    compare.dataset.toggleCompare = detail.id;
    actions.append(compare);

    if (detail.availability === "closed") {
      actions.append(el("p", "hd-actions__closed", "営業終了情報があるため予約リンクは表示していません"));
      container.append(actions);
      return;
    }

    const booking = el("div", "hd-actions__booking");
    booking.setAttribute("aria-label", "予約サイト");
    actions.append(booking);
    container.append(actions);

    const links = await fetchAffiliateLinks(hotel);
    if (!container.isConnected || !links.length) return;
    links.forEach((link, index) => {
      const anchor = el("a", `button ${index === 0 ? "button--primary" : "button--secondary"}`, `${link.provider}で空室を確認`);
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer sponsored";
      anchor.addEventListener("click", () => {
        try { window.dataLayer?.push({ event: "affiliate_click", hotel_id: detail.id, provider: link.provider, source: "hotel_detail" }); } catch { /* noop */ }
      });
      booking.append(anchor);
    });
  };

  const render = async (detail, hotel) => {
    title.textContent = detail.hotelName || hotel?.name || "ホテルの詳細";
    if (kicker) kicker.textContent = detail.venueName
      ? `${detail.venueName}${detail.rank ? `｜候補${detail.rank}` : ""}`
      : "ホテルの詳細";

    const shell = el("article", "hd-detail");
    shell.dataset.hotelId = detail.id || "";

    const availability = renderAvailability(detail);
    if (availability) shell.append(availability);
    shell.append(renderAccessHero(detail));

    const route = renderRoute(detail);
    if (route) shell.append(route);

    const fit = renderFit(detail);
    if (fit) shell.append(fit);

    const stay = renderStay(detail);
    if (stay) shell.append(stay);

    shell.append(renderChecks(detail));

    const sources = renderSources(detail);
    if (sources) shell.append(sources);

    content.replaceChildren(shell);
    await renderActions(shell, detail, hotel);
  };

  const open = async (id, trigger) => {
    lastTrigger = trigger;
    const other = q("[data-compare-dialog]");
    if (other?.open) other.close();

    title.textContent = trigger.closest("[data-hotel-id]")?.querySelector("h3")?.textContent?.trim() || "ホテルの詳細";
    if (kicker) kicker.textContent = "ホテルの詳細";
    const loading = el("div", "hd-loading");
    loading.append(el("strong", "", "詳細情報を読み込んでいます"), el("p", "", "会場までのアクセスを確認しています"));
    content.replaceChildren(loading);

    if (!dialog.open) dialog.showModal();
    document.body.classList.add("is-locked");

    await loadData;
    const hotel = hotels.get(id) || null;
    const detail = details.get(id) || fallbackDetail(hotel || { id, name: title.textContent });
    await render(detail, hotel);

    try { window.dataLayer?.push({ event: "hotel_detail_open", hotel_id: id, detail_source: details.has(id) ? "research" : "fallback" }); } catch { /* noop */ }
  };

  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-open-detail]");
    if (!trigger) return;
    const id = trigger.dataset.openDetail;
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void open(id, trigger);
  }, true);

  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener("close", () => {
    document.body.classList.remove("is-locked");
    if (kicker) kicker.textContent = "ホテルの詳細";
    lastTrigger?.focus?.();
  });

  dialog.querySelector("[data-close-detail]")?.addEventListener("click", () => {
    if (dialog.open) dialog.close();
  });
})();
