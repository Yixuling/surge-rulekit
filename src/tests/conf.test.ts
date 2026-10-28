import { expect, test } from "bun:test";
import { rules, sections, splitFields } from "../conf";

const CONF = `[General]
loglevel = notify

[Rule]
# 注释
RULE-SET, https://x/y/AI.list, AI, extended-matching
RULE-SET, LAN, DIRECT
IP-CIDR, 17.0.0.0/8, DIRECT, no-resolve
RULE-SET, https://x/A.list, "Arc & Dia", extended-matching
AND, ((DOMAIN, a.com), (DEST-PORT, 443)), 🚀 Proxy, no-resolve
RULE-SET, https://x/B.list
FINAL, 🟢 Final, dns-failed

[MITM]
h2 = true
`;

test("rules 取规则 id 与策略：RULE-SET 取文件名或内置名、逻辑规则取整个表达式、FINAL 紧跟类型", () => {
  expect(rules(CONF).map(({ type, id, policy }) => [type, id, policy])).toEqual([
    ["RULE-SET", "AI.list", "AI"],
    ["RULE-SET", "LAN", "DIRECT"],
    ["IP-CIDR", "17.0.0.0/8", "DIRECT"],
    ["RULE-SET", "A.list", "Arc & Dia"],
    ["AND", "((DOMAIN, a.com), (DEST-PORT, 443))", "🚀 Proxy"],
    ["RULE-SET", "B.list", undefined],
    ["FINAL", "FINAL", "🟢 Final"],
  ]);
});

test("rules 保留原文供报错", () => {
  expect(rules(CONF)[5]!.raw).toBe("RULE-SET, https://x/B.list");
});

test("sections 按出现顺序分段：去掉注释与空行、保留 #! 指令、标题容许首尾空白、同名段不合并", () => {
  const text = "#!MANAGED-CONFIG https://x\n# 注释\n\n  [General]  \na = 1\n[Rule]\nFINAL, A\n[Rule]\nFINAL, B\n";
  expect(sections(text)).toEqual([
    ["", ["#!MANAGED-CONFIG https://x"]],
    ["General", ["a = 1"]],
    ["Rule", ["FINAL, A"]],
    ["Rule", ["FINAL, B"]],
  ]);
  expect(rules(text).map((r) => r.policy)).toEqual(["A"]);
});

test("rules 跳过 #! 指令，没有 [Rule] 段时为空", () => {
  expect(rules("[Rule]\n#!directive\nFINAL, A\n")).toHaveLength(1);
  expect(rules("[General]\na = 1\n")).toEqual([]);
});

test("splitFields：引号内逗号不切，去掉引号与空白", () => {
  expect(splitFields(' a , "b, c" ,d')).toEqual(["a", "b, c", "d"]);
  // 含逗号的正则 Surge 自己也要求加引号（不加 surge-cli -c 报 invalid），按引号切即与 Surge 一致
  expect(splitFields('select, policy-regex-filter = "(A){1,2}", hidden = 1')).toEqual(["select", 'policy-regex-filter = "(A){1,2}"', "hidden = 1"]);
});
