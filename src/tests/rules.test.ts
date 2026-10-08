// rules/ 的格式约定（见 AGENTS.md）与模板对本仓库文件的引用
import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../template";

const RULES = join(ROOT, "rules");
const files = readdirSync(RULES).filter((f) => f.endsWith(".list")).sort();
const ENTRY = /^(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|DOMAIN-WILDCARD|IP-CIDR|IP-CIDR6|IP-ASN|URL-REGEX|USER-AGENT|PROCESS-NAME), \S+$/;

test("每个规则集：三行头部、分组标题、条目写法、无重复、单个尾部换行", () => {
  for (const f of files) {
    const text = readFileSync(join(RULES, f), "utf8");
    expect(text, `${f} 须以单个换行结尾`).toMatch(/[^\n]\n$/);
    const lines = text.split("\n");
    expect(lines[0], `${f} 第 1 行应为名称注释`).toMatch(/^# \S.*规则$/);
    expect(lines[1], `${f} 第 2 行应为说明`).toMatch(/^# 说明：\S/);
    expect(lines[2], `${f} 第 3 行应为来源`).toMatch(/^# 来源：\S/);
    expect(lines[3], `${f} 头部后应空一行`).toBe("");
    const entries: string[] = [];
    lines.slice(4, -1).forEach((line, i) => {
      const where = `${f} 第 ${i + 5} 行`;
      expect(line, `${where} 有行尾空白`).toBe(line.trimEnd());
      if (line === "" || line.startsWith("# ")) return; // 空行、分组标题与说明注释
      expect(line, `${where} 条目须写成 "TYPE, value"，不带策略`).toMatch(ENTRY);
      entries.push(line);
    });
    expect(entries.length, `${f} 没有条目`).toBeGreaterThan(0);
    expect(new Set(entries).size, `${f} 有重复条目`).toBe(entries.length);
  }
});

test("AI 规则精确覆盖 Anthropic 依赖，不用宽泛模式接管共享风控与遥测域", () => {
  const text = readFileSync(join(RULES, "AI.list"), "utf8");
  const entries = new Set(text.split("\n").filter((line) => line && !line.startsWith("#")));
  for (const entry of [
    "DOMAIN, anthropic.auth0.com",
    "DOMAIN, anthropic-com.ghost.io",
    "DOMAIN, servd-anthropic-website.b-cdn.net",
    "DOMAIN, anthropic.com.cdn.cloudflare.net",
    "DOMAIN, browser-intake-us5-datadoghq.com",
    "DOMAIN, http-intake.logs.us5.datadoghq.com",
    "IP-CIDR, 160.79.104.0/21",
    "IP-CIDR6, 2607:6bc0::/32",
  ]) {
    expect(entries.has(entry), `AI.list 缺少 ${entry}`).toBe(true);
  }
  for (const entry of [
    "DOMAIN-KEYWORD, sift",
    "DOMAIN-KEYWORD, datadog",
    "DOMAIN-SUFFIX, siftscience.com",
    "DOMAIN-SUFFIX, statsigapi.net",
    "DOMAIN-SUFFIX, sentry.io",
    "DOMAIN-SUFFIX, datadoghq.com",
  ]) {
    expect(entries.has(entry), `AI.list 不应宽泛接管 ${entry}`).toBe(false);
  }
  const tpl = readFileSync(join(ROOT, "Surge.tpl.conf"), "utf8");
  expect(tpl).toContain("rules/AI.list, AI, no-resolve, extended-matching");
});

test("模板引用的本仓库 rules/ 与 icons/ 文件都存在，rules/ 里没有模板不引用的文件", () => {
  const tpl = readFileSync(join(ROOT, "Surge.tpl.conf"), "utf8");
  const refs = [...tpl.matchAll(/surge-rulekit\/refs\/heads\/main\/((?:rules|icons)\/[^\s,]+)/g)].map((m) => m[1]!);
  expect(refs.length).toBeGreaterThan(0);
  for (const ref of new Set(refs)) expect(existsSync(join(ROOT, ref)), `模板引用的 ${ref} 不存在`).toBe(true);
  const referenced = new Set(refs.filter((r) => r.startsWith("rules/")).map((r) => r.slice("rules/".length)));
  for (const f of files) expect(referenced.has(f), `rules/${f} 没有被模板引用`).toBe(true);
});
