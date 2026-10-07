// [Rule] 顺序约束：Surge 自上而下匹配，打乱以下顺序，流量会被前面的规则抢走。
// 规则以 id 指代：RULE-SET 取 URL 文件名（AI.list）或内置名（LAN），其余取匹配值（17.0.0.0/8）。
import { splitFields } from "./normalize";

const APPLE_DIRECT = "gateway.icloud.com 在 iCloud.list 的 icloud.com 后缀之内，后置会被抢成直连";
const APPLE_IP = "apple-relay 等需代理域名解析到 17.x，IP 规则前置会把它们抢成直连";
const DNS_TAIL = "LAN 与 ASN 规则会触发本地 DNS 解析，须沉底";

// 须是第一个 RULE-SET：[规则, 原因]
export const FIRST_RULE_SET: [string, string] = ["WeChat.list", "微信对出口策略敏感，须先于所有规则集匹配"];

// 兜底规则集：所有策略不是 DIRECT 的 RULE-SET 都须在它之前，否则被它收走送进 🚀 Proxy。
// 之后只允许直连类规则集（China、LAN、ASN）
export const CATCH_ALL: [string, string] = ["Global_All_No_Resolve.list", "兜底规则集把没点名的国外域名都送进 🚀 Proxy，服务规则集后置会被抢走"];

// [先, 后, 原因]
export const ORDER: [string, string, string][] = [
  ["AppleExtra.list", "iCloud.list", APPLE_DIRECT],
  ["AppleIntelligence.list", "17.0.0.0/8", APPLE_IP],
  ["AppleExtra.list", "17.0.0.0/8", APPLE_IP],
  ["AppleDev.list", "17.0.0.0/8", APPLE_IP],
  ["TestFlight.list", "17.0.0.0/8", APPLE_IP],
  ["AppleMedia.list", "17.0.0.0/8", APPLE_IP],
  ["AI.list", "Google.list", "防 Gemini 域名被 Google 组抢先匹配"],
  ["AI.list", "Twitter.list", "grok.com 也在 Twitter.list 里，后置会被 Twitter 组抢先匹配"],
  ["YouTube.list", "Google.list", "防 googlevideo 被 Google 组抢先匹配"],
  ["China_All_No_Resolve.list", "LAN", DNS_TAIL],
  ["LAN", "ASN.China.list", DNS_TAIL],
];

type Rule = { type: string; id: string; policy: string };

// [Rule] 段每条规则
function rules(conf: string): Rule[] {
  const section = conf.split(/^\[Rule\]$/m)[1]?.split(/^\[/m)[0] ?? "";
  return section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [type = "", value = "", policy = ""] = splitFields(l);
      if (type === "FINAL") return { type, id: "FINAL", policy: value };
      return { type, id: type === "RULE-SET" ? value.slice(value.lastIndexOf("/") + 1) : value, policy };
    });
}

export const ruleIds = (conf: string): string[] => rules(conf).map((r) => r.id);

// 返回违反项；约束涉及的规则须恰好出现一次，否则无从检查，会静默通过
export function checkOrder(conf: string, order = ORDER): string[] {
  const all = rules(conf);
  const ids = all.map((r) => r.id);
  const problems = new Set<string>();
  const pos = (id: string) => {
    const n = ids.filter((x) => x === id).length;
    if (n !== 1) problems.add(`规则 ${id} 出现 ${n} 次，须恰好一次`);
    return ids.indexOf(id);
  };
  for (const [first, then, why] of order) {
    const [a, b] = [pos(first), pos(then)];
    if (a >= 0 && b >= 0 && a > b) problems.add(`${first} 须在 ${then} 之前：${why}`);
  }
  const [lead, leadWhy] = FIRST_RULE_SET;
  const firstSet = all.find((r) => r.type === "RULE-SET")?.id;
  if (pos(lead) >= 0 && firstSet !== lead) problems.add(`${lead} 须是第一个 RULE-SET（现在是 ${firstSet}）：${leadWhy}`);
  const [catchAll, catchAllWhy] = CATCH_ALL;
  const c = pos(catchAll);
  if (c >= 0) {
    all.forEach((r, i) => {
      if (i > c && r.type === "RULE-SET" && r.policy !== "DIRECT") problems.add(`${r.id} 须在 ${catchAll} 之前：${catchAllWhy}`);
    });
  }
  return [...problems];
}
