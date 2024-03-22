import { describe, expect, it } from "vitest";
import { QCraft } from "./index.js";

describe("QCraft", () => {
  it("works", () => {
    const q = new QCraft();
    expect(q).toBeInstanceOf(QCraft);
  });
});
