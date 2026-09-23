import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("mantém caminhos internos", () => {
    expect(safeNextPath("/organizacao")).toBe("/organizacao");
    expect(safeNextPath("/convite/abc?x=1")).toBe("/convite/abc?x=1");
  });

  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "evil", "", "/\u0000x", null, 42])("bloqueia %s", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });
});
