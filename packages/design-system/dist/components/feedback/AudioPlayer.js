import React from "react";
import { VoiceWaveform } from "./VoiceWaveform.js";
import { IconButton } from "../buttons/IconButton.js";
const CSS = `
.hv-audio {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-3) var(--space-4);
  background: var(--surface-card);
  border: var(--border-hair) solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  color: var(--text-body);
  font-family: var(--font-sans);
}

.hv-audio--bare {
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

.hv-audio__play {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--action-primary);
  color: var(--action-primary-text);
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-standard),
              transform var(--dur-fast) var(--ease-standard),
              box-shadow var(--dur-fast) var(--ease-standard);
}
.hv-audio__play:hover:not(:disabled) { background: var(--action-primary-hover); }
.hv-audio__play:active:not(:disabled) { background: var(--action-primary-press); transform: scale(0.94); }
.hv-audio__play:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
@media (prefers-reduced-motion: reduce) {
  .hv-audio__play:active:not(:disabled) { transform: none; }
}
.hv-audio__play:disabled { background: var(--state-disabled-bg); color: var(--state-disabled-fg); cursor: not-allowed; }
.hv-audio__play svg { width: 20px; height: 20px; display: block; }

.hv-audio__main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.hv-audio__title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hv-audio__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.hv-audio__wave {
  flex: 1 1 auto;
  min-width: 0;
}

/* Dense, fine-grained waveform: many thin bars filling the width with a 1px gap,
   so a wide container never turns them into fat horizontal ovals. */
.hv-audio .hv-waveform {
  gap: 1px;
}
.hv-audio .hv-waveform__bar {
  flex: 1 1 0;
}

.hv-audio__time {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.hv-audio__mute { flex: 0 0 auto; }
`;
if (typeof document !== "undefined" && !document.getElementById("hv-audio-css")) {
  const el = document.createElement("style");
  el.id = "hv-audio-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
async function extractPeaks(audioUrl, barsCount) {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new Ctx();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const rawData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(rawData.length / barsCount) || 1;
  const peaks = [];
  for (let i = 0; i < barsCount; i++) {
    const start = i * blockSize;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(rawData[start + j] || 0);
    }
    peaks.push(sum / blockSize);
  }
  const maxPeak = Math.max(...peaks) || 1;
  audioCtx.close();
  return peaks.map((p) => Math.max(0.15, p / maxPeak));
}
const PlayIcon = () => /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" }));
const PauseIcon = () => /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M7 4h3v16H7zM14 4h3v16h-3z" }));
const VolumeIcon = () => /* @__PURE__ */ React.createElement(
  "svg",
  {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  },
  /* @__PURE__ */ React.createElement("path", { d: "M11 5 6 9H2v6h4l5 4V5Z" }),
  /* @__PURE__ */ React.createElement("path", { d: "M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" })
);
const MutedIcon = () => /* @__PURE__ */ React.createElement(
  "svg",
  {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  },
  /* @__PURE__ */ React.createElement("path", { d: "M11 5 6 9H2v6h4l5 4V5Z" }),
  /* @__PURE__ */ React.createElement("path", { d: "m22 9-6 6M16 9l6 6" })
);
function AudioPlayer({
  src,
  data,
  bars = 96,
  title,
  loop = false,
  autoPeaks = true,
  showMute = true,
  bare = false,
  onPlay,
  onPause,
  onEnded,
  playLabel = "Reproduzir",
  pauseLabel = "Pausar",
  className = "",
  ...rest
}) {
  const audioRef = React.useRef(null);
  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [peaks, setPeaks] = React.useState(data || null);
  React.useEffect(() => {
    if (data) setPeaks(data);
  }, [data]);
  React.useEffect(() => {
    let cancelled = false;
    if (!data && autoPeaks && src && typeof window !== "undefined" && window.AudioContext) {
      extractPeaks(src, bars).then((p) => {
        if (!cancelled) setPeaks(p);
      }).catch(() => {
      });
    }
    return () => {
      cancelled = true;
    };
  }, [src, bars, autoPeaks, data]);
  React.useEffect(() => {
    if (!playing) return;
    let raf;
    const tick = () => {
      const el = audioRef.current;
      if (el) setCurrent(el.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
    } else {
      el.pause();
    }
  };
  const handleSeek = (fraction) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = fraction * el.duration;
    setCurrent(el.currentTime);
  };
  const toggleMute = () => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };
  const progress = duration > 0 ? current / duration : 0;
  const remaining = duration > 0 ? duration - current : 0;
  const cls = [
    "hv-audio",
    bare ? "hv-audio--bare" : "",
    className
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("div", { className: cls, ...rest }, /* @__PURE__ */ React.createElement(
    "audio",
    {
      ref: audioRef,
      src,
      loop,
      preload: "metadata",
      onLoadedMetadata: (e) => setDuration(e.currentTarget.duration),
      onTimeUpdate: (e) => setCurrent(e.currentTarget.currentTime),
      onPlay: (e) => {
        setPlaying(true);
        onPlay && onPlay(e);
      },
      onPause: (e) => {
        setPlaying(false);
        onPause && onPause(e);
      },
      onEnded: (e) => {
        setPlaying(false);
        onEnded && onEnded(e);
      }
    }
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "hv-audio__play",
      onClick: togglePlay,
      disabled: !src,
      "aria-label": playing ? pauseLabel : playLabel,
      title: playing ? pauseLabel : playLabel
    },
    playing ? /* @__PURE__ */ React.createElement(PauseIcon, null) : /* @__PURE__ */ React.createElement(PlayIcon, null)
  ), /* @__PURE__ */ React.createElement("div", { className: "hv-audio__main" }, title && /* @__PURE__ */ React.createElement("div", { className: "hv-audio__title" }, title), /* @__PURE__ */ React.createElement("div", { className: "hv-audio__row" }, /* @__PURE__ */ React.createElement("div", { className: "hv-audio__wave" }, /* @__PURE__ */ React.createElement(
    VoiceWaveform,
    {
      data: peaks || void 0,
      bars,
      height: 36,
      progress,
      playing,
      interactive: true,
      onSeek: handleSeek
    }
  )), /* @__PURE__ */ React.createElement("span", { className: "hv-audio__time", "aria-hidden": "true" }, formatTime(current), " / ", formatTime(duration)))), showMute && /* @__PURE__ */ React.createElement(
    IconButton,
    {
      variant: "quiet",
      size: "sm",
      className: "hv-audio__mute",
      onClick: toggleMute,
      label: muted ? "Ativar som" : "Silenciar"
    },
    muted ? /* @__PURE__ */ React.createElement(MutedIcon, null) : /* @__PURE__ */ React.createElement(VolumeIcon, null)
  ));
}
export {
  AudioPlayer
};
