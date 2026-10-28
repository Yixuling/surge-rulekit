// Surge 配置的读取：分段与 [Rule] 规则行。顺序检查、引用检查、漂移规范化都从这里读，不各自解析。

// 按逗号切分（引号内不切），去掉首尾空白与包裹的引号
export function splitFields(text: string): string[] {
  return (text.match(/("[^"]*"|[^,])+/g) ?? []).map((f) => f.trim().replace(/^"(.*)"$/, "$1").trim());
}

// 策略组行里 key = value 形式的参数（区别于成员）
export const isParam = (f: string) => /^[a-z0-9-]+\s*=/i.test(f);

// 按出现顺序的 [段名, 行]，段名不含方括号，首个段标题之前的行归在 "" 段；
// 行已 trim，去掉空行与注释，保留 #! 指令（Surge 指令，漂移比较要看）
export function sections(conf: string): [string, string[]][] {
  const out: [string, string[]][] = [["", []]];
  for (const raw of conf.split("\n")) {
    const line = raw.trim();
    if (!line || (line.startsWith("#") && !line.startsWith("#!"))) continue;
    const header = line.match(/^\[(.+)\]$/)?.[1];
    if (header !== undefined) out.push([header, []]);
    else out.at(-1)![1].push(line);
  }
  return out.filter(([name, lines]) => name || lines.length);
}

// 规则 id 见 GLOSSARY.md；policy 缺失时为 undefined，由调用方决定是否报错
type Rule = { type: string; id: string; policy: string | undefined; raw: string };

const LOGIC = ["AND", "OR", "NOT"];

// 第一个 [Rule] 段的规则
export function rules(conf: string): Rule[] {
  const lines = sections(conf).find(([name]) => name === "Rule")?.[1] ?? [];
  return lines
    .filter((l) => !l.startsWith("#"))
    .map((raw) => {
      const [type = "", value = "", policy] = splitFields(raw);
      if (type === "FINAL") return { type, id: "FINAL", policy: value || undefined, raw };
      if (LOGIC.includes(type)) {
        // 逻辑规则的子规则里有逗号，表达式到最外层右括号为止，策略跟在后面
        const end = raw.lastIndexOf(")") + 1;
        return { type, id: raw.slice(raw.indexOf(",") + 1, end).trim(), policy: splitFields(raw.slice(end))[0], raw };
      }
      return { type, id: type === "RULE-SET" ? value.slice(value.lastIndexOf("/") + 1) : value, policy, raw };
    });
}
