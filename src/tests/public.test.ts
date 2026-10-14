import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildProfile, PROFILES } from "../public";
import { ROOT } from "../template";

for (const p of PROFILES) {
  // 模板改了却没重新渲染时，仓库里的公开配置会落后于模板
  test(`${p.file} 与模板同步（改模板后要 bun run render 再提交）`, () => {
    expect(readFileSync(join(ROOT, p.file), "utf8")).toBe(buildProfile(p));
  });

  test(`${p.file} 不含作者专用部分`, () => {
    const conf = buildProfile(p);
    for (const s of ["🚄 Static", "http-api", "ca-p12", "ca-passphrase", "专线"]) expect(conf).not.toContain(s);
    expect(conf).toContain("# 👇");
  });
}

test("单机场版只剩一家机场", () => {
  const conf = buildProfile(PROFILES.find((p) => p.file === "Surge-Single.conf")!);
  expect(conf).not.toContain("机场B");
  expect(conf).toMatch(/^🌀 🇭🇰 HongKong += fallback, "🇭🇰 HongKong \| 机场", +url/m);
});
