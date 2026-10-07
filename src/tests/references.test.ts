import { expect, test } from "bun:test";
import { checkReferences, rulePolicy } from "../references";

const BASE = `[General]
loglevel = notify

[Proxy]
🎯 Direct = direct

[Proxy Group]
🚀 Proxy = select, "🌀 HK", include-other-group = "📍 Regions, 📡 Subscription"
🌀 HK = fallback, "🇭🇰 HK | A", url = http://x/generate_204, interval = 300
🇭🇰 HK | A = smart, hidden = 1, include-other-group = A, policy-regex-filter = HK
📡 Subscription = select, hidden = 1, policy-path = https://x/sub
A = select, include-other-group = "📡 Subscription", policy-regex-filter = A
📍 Regions = select, hidden = 1, "🌀 HK"
Arc & Dia = select, "🚀 Proxy", "🎯 Direct"

[Rule]
# 注释
IP-CIDR, 0.0.0.0/32, REJECT, no-resolve
RULE-SET, https://x/ArcDia.list, Arc & Dia, extended-matching
RULE-SET, LAN, DIRECT
AND, ((DOMAIN, a.com), (DEST-PORT, 443)), 🚀 Proxy
FINAL, 🚀 Proxy, dns-failed

[MITM]
h2 = true
`;

test("rulePolicy 取 FINAL、逻辑规则与普通规则的策略名", () => {
  expect(rulePolicy("FINAL, 🟢 Final, dns-failed")).toBe("🟢 Final");
  expect(rulePolicy("AND, ((DOMAIN, a.com), (DEST-PORT, 443)), 🚀 Proxy, no-resolve")).toBe("🚀 Proxy");
  expect(rulePolicy('RULE-SET, https://x/A.list, "Arc & Dia", extended-matching')).toBe("Arc & Dia");
  expect(rulePolicy("RULE-SET, https://x/A.list")).toBeUndefined();
});

test("引用都已定义时无违反", () => {
  expect(checkReferences(BASE)).toEqual([]);
});

test("规则策略、组成员、include-other-group 引用未定义都报错", () => {
  const problems = checkReferences(
    BASE.replace("FINAL, 🚀 Proxy", "FINAL, 🟢 Final")
      .replace('"🚀 Proxy", "🎯 Direct"', '"🚀 Proxy", "🎯 Direkt"')
      .replace('include-other-group = "📍 Regions, 📡 Subscription"', 'include-other-group = "📍 Regions, 📡 Sub"')
      .replace("RULE-SET, LAN, DIRECT", "RULE-SET, LAN"),
  );
  expect(problems).toContain("[Rule] 第 5 条引用的策略 🟢 Final 未定义");
  expect(problems).toContain("策略组 Arc & Dia 的成员 🎯 Direkt 未定义");
  expect(problems).toContain("策略组 🚀 Proxy 的 include-other-group 引用的 📡 Sub 未定义");
  expect(problems).toContain("[Rule] 第 3 条缺少策略：RULE-SET, LAN");
  expect(problems).toHaveLength(4);
});

test("内置策略不算未定义，include-other-group 不接受内置策略", () => {
  expect(checkReferences(BASE.replace("RULE-SET, LAN, DIRECT", "RULE-SET, LAN, REJECT-DROP"))).toEqual([]);
  expect(checkReferences(BASE.replace("include-other-group = A,", "include-other-group = DIRECT,"))).toEqual([
    "策略组 🇭🇰 HK | A 的 include-other-group 引用的 DIRECT 未定义",
  ]);
});
