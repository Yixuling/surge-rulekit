// 策略引用一致性：[Rule] 用到的策略、策略组成员、include-other-group 引用的组，都必须在 [Proxy] / [Proxy Group] 里定义。
// surge-cli -c 在本机 deploy 时能查出来，但 CI 与 fork 用户没有 surge-cli，这里在渲染阶段提前报错。
import { isParam, splitFields } from "./normalize";

const BUILTIN = new Set(["DIRECT", "REJECT", "REJECT-TINYGIF", "REJECT-DROP", "REJECT-NO-DROP"]);

// 某段的非空、非注释行
function sectionLines(conf: string, name: string): string[] {
  const body = conf.split(new RegExp(`^\\[${name}\\]$`, "m"))[1]?.split(/^\[/m)[0] ?? "";
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

// 规则行里的策略名：FINAL 紧跟类型；逻辑规则（AND/OR/NOT）跟在最外层括号后；其余在匹配值之后
export function rulePolicy(line: string): string | undefined {
  const [type = "", ...rest] = splitFields(line);
  if (type === "FINAL") return rest[0];
  if (["AND", "OR", "NOT"].includes(type)) {
    const tail = line.slice(line.lastIndexOf(")") + 1);
    return splitFields(tail)[0];
  }
  return rest[1];
}

export function checkReferences(conf: string): string[] {
  const defined = new Set<string>();
  const groups: [string, string][] = [];
  for (const section of ["Proxy", "Proxy Group"]) {
    for (const line of sectionLines(conf, section)) {
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const name = line.slice(0, eq).trim();
      defined.add(name);
      if (section === "Proxy Group") groups.push([name, line.slice(eq + 1)]);
    }
  }
  const known = (p: string) => defined.has(p) || BUILTIN.has(p);
  const problems = new Set<string>();

  for (const [name, body] of groups) {
    const fields = splitFields(body).slice(1); // 去掉组类型
    for (const member of fields.filter((f) => !isParam(f))) {
      if (!known(member)) problems.add(`策略组 ${name} 的成员 ${member} 未定义`);
    }
    for (const param of fields.filter(isParam)) {
      const [key = "", value = ""] = param.split(/\s*=\s*(.*)/s);
      if (key !== "include-other-group") continue;
      for (const ref of splitFields(value.replace(/^"(.*)"$/, "$1"))) {
        if (!defined.has(ref)) problems.add(`策略组 ${name} 的 include-other-group 引用的 ${ref} 未定义`);
      }
    }
  }

  sectionLines(conf, "Rule").forEach((line, i) => {
    const policy = rulePolicy(line);
    if (policy === undefined) problems.add(`[Rule] 第 ${i + 1} 条缺少策略：${line}`);
    else if (!known(policy)) problems.add(`[Rule] 第 ${i + 1} 条引用的策略 ${policy} 未定义`);
  });
  return [...problems];
}
