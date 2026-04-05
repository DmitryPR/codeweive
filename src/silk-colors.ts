/**
 * Preset pairs aligned with weavesilk.com `site.js` `initColorPicker` `colors` array
 * (gradient display colors + true base/accent used for Silk.velocity color scale).
 */
export type SilkColorPreset = {
  /** `Silk.color` — low-velocity / base of scale */
  base: string;
  /** `Silk.highlightColor` — high-velocity / highlight of scale */
  accent: string;
  /** CSS gradient for the swatch button */
  gradient: string;
};

export const SILK_COLOR_PRESETS: SilkColorPreset[] = [
  {
    base: "#276f9b",
    accent: "#3dbbea",
    gradient: "linear-gradient(140deg, #3e95cc, #82cefc)",
  },
  {
    base: "#53BD39",
    accent: "#65eb43",
    gradient: "linear-gradient(140deg, #53bf39, #65eb43)",
  },
  {
    base: "#E3BF30",
    accent: "#fdf23f",
    gradient: "linear-gradient(140deg, #e1d730, #fdf23f)",
  },
  {
    base: "#EB5126",
    accent: "#fd722e",
    gradient: "linear-gradient(140deg, #ea5126, #fd722e)",
  },
  {
    base: "#dd4876",
    accent: "#fe495e",
    gradient: "linear-gradient(140deg, #db4775, #fd5e8f)",
  },
  {
    base: "#825ba1",
    accent: "#b585da",
    gradient: "linear-gradient(140deg, #825ba1, #b585da)",
  },
  {
    base: "#555555",
    accent: "#717171",
    gradient: "linear-gradient(140deg, #555555, #717171)",
  },
];
