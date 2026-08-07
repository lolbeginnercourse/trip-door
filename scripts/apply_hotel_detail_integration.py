#!/usr/bin/env python3
from pathlib import Path


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)


def patch_app():
    path = Path("assets/js/app.js")
    text = path.read_text(encoding="utf-8")

    style_anchor = '  appendStylesheet("assets/css/finder-single-select.css?v=20260806-1", "finder-two-step-style");'
    style_new = style_anchor + '\n  appendStylesheet("assets/css/hotel-detail.css?v=20260808-1", "hotel-detail-style");'
    if 'assets/css/hotel-detail.css?v=20260808-1' not in text:
        text = replace_once(text, style_anchor, style_new, "app stylesheet")

    old_onload = '  core.onload = applyTopRefresh;'
    new_onload = '''  core.onload = () => {
    applyTopRefresh();
    if (document.querySelector("script[data-hotel-detail-script]")) return;
    const detail = document.createElement("script");
    detail.src = "assets/js/hotel-detail.js?v=20260808-1";
    detail.async = false;
    detail.dataset.hotelDetailScript = "";
    detail.onerror = () => console.error("Hotel detail enhancement could not be loaded.");
    document.head.append(detail);
  };'''
    if 'data-hotel-detail-script' not in text:
        text = replace_once(text, old_onload, new_onload, "app core.onload")

    path.write_text(text, encoding="utf-8")


def patch_detail_js():
    path = Path("assets/js/hotel-detail.js")
    text = path.read_text(encoding="utf-8")

    old = '''    const badge = el("span", "hd-mode-badge", modeLabel(access.mode));
    card.append(copy, badge);
    if (access.note) card.append(el("p", "hd-access__note", access.note));
    return card;'''
    new = '''    const badge = el("span", "hd-mode-badge", modeLabel(access.mode));
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
    return card;'''
    if 'hd-access-facts' not in text:
        text = replace_once(text, old, new, "detail access facts")

    old_order = '''    const stay = renderStay(detail);
    if (stay) shell.append(stay);

    const fit = renderFit(detail);
    if (fit) shell.append(fit);'''
    new_order = '''    const fit = renderFit(detail);
    if (fit) shell.append(fit);

    const stay = renderStay(detail);
    if (stay) shell.append(stay);'''
    if old_order in text:
        text = text.replace(old_order, new_order, 1)

    path.write_text(text, encoding="utf-8")


def patch_detail_css():
    path = Path("assets/css/hotel-detail.css")
    text = path.read_text(encoding="utf-8")

    facts_css = '''.hd-access-facts {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.hd-access-fact {
  min-width: 0;
  padding: 10px 11px;
  display: grid;
  gap: 3px;
  border: 1px solid color-mix(in srgb, var(--category) 18%, var(--border));
  border-radius: 10px;
  background: rgba(255,255,255,.74);
}

.hd-access-fact__label {
  overflow: hidden;
  color: var(--muted);
  font-size: .68rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hd-access-fact strong {
  overflow-wrap: anywhere;
  color: var(--text);
  font-size: .82rem;
  line-height: 1.35;
}

'''
    if '.hd-access-facts {' not in text:
        anchor = '.hd-access__note {'
        if anchor not in text:
            raise SystemExit("detail css access note anchor not found")
        text = text.replace(anchor, facts_css + anchor, 1)

    mobile_anchor = '''  .hd-access__limited-title {
    font-size: 1.45rem;
  }
'''
    mobile_facts = '''
  .hd-access-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }

  .hd-access-fact {
    padding: 9px 10px;
  }
'''
    if 'grid-template-columns: repeat(2, minmax(0, 1fr));\n    gap: 7px;' not in text:
        if mobile_anchor not in text:
            raise SystemExit("detail css mobile facts anchor not found")
        text = text.replace(mobile_anchor, mobile_anchor + mobile_facts, 1)

    old_actions = '''  .hd-actions {
    margin: 20px -16px 0;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    grid-template-columns: 1fr;
  }

  .hd-actions__booking {
    grid-template-columns: 1fr;
  }
'''
    new_actions = '''  .hd-actions {
    margin: 20px -16px 0;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr);
    align-items: stretch;
  }

  .hd-actions__booking {
    grid-template-columns: 1fr;
  }

  .hd-actions__booking .button:nth-child(n+2) {
    display: none;
  }

  .hd-actions:has(.hd-actions__booking:empty) {
    grid-template-columns: 1fr;
  }
'''
    if old_actions in text:
        text = text.replace(old_actions, new_actions, 1)

    path.write_text(text, encoding="utf-8")


def main():
    patch_app()
    patch_detail_js()
    patch_detail_css()
    print("hotel detail integration patches applied")


if __name__ == "__main__":
    main()
