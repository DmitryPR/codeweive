/// <reference types="vite/client" />

declare global {
  interface Window {
    noise: (
      x: number,
      y: number,
      z: number,
      octaves: number,
      fallout: number,
    ) => number;
  }
}

export {};
