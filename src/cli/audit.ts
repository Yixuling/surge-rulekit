// 规则审计（只读，结果只打印不落盘：内容是访问记录）
//   bun run audit                  本月会落到 FINAL 的域名：先触发本地 DNS 解析、再走代理，可点名补规则省掉这次解析
//   bun run audit --speed 主机...  对比直连与代理的首字节时间（绕过 Surge 直连，各测 4 次取中位数）
// 流程与分类约定见 .claude/skills/rule-audit/SKILL.md。测速请求会进入 Surge 的请求记录，先列名单再测速
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../template";

const SURGE = "/Applications/Surge.app/Contents/Applications/surge-cli";
// 物理网卡：增强模式下默认路由是 utun，绑定物理网卡才能绕过 Surge
const IFACE = process.env.AUDIT_IFACE ?? "en0";
// 直连测速用的 DoH：绑定物理网卡查询，拿到不经 Surge 虚拟 IP 的真实地址
const DOH = "https://223.5.5.5/resolve";

function run(cmd: string[]): string {
  return Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" }).stdout.toString();
}

function surge<T>(...args: string[]): T {
  return JSON.parse(run([SURGE, "--raw", ...args])) as T;
}

type Request = { remoteHost?: string; processPath?: string; rule?: string };

// 本月出现过的主域名。只用域名集合、不用字节数：Surge 按域名的流量统计（界面与 CLI）实测数值乱跳，
// 空闲域名也会在几 KB 与几十 MB 间变动，多次读取取最大值也不收敛，排出的先后会误导（决策见 AGENTS.md）
function monthlyHosts(): string[] {
  const stats = surge<{ result: Record<string, unknown> }>("dump", "traffic-stat-host").result;
  return Object.keys(stats)
    .filter((h) => /[a-z]/i.test(h) && h.includes(".") && !h.includes(":"))
    .sort();
}

// 用当前生效的规则计算命中，不建立连接
function match(host: string): string {
  return run([SURGE, "rule", "match", host]).match(/^Matched rule: (.*)$/m)?.[1] ?? "?";
}

// 最近与活动请求里实际落到 FINAL 的 主域名 → 应用；只覆盖最近约 200 条请求，但这是"最近确实在用"的直接证据。
// 只算本身落到 FINAL 的请求：同一主域名下别的子域可能已被规则点名（如 Claude 的 Datadog 端点在 AI.list），不能算进来
function appsByHost(): Map<string, Set<string>> {
  const reqs = ["recent", "active"].flatMap((t) => surge<{ requests?: Request[] }>("dump", t).requests ?? []);
  const map = new Map<string, Set<string>>();
  for (const r of reqs) {
    const host = (r.remoteHost ?? "").replace(/:\d+$/, "");
    const path = r.processPath ?? "";
    // .app 取应用名；命令行工具取路径里最后一个像名字的段（跳过 versions/2.1.296 这类版本目录）
    const app = path.match(/([^/]+)\.app\//)?.[1] ?? path.split("/").reverse().find((seg) => /[a-z]/i.test(seg) && seg !== "versions");
    if (!host || !app || !r.rule?.startsWith("FINAL")) continue;
    const labels = host.split(".");
    for (let i = 0; i < labels.length - 1; i++) {
      const key = labels.slice(i).join(".");
      map.set(key, (map.get(key) ?? new Set()).add(app));
    }
  }
  return map;
}

// 长名单按行宽折行，便于浏览
function wrap(items: string[], width = 100) {
  let line = "";
  for (const item of items) {
    if (line && line.length + item.length + 2 > width) {
      console.log(line);
      line = "";
    }
    line += (line ? "  " : "") + item;
  }
  if (line) console.log(line);
}

function list() {
  const now = new Date();
  const days = now.getDate();
  console.log(`数据覆盖 ${now.getMonth() + 1} 月 1 日至今，共 ${days} 天（Surge 按域名只保留当月）`);
  if (days < 7) console.log("数据偏少，名单会很短，建议月中以后再跑");

  const hosts = monthlyHosts();
  console.error(`对 ${hosts.length} 个域名模拟规则匹配…`);
  const final: string[] = [];
  let asn = 0;
  for (const host of hosts) {
    const rule = match(host);
    if (rule.startsWith("FINAL")) final.push(host);
    else if (rule.includes("ASN.China.list")) asn++;
  }

  const apps = appsByHost();
  const byApp = new Map<string, string[]>();
  const rest: string[] = [];
  for (const host of final) {
    const found = apps.get(host);
    if (!found) rest.push(host);
    else for (const app of found) byApp.set(app, [...(byApp.get(app) ?? []), host]);
  }

  console.log(`\n落到 FINAL：${final.length} 个域名`);
  console.log(`\n最近请求里能对上发起应用的（${final.length - rest.length} 个，说明最近确实在用）：`);
  for (const [app, list] of [...byApp].sort(([a], [b]) => a.localeCompare(b))) console.log(`  ${app}：${list.join(", ")}`);
  console.log(`\n其余（${rest.length} 个，按字母排；常用与否请自行判断）：`);
  wrap(rest);
  console.log(`\n经 ASN.China 直连：${asn} 个域名（直连本就要本地解析，补规则省不了，无需处理）`);
}

const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

// 首字节与建连时间（毫秒），失败返回 undefined
function timing(args: string[]): [number, number] | undefined {
  const out = run(["curl", "-s", "-o", "/dev/null", "--max-time", "8", "-w", "%{http_code} %{time_connect} %{time_starttransfer}", ...args]);
  const [code, connect, first] = out.split(" ");
  return code && code !== "000" ? [Number(first) * 1000, Number(connect) * 1000] : undefined;
}

function summary(samples: ([number, number] | undefined)[]): string {
  const ok = samples.filter((s) => s !== undefined);
  if (ok.length === 0) return "失败".padEnd(24);
  return `${median(ok.map((s) => s[0])).toFixed(0)} ms（建连 ${median(ok.map((s) => s[1])).toFixed(0)}，${ok.length}/${samples.length}）`.padEnd(24);
}

function speed(hosts: string[]) {
  const listen = readFileSync(join(ROOT, "Surge.tpl.conf"), "utf8").match(/^http-listen\s*=\s*(\S+)/m)?.[1];
  if (!listen) throw new Error("模板里找不到 http-listen");
  const time = new Date().toTimeString().slice(0, 5);
  console.log(`当前 ${time}；晚高峰（20–23 点）的结果更有参考价值。直连经 ${IFACE} 绕过 Surge，代理经 ${listen} 按规则出站`);
  for (const host of hosts) {
    const answer = JSON.parse(run(["curl", "-s", "--max-time", "5", "--interface", IFACE, `${DOH}?name=${host}&type=1`]) || "{}");
    const ip = (answer.Answer as { type: number; data: string }[] | undefined)?.find((a) => a.type === 1)?.data;
    const url = `https://${host}/`;
    const direct = ip ? [1, 2, 3, 4].map(() => timing(["--interface", IFACE, "--resolve", `${host}:443:${ip}`, url])) : [undefined];
    const proxy = [1, 2, 3, 4].map(() => timing(["-x", `http://${listen}`, url]));
    console.log(`${host.padEnd(28)} 直连 ${summary(direct)} 代理 ${summary(proxy)}`.trimEnd());
  }
}

const args = process.argv.slice(2);
if (args[0] === "--speed") {
  if (args.length < 2) {
    console.error("用法：bun run audit --speed 主机...");
    process.exit(1);
  }
  speed(args.slice(1));
} else {
  list();
}
