import React from "react";
function haptics(padrao = 8) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return false;
  try {
    return navigator.vibrate(padrao);
  } catch (e) {
    return false;
  }
}
function useSwipeDismiss({
  onDismiss,
  onReverse,
  axis = "y",
  direction = 1,
  threshold = 96,
  velocity = 0.5,
  enabled = true,
  canStart
} = {}) {
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const ref = React.useRef({ ativo: false, inicio: 0, cruz: 0, t: 0, ultimo: 0, ultimoT: 0, id: null });
  const eixoPos = (e) => axis === "y" ? e.clientY : e.clientX;
  const cruzPos = (e) => axis === "y" ? e.clientX : e.clientY;
  const onPointerDown = (e) => {
    if (!enabled || e.pointerType === "mouse" && e.button !== 0) return;
    if (canStart && !canStart(e)) return;
    const s = ref.current;
    s.ativo = true;
    s.inicio = eixoPos(e);
    s.cruz = cruzPos(e);
    s.t = e.timeStamp;
    s.ultimo = s.inicio;
    s.ultimoT = s.t;
    s.id = e.pointerId;
    s.decidiu = false;
  };
  const onPointerMove = (e) => {
    const s = ref.current;
    if (!s.ativo || e.pointerId !== s.id) return;
    const d = (eixoPos(e) - s.inicio) * direction;
    const dCruz = Math.abs(cruzPos(e) - s.cruz);
    if (!s.decidiu) {
      const dAbs = Math.abs(eixoPos(e) - s.inicio);
      if (dAbs < 6 && dCruz < 6) return;
      s.decidiu = true;
      if (dCruz > dAbs) {
        s.ativo = false;
        return;
      }
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(s.id);
      } catch (err) {
      }
    }
    s.ultimo = eixoPos(e);
    s.ultimoT = e.timeStamp;
    setOffset(d < 0 && !onReverse ? d / 4 : d);
  };
  const finalizar = (e) => {
    const s = ref.current;
    if (!s.ativo && !dragging) return;
    const estavaArrastando = s.decidiu;
    s.ativo = false;
    setDragging(false);
    if (!estavaArrastando) {
      setOffset(0);
      return;
    }
    const d = (s.ultimo - s.inicio) * direction;
    const dt = Math.max(1, s.ultimoT - s.t);
    const v = d / dt;
    if (onReverse && (d < -threshold || v < -velocity)) {
      haptics(6);
      onReverse();
      setOffset(0);
    } else if (d > threshold || v > velocity) {
      haptics(6);
      onDismiss && onDismiss();
    } else {
      setOffset(0);
    }
    try {
      e && e.currentTarget && e.currentTarget.releasePointerCapture(s.id);
    } catch (err) {
    }
  };
  const handlers = enabled ? { onPointerDown, onPointerMove, onPointerUp: finalizar, onPointerCancel: finalizar } : {};
  return { handlers, offset, dragging, reset: () => setOffset(0) };
}
let _travas = 0;
let _scrollGuardado = 0;
function useScrollLock(ativo) {
  React.useEffect(() => {
    if (!ativo || typeof document === "undefined") return;
    const body = document.body;
    if (_travas === 0) {
      _scrollGuardado = window.scrollY;
      body.style.position = "fixed";
      body.style.top = `-${_scrollGuardado}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.overflow = "hidden";
    }
    _travas++;
    return () => {
      _travas--;
      if (_travas === 0) {
        body.style.position = "";
        body.style.top = "";
        body.style.left = "";
        body.style.right = "";
        body.style.overflow = "";
        window.scrollTo(0, _scrollGuardado);
      }
    };
  }, [ativo]);
}
function useFocusTrap(ativo, painelRef) {
  const anteriorRef = React.useRef(null);
  React.useEffect(() => {
    if (!ativo) {
      const alvo = anteriorRef.current;
      if (!alvo) return;
      anteriorRef.current = null;
      const id = setTimeout(() => {
        if (typeof alvo.focus === "function" && document.contains(alvo)) alvo.focus();
      }, 0);
      return () => clearTimeout(id);
    }
    if (!anteriorRef.current) anteriorRef.current = document.activeElement;
    const painelAgora = () => painelRef && painelRef.current;
    const focaveis = (painel) => [...painel.querySelectorAll(
      'a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )].filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0);
    let quadros = 0, raf = 0;
    const levarFoco = () => {
      const painel = painelAgora();
      if (painel) {
        if (painel.contains(document.activeElement)) return;
        const alvo = focaveis(painel)[0];
        if (alvo) {
          alvo.focus();
          return;
        }
        if (!painel.hasAttribute("tabindex")) painel.setAttribute("tabindex", "-1");
        painel.focus();
        return;
      }
      if (++quadros < 30) raf = requestAnimationFrame(levarFoco);
    };
    raf = requestAnimationFrame(levarFoco);
    const aoTeclar = (e) => {
      if (e.key !== "Tab") return;
      const painel = painelAgora();
      if (!painel) return;
      const its = focaveis(painel);
      if (!its.length) {
        e.preventDefault();
        return;
      }
      const primeiro = its[0], ultimo = its[its.length - 1];
      if (!painel.contains(document.activeElement)) {
        e.preventDefault();
        primeiro.focus();
      } else if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", aoTeclar, true);
    };
  }, [ativo, painelRef]);
}
export {
  haptics,
  useFocusTrap,
  useScrollLock,
  useSwipeDismiss
};
