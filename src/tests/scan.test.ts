import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hitLines, messageFindings, stagedFindings } from "../cli/scan";

const repo = mkdtempSync(join(tmpdir(), "scan-test-"));
const git = (...args: string[]) => Bun.spawnSync(["git", "-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: repo });
afterAll(() => rmSync(repo, { recursive: true, force: true }));

test("暂存内容命中扫描串，含 git mv 后改内容的重命名文件", () => {
  git("init", "-q");
  writeFileSync(join(repo, "a.txt"), Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n") + "\n");
  git("add", "a.txt");
  git("commit", "-qm", "init");
  git("mv", "a.txt", "b.txt");
  writeFileSync(join(repo, "b.txt"), Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n") + "\nLEAK\n");
  writeFileSync(join(repo, "c.txt"), "clean\n");
  git("add", "b.txt", "c.txt");
  expect(stagedFindings(["LEAK"], repo)).toEqual(["b.txt 第 31 行"]);
});

test("文件路径命中时报序号、不回显路径", () => {
  writeFileSync(join(repo, "LEAK.txt"), "clean\n");
  git("add", "LEAK.txt");
  expect(stagedFindings(["LEAK"], repo)).toEqual(["第 1 个暂存文件的路径（git diff --cached --name-only 查看）", "b.txt 第 31 行"]);
  git("rm", "-q", "--cached", "LEAK.txt");
});

test("域名不区分大小写，其他串区分", () => {
  expect(hitLines("Leak.Example.COM\nleaky", ["leak.example.com", "LEAKY"])).toEqual([1]);
});

test("提交信息：注释行与剪切线以下不算", () => {
  const msg = "fix\n# LEAK in comment\nbody LEAK\n# ------------------------ >8 ------------------------\nLEAK in diff\n";
  expect(messageFindings(msg, ["LEAK"])).toEqual(["提交信息第 3 行"]);
});

test("超长 base64 也会命中", () => {
  expect(messageFindings("A".repeat(80), [])).toEqual(["提交信息第 1 行"]);
});

test("npm 完整性哈希不算超长 base64，同行的私有值和其他长串照样命中", () => {
  const integrity = `"sha512-${"A".repeat(86)}=="`;
  expect(hitLines(integrity, [])).toEqual([]);
  expect(hitLines(`${integrity} LEAK`, ["LEAK"])).toEqual([1]);
  expect(hitLines(`${integrity} ${"B".repeat(80)}`, [])).toEqual([1]);
});
