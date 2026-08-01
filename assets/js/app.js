const hotels = [
  {
    id: "tokyo-dome-hotel",
    genre: "stage",
    name: "東京ドームホテル",
    role: "終演後の移動を最短に",
    area: "水道橋・後楽園",
    venueLabel: "東京ドームシティ周辺",
    venues: ["kanadevia"],
    station: "JR水道橋駅から徒歩約2分",
    summary:
      "終演後すぐ戻れるし、物販後やマチソワ間にホテルへ戻る可能性を残したい人向け。",
    styles: ["solo", "group", "matinee", "stay"],
    priorities: ["near", "baggage", "mirror"],
    facts: [
      "東京ドームシティ内の会場に便利",
      "チェックイン前の荷物預かりを確認",
      "客室タイプが豊富"
    ],
    statuses: [
      ["会場への近さ", "confirmed", "東京ドームシティ内の会場を利用する日に強い"],
      ["荷物預かり", "confirmed", "公式案内で事前預かりを確認"],
      ["姿見・デスク", "conditional", "客室タイプと写真で確認"]
    ],
    rakuten: "https://travel.rakuten.co.jp/HOTEL/4805/4805.html",
    jalan: "https://www.jalan.net/yad321419/"
  },
  {
    id: "metropolitan-ikebukuro",
    genre: "stage",
    name: "ホテルメトロポリタン",
    role: "劇場・食事・連泊を池袋に集約",
    area: "池袋西口",
    venueLabel: "東京芸術劇場周辺",
    venues: ["geigeki"],
    station: "JR池袋駅から徒歩約1〜3分",
    summary:
      "劇場、飲食、翌日の移動を池袋にまとめたい遠征向け。友人との宿泊や連泊にも合わせやすい。",
    styles: ["solo", "group", "matinee", "stay"],
    priorities: ["near", "station", "baggage", "mirror"],
    facts: [
      "東京芸術劇場のある西口エリア",
      "複数の客室タイプ",
      "周辺の飲食店が豊富"
    ],
    statuses: [
      ["劇場動線", "confirmed", "池袋西口エリアで移動をまとめやすい"],
      ["グループ遠征", "confirmed", "ツインなど複数の客室タイプを選びやすい"],
      ["鏡・デスク", "conditional", "予約する客室タイプの写真で確認"]
    ],
    rakuten: "https://travel.rakuten.co.jp/HOTEL/388/388.html",
    jalan: "https://www.jalan.net/yad306290/"
  },
  {
    id: "monterey-hanzomon",
    genre: "stage",
    name: "ホテルモントレ半蔵門",
    role: "武道館と終演後の静けさ",
    area: "半蔵門・九段下",
    venueLabel: "日本武道館周辺",
    venues: ["budokan"],
    station: "半蔵門駅5番出口の向かい",
    summary:
      "駅前の分かりやすさと、終演後に落ち着いて休める環境を重視する一人遠征向け。",
    styles: ["solo", "stay"],
    priorities: ["quiet", "station", "baggage"],
    facts: [
      "半蔵門駅前",
      "武道館への徒歩移動を検討可能",
      "落ち着いた客室デザイン"
    ],
    statuses: [
      ["駅への近さ", "confirmed", "半蔵門駅出口の向かい"],
      ["静かな滞在", "conditional", "部屋位置や階数で周辺音が変わる"],
      ["荷物預かり", "conditional", "利用日と時間をホテルへ確認"]
    ],
    rakuten: "https://travel.rakuten.co.jp/HOTEL/52639/52639.html",
    jalan: "https://www.jalan.net/yad384371/"
  },
  {
    id: "apa-makuhari",
    genre: "esports",
    name: "アパホテル＆リゾート〈東京ベイ幕張〉",
    role: "会場徒歩と大浴場",
    area: "海浜幕張",
    venueLabel: "幕張メッセ",
    venues: ["makuhari"],
    station: "JR海浜幕張駅から徒歩約7分",
    summary:
      "イベント終了後の移動を短くし、大浴場で体を休めたい参加者・観戦者向け。",
    styles: ["player", "spectator", "device", "group", "stay"],
    priorities: ["near", "bath", "food"],
    facts: [
      "幕張メッセ徒歩圏",
      "大浴場あり",
      "館内・近隣で食事を確保しやすい"
    ],
    statuses: [
      ["会場への近さ", "confirmed", "幕張メッセ徒歩圏"],
      ["大浴場", "confirmed", "イベント後の回復候補"],
      ["通信・机", "conditional", "混雑時の速度と客室机を要確認"]
    ],
    rakuten: "https://travel.rakuten.co.jp/HOTEL/51637/",
    jalan: "https://www.jalan.net/yad350664/"
  },
  {
    id: "springs-makuhari",
    genre: "esports",
    name: "ホテルスプリングス幕張",
    role: "駅近と複数人遠征",
    area: "海浜幕張駅北口",
    venueLabel: "幕張メッセ",
    venues: ["makuhari"],
    station: "JR海浜幕張駅北口から徒歩約2分",
    summary:
      "重いデバイス荷物を持って駅から長く歩きたくない人や、複数人で泊まる遠征向け。",
    styles: ["player", "device", "group", "stay"],
    priorities: ["station", "desk", "food"],
    facts: [
      "海浜幕張駅から近い",
      "ツイン・広めの客室を選びやすい",
      "幕張メッセへ徒歩移動可能"
    ],
    statuses: [
      ["駅への近さ", "confirmed", "海浜幕張駅北口から徒歩約2分"],
      ["複数人利用", "confirmed", "客室タイプから選択可能"],
      ["机・電源", "conditional", "デバイス利用時は客室写真で確認"]
    ],
    rakuten: "https://travel.rakuten.co.jp/HOTEL/29726/",
    jalan: "https://www.jalan.net/yad328843/"
  },
  {
    id: "villa-fontaine-ariake",
    genre: "esports",
    name: "ヴィラフォンテーヌ グランド 東京有明",
    role: "会場・食事・温浴を有明で完結",
    area: "有明・国際展示場",
    venueLabel: "東京ガーデンシアター／東京ビッグサイト",
    venues: ["ariake", "bigsite"],
    station: "有明駅から徒歩約4分",
    summary:
      "会場、食事、温浴を有明エリア内でまとめたい人や、前泊・連日参加向け。",
    styles: ["player", "spectator", "group", "stay"],
    priorities: ["near", "bath", "food", "station"],
    facts: [
      "東京ガーデンシアターに隣接",
      "有明ガーデン直結",
      "温浴施設を利用しやすい"
    ],
    statuses: [
      ["会場動線", "confirmed", "有明の主要イベント会場に移動しやすい"],
      ["食事環境", "confirmed", "商業施設内で選択肢を確保しやすい"],
      ["机・通信", "conditional", "使用予定の客室タイプで確認"]
    ],
    rakuten: "https://travel.rakuten.co.jp/HOTEL/178230/178230.html",
    jalan: "https://www.jalan.net/yad379750/"
  },
  {
    id: "nohga-ueno",
    genre: "art",
    name: "NOHGA HOTEL UENO TOKYO",
    role: "上野の美術館巡りと地域文化",
    area: "上野",
    venueLabel: "上野公園ミュージアム群",
    venues: ["ueno"],
    station: "東京メトロ上野駅から徒歩約3分",
    summary:
      "展示だけでなく、上野の街や工芸にも触れたい一人旅向け。落ち着いた滞在を組み立てやすい。",
    styles: ["museum", "walk", "solo", "quiet"],
    priorities: ["station", "design", "desk", "quiet", "walk"],
    facts: [
      "上野駅から近い",
      "地域の工芸を取り入れた客室",
      "ライブラリーラウンジ"
    ],
    statuses: [
      ["美術館へ動きやすい", "confirmed", "上野公園の美術館群へ向かいやすい"],
      ["館内デザイン", "confirmed", "地域の工芸を客室に取り入れている"],
      ["図録用デスク", "conditional", "客室タイプの机サイズを確認"]
    ],
    rakuten: "https://travel.rakuten.co.jp/HOTEL/167837/167837.html",
    jalan: "https://www.jalan.net/yad302349/"
  },
  {
    id: "kaika-tokyo",
    genre: "art",
    name: "KAIKA 東京 by THE SHARE HOTELS",
    role: "ホテル自体をアート体験に",
    area: "本所・浅草・蔵前",
    venueLabel: "浅草・蔵前・両国アート散策",
    venues: ["sumida"],
    station: "浅草駅から徒歩約9分",
    summary:
      "アートストレージとホテルが融合した施設。宿泊自体にも作品との出会いを求める人向け。",
    styles: ["walk", "hotelart", "solo"],
    priorities: ["design", "walk", "desk"],
    facts: [
      "アートストレージを併設",
      "浅草・蔵前・両国を巡りやすい",
      "宿泊自体がアート体験"
    ],
    statuses: [
      ["館内アート", "confirmed", "館内で作品との出会いを楽しめる"],
      ["街歩き", "confirmed", "周辺の複数エリアを組み合わせやすい"],
      ["静けさ", "conditional", "部屋位置や周辺音を予約前に確認"]
    ],
    rakuten: "https://travel.rakuten.co.jp/HOTEL/178476/178476.html",
    jalan: "https://www.jalan.net/yad330083/"
  },
  {
    id: "remm-roppongi",
    genre: "art",
    name: "レム六本木",
    role: "六本木アート巡りと休息",
    area: "六本木",
    venueLabel: "六本木アートエリア",
    venues: ["roppongi"],
    station: "六本木駅から徒歩約1分",
    summary:
      "鑑賞後の移動を短くし、睡眠と翌日の回復を重視するアート巡り向け。",
    styles: ["museum", "solo", "quiet"],
    priorities: ["station", "quiet", "walk"],
    facts: [
      "六本木駅から近い",
      "主要美術館を巡りやすい",
      "休息を重視した滞在"
    ],
    statuses: [
      ["美術館へ動きやすい", "confirmed", "六本木の主要美術館を巡りやすい"],
      ["駅への近さ", "confirmed", "六本木駅から徒歩約1分"],
      ["客室の静けさ", "conditional", "部屋位置や階数によって変わる"]
    ],
    rakuten: "https://travel.rakuten.co.jp/HOTEL/153693/153693.html",
    jalan: "https://www.jalan.net/yad382341/"
  }
];

const genreLabels = {
  stage: "舞台遠征",
  esports: "eスポーツ",
  art: "アート巡り"
};

let currentPage = "home";
let currentDetailId = null;
let noticeTimer = null;

function removeCompareStorage() {
  try {
    localStorage.removeItem("tripDoorCompare");
    return true;
  } catch {
    return false;
  }
}

function loadCompareIds() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("tripDoorCompare") || "[]"
    );

    if (!Array.isArray(saved)) {
      removeCompareStorage();
      return [];
    }

    return saved.filter((id) => hotels.some((hotel) => hotel.id === id));
  } catch {
    removeCompareStorage();
    return [];
  }
}

let compareIds = loadCompareIds();

const pages = [...document.querySelectorAll("[data-page]")];
const navButtons = [...document.querySelectorAll(".nav-button")];
const compareTray = document.querySelector("[data-compare-tray]");
const compareCount = document.querySelector("[data-compare-count]");
const compareDialog = document.querySelector("[data-compare-dialog]");
const compareGrid = document.querySelector("[data-compare-grid]");
const detailDialog = document.querySelector("[data-detail-dialog]");
const detailTitle = document.querySelector("[data-detail-title]");
const detailKicker = document.querySelector("[data-detail-kicker]");
const detailContent = document.querySelector("[data-detail-content]");
const siteNotice = document.querySelector("[data-site-notice]");

function saveCompareIds() {
  try {
    localStorage.setItem("tripDoorCompare", JSON.stringify(compareIds));
  } catch {
    showNotice("比較候補をブラウザに保存できませんでした。ページを閉じると候補が消える場合があります。");
  }
}

function showNotice(message) {
  window.clearTimeout(noticeTimer);
  siteNotice.textContent = message;
  siteNotice.classList.add("visible");

  noticeTimer = window.setTimeout(() => {
    siteNotice.classList.remove("visible");
  }, 2800);
}

function syncModalState() {
  document.body.classList.toggle(
    "modal-open",
    compareDialog.open || detailDialog.open
  );
}

function navigate(pageName) {
  const nextPage = document.querySelector(`[data-page="${pageName}"]`);

  if (!nextPage) {
    return;
  }

  currentPage = pageName;

  pages.forEach((page) => {
    page.hidden = page !== nextPage;
    page.classList.remove("page-enter");
  });

  nextPage.classList.add("page-enter");

  navButtons.forEach((button) => {
    const isCurrent = button.dataset.route === pageName;
    button.classList.toggle("active", isCurrent);

    if (isCurrent) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  document.documentElement.scrollTop = 0;

  if (pageName !== "home") {
    renderResults(pageName);
  }

  const nextUrl = pageName === "home"
    ? `${location.pathname}${location.search}`
    : `#${pageName}`;

  history.replaceState(null, "", nextUrl);
}

function scoreHotel(hotel, priority) {
  if (priority !== "all" && hotel.priorities.includes(priority)) {
    return 7;
  }

  return 0;
}

function getSelectedLabel(selectElement) {
  return selectElement.options[selectElement.selectedIndex]?.text || "";
}

function getFormValues(genre) {
  const form = document.querySelector(`[data-search-form="${genre}"]`);

  return {
    venue: form.elements.venue.value,
    venueLabel: getSelectedLabel(form.elements.venue),
    style: form.elements.style.value,
    styleLabel: getSelectedLabel(form.elements.style),
    priority: form.elements.priority.value,
    priorityLabel: getSelectedLabel(form.elements.priority)
  };
}

const appliedFilters = Object.fromEntries(
  ["stage", "esports", "art"].map((genre) => [genre, getFormValues(genre)])
);

function getAppliedFilters(genre) {
  return appliedFilters[genre] || getFormValues(genre);
}

function applyCurrentFormFilters(genre) {
  appliedFilters[genre] = getFormValues(genre);
  return appliedFilters[genre];
}

function syncPriorityChips(form) {
  const selectedPriority = form.elements.priority.value;

  form.querySelectorAll(".quick-chip").forEach((button) => {
    const isActive = button.dataset.quickPriority === selectedPriority;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getMatchInfo(hotel, values) {
  const items = [];

  if (values.venue !== "all") {
    items.push({
      matched: hotel.venues.includes(values.venue),
      text: `会場・エリア「${values.venueLabel}」に一致`
    });
  }

  if (values.style !== "all") {
    items.push({
      matched: hotel.styles.includes(values.style),
      text: `スタイル「${values.styleLabel}」に対応`
    });
  }

  if (values.priority !== "all") {
    const matched = hotel.priorities.includes(values.priority);

    items.push({
      matched,
      text: matched
        ? `優先条件「${values.priorityLabel}」が主な特徴に含まれます`
        : `優先条件「${values.priorityLabel}」は主な特徴として掲載していません`
    });
  }

  return {
    items,
    activeCount: items.length,
    matchedCount: items.filter((item) => item.matched).length
  };
}

function renderMatchPanel(hotel, values) {
  const match = getMatchInfo(hotel, values);

  if (!match.activeCount) {
    return `
      <div class="match-panel neutral">
        <div class="match-head">
          <strong>選んだ条件との相性</strong>
          <span class="match-score">条件を選択していません</span>
        </div>
        <p class="match-note">
          会場・スタイル・優先したいことを選ぶと、このホテルが合う理由を表示します。
        </p>
      </div>
    `;
  }

  const items = match.items.map((item) => {
    return `
      <li class="match-item ${item.matched ? "matched" : "pending"}">
        ${escapeHtml(item.text)}
      </li>
    `;
  }).join("");

  return `
    <div class="match-panel">
      <div class="match-head">
        <strong>選んだ条件との相性</strong>
        <span class="match-score">
          ${match.matchedCount}/${match.activeCount}項目が一致
        </span>
      </div>
      <ul class="match-list">${items}</ul>
    </div>
  `;
}

function renderStatuses(statuses, detailMode = false) {
  return statuses.map(([label, status, text]) => {
    const stateText = status === "confirmed" ? "確認済み" : "予約時に確認";
    const stateClass = status === "confirmed"
      ? "confirmed-state"
      : "conditional-state";

    if (detailMode) {
      return `
        <li class="detail-status-item">
          <span class="detail-status-icon ${status}" aria-hidden="true">
            ${status === "confirmed" ? "✓" : "△"}
          </span>
          <span class="detail-status-copy">
            <strong>
              ${escapeHtml(label)}
              <span class="status-state ${stateClass}">${stateText}</span>
            </strong>
            <small>${escapeHtml(text)}</small>
          </span>
        </li>
      `;
    }

    return `
      <div class="status">
        <strong>
          <span class="status-dot ${status}" aria-hidden="true"></span>
          ${escapeHtml(label)}
          <span class="status-state ${stateClass}">${stateText}</span>
        </strong>
        <small>${escapeHtml(text)}</small>
      </div>
    `;
  }).join("");
}

function renderHotelCard(hotel, values) {
  const isCompared = compareIds.includes(hotel.id);
  const statuses = renderStatuses(hotel.statuses);
  const matchPanel = renderMatchPanel(hotel, values);

  const facts = hotel.facts.map((fact) => {
    return `<span class="fact">${escapeHtml(fact)}</span>`;
  }).join("");

  return `
    <article class="hotel-card">
      <div class="hotel-visual">
        <span class="visual-label">${escapeHtml(genreLabels[hotel.genre])}</span>
        <span class="visual-area">${escapeHtml(hotel.area)}</span>
      </div>

      <div class="hotel-content">
        <span class="hotel-role">${escapeHtml(hotel.role)}</span>
        <h3>${escapeHtml(hotel.name)}</h3>

        <p class="hotel-location">
          ${escapeHtml(hotel.area)}｜${escapeHtml(hotel.venueLabel)}
        </p>

        <p class="hotel-summary">${escapeHtml(hotel.summary)}</p>

        <div class="facts">${facts}</div>
        ${matchPanel}
        <div class="status-grid">${statuses}</div>

        <div class="hotel-actions">
          <button
            class="button primary"
            type="button"
            data-show-detail="${escapeHtml(hotel.id)}"
          >
            ホテルの詳細を見る
          </button>

          <a
            class="button small"
            href="${escapeHtml(hotel.rakuten)}"
            target="_blank"
            rel="sponsored noopener"
          >
            楽天トラベル
          </a>

          <a
            class="button small"
            href="${escapeHtml(hotel.jalan)}"
            target="_blank"
            rel="sponsored noopener"
          >
            じゃらん
          </a>

          <button
            class="compare-button ${isCompared ? "active" : ""}"
            type="button"
            data-compare-id="${escapeHtml(hotel.id)}"
            aria-pressed="${isCompared}"
          >
            ${isCompared ? "✓ 比較候補に追加済み" : "＋ 比較候補に追加"}
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderResults(genre, options = {}) {
  const { applyForm = false } = options;
  const list = document.querySelector(`[data-result-list="${genre}"]`);
  const summary = document.querySelector(`[data-result-summary="${genre}"]`);
  const empty = document.querySelector(`[data-empty="${genre}"]`);
  const values = applyForm
    ? applyCurrentFormFilters(genre)
    : getAppliedFilters(genre);

  let results = hotels.filter((hotel) => hotel.genre === genre);

  if (values.venue !== "all") {
    results = results.filter((hotel) => hotel.venues.includes(values.venue));
  }

  if (values.style !== "all") {
    results = results.filter((hotel) => hotel.styles.includes(values.style));
  }

  results.sort((a, b) => {
    return scoreHotel(b, values.priority) - scoreHotel(a, values.priority);
  });

  list.innerHTML = results
    .map((hotel) => renderHotelCard(hotel, values))
    .join("");

  const conditionText = [];

  if (values.venue !== "all") {
    conditionText.push(values.venueLabel);
  }

  if (values.style !== "all") {
    conditionText.push(values.styleLabel);
  }

  if (values.priority !== "all") {
    conditionText.push(`「${values.priorityLabel}」を優先`);
  }

  summary.textContent =
    `${results.length}件のホテルを表示`
    + (conditionText.length ? `｜${conditionText.join("・")}` : "");

  empty.hidden = results.length !== 0;

  if (!results.length) {
    empty.innerHTML = `
      <h3>条件に合うホテルが見つかりません</h3>
      <p>会場やスタイルの条件を「指定なし」に戻すと、表示できるホテルが増えます。</p>
      <button class="button primary" type="button" data-reset="${genre}">
        条件をクリア
      </button>
    `;
  }

  updateCompareUI();
}

function resetForm(genre) {
  const form = document.querySelector(`[data-search-form="${genre}"]`);
  form.reset();
  syncPriorityChips(form);
  renderResults(genre, { applyForm: true });
}

function toggleCompare(id) {
  if (compareIds.includes(id)) {
    compareIds = compareIds.filter((hotelId) => hotelId !== id);
  } else {
    if (compareIds.length >= 3) {
      showNotice("比較できるホテルは最大3件です。いずれか1件を解除してから追加してください。");
      return;
    }

    compareIds.push(id);
  }

  saveCompareIds();

  if (currentPage !== "home") {
    renderResults(currentPage);
  }

  if (detailDialog.open && currentDetailId) {
    renderDetailContent(currentDetailId);
  }

  updateCompareUI();
}

function updateCompareUI() {
  const hasItems = compareIds.length > 0;

  compareCount.textContent = String(compareIds.length);
  compareTray.classList.toggle("visible", hasItems);
  compareTray.setAttribute("aria-hidden", String(!hasItems));
  document.body.classList.toggle("has-compare-tray", hasItems);
}

function renderDetailContent(hotelId) {
  const hotel = hotels.find((item) => item.id === hotelId);

  if (!hotel) {
    return;
  }

  currentDetailId = hotel.id;
  const values = getAppliedFilters(hotel.genre);
  const isCompared = compareIds.includes(hotel.id);
  const matchPanel = renderMatchPanel(hotel, values);
  const facts = hotel.facts.map((fact) => {
    return `<li class="detail-fact">${escapeHtml(fact)}</li>`;
  }).join("");

  detailTitle.textContent = hotel.name;
  detailKicker.textContent = `${genreLabels[hotel.genre]} HOTEL DETAILS`;

  detailContent.innerHTML = `
    <div class="detail-summary-card">
      <span class="detail-role">${escapeHtml(hotel.role)}</span>
      <p class="detail-location">
        ${escapeHtml(hotel.area)}｜${escapeHtml(hotel.venueLabel)}
      </p>
      <p class="detail-summary">${escapeHtml(hotel.summary)}</p>
    </div>

    <section class="detail-section" aria-labelledby="detail-access-heading">
      <h3 id="detail-access-heading">会場・駅へのアクセス</h3>
      <div class="detail-access">
        <div class="detail-access-card">
          <small>対象会場・エリア</small>
          <strong>${escapeHtml(hotel.venueLabel)}</strong>
        </div>
        <div class="detail-access-card">
          <small>駅からの目安</small>
          <strong>${escapeHtml(hotel.station)}</strong>
        </div>
      </div>
    </section>

    <section class="detail-section" aria-labelledby="detail-match-heading">
      <h3 id="detail-match-heading">選んだ条件との相性</h3>
      ${matchPanel}
    </section>

    <section class="detail-section" aria-labelledby="detail-features-heading">
      <h3 id="detail-features-heading">このホテルが向いている理由</h3>
      <ul class="detail-facts">${facts}</ul>
    </section>

    <section class="detail-section" aria-labelledby="detail-check-heading">
      <h3 id="detail-check-heading">設備・サービスの確認状況</h3>
      <ul class="detail-status-list">
        ${renderStatuses(hotel.statuses, true)}
      </ul>
    </section>

    <div class="detail-actions">
      <a
        class="button primary"
        href="${escapeHtml(hotel.rakuten)}"
        target="_blank"
        rel="sponsored noopener"
      >
        楽天トラベルで空室を見る
      </a>

      <a
        class="button"
        href="${escapeHtml(hotel.jalan)}"
        target="_blank"
        rel="sponsored noopener"
      >
        じゃらんで空室を見る
      </a>

      <button
        class="compare-button ${isCompared ? "active" : ""}"
        type="button"
        data-compare-id="${escapeHtml(hotel.id)}"
        aria-pressed="${isCompared}"
      >
        ${isCompared ? "✓ 比較候補に追加済み" : "＋ 比較候補に追加"}
      </button>
    </div>

    <p class="detail-note">
      料金・空室・設備・サービス内容は変更される場合があります。予約前に、予約サイトとホテル公式情報の両方で最新状況をご確認ください。
    </p>
  `;
}

function openDetailDialog(hotelId) {
  const hotel = hotels.find((item) => item.id === hotelId);

  if (!hotel) {
    return;
  }

  detailDialog.classList.remove("theme-stage", "theme-esports", "theme-art");
  detailDialog.classList.add(`theme-${hotel.genre}`);
  renderDetailContent(hotel.id);
  detailDialog.showModal();
  syncModalState();
}

function openCompareDialog() {
  const selectedHotels = compareIds
    .map((id) => hotels.find((hotel) => hotel.id === id))
    .filter(Boolean);

  if (!selectedHotels.length) {
    showNotice("比較したいホテルを候補に追加してください。");
    return;
  }

  compareGrid.innerHTML = selectedHotels.map((hotel) => {
    return `
      <article class="compare-card">
        <h3>${escapeHtml(hotel.name)}</h3>

        <dl>
          <dt>ジャンル</dt>
          <dd>${escapeHtml(genreLabels[hotel.genre])}</dd>

          <dt>向いている目的</dt>
          <dd>${escapeHtml(hotel.role)}</dd>

          <dt>エリア</dt>
          <dd>${escapeHtml(hotel.area)}</dd>

          <dt>対象会場・エリア</dt>
          <dd>${escapeHtml(hotel.venueLabel)}</dd>

          <dt>駅アクセス</dt>
          <dd>${escapeHtml(hotel.station)}</dd>

          <dt>向いている過ごし方</dt>
          <dd>${escapeHtml(hotel.summary)}</dd>
        </dl>
      </article>
    `;
  }).join("");

  compareDialog.showModal();
  syncModalState();
}

document.addEventListener("click", (event) => {
  const finderJump = event.target.closest("[data-scroll-finder]");

  if (finderJump) {
    const target = document.getElementById(
      `${finderJump.dataset.scrollFinder}-finder`
    );

    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const routeButton = event.target.closest("[data-route]");

  if (routeButton) {
    navigate(routeButton.dataset.route);
    return;
  }

  const compareButton = event.target.closest("[data-compare-id]");

  if (compareButton) {
    toggleCompare(compareButton.dataset.compareId);
    return;
  }

  const resetButton = event.target.closest("[data-reset]");

  if (resetButton) {
    resetForm(resetButton.dataset.reset);
    return;
  }

  const quickButton = event.target.closest("[data-quick-priority]");

  if (quickButton) {
    const form = quickButton.closest("form");
    const genre = form.dataset.searchForm;

    form.elements.priority.value = quickButton.dataset.quickPriority;
    syncPriorityChips(form);
    renderResults(genre, { applyForm: true });
    return;
  }

  const detailButton = event.target.closest("[data-show-detail]");

  if (detailButton) {
    openDetailDialog(detailButton.dataset.showDetail);
  }
});

document.querySelectorAll("[data-search-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const genre = form.dataset.searchForm;
    renderResults(genre, { applyForm: true });

    document
      .querySelector(`[data-page="${genre}"] .results-head`)
      .scrollIntoView({ behavior: "smooth", block: "start" });
  });

  form.elements.priority.addEventListener("change", () => {
    syncPriorityChips(form);
  });

  syncPriorityChips(form);
});

document.querySelector("[data-open-compare]").addEventListener(
  "click",
  openCompareDialog
);

document.querySelector("[data-close-compare]").addEventListener(
  "click",
  () => compareDialog.close()
);

document.querySelector("[data-close-detail]").addEventListener(
  "click",
  () => detailDialog.close()
);

document.querySelector("[data-clear-compare]").addEventListener(
  "click",
  () => {
    compareIds = [];

    if (!removeCompareStorage()) {
      showNotice("保存済みの比較候補を削除できませんでした。現在の画面上では解除されています。");
    }

    compareDialog.close();
    updateCompareUI();

    if (currentPage !== "home") {
      renderResults(currentPage);
    }
  }
);

[compareDialog, detailDialog].forEach((dialog) => {
  dialog.addEventListener("close", () => {
    if (dialog === detailDialog) {
      currentDetailId = null;
    }

    syncModalState();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
});

updateCompareUI();

const firstPage = location.hash.replace("#", "");

if (["stage", "esports", "art"].includes(firstPage)) {
  navigate(firstPage);
} else {
  navigate("home");
}
