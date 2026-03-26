/**
 * Visual FX configuration — all effects toggleable for performance control.
 * URL param: ?fx=off disables ALL effects.
 */

export interface VisualFXConfig {
  vignette: boolean;
  bloom: boolean;
  colorGrading: boolean;
  objectGlow: boolean;
  trumanGlow: boolean;
  crtScanlines: boolean;
  ambientParticles: boolean;
  dayNightCycle: boolean;
}

const DEFAULT_FX: VisualFXConfig = {
  vignette: true,
  bloom: true,
  colorGrading: true,
  objectGlow: true,
  trumanGlow: true,
  crtScanlines: false,
  ambientParticles: true,
  dayNightCycle: true,
};

const ALL_OFF: VisualFXConfig = {
  vignette: false,
  bloom: false,
  colorGrading: false,
  objectGlow: false,
  trumanGlow: false,
  crtScanlines: false,
  ambientParticles: false,
  dayNightCycle: false,
};

let currentConfig: VisualFXConfig = { ...DEFAULT_FX };

/** Initialize FX config based on URL params */
export function initVisualConfig(): VisualFXConfig {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const fxParam = params.get("fx");
    if (fxParam === "off" || fxParam === "false" || fxParam === "0") {
      currentConfig = { ...ALL_OFF };
    }
  }
  return currentConfig;
}

/** Get current FX config */
export function getVisualConfig(): VisualFXConfig {
  return currentConfig;
}

/** Update a specific FX toggle at runtime */
export function setVisualFX(key: keyof VisualFXConfig, value: boolean): void {
  currentConfig[key] = value;
}

/** Get config as plain object (for ConfigPanel display) */
export function getVisualConfigEntries(): Array<[string, boolean]> {
  return Object.entries(currentConfig) as Array<[string, boolean]>;
}
