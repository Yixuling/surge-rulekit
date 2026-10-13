// bun run deploy [--force]
// 渲染 → surge-cli 校验 → 检查 iCloud 配置是否在 UI / iOS 上被改过 → 覆盖 → 记录基准 → reload
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { driftReference, normalize } from "../normalize";
import { build, DIST, ROOT } from "../template";

const PROFILE =
  process.env.SURGE_PROFILE ?? join(homedir(), "Library/Mobile Documents/iCloud~com~nssurge~inc/Documents/Surge.conf");
const BASELINE = join(ROOT, "private/state/last-deploy.conf");
const SURGE = "/Applications/Surge.app/Contents/Applications/surge-cli";

function run(cmd: string[], stdin?: string) {
  const p = Bun.spawnSync(cmd, { stdin: stdin === undefined ? "ignore" : Buffer.from(stdin), stdout: "pipe", stderr: "pipe" });
  return { ok: p.exitCode === 0, output: (p.stdout.toString() + p.stderr.toString()).trim() };
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!existsSync(SURGE)) fail(`找不到 surge-cli（${SURGE}），确认已安装 Surge for Mac`);

let conf: string;
try {
  conf = build();
} catch (e) {
  fail((e as Error).message);
}
mkdirSync(dirname(DIST), { recursive: true });
writeFileSync(DIST, conf);

// 先校验再复制：坏配置一旦写进 iCloud 就会同步到 iOS
const check = run([SURGE, "-c", DIST]);
if (!check.ok) fail(`surge-cli 校验未通过，未部署：\n${check.output}`);

if (existsSync(PROFILE)) {
  const reference = driftReference(readFileSync(PROFILE, "utf8"), existsSync(BASELINE) ? readFileSync(BASELINE, "utf8") : undefined, conf);
  if (reference !== undefined) {
    const current = normalize(readFileSync(PROFILE, "utf8"));
    const diffFile = join(ROOT, "dist", "reference.normalized");
    writeFileSync(diffFile, normalize(reference));
    console.error(run(["diff", "-u", "--label", "预期", "--label", "iCloud 当前", diffFile, "-"], current).output);
    rmSync(diffFile);
    if (!process.argv.includes("--force")) {
      fail("iCloud 里的配置与预期不一致（多半在 UI 或 iOS 上改过），以上为语义差异。\n先把要保留的改动回填进模板或 private/，再用 bun run deploy --force 覆盖。");
    }
    console.warn("已指定 --force，覆盖上述差异");
  }
}

// 写临时文件再 rename：直接覆盖会先清空文件，iCloud 若在写完前读到，会把残缺配置同步到 iOS。
// 已实测 iCloud 对同目录 rename 覆盖不产生冲突副本，临时文件须在同目录（同卷 rename 才原子）
const tmp = join(dirname(PROFILE), `.${basename(PROFILE)}.tmp`);
writeFileSync(tmp, conf, { mode: 0o600 }); // rename 换的是新文件，不继承原文件权限，配置含 MITM 私钥
renameSync(tmp, PROFILE);
mkdirSync(dirname(BASELINE), { recursive: true });
writeFileSync(BASELINE, conf, { mode: 0o600 });

const reload = run([SURGE, "reload"]);
if (!reload.ok) fail(`已写入 ${PROFILE}，但 reload 失败：\n${reload.output}`);
console.log(`已部署到 ${PROFILE} 并重载`);
console.log("基准 private/state/last-deploy.conf 已更新，记得 bun run private:backup，否则换机器恢复后会误报漂移");
