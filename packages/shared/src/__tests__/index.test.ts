import { describe, it, expect } from "vitest";
import { APP_NAME } from "../index.js";

describe("shared", () => {
  it("exports APP_NAME constant", () => {
    expect(APP_NAME).toBe("No True Man Show");
  });
});
