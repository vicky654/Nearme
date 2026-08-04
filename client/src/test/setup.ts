import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia; the theme store (Task 13) needs it to
// resolve the "system" preference, so every test run gets a working stub.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}
