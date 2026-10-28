import { expect, test } from "bun:test";
import { join } from "node:path";
import { sections } from "../conf";
import { denyStrings, parseEnv, type PrivateLayer } from "../private";
import { build, GENERATED_HEADER, readTemplate, render, ROOT } from "../template";

const layer = (vars: Record<string, string>, snippets: Record<string, string> = {}, deny: string[] = []): PrivateLayer => ({
  vars: new Map(Object.entries(vars)),
  snippets: new Map(Object.entries(snippets)),
  deny,
});

test("替换变量、内联片段", () => {
  expect(render("a = {{A}}\n{{> extra}}\nb = 1", layer({ A: "x" }, { extra: "c = 2\n\n" }))).toBe("a = x\nc = 2\nb = 1");
});

test("未定义、缺失、未使用、格式不对都报错", () => {
  const t = () => render("a = {{A}}\n{{> nope}}\nb = {{lower}}", layer({ UNUSED: "x" }, { extra: "" }));
  expect(t).toThrow("未定义变量 A");
  expect(t).toThrow("缺少片段 snippets/nope.conf");
  expect(t).toThrow("变量 UNUSED 在模板中未使用");
  expect(t).toThrow("片段 snippets/extra.conf 在模板中未使用");
  expect(t).toThrow("格式不对的占位符");
  expect(() => render("a = {B}", layer({}))).toThrow("格式不对的占位符");
});

test("parseEnv 取第一个 = 之后的全部内容，拒绝重复与非法键", () => {
  expect(parseEnv("# c\n\nA=x=y, z\n")).toEqual(new Map([["A", "x=y, z"]]));
  expect(() => parseEnv("A=1\nA=2")).toThrow("重复");
  expect(() => parseEnv("a=1")).toThrow("格式错误");
});

test("扫描清单只含 SECRET_*、deny.txt 与片段里的域名", () => {
  const deny = denyStrings(
    layer({ SECRET_URL: "https://s.example/x", HTTP_API_KEY: "surge" }, { r: "# a.example.com\nDOMAIN, p.example.org, DIRECT" }, ["abc"]),
  );
  expect(deny.sort()).toEqual(["abc", "https://s.example/x", "p.example.org"]);
});

// CI 只有示例私有层：保证模板与示例同步，且顺序约束成立
test("模板用 private.example 能完整渲染，模板说明换成生成说明", () => {
  const conf = build(join(ROOT, "private.example"));
  expect(conf).not.toContain("{{");
  expect(conf).toStartWith(GENERATED_HEADER);
  expect(conf).not.toContain("配置模板");
});

// 终端显示宽度：emoji 与中文占 2 列，变体选择符与零宽连接符不占列，国旗由两个区域指示符组成、各占 1 列
const width = (s: string) =>
  [...s].reduce((n, ch) => {
    const c = ch.codePointAt(0)!;
    if (c === 0xfe0f || c === 0x200d) return n;
    if (c >= 0x1f1e6 && c <= 0x1f1ff) return n + 1;
    const wide = c >= 0x1f000 || (c >= 0x2600 && c <= 0x27bf) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xff00 && c <= 0xff60);
    return n + (wide ? 2 : 1);
  }, 0);

// 模板等号按块（空行分隔）对齐：同一块里第一个 = 在同一列，= 前至少一个空格、后恰好一个空格
function misaligned(text: string): string[] {
  const problems: string[] = [];
  let block: [number, string][] = [];
  const flush = () => {
    const cols = new Set(block.map(([, l]) => width(l.slice(0, l.indexOf("=")))));
    if (cols.size > 1) problems.push(`第 ${block[0]![0]}–${block.at(-1)![0]} 行的等号没有对齐`);
    block = [];
  };
  text.split("\n").forEach((line, i) => {
    if (!line.trim()) return flush();
    if (line.startsWith("#") || line.startsWith("[") || !line.includes("=")) return;
    if (!/\S +=(?: \S|$)/.test(line.slice(0, line.indexOf("=") + 3))) problems.push(`第 ${i + 1} 行等号两侧空格不对：前至少一个、后恰好一个`);
    block.push([i + 1, line]);
  });
  flush();
  return problems;
}

test("等号检查：未对齐与等号后缺空格都会被发现，emoji 与中文按 2 列计", () => {
  expect(misaligned("🎯 Direct  = direct\n⛔️ Reject  = reject\n🔗 Tailnet = tailscale")).toEqual([]);
  expect(misaligned("🇭🇰 HK = a\n中文  = b")).toEqual([]);
  expect(misaligned("AdsPower  = select\nApple     =select")).toEqual(["第 2 行等号两侧空格不对：前至少一个、后恰好一个"]);
  expect(misaligned("a  = 1\nbb = 2\n\nccc = 3\nd = 4")).toEqual(["第 4–5 行的等号没有对齐"]);
});

test("模板等号按块对齐", () => {
  expect(misaligned(readTemplate())).toEqual([]);
});

// 手册：all-hybrid「Instead of setting up connections with cellular data when the Wi-Fi network is poor」，即取代 wifi-assist 的被动切换
// （https://manual.nssurge.com/profile/general.html）。两者同开是多余的，还会让人误以为两套机制同时生效
function hybridConflict(conf: string): string[] {
  const general = new Map(
    (sections(conf).find(([name]) => name === "General")?.[1] ?? []).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
  return general.get("all-hybrid") === "true" && general.get("wifi-assist") === "true"
    ? ["all-hybrid 开启时 wifi-assist 须为 false：all-hybrid 已取代 wifi-assist 的被动切换（见 Surge 手册 General 段）"]
    : [];
}

test("all-hybrid 开启时 wifi-assist 须关闭，关闭 all-hybrid 后可单独开 wifi-assist", () => {
  expect(hybridConflict("[General]\nwifi-assist = true\nall-hybrid = true\n")).toHaveLength(1);
  expect(hybridConflict("[General]\nwifi-assist = true\nall-hybrid = false\n")).toEqual([]);
  expect(hybridConflict(readTemplate())).toEqual([]);
});
