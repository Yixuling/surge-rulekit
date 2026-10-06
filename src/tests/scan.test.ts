import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { messageFindings, stagedFindings } from "../cli/scan";

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

test("提交信息：注释行与剪切线以下不算", () => {
  const msg = "fix\n# LEAK in comment\nbody LEAK\n# ------------------------ >8 ------------------------\nLEAK in diff\n";
  expect(messageFindings(msg, ["LEAK"])).toEqual(["提交信息第 3 行"]);
});

test("超长 base64 也会命中", () => {
  expect(messageFindings("A".repeat(80), [])).toEqual(["提交信息第 1 行"]);
});
