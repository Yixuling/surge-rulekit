import { expect, test } from "bun:test";
import { driftReference, normalize, splitFields } from "../normalize";

test("splitFields：引号内逗号不切，去掉引号与空白", () => {
  expect(splitFields(' a , "b, c" ,d')).toEqual(["a", "b, c", "d"]);
});

// 取自 Surge UI 保存前后的真实差异
const handWritten = `# 注释
[General]
loglevel = notify
ipv6 = false

[Proxy Group]
📍 Regions = select, hidden = 1, "🌀 HK", "🌀 SG"
Pool = smart, hidden = 1, include-other-group = "🇭🇰 HK | A"
Mix = select, include-other-group = "📍 Regions, AllProxies"

[Rule]
RULE-SET, https://x/ArcDia.list, Arc & Dia, extended-matching
FINAL, 🟢 Final, dns-failed

[Script]
`;
const uiSaved = `[General]
ipv6 = false
loglevel = notify

[Proxy Group]
📍 Regions = select, "🌀 HK", "🌀 SG", hidden=1
Pool = smart, hidden=1, include-other-group=🇭🇰 HK | A
Mix = select, include-other-group="📍 Regions,AllProxies"

[Rule]
RULE-SET,https://x/ArcDia.list,"Arc & Dia",extended-matching
FINAL,🟢 Final,dns-failed
`;

test("UI 改写前后语义相等", () => {
  expect(normalize(uiSaved)).toBe(normalize(handWritten));
});

test("规则或成员顺序变化视为不同", () => {
  const rules = handWritten.replace(/(RULE-SET.*)\n(FINAL.*)/, "$2\n$1");
  const members = handWritten.replace('"🌀 HK", "🌀 SG"', '"🌀 SG", "🌀 HK"');
  expect(normalize(rules)).not.toBe(normalize(handWritten));
  expect(normalize(members)).not.toBe(normalize(handWritten));
});

test("保留 #! 指令", () => {
  expect(normalize("#!MANAGED-CONFIG https://x\n[General]\na = 1")).toContain("#!MANAGED-CONFIG https://x");
});

test("漂移：UI 只改格式不算，语义变化算；无基准时与本次渲染比较", () => {
  const changed = handWritten.replace("loglevel = notify", "loglevel = verbose");
  expect(driftReference(uiSaved, handWritten, "")).toBeUndefined();
  expect(driftReference(changed, handWritten, "")).toBe(handWritten);
  expect(driftReference(uiSaved, undefined, handWritten)).toBeUndefined();
  expect(driftReference(changed, undefined, handWritten)).toBe(handWritten);
});
