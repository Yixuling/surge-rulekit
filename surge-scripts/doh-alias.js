// Surge DNS 脚本：用指定的 DoH 服务器查询另一个域名，把结果作为当前域名的解析结果。
//
// 适用场景：机场订阅里的节点用「入口域名」，但只有用机场提供的 DoH 查询「接入域名」才能拿到就近的入口地址。
// [Host] 里写 `入口 = 接入` 加 `接入 = server:<DoH>` 不行：别名之后 Surge 改用全局 DNS 解析接入域名，不再套用它的 server: 条目。
// 本脚本把这两步合成一步，其余域名仍走全局 DNS，不必把 encrypted-dns-server 整个换成机场的。
//
// 用法（脚本与配置文件放在同一目录时 script-path 可写相对路径）：
//   [Host]
//   entry.example.com = script:node-dns
//   [Script]
//   node-dns = type=dns, script-path=doh-alias.js, engine=jsc, argument="target=access.example.com&doh=https://dns.example.com/dns-query"
//
// argument 参数（& 分隔，值可用 encodeURIComponent 编码）：
//   target   必填，实际查询的域名
//   doh      必填，DoH 地址（RFC 8484，GET 方式），多个用 | 分隔；并发查询，取第一个有结果的
//   ipv6     可选，true 时同时查询 AAAA，默认只查 A
//   timeout  可选，每个请求的超时秒数，默认 3
//
// 查询直连发出（policy=DIRECT），不受规则影响；全部失败时 $done({}) 回退到 Surge 的默认解析。

const MIN_TTL = 60;
const MAX_TTL = 3600;

function parseArgs(raw) {
  const args = {};
  for (const pair of (typeof raw === "string" ? raw : "").split("&")) {
    const i = pair.indexOf("=");
    if (i > 0) args[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  }
  return args;
}

// DNS 查询报文：ID 0（RFC 8484 建议，便于缓存）、RD=1、一个问题
function buildQuery(name, qtype) {
  const bytes = [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0];
  for (const label of name.replace(/\.$/, "").split(".")) {
    if (label.length === 0 || label.length > 63) throw new Error(`域名格式错误：${name}`);
    bytes.push(label.length);
    for (let i = 0; i < label.length; i++) bytes.push(label.charCodeAt(i) & 0x7f);
  }
  bytes.push(0, 0, qtype, 0, 1);
  return bytes;
}

function base64url(bytes) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    s += A[(n >> 18) & 63] + A[(n >> 12) & 63];
    if (i + 1 < bytes.length) s += A[(n >> 6) & 63];
    if (i + 2 < bytes.length) s += A[n & 63];
  }
  return s;
}

function skipName(r, i) {
  while (i < r.length) {
    if ((r[i] & 0xc0) === 0xc0) return i + 2;
    if (r[i] === 0) return i + 1;
    i += r[i] + 1;
  }
  throw new Error("应答报文截断");
}

function formatIPv6(r, i) {
  const groups = [];
  for (let k = 0; k < 16; k += 2) groups.push(((r[i + k] << 8) | r[i + k + 1]).toString(16));
  return groups.join(":");
}

// 只取 A / AAAA 记录，CNAME 等其他记录跳过；返回 { addresses, ttl }
function parseAnswer(data) {
  const r = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (r.length < 12) throw new Error("应答报文过短");
  const rcode = r[3] & 0x0f;
  if (rcode !== 0) throw new Error(`DNS 错误码 ${rcode}`);
  const qd = (r[4] << 8) | r[5];
  const an = (r[6] << 8) | r[7];
  let i = 12;
  for (let n = 0; n < qd; n++) i = skipName(r, i) + 4;
  const addresses = [];
  let ttl = MAX_TTL;
  for (let n = 0; n < an; n++) {
    i = skipName(r, i);
    if (i + 10 > r.length) throw new Error("应答报文截断");
    const type = (r[i] << 8) | r[i + 1];
    const recordTTL = ((r[i + 4] << 24) | (r[i + 5] << 16) | (r[i + 6] << 8) | r[i + 7]) >>> 0;
    const len = (r[i + 8] << 8) | r[i + 9];
    i += 10;
    if (i + len > r.length) throw new Error("应答报文截断");
    if (type === 1 && len === 4) addresses.push(`${r[i]}.${r[i + 1]}.${r[i + 2]}.${r[i + 3]}`);
    else if (type === 28 && len === 16) addresses.push(formatIPv6(r, i));
    else { i += len; continue; }
    ttl = Math.min(ttl, recordTTL);
    i += len;
  }
  return { addresses, ttl };
}

function resolveVia(url, name, qtype, timeout) {
  return new Promise((resolve) => {
    const sep = url.includes("?") ? "&" : "?";
    $httpClient.get(
      {
        url: `${url}${sep}dns=${base64url(buildQuery(name, qtype))}`,
        headers: { Accept: "application/dns-message" },
        timeout,
        policy: "DIRECT",
        "binary-mode": true,
      },
      (error, response, data) => {
        try {
          if (error) throw new Error(String(error));
          if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
          resolve(parseAnswer(data));
        } catch (e) {
          console.log(`${$domain}：${url} 查询 ${name} 失败：${e.message}`);
          resolve({ addresses: [], ttl: MAX_TTL });
        }
      },
    );
  });
}

// 并发查询所有服务器，取第一个有地址的结果；都没有结果时返回空
function firstWithAddresses(urls, name, qtype, timeout) {
  return new Promise((resolve) => {
    let pending = urls.length;
    for (const url of urls) {
      resolveVia(url, name, qtype, timeout).then((res) => {
        pending--;
        if (res.addresses.length) resolve(res);
        else if (pending === 0) resolve({ addresses: [], ttl: MAX_TTL });
      });
    }
  });
}

async function main() {
  const args = parseArgs(typeof $argument === "undefined" ? "" : $argument);
  const target = (args.target || "").trim();
  const urls = (args.doh || "").split("|").map((s) => s.trim()).filter((s) => /^https:\/\//.test(s));
  const timeout = Number(args.timeout) > 0 ? Number(args.timeout) : 3;
  if (!target || urls.length === 0) {
    console.log(`${$domain}：argument 缺少 target 或有效的 https:// doh 地址，回退到默认解析`);
    return {};
  }

  const types = args.ipv6 === "true" ? [1, 28] : [1];
  const results = await Promise.all(types.map((t) => firstWithAddresses(urls, target, t, timeout)));
  const addresses = [...new Set(results.flatMap((r) => r.addresses))];
  if (addresses.length === 0) {
    console.log(`${$domain}：所有 DoH 都没有返回 ${target} 的地址，回退到默认解析`);
    return {};
  }
  const ttl = Math.max(MIN_TTL, Math.min(MAX_TTL, ...results.filter((r) => r.addresses.length).map((r) => r.ttl)));
  return { addresses, ttl };
}

main()
  .then((result) => $done(result))
  .catch((e) => {
    console.log(`${$domain}：脚本异常：${e.message}，回退到默认解析`);
    $done({});
  });
