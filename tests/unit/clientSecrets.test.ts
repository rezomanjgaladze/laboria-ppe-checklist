import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("client secret boundaries", () => {
  it("does not reference private environment variables from client components", () => {
    const root = process.cwd();
    const files = execFileSync("git", ["ls-files", "app/**/*.ts", "app/**/*.tsx"], {
      cwd: root,
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .filter(Boolean);
    const violations: string[] = [];

    for (const file of files) {
      const path = join(root, file);
      if (!existsSync(path)) continue;
      const source = readFileSync(path, "utf8");
      if (!/^\s*["']use client["'];/m.test(source)) continue;
      const matches = source.match(/process\.env\.([A-Z0-9_]+)/g) || [];
      for (const match of matches) {
        if (!match.includes("NEXT_PUBLIC_")) violations.push(`${file}: ${match}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
