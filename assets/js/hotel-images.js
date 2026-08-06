(() => {
  "use strict";

  const DATA_URL = "assets/data/hotels.json?v=20260802-2";
  const API_URL = "/api/hotel-image";
  const requestCache = new Map();
  const observedCards = new WeakSet();
  const queue = [];
  const MAX_CONCURRENT = 2;
  const MIN_START_INTERVAL_MS = 500;
  let activeRequests = 0;
  let lastStartedAt = 0;
  let hotelMapPromise;

  function normalizeHotels(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.hotels)) return payload.hotels;
    return [];
  }

  function loadHotelMap() {
    if (hotelMapPromise) return hotelMapPromise;
    hotelMapPromise = fetch(DATA_URL, { headers: { Accept: "application/json" } })
      .then(response => {
        if (!response.ok) throw new Error(`hotel_data_${response.status}`);
        return response.json();
      })
      .then(payload => new Map(normalizeHotels(payload)
        .filter(hotel => hotel && typeof hotel.id === "string")
        .map(hotel => [hotel.id, hotel])))
      .catch(() => new Map());
    return hotelMapPromise;
  }

  function normalizedKeyPart(value) {
    return String(value || "").normalize("NFKC").trim().toLowerCase();
  }

  function requestKey(hotel) {
    const hotelNo = String(hotel?.rakutenHotelNo || "").trim();
    if (/^\d{1,12}$/.test(hotelNo)) return `hotelNo:${hotelNo}`;
    const location = hotel?.station || hotel?.area || "";
    return `name:${[
      normalizedKeyPart(hotel?.name),
      normalizedKeyPart(hotel?.prefecture),
      normalizedKeyPart(location)
    ].join("|")}`;
  }

  function scheduleRequest(task) {
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      pumpQueue();
    });
  }

  function pumpQueue() {
    if (activeRequests >= MAX_CONCURRENT || !queue.length) return;
    const wait = Math.max(0, MIN_START_INTERVAL_MS - (Date.now() - lastStartedAt));
    setTimeout(() => {
      if (activeRequests >= MAX_CONCURRENT || !queue.length) return;
      const item = queue.shift();
      activeRequests += 1;
      lastStartedAt = Date.now();
      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
        .finally(() => {
          activeRequests -= 1;
          pumpQueue();
        });
      pumpQueue();
    }, wait);
  }

  function addParam(params, key, value) {
    const text = String(value || "").trim();
    if (text) params.set(key, text);
  }

  function fetchImageData(hotel) {
    const key = requestKey(hotel);
    if (requestCache.has(key)) return requestCache.get(key);

    const pending = scheduleRequest(async () => {
      const params = new URLSearchParams();
      params.set("matchVersion", "2");
      addParam(params, "name", hotel?.name);
      addParam(params, "prefecture", hotel?.prefecture);
      addParam(params, "area", hotel?.area);
      addParam(params, "station", hotel?.station);
      addParam(params, "accessEstimate", hotel?.accessEstimate);
      const hotelNo = String(hotel?.rakutenHotelNo || "").trim();
      if (/^\d{1,12}$/.test(hotelNo)) params.set("rakutenHotelNo", hotelNo);
      const response = await fetch(`${API_URL}?${params}`, { headers: { Accept: "application/json" } });
      if (!response.ok) return null;
      const data = await response.json();
      return data?.image?.src && /^https:\/\//.test(data.image.src) ? data.image : null;
    }).catch(() => null);

    requestCache.set(key, pending);
    return pending;
  }

  function setImage(card, visual, imageData, hotel) {
    if (!card.isConnected || !visual.isConnected || !imageData?.src || visual.querySelector("img")) return;
    const fallback = visual.firstElementChild?.cloneNode(true) || document.createTextNode("HOTEL STAY");
    const image = new Image(800, 500);
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = imageData.alt || `${hotel.name || "ホテル"}の施設画像`;
    image.addEventListener("load", () => {
      card.dataset.hotelImageStatus = "loaded";
    }, { once: true });
    image.addEventListener("error", () => {
      if (visual.isConnected && visual.contains(image)) visual.replaceChildren(fallback);
      card.dataset.hotelImageStatus = "unavailable";
    }, { once: true });
    image.src = imageData.src;
    visual.replaceChildren(image);
  }

  async function hydrateCard(card) {
    if (!(card instanceof HTMLElement) || card.dataset.hotelImageStatus) return;
    const visual = card.querySelector(".hotel-card__image");
    if (!visual || visual.querySelector("img")) {
      card.dataset.hotelImageStatus = "existing";
      return;
    }

    card.dataset.hotelImageStatus = "loading";
    const hotelMap = await loadHotelMap();
    const hotel = hotelMap.get(card.dataset.hotelId || "");
    if (!hotel?.name) {
      card.dataset.hotelImageStatus = "unavailable";
      return;
    }

    const imageData = await fetchImageData(hotel);
    if (!imageData) {
      card.dataset.hotelImageStatus = "unavailable";
      return;
    }
    setImage(card, visual, imageData, hotel);
  }

  const intersectionObserver = "IntersectionObserver" in window
    ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        intersectionObserver.unobserve(entry.target);
        hydrateCard(entry.target);
      });
    }, { rootMargin: "500px 0px" })
    : null;

  function observeCard(card) {
    if (!(card instanceof HTMLElement) || observedCards.has(card)) return;
    observedCards.add(card);
    if (intersectionObserver) intersectionObserver.observe(card);
    else hydrateCard(card);
  }

  function scan(root = document) {
    if (root instanceof HTMLElement && root.matches(".hotel-card[data-hotel-id]")) observeCard(root);
    root.querySelectorAll?.(".hotel-card[data-hotel-id]").forEach(observeCard);
  }

  function install() {
    scan();
    const list = document.querySelector("[data-hotel-list]");
    if (!list) return;
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node instanceof HTMLElement) scan(node);
      }));
    });
    observer.observe(list, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
