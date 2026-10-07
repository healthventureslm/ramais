import React from "react";
const CSS = `
.hv-waveform {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3px;
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-2) 0;
  user-select: none;
}

.hv-waveform--interactive {
  cursor: pointer;
}

.hv-waveform__bar {
  flex: 1 1 0;
  min-width: 1px;
  max-width: 6px;
  background: var(--_bar-bg, var(--border-strong));
  border-radius: var(--radius-pill);
  transition: transform var(--dur-normal) var(--ease-standard),
              background-color var(--dur-fast) var(--ease-standard);
  transform-origin: center;
}

/* Parte JA TOCADA de um audio gravado. Era coral \u2014 mas coral e --live, e
   reproduzir uma gravacao nao e processo acontecendo agora: o relogio que
   corre ali e o do player, nao o do plantao. Coral fica so em
   .hv-waveform--recording, logo abaixo, que e a captura de verdade. Tocado
   vira a tinta da acao primaria, a mesma do botao de play ao lado. */
.hv-waveform__bar--active {
  --_bar-bg: var(--action-primary);
}

.hv-waveform__bar--inactive {
  --_bar-bg: var(--sand-300);
}

/* Era coral-400 com opacity 0.85 \u2014 tom por transparencia, e na tinta errada.
   Um degrau mais claro na mesma rampa da parte tocada. */
.hv-waveform__bar--hovered {
  --_bar-bg: var(--petrol-300);
}

.hv-waveform--recording .hv-waveform__bar {
  --_bar-bg: var(--coral-500);
  animation: hv-waveform-bounce 1.2s ease-in-out infinite;
}

@keyframes hv-waveform-bounce {
  0%, 100% {
    transform: scaleY(0.3);
  }
  50% {
    transform: scaleY(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hv-waveform--recording .hv-waveform__bar {
    animation: none;
    transform: scaleY(0.65);
  }
}
`;
if (typeof document !== "undefined" && !document.getElementById("hv-waveform-css")) {
  const el = document.createElement("style");
  el.id = "hv-waveform-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function generateDefaultWaveform(barsCount) {
  const data = [];
  for (let i = 0; i < barsCount; i++) {
    const val1 = Math.sin(i / (barsCount - 1) * Math.PI);
    const val2 = Math.sin(i / (barsCount - 1) * Math.PI * 4.5);
    const val3 = Math.cos(i / (barsCount - 1) * Math.PI * 2);
    let height = Math.abs(val1 * 0.6 + val2 * 0.25 + val3 * 0.15);
    height = Math.max(0.15, Math.min(1, height));
    data.push(height);
  }
  return data;
}
function VoiceWaveform({
  data,
  bars,
  height = 48,
  progress = 0,
  recording = false,
  playing = false,
  interactive = false,
  onSeek,
  className = "",
  style,
  /**
   * Nome do controle para leitor de tela quando `interactive`. Era uma string
   * literal dentro do JSX — o produto nao tinha como traduzir nem ajustar.
   */
  ariaLabel = "Visualizador de \xE1udio interativo",
  ...rest
}) {
  const containerRef = React.useRef(null);
  const [hoverIndex, setHoverIndex] = React.useState(-1);
  const [containerWidth, setContainerWidth] = React.useState(0);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const wavePoints = React.useMemo(() => {
    if (data && data.length > 0) {
      return data;
    }
    const count = bars != null ? bars : Math.max(12, Math.round((containerWidth || 600) / 5));
    return generateDefaultWaveform(count);
  }, [data, bars, containerWidth]);
  const totalBars = wavePoints.length;
  const handleMouseMove = (e) => {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.floor(fraction * totalBars);
    setHoverIndex(index);
  };
  const handleMouseLeave = () => {
    setHoverIndex(-1);
  };
  const handleClick = (e) => {
    if (!interactive || !containerRef.current || !onSeek) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    onSeek(fraction);
  };
  const handleKeyDown = (e) => {
    if (!interactive || !onSeek) return;
    const ir = (v) => {
      e.preventDefault();
      onSeek(Math.max(0, Math.min(1, v)));
    };
    if (e.key === "ArrowRight" || e.key === "ArrowUp") ir(progress + 0.05);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") ir(progress - 0.05);
    else if (e.key === "PageUp") ir(progress + 0.2);
    else if (e.key === "PageDown") ir(progress - 0.2);
    else if (e.key === "Home") ir(0);
    else if (e.key === "End") ir(1);
  };
  const cls = [
    "hv-waveform",
    recording ? "hv-waveform--recording" : "",
    interactive ? "hv-waveform--interactive" : "",
    className
  ].filter(Boolean).join(" ");
  const containerStyle = {
    height: typeof height === "number" ? `${height}px` : height,
    ...style
  };
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: containerRef,
      className: cls,
      style: containerStyle,
      onClick: handleClick,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
      onKeyDown: handleKeyDown,
      tabIndex: interactive ? 0 : void 0,
      role: interactive ? "slider" : void 0,
      "aria-label": interactive ? ariaLabel : void 0,
      "aria-valuetext": interactive ? `${Math.round(progress * 100)}%` : void 0,
      "aria-valuenow": interactive ? Math.round(progress * 100) : void 0,
      "aria-valuemin": interactive ? 0 : void 0,
      "aria-valuemax": interactive ? 100 : void 0,
      ...rest
    },
    wavePoints.map((val, idx) => {
      const barProgressFraction = (idx + 0.5) / totalBars;
      const isActive = recording || barProgressFraction <= progress;
      const isHovered = interactive && hoverIndex !== -1 && idx <= hoverIndex;
      let barClass = "hv-waveform__bar";
      if (isHovered) {
        barClass += " hv-waveform__bar--hovered";
      } else if (isActive) {
        barClass += " hv-waveform__bar--active";
      } else {
        barClass += " hv-waveform__bar--inactive";
      }
      const barStyle = {
        height: "100%"
      };
      if (recording) {
        barStyle.animationDelay = `${-idx * 0.06}s`;
      }
      barStyle.transform = `scaleY(${val})`;
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: idx,
          className: barClass,
          style: barStyle
        }
      );
    })
  );
}
export {
  VoiceWaveform
};
