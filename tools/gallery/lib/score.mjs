/* Measured scores and how the four categories combine (methodVersion 1; weights in the design
   doc). `raw` has a `desktop` and a `phone` object, each with:
   lcpMs, overflow, smallTapFraction, axeSerious, errors, failedRequests,
   contrastFailures, cls, badImages, fontFamilies. measure.mjs writes exactly these fields. */
import { roundHalfEven } from "../../check-student-gallery.mjs";
import { hamming, textSimilarity } from "./unique.mjs";

/** 100 at `best`, 0 at `worst`, linear between, clamped and rounded. */
export function curve(value, best, worst) {
  const t = (value - worst) / (best - worst);
  return Math.round(100 * Math.min(1, Math.max(0, t)));
}

const both = (raw, f) => (f(raw.desktop) + f(raw.phone)) / 2;

/** Usability: speed 30%, phone fit 25%, accessibility 25%, working 20%; desktop and phone averaged. */
export function usabilityScore(raw) {
  const speed = both(raw, (v) => curve(v.lcpMs, 1500, 6000));
  const fit = both(raw, (v) => (v.overflow ? 0 : 40) + 60 * (1 - v.smallTapFraction));
  const access = both(raw, (v) => curve(v.axeSerious, 0, 20));
  const working = both(raw, (v) => Math.max(0, 100 - 25 * (v.errors + v.failedRequests)));
  return roundHalfEven(0.3 * speed + 0.25 * fit + 0.25 * access + 0.2 * working);
}

/** The measured half of Design: contrast 40%, layout shift 30%, images 15%, fonts 15%. */
export function designMeasuredScore(raw) {
  const contrast = both(raw, (v) => curve(v.contrastFailures, 0, 30));
  const shift = both(raw, (v) => curve(v.cls, 0.05, 0.5));
  const images = both(raw, (v) => Math.max(0, 100 - 25 * v.badImages));
  const fonts = both(raw, (v) => (v.fontFamilies <= 3 ? 100 : Math.max(0, 100 - 25 * (v.fontFamilies - 3))));
  return roundHalfEven(0.4 * contrast + 0.3 * shift + 0.15 * images + 0.15 * fonts);
}

/** Design = half measured, half judged look. */
export const designScore = (measured, look) => roundHalfEven((measured + look) / 2);

/** Overall = plain average of the four, rounded half to even. */
export const overallScore = (s) => roundHalfEven((s.concept + s.uniqueness + s.design + s.usability) / 4);

/** True when a site must be (re)judged: new, never judged, changed, or judged under an older rubric. */
export function needsJudging(saved, fresh, rubricVersion) {
  if (!saved || !saved.judged || saved.rejudge || saved.judged.rubricVersion !== rubricVersion) return true;
  const a = saved.fingerprint ?? {};
  const b = fresh.fingerprint;
  if (!a.minhash || !a.dhash) return true;
  return textSimilarity(a.minhash, b.minhash) < 0.85 || hamming(a.dhash, b.dhash) > 12;
}
