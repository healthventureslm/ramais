import React from "react";
const CSS = `
.hv-wordmark { display: inline-flex; align-items: center; gap: var(--space-3);
  font-family: var(--font-sans); text-decoration: none; color: inherit; min-width: 0; }
.hv-wordmark--stacked { flex-direction: column; gap: var(--space-2); text-align: center; }

.hv-wordmark__mark { flex: none; display: block; border-radius: var(--radius-sm); }
.hv-wordmark--sm .hv-wordmark__mark { width: 28px; height: 28px; }
.hv-wordmark--md .hv-wordmark__mark { width: 36px; height: 36px; }
.hv-wordmark--lg .hv-wordmark__mark { width: 48px; height: 48px; }

.hv-wordmark__text { display: flex; flex-direction: column; min-width: 0; }
.hv-wordmark--stacked .hv-wordmark__text { align-items: center; }

.hv-wordmark__name {
  font-family: var(--font-display); font-weight: var(--weight-bold);
  color: var(--text-strong); letter-spacing: var(--tracking-snug);
  line-height: var(--leading-tight);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hv-wordmark--sm .hv-wordmark__name { font-size: var(--text-base); }
.hv-wordmark--md .hv-wordmark__name { font-size: var(--text-lg); }
.hv-wordmark--lg .hv-wordmark__name { font-size: var(--text-xl); }

/* A segunda metade do nome em it\xE1lico petrol \xE9 o tratamento can\xF4nico da
   marca \u2014 "VoxFlow", "VoiceHealth". Substitui a serifada que o wordmark
   antigo pedia e que o DS nunca teve. */
.hv-wordmark__accent { font-style: italic; color: var(--petrol-600); font-weight: var(--weight-semibold); }

.hv-wordmark__byline {
  font-size: var(--text-2xs); font-weight: var(--weight-medium);
  text-transform: uppercase; letter-spacing: var(--tracking-wider);
  color: var(--text-subtle); margin-top: var(--nudge-1);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Sobre superf\xEDcie de marca os tokens normais somem. */
.hv-wordmark--on-brand .hv-wordmark__name { color: var(--text-on-brand); }
.hv-wordmark--on-brand .hv-wordmark__accent { color: var(--petrol-200); }
.hv-wordmark--on-brand .hv-wordmark__byline { color: var(--text-on-brand-muted); }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-wordmark-css")) {
  const el = document.createElement("style");
  el.id = "hv-wordmark-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Wordmark({
  name,
  accent,
  byline = "by Health Ventures",
  markSrc,
  orientation = "horizontal",
  size = "md",
  onBrand = false,
  href,
  className = "",
  ...rest
}) {
  const Tag = href ? "a" : "div";
  return /* @__PURE__ */ React.createElement(
    Tag,
    {
      className: [
        "hv-wordmark",
        `hv-wordmark--${orientation === "stacked" ? "stacked" : "horizontal"}`,
        `hv-wordmark--${size}`,
        onBrand ? "hv-wordmark--on-brand" : "",
        className
      ].filter(Boolean).join(" "),
      href,
      ...rest
    },
    markSrc && /* @__PURE__ */ React.createElement("img", { className: "hv-wordmark__mark", src: markSrc, alt: "", "aria-hidden": "true" }),
    /* @__PURE__ */ React.createElement("span", { className: "hv-wordmark__text" }, /* @__PURE__ */ React.createElement("span", { className: "hv-wordmark__name" }, name, accent && /* @__PURE__ */ React.createElement("span", { className: "hv-wordmark__accent" }, accent)), byline && /* @__PURE__ */ React.createElement("span", { className: "hv-wordmark__byline" }, byline))
  );
}
export {
  Wordmark
};
