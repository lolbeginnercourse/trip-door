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
  let gameDetails = [];
  let gameDetailByExact = new Map();
  let gameDetailByHotelVenue = new Map();
  let gameDetailByHotelRank = new Map();
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

  const normalizeLookup = value => String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ \t\r\n　・･\-‐‑‒–—―_〈〉＜＞<>【】\[\]（）()]/g, "");

  const canonicalVenue = value => {
    const normalized = normalizeLookup(value);
    const aliases = {
      [normalizeLookup("千葉JPFドーム")]: normalizeLookup("TIPSTAR DOME CHIBA"),
      [normalizeLookup("千葉JPFドーム（旧 TIPSTAR DOME CHIBA）")]: normalizeLookup("TIPSTAR DOME CHIBA"),
      [normalizeLookup("沖縄サントリーアリーナ")]: normalizeLookup("沖縄アリーナ"),
      [normalizeLookup("沖縄サントリーアリーナ（沖縄アリーナ）")]: normalizeLookup("沖縄アリーナ")
    };
    return aliases[normalized] || normalized;
  };

  const gameVenueLabel = value => ({
    "TIPSTAR DOME CHIBA": "千葉JPFドーム（旧 TIPSTAR DOME CHIBA）",
    "沖縄アリーナ": "沖縄サントリーアリーナ（沖縄アリーナ）"
  }[value] || value);

  const numberIn = value => {
    const match = String(value || "").match(/(\d+)/);
    return match ? Number(match[1]) : null;
  };

  const travelModeFromLabel = label => {
    const text = String(label || "");
    if (text.includes("徒歩")) return "walk";
    if (text.includes("バス")) return "bus";
    if (text.includes("タクシー") || text.includes("車")) return "taxi";
    if (["電車", "地下鉄", "JR", "モノレール", "鉄道", "線"].some(key => text.includes(key))) return "rail";
    return "mixed";
  };

  const parseGameRoute = value => {
    const lines = String(value || "").replace(/\r\n/g, "\n").split("\n").filter(line => line.trim());
    const chunks = [];
    let current = null;
    lines.forEach(line => {
      const match = line.match(/^\s*\d+\.\s*(.*)$/);
      if (match) {
        if (current) chunks.push(current);
        current = { head: match[1].trim(), subs: [] };
      } else if (current) {
        current.subs.push(line.trim());
      }
    });
    if (current) chunks.push(current);

    return chunks.map(chunk => {
      if (chunk.head.startsWith("●")) {
        return { kind: "place", label: chunk.head.replace(/^●\s*/, "") };
      }
      if (["乗換", "i", "案内", "注意"].includes(chunk.head)) {
        const extra = chunk.subs.length ? `：${chunk.subs.join(" ")}` : "";
        return { kind: "note", label: `${chunk.head}${extra}` };
      }

      let minutes = null;
      const detailParts = [];
      chunk.subs.forEach(sub => {
        const match = sub.match(/約?\s*(\d+)\s*分/);
        if (match && minutes === null) {
          minutes = Number(match[1]);
          const residual = sub.replace(/約?\s*\d+\s*分/, "").trim();
          if (residual) detailParts.push(residual);
        } else {
          detailParts.push(sub);
        }
      });

      const step = {
        kind: "travel",
        mode: travelModeFromLabel(chunk.head),
        label: chunk.head
      };
      if (Number.isFinite(minutes)) step.minutes = minutes;
      if (detailParts.length) step.detail = detailParts.join(" ");
      return step;
    });
  };

  const decodeGameDetails = payload => {
    const dictionary = payload?.d || {};
    const rows = Array.isArray(payload?.z) ? payload.z : [];
    const hotelNames = dictionary.h || [];
    const venues = dictionary.v || [];
    const heroTexts = dictionary.x || [];
    const stations = dictionary.s || [];
    const plans = dictionary.p || [];
    const rooms = dictionary.r || [];
    const cancellations = dictionary.c || [];
    const roles = dictionary.o || [];
    const notes = dictionary.a || [];
    const routes = dictionary.q || [];
    const checkedAt = payload?.date || null;
    const modes = ["walk", "rail", "bus", "taxi", "mixed", "unknown"];
    const money = value => Number.isFinite(value) ? `${new Intl.NumberFormat("ja-JP").format(value)}円（目安）` : null;
    const range = (min, max) => Number.isFinite(min) && Number.isFinite(max)
      ? `約${new Intl.NumberFormat("ja-JP").format(min)}～${new Intl.NumberFormat("ja-JP").format(max)}円`
      : null;

    return rows.map(row => {
      const [
        hotelIndex, venueIndex, rank, heroIndex, modeIndex,
        hotelStationIndex, hotelWalkMin, transferCount, venueStationIndex, venueWalkMin,
        routeRef, noteIndex, roleIndex, priceEstimate, priceMin, priceMax,
        planIndex, roomIndex, cancellationIndex
      ] = row;
      const hotelName = hotelNames[hotelIndex] || "";
      const venueName = venues[venueIndex] || "";
      const displayVenue = gameVenueLabel(venueName);
      const heroText = heroTexts[heroIndex] || "";
      const mode = modes[modeIndex] || "unknown";
      const suitability = roles[roleIndex] || "";

      let routeSteps;
      if (Number(routeRef) < 0) {
        const simpleMode = modes[Math.abs(Number(routeRef)) - 1] || mode;
        const minutes = numberIn(heroText);
        routeSteps = [
          { kind: "place", label: hotelName },
          {
            kind: "travel",
            mode: simpleMode,
            label: simpleMode === "taxi" ? "タクシー／車" : modeLabel(simpleMode),
            ...(Number.isFinite(minutes) ? { minutes } : {}),
            detail: `${displayVenue}まで`
          },
          { kind: "place", label: displayVenue }
        ];
      } else {
        routeSteps = parseGameRoute(routes[routeRef] || "");
      }

      return {
        hotelName,
        venueName: displayVenue,
        rank,
        lookup: { hotelName, venueName, rank },
        coverage: "full",
        availability: "active",
        suppressBooking: true,
        access: {
          heroMin: numberIn(heroText),
          heroText,
          mode,
          hotelStation: stations[hotelStationIndex] || null,
          hotelWalkMin: Number.isFinite(hotelWalkMin) ? hotelWalkMin : null,
          transferCount: Number.isFinite(transferCount) ? transferCount : null,
          venueStation: stations[venueStationIndex] || null,
          venueWalkMin: Number.isFinite(venueWalkMin) ? venueWalkMin : null,
          routeSteps,
          note: notes[noteIndex] || ""
        },
        stay: {
          priceEstimate: money(priceEstimate),
          priceRange: range(priceMin, priceMax),
          plan: plans[planIndex] || null,
          roomType: rooms[roomIndex] || null,
          cancellation: cancellations[cancellationIndex] || null
        },
        fit: {
          role: `${displayVenue}周辺の候補${rank}`,
          summary: `${suitability}${suitability ? "。" : ""}指定日の確定在庫価格ではなく、既存調査の公開料金帯・ホテル格・地域相場などを基にした、1名素泊まりの安い～標準客室の予約目安。`
        },
        bookingChecks: ["会場へのアクセス", "料金目安", "プランごとのキャンセル条件"],
        checkedAt,
        sources: []
      };
    });
  };

  const addUniqueLookup = (map, key, detail) => {
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, detail);
      return;
    }
    const current = map.get(key);
    if (current !== detail) map.set(key, null);
  };

  const indexGameDetails = records => {
    gameDetails = Array.isArray(records) ? records.filter(Boolean) : [];
    gameDetailByExact = new Map();
    gameDetailByHotelVenue = new Map();
    gameDetailByHotelRank = new Map();

    gameDetails.forEach(detail => {
      const lookup = detail.lookup || {};
      const hotelName = normalizeLookup(lookup.hotelName || detail.hotelName);
      const venueName = canonicalVenue(lookup.venueName || detail.venueName);
      const rank = Number(lookup.rank ?? detail.rank);
      if (!hotelName || !venueName) return;

      gameDetailByExact.set(`${hotelName}|${venueName}|${Number.isFinite(rank) ? rank : ""}`, detail);
      addUniqueLookup(gameDetailByHotelVenue, `${hotelName}|${venueName}`, detail);
      if (Number.isFinite(rank)) addUniqueLookup(gameDetailByHotelRank, `${hotelName}|${rank}`, detail);
    });
  };

  const findGameDetail = hotel => {
    if (!hotel) return null;
    const hotelName = normalizeLookup(hotel.name);
    const venueName = canonicalVenue(hotel.venueLabel || hotel.venueName);
    const rank = Number(hotel.rank);
    if (!hotelName) return null;

    if (venueName && Number.isFinite(rank)) {
      const exact = gameDetailByExact.get(`${hotelName}|${venueName}|${rank}`);
      if (exact) return exact;
    }
    if (venueName) {
      const byVenue = gameDetailByHotelVenue.get(`${hotelName}|${venueName}`);
      if (byVenue) return byVenue;
    }
    if (Number.isFinite(rank)) {
      const byRank = gameDetailByHotelRank.get(`${hotelName}|${rank}`);
      if (byRank) return byRank;
    }
    return null;
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

  const loadJson = (path, label) => fetch(path, { cache: "no-cache", headers: { Accept: "application/json" } })
    .then(async response => {
      if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
      return response.json();
    });

  const loadData = (async () => {
    const [detailResult, hotelResult, ...gameResults] = await Promise.allSettled([
      loadJson("assets/data/hotel-details.json", "hotel-details"),
      loadJson("assets/data/hotels.json", "hotels"),
      loadJson("assets/data/game-hotel-details-1.json", "game-hotel-details-1"),
      loadJson("assets/data/game-hotel-details-2.json", "game-hotel-details-2"),
      loadJson("assets/data/game-hotel-details-3.json", "game-hotel-details-3"),
      loadJson("assets/data/game-hotel-details-4.json", "game-hotel-details-4")
    ]);

    if (detailResult.status === "fulfilled") {
      const records = detailResult.value?.records;
      if (records && typeof records === "object") details = new Map(Object.entries(records));
    } else {
      console.warn("Hotel detail data could not be loaded", detailResult.reason);
    }

    const decodedGameDetails = [];
    gameResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        decodedGameDetails.push(...decodeGameDetails(result.value));
      } else {
        console.warn(`Game hotel detail chunk ${index + 1} could not be loaded`, result.reason);
      }
    });
    indexGameDetails(decodedGameDetails);

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

  const stationLabel = value => {
    const text = String(value || "").trim();
    if (!text) return "";
    return /(駅|停留所|バス停|空港|港)$/.test(text) ? text : `${text}駅`;
  };

  const renderAccessHero = detail => {
    const access = detail.access || {};
    const card = el("section", `hd-access${detail.coverage === "limited" ? " hd-access--limited" : ""}`);
    const copy = el("div", "hd-access__copy");
    copy.append(el("p", "hd-access__eyebrow", `${detail.venueName}へのアクセス`));

    if (access.heroText || Number.isFinite(access.heroMin)) {
      const time = el("p", "hd-access__time");
      const shown = access.heroText ? String(access.heroText) : String(access.heroMin);
      time.append(el("span", "", "約"), el("strong", "", shown), el("span", "", "分"));
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
    if (Number.isFinite(access.hotelWalkMin) && access.hotelStation) addFact(`${stationLabel(access.hotelStation)}まで`, `徒歩${access.hotelWalkMin}分`);
    if (Number.isFinite(access.transferCount)) addFact("乗換", `${access.transferCount}回`);
    if (access.venueStation) addFact("会場最寄り", stationLabel(access.venueStation));
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

    // Game/streamer hotel details intentionally keep Rakuten/Jalan URLs unset for now.
    // Preserve the stage/2.5D behavior by suppressing booking only on records that opt in.
    if (detail.suppressBooking === true) {
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
    const researched = details.get(id) || findGameDetail(hotel);
    const detail = researched
      ? { ...researched, id, hotelName: researched.hotelName || hotel?.name || title.textContent }
      : fallbackDetail(hotel || { id, name: title.textContent });
    await render(detail, hotel);

    try { window.dataLayer?.push({ event: "hotel_detail_open", hotel_id: id, detail_source: researched ? "research" : "fallback" }); } catch { /* noop */ }
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