// 模板渲染：只做占位符替换与片段内联，然后检查规则顺序
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkOrder } from "./order";
import { loadPrivate, type PrivateLayer } from "./private";
import { checkReferences } from "./references";

export const ROOT = join(import.meta.dir, "..");
export const DIST = join(ROOT, "dist", "Surge.conf");

const VAR = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;
const SNIPPET = /^\{\{> ([a-z0-9-]+)\}\}$/;

export function render(template: string, layer: PrivateLayer): string {
  const problems: string[] = [];
  const used = new Set<string>();
  const out = template.split("\n").map((line, i) => {
    const snippet = line.trim().match(SNIPPET)?.[1];
    if (snippet) {
      used.add(`snippets/${snippet}.conf`);
      const body = layer.snippets.get(snippet);
      if (body === undefined) problems.push(`模板第 ${i + 1} 行：缺少片段 snippets/${snippet}.conf`);
      return (body ?? line).replace(/\n+$/, "");
    }
    return line.replace(VAR, (whole, name: string) => {
      used.add(name);
      const value = layer.vars.get(name);
      if (value === undefined) problems.push(`模板第 ${i + 1} 行：未定义变量 ${name}`);
      return value ?? whole;
    });
  });

  // 没用到的变量或片段，多半是模板改名后私有层没跟上
  for (const key of layer.vars.keys()) {
    if (!used.has(key)) problems.push(`变量 ${key} 在模板中未使用`);
  }
  for (const name of layer.snippets.keys()) {
    if (!used.has(`snippets/${name}.conf`)) problems.push(`片段 snippets/${name}.conf 在模板中未使用`);
  }
  // 写错的占位符会原样留在产物里：残留的 {{，或少了一层花括号的 {大写名}
  out.forEach((line, i) => {
    if (!line.trimStart().startsWith("#") && /\{\{|\{[A-Z][A-Z0-9_]*\}/.test(line)) problems.push(`输出第 ${i + 1} 行有格式不对的占位符`);
  });

  if (problems.length) throw new Error(`渲染失败：\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  return out.join("\n");
}

// 模板开头的注释块只描述模板本身，产物里换成生成说明
export const GENERATED_HEADER = "# 由 Surge.tpl.conf 经 bun run render 生成，勿直接编辑；改配置请改模板后 bun run deploy\n";

export function build(privateDir = join(ROOT, "private")): string {
  const rendered = render(readFileSync(join(ROOT, "Surge.tpl.conf"), "utf8"), loadPrivate(privateDir));
  const conf = GENERATED_HEADER + rendered.replace(/^(#.*\n)+\n*/, "\n");
  const problems = checkOrder(conf);
  if (problems.length) throw new Error(`规则顺序约束不满足（见 src/order.ts）：\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  const refs = checkReferences(conf);
  if (refs.length) throw new Error(`引用了未定义的策略（见 src/references.ts）：\n${refs.map((p) => `  - ${p}`).join("\n")}`);
  return conf;
}
