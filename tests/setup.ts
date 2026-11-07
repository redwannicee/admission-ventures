import "@testing-library/jest-dom/vitest";

// The site defaults to Bangla; the existing component tests assert on English text.
localStorage.setItem("av_lang", "en");
