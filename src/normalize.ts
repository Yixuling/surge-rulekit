// 配置规范化，用于 deploy 的漂移比较：抹掉 Surge UI 保存时的格式改写
// （删注释与空段、改空白与引号、挪动 key=value 参数），保留规则与成员的先后顺序。
import { isParam, sections, splitFields } from "./conf";

function normalizeLine(section: string, line: string): string {
  const eq = line.indexOf("=");
  if (section === "Rule" || eq < 0) return splitFields(line).join(",");
  const key = line.slice(0, eq).trim();
  const fields = splitFields(line.slice(eq + 1));
  if (section !== "Proxy" && section !== "Proxy Group") return `${key}=${fields.join(",")}`;
  // 策略组：成员保序，参数按键排序，参数值里的列表统一逗号格式
  const params = fields
    .filter(isParam)
    .map((f) => f.replace(/^([^=]+?)\s*=\s*(.*)$/, (_, k, v) => `${k}=${splitFields(v.replace(/^"(.*)"$/, "$1")).join(",")}`))
    .sort();
  return `${key}=${[...fields.filter((f) => !isParam(f)), ...params].join(",")}`;
}

// 漂移检查：iCloud 当前配置与预期（上次部署的内容；本机首次部署没有基准，就用本次渲染结果）语义不同时，
// 返回预期内容供打印 diff；一致返回 undefined
export function driftReference(current: string, baseline: string | undefined, rendered: string): string | undefined {
  const reference = baseline ?? rendered;
  return normalize(current) === normalize(reference) ? undefined : reference;
}

export function normalize(conf: string): string {
  const out = sections(conf).flatMap(([name, lines]) => {
    const normalized = lines.map((line) => normalizeLine(name, line));
    // [General] 与 [MITM] 键唯一、顺序无意义
    if (["General", "MITM"].includes(name)) normalized.sort();
    // 空段不参与比较（UI 保存时会删掉空段）
    return name && !lines.length ? [] : [name && `[${name}]`, ...normalized];
  });
  return out.join("\n") + "\n";
}
