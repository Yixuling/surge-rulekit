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

test("模板引用的本仓库 rules/ 与 icons/ 文件都存在，rules/ 里没有模板不引用的文件", () => {
  const tpl = readFileSync(join(ROOT, "Surge.tpl.conf"), "utf8");
  const refs = [...tpl.matchAll(/surge-rulekit\/refs\/heads\/main\/((?:rules|icons)\/[^\s,]+)/g)].map((m) => m[1]!);
  expect(refs.length).toBeGreaterThan(0);
  for (const ref of new Set(refs)) expect(existsSync(join(ROOT, ref)), `模板引用的 ${ref} 不存在`).toBe(true);
  const referenced = new Set(refs.filter((r) => r.startsWith("rules/")).map((r) => r.slice("rules/".length)));
  for (const f of files) expect(referenced.has(f), `rules/${f} 没有被模板引用`).toBe(true);
});
