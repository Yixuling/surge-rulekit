// 公开配置（根目录的 Surge-*.conf）：从同一份模板转换出三份可直接下载使用的配置（单机场、双机场分开订阅、双机场合并订阅），不含任何私有值。
// 转换按模板原文匹配，模板改动导致某处没匹配上时直接报错，不会静默产出走样的配置
import type { PrivateLayer } from "./private";
import { finalize, readTemplate, render } from "./template";

const ICON = "https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Airport.png";
const PRIMARY = "{{SECRET_PRIMARY_AIRPORT}}";
const BACKUP = "{{SECRET_BACKUP_AIRPORT}}";

function sub(text: string, from: string | RegExp, to: string): string {
  const out = text.replace(from, to);
  if (out === text) throw new Error(`公开配置转换：模板里找不到 ${from}，模板改过后要同步 src/public.ts`);
  return out;
}

const lines = (text: string, keep: (line: string) => boolean): string => text.split("\n").filter(keep).join("\n");

// 三份共用：去掉只对作者有意义的部分（专线、Tailscale、HTTP API、MITM 证书、私有规则与 skip-proxy 追加项）
function common(t: string): string {
  t = sub(t, /^# 只访问 tailnet.*\n🔗 Tailnet .*\n\n# 在 Surge 策略编辑器里登录.*\n\[Tailscale tailnet\]\n.*\n/m, "");
  t = sub(t, /^🎯 Direct  =/m, "🎯 Direct =");
  t = sub(t, /^⛔️ Reject  =/m, "⛔️ Reject =");
  t = sub(t, "；末尾为私有追加条目（反代理检测的银行 App 等，见 values.env）", "");
  t = sub(t, ", {{SKIP_PROXY_EXTRA}}", "");
  t = lines(t, (l) => !/^(# HTTP API|http-api|ca-passphrase|ca-p12)/.test(l));
  t = sub(t, "{{> private-rules}}\n\n", "");
  t = sub(t, / \/ 专线/, "");
  t = sub(t, /"🚄 Static", /g, "");
  t = sub(t, /\^\(\?!\.\*\{\{SECRET_STATIC_KEYWORD\}\}\)\.\*/g, "");
  t = sub(t, "# 主力机场（排除专线节点）", "# 主力机场");
  t = sub(t, /^# ── 专线 ──\n(?:.+\n)+\n/m, "");
  return sub(t, "（→ 专线）", "");
}

// 地区组只留主力机场：删备用机场的 Smart 组与子集组，fallback 组去掉备用成员
function singleAirport(t: string): string {
  t = sub(t, new RegExp(`, +"[^"]+ \\| ${BACKUP.replace(/[{}]/g, "\\$&")}"`, "g"), "");
  t = lines(t, (l) => !l.includes(BACKUP) && l !== "# 备用机场");
  t = sub(t, `, policy-regex-filter = ${PRIMARY}`, "");
  t = sub(t, "# 机场子集（正则过滤）", "# 机场节点（地区组从这里筛选）");
  return sub(t, /^📡 Subscription .*$/m, "# 👇 换成自己的订阅链接\n$&");
}

// 每家机场一条订阅：子集组直接拉订阅，📡 Subscription 改为汇总两家
function splitSubscriptions(t: string): string {
  t = sub(t, "# 全量节点池（远程订阅）", "# 全量节点池（汇总两家机场）");
  t = sub(t, "policy-path = {{SECRET_SUB_URL}}", `include-other-group = "${PRIMARY}, ${BACKUP}"`);
  t = sub(t, `include-other-group = "📡 Subscription", policy-regex-filter = ${PRIMARY},`, "policy-path = {{SUB_URL_A}},");
  t = sub(t, `include-other-group = "📡 Subscription", policy-regex-filter = ${BACKUP}, `, "policy-path = {{SUB_URL_B}},");
  return sub(t, /^# 机场子集（正则过滤）$/m, "# 两家机场各自的订阅\n# 👇 换成自己的订阅链接");
}

// 合并订阅：结构同作者自用版，节点关键词与组名分开，改关键词只需改一处
function mergedSubscription(t: string): string {
  t = sub(t, `policy-regex-filter = ${PRIMARY},`, "policy-regex-filter = {{KEYWORD_A}},");
  t = sub(t, `policy-regex-filter = ${BACKUP}, `, "policy-regex-filter = {{KEYWORD_B}},");
  t = sub(t, /^📡 Subscription .*$/m, "# 👇 换成合并后的订阅链接（两家机场的订阅可以用 Sub-Store 合并成一份）\n$&");
  return sub(t, /^# 机场子集（正则过滤）$/m, "# 机场子集（正则过滤）\n# 👇 关键词A、关键词B 换成节点名里能区分两家机场的关键词");
}

type Profile = { file: string; title: string; transform: (t: string) => string; vars: Record<string, string> };

export const PROFILES: Profile[] = [
  {
    file: "Surge-Single.conf",
    title: "单机场",
    transform: singleAirport,
    vars: { SECRET_SUB_URL: "https://example.com/subscription", SECRET_PRIMARY_AIRPORT: "机场", PRIMARY_AIRPORT_ICON: ICON },
  },
  {
    file: "Surge-Dual.conf",
    title: "双机场，各用一条订阅",
    transform: splitSubscriptions,
    vars: {
      SUB_URL_A: "https://example.com/subscription-a",
      SUB_URL_B: "https://example.com/subscription-b",
      SECRET_PRIMARY_AIRPORT: "机场A",
      SECRET_BACKUP_AIRPORT: "机场B",
      PRIMARY_AIRPORT_ICON: ICON,
      BACKUP_AIRPORT_ICON: ICON,
    },
  },
  {
    file: "Surge-Merged.conf",
    title: "双机场，合并成一条订阅",
    transform: mergedSubscription,
    vars: {
      SECRET_SUB_URL: "https://example.com/merged-subscription",
      KEYWORD_A: "关键词A",
      KEYWORD_B: "关键词B",
      SECRET_PRIMARY_AIRPORT: "机场A",
      SECRET_BACKUP_AIRPORT: "机场B",
      PRIMARY_AIRPORT_ICON: ICON,
      BACKUP_AIRPORT_ICON: ICON,
    },
  },
];

export function buildProfile(p: Profile): string {
  const layer: PrivateLayer = { vars: new Map(Object.entries(p.vars)), snippets: new Map(), deny: [] };
  const header =
    `# surge-rulekit 公开配置：${p.title}\n` +
    "# 由 https://github.com/Yixuling/surge-rulekit 的模板生成，用法见仓库 README\n" +
    "# 需要改的只有标着 👇 的几行，规则集会跟着仓库自动更新\n";
  return finalize(render(p.transform(common(readTemplate())), layer), header);
}
