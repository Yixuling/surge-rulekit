// 提交前敏感串扫描，由 scripts/hooks/ 调用
//   bun src/cli/scan.ts staged        扫描全部暂存内容（pre-commit）
//   bun src/cli/scan.ts msg <file>    扫描提交信息（commit-msg，pre-commit 时还看不到 message）
// 清单来自 private/（见 denyStrings），无需另行维护。只报位置，不回显命中内容。
import { existsSync, readFileSync } from "node:fs";
import { denyStrings, loadPrivate } from "../private";
import { ROOT } from "../template";

const LONG_BASE64 = /[A-Za-z0-9+/=]{80,}/;

function git(args: string[], cwd?: string): Buffer {
  return Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe" }).stdout;
}

export function hitLines(text: string, patterns: string[]): number[] {
  return text.split("\n").flatMap((line, i) =>
    patterns.some((p) => line.includes(p)) || LONG_BASE64.test(line) ? [i + 1] : [],
  );
}

// 暂存区里新增、复制、修改、重命名的文本文件中命中的位置。
// 重命名（R）必须算上：git mv 后再改内容，git 记为重命名而不是修改
export function stagedFindings(patterns: string[], cwd?: string): string[] {
  const paths = git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"], cwd).toString().split("\0").filter(Boolean);
  return paths.flatMap((path) => {
    const blob = git(["show", `:${path}`], cwd);
    if (blob.includes(0)) return []; // 二进制（图标等）藏不了明文敏感串
    const lines = hitLines(blob.toString(), patterns);
    return lines.length ? [`${path} 第 ${lines.join(",")} 行`] : [];
  });
}

// 剔除注释行与 commit -v 剪切线以下的 diff，它们不会进入提交信息
export function messageFindings(message: string, patterns: string[]): string[] {
  const body = message.split("# ------------------------ >8 ------------------------")[0]!;
  const lines = hitLines(body.split("\n").map((l) => (l.startsWith("#") ? "" : l)).join("\n"), patterns);
  return lines.length ? [`提交信息第 ${lines.join(",")} 行`] : [];
}

function loadPatterns(): string[] {
  const dir = `${ROOT}/private`;
  if (!existsSync(dir)) {
    if (git(["config", "--bool", "surge-rulekit.allow-no-private"]).toString().trim() === "true") return [];
    console.error("缺少 private/，拒绝提交。");
    console.error("  维护者：bun run private:restore 恢复后重试");
    console.error("  fork 使用者（确实没有私有值）：git config surge-rulekit.allow-no-private true");
    process.exit(1);
  }
  return denyStrings(loadPrivate(dir));
}

if (import.meta.main) {
  const [mode, file] = process.argv.slice(2);
  let findings: string[];
  if (mode === "staged") findings = stagedFindings(loadPatterns());
  else if (mode === "msg" && file) findings = messageFindings(readFileSync(file, "utf8"), loadPatterns());
  else {
    console.error("用法：scan.ts staged | scan.ts msg <file>");
    process.exit(2);
  }
  if (findings.length) {
    for (const f of findings) console.error(`  ${f} 命中私有值或超长 base64`);
    console.error("已拒绝提交。修掉上述位置后重试；确属误报时用 git commit --no-verify，但先确认那不是真泄露。");
    process.exit(1);
  }
}
