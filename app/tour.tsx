"use client";

import { useCallback, useEffect, useRef } from "react";

export type TourStep = {
  target: string;
  title: string;
  body: string;
  placement?: "bottom" | "top" | "left" | "right";
};

type TourProps = {
  steps: TourStep[];
  active: boolean;
  stepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
};

const PAD = 6;

function getRect(selector: string): DOMRect | null {
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    return el.getBoundingClientRect();
  } catch { return null; }
}

export default function Tour({ steps, active, stepIndex, onNext, onPrev, onSkip }: TourProps) {
  const raf = useRef(0);
  const step = steps[stepIndex];

  const update = useCallback(() => {
    const spot = document.getElementById("tour-spotlight");
    const tip = document.getElementById("tour-tooltip");
    if (!spot || !tip || !step) return;

    const rect = getRect(step.target);
    if (!rect) {
      spot.style.display = "none";
      tip.style.display = "none";
      return;
    }

    const sx = rect.x - PAD;
    const sy = rect.y - PAD;
    const sw = rect.width + PAD * 2;
    const sh = rect.height + PAD * 2;

    spot.style.display = "block";
    spot.style.left = `${sx}px`;
    spot.style.top = `${sy}px`;
    spot.style.width = `${sw}px`;
    spot.style.height = `${sh}px`;

    tip.style.display = "block";
    const place = step.placement ?? "bottom";
    const tipW = 360;
    const tipH = tip.offsetHeight || 160;
    let tx: number, ty: number;

    switch (place) {
      case "top":
        tx = sx + sw / 2 - tipW / 2;
        ty = sy - tipH - 16;
        break;
      case "bottom":
        tx = sx + sw / 2 - tipW / 2;
        ty = sy + sh + 16;
        break;
      case "left":
        tx = sx - tipW - 16;
        ty = sy + sh / 2 - tipH / 2;
        break;
      default: // right
        tx = sx + sw + 16;
        ty = sy + sh / 2 - tipH / 2;
    }

    tx = Math.max(16, Math.min(tx, window.innerWidth - tipW - 16));
    ty = Math.max(16, Math.min(ty, window.innerHeight - tipH - 16));
    tip.style.left = `${tx}px`;
    tip.style.top = `${ty}px`;
  }, [step]);

  useEffect(() => {
    if (!active) return;
    raf.current = requestAnimationFrame(() => { update(); });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [active, update]);

  useEffect(() => {
    if (!active || !step) return;
    const el = document.querySelector(step.target);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active, step]);

  if (!active || !step) return null;

  return (
    <div className="tour-root">
      <div id="tour-spotlight" className="tour-spotlight" />
      <div id="tour-tooltip" className="tour-tooltip">
        <button type="button" className="tour-close" onClick={onSkip} aria-label="关闭引导">×</button>
        <div className="tour-step-indicator">{stepIndex + 1} / {steps.length}</div>
        <strong className="tour-tooltip-title">{step.title}</strong>
        <p className="tour-tooltip-body">{step.body}</p>
        <div className="tour-tooltip-actions">
          {stepIndex > 0
            ? <button type="button" className="tour-btn tour-btn-secondary" onClick={onPrev}>上一步</button>
            : <div />}
          <button type="button" className="tour-btn tour-btn-skip" onClick={onSkip}>跳过</button>
          <button type="button" className="tour-btn tour-btn-primary" onClick={onNext}>
            {stepIndex === steps.length - 1 ? "完成" : "下一步"}
          </button>
        </div>
        <div className="tour-dots">
          {steps.map((_, i) => (
            <span key={i} className={`tour-dot ${i === stepIndex ? "active" : i < stepIndex ? "done" : ""}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
