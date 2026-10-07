import { expect, test } from "bun:test";
import { CATCH_ALL, checkOrder, ORDER, ruleIds } from "../order";

const ORDERED = [
  "WeChat.list", "AppleIntelligence.list", "AppleExtra.list", "AppStore.list", "iCloud.list", "AppleDev.list", "TestFlight.list",
  "AppleMedia.list", "17.0.0.0/8", "AI.list", "YouTube.list", "Google.list", "Twitter.list", "Global_All_No_Resolve.list",
  "China_All_No_Resolve.list", "LAN", "ASN.China.list",
];
const DIRECT = new Set(["AppStore.list", "iCloud.list", "China_All_No_Resolve.list", "ASN.China.list"]);
const line = (id: string) =>
  id === "LAN" ? "RULE-SET, LAN, DIRECT"
  : id.includes("/") ? `IP-CIDR, ${id}, DIRECT, no-resolve`
  : `RULE-SET, https://x/y/${id}, ${DIRECT.has(id) ? "DIRECT" : "P"}`;
const conf = (ids: string[]) => `[General]\na = 1\n[Rule]\n# 注释\n${ids.map(line).join("\n")}\nFINAL, F, dns-failed\n[MITM]\nh2 = true\n`;

test("ruleIds 取文件名、内置名、匹配值", () => {
  expect(ruleIds(conf(["AI.list", "LAN", "17.0.0.0/8"]))).toEqual(["AI.list", "LAN", "17.0.0.0/8", "FINAL"]);
});

test("合规顺序无违反", () => {
  expect(checkOrder(conf(ORDERED))).toEqual([]);
});

test("每条约束反过来都会被发现", () => {
  for (const [first, then, why] of ORDER) {
    const swapped = ORDERED.map((id) => (id === first ? then : id === then ? first : id));
    expect(checkOrder(conf(swapped))).toContain(`${first} 须在 ${then} 之前：${why}`);
  }
});

test("WeChat 不是第一个规则集会被发现", () => {
  const moved = ["AppleIntelligence.list", "WeChat.list", ...ORDERED.slice(2)];
  expect(checkOrder(conf(moved))).toContain(
    "WeChat.list 须是第一个 RULE-SET（现在是 AppleIntelligence.list）：微信对出口策略敏感，须先于所有规则集匹配",
  );
  // 非规则集（如 IP-CIDR）排在前面不算违反
  expect(checkOrder(conf(["0.0.0.0/32", ...ORDERED]))).toEqual([]);
});

test("非直连规则集排在兜底规则集之后会被发现，直连规则集不算", () => {
  const [catchAll, why] = CATCH_ALL;
  const after = (id: string) => {
    const rest = ORDERED.filter((x) => x !== id);
    rest.splice(rest.indexOf(catchAll) + 1, 0, id);
    return rest;
  };
  expect(checkOrder(conf(after("Twitter.list")))).toContain(`Twitter.list 须在 ${catchAll} 之前：${why}`);
  expect(checkOrder(conf(after("iCloud.list"))).filter((p) => p.includes(catchAll))).toEqual([]);
});

test("约束涉及的规则缺失或重复都报错", () => {
  expect(checkOrder(conf(ORDERED.filter((id) => id !== "Google.list")))).toContain("规则 Google.list 出现 0 次，须恰好一次");
  expect(checkOrder(conf(["AI.list", ...ORDERED]))).toContain("规则 AI.list 出现 2 次，须恰好一次");
});
