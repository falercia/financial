import { describe, expect, it } from "vitest";
import { assignableRoles, canRemoveMember, invitableRoles, isAdminRole } from "./roles";

describe("papéis", () => {
  it("apenas proprietário e administrador são administrativos", () => {
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("member")).toBe(false);
  });

  it("convites seguem a hierarquia", () => {
    expect(invitableRoles("owner")).toEqual(["admin", "member"]);
    expect(invitableRoles("admin")).toEqual(["member"]);
    expect(invitableRoles("member")).toEqual([]);
  });

  it("administrador não promove nem rebaixa administradores", () => {
    expect(assignableRoles("admin", "admin")).toEqual([]);
    expect(assignableRoles("admin", "member")).toEqual(["member"]);
    expect(assignableRoles("owner", "admin")).toEqual(["owner", "admin", "member"]);
  });

  it("remoção respeita a hierarquia, e qualquer pessoa pode sair", () => {
    expect(canRemoveMember("member", "member", true)).toBe(true);
    expect(canRemoveMember("member", "member", false)).toBe(false);
    expect(canRemoveMember("admin", "member", false)).toBe(true);
    expect(canRemoveMember("admin", "owner", false)).toBe(false);
    expect(canRemoveMember("owner", "admin", false)).toBe(true);
  });
});
