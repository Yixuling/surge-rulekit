// 私有层：values.env（模板变量）+ snippets/*.conf（多行片段）+ deny.txt（提交扫描补充清单）
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type PrivateLayer = {
  vars: Map<string, string>;
  snippets: Map<string, string>;
  deny: string[];
};

export function parseEnv(text: string): Map<string, string> {
  const vars = new Map<string, string>();
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const eq = line.indexOf("=");
    const key = eq > 0 ? line.slice(0, eq).trim() : "";
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      throw new Error(`values.env 第 ${i + 1} 行格式错误，应为 KEY=value（KEY 大写字母、数字、下划线）`);
    }
    if (vars.has(key)) throw new Error(`values.env 第 ${i + 1} 行：变量 ${key} 重复定义`);
    vars.set(key, line.slice(eq + 1).trim());
  });
  return vars;
}

export function loadPrivate(dir: string): PrivateLayer {
  const envPath = join(dir, "values.env");
  if (!existsSync(envPath)) {
    throw new Error(`缺少 ${envPath}。维护者用 bun run private:restore 恢复；fork 使用者从 private.example/ 复制`);
  }
  const snippets = new Map<string, string>();
  const snippetDir = join(dir, "snippets");
  if (existsSync(snippetDir)) {
    for (const f of readdirSync(snippetDir).sort()) {
      if (f.endsWith(".conf")) snippets.set(f.slice(0, -".conf".length), readFileSync(join(snippetDir, f), "utf8"));
    }
  }
  const denyPath = join(dir, "deny.txt");
  const deny = existsSync(denyPath)
    ? readFileSync(denyPath, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    : [];
  return { vars: parseEnv(readFileSync(envPath, "utf8")), snippets, deny };
}

// 片段里的非注释行按定义都是私有内容，从中取出域名作为扫描串
const HOSTNAME = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi;

// 提交扫描清单：SECRET_* 的值、deny.txt，加上片段中出现的域名。
// 其他变量（如短标识、公开图标 URL）不进清单，否则会在公开文件里大量误报。
export function denyStrings(layer: PrivateLayer): string[] {
  const out = new Set<string>(layer.deny);
  for (const [key, value] of layer.vars) {
    if (value && key.startsWith("SECRET_")) out.add(value);
  }
  for (const text of layer.snippets.values()) {
    for (const line of text.split("\n")) {
      if (line.trim().startsWith("#")) continue;
      for (const m of line.matchAll(HOSTNAME)) out.add(m[0]);
    }
  }
  return [...out];
}
