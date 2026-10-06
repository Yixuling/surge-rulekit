// bun run deploy [--force]
// 渲染 → surge-cli 校验 → 检查 iCloud 配置是否在 UI / iOS 上被改过 → 覆盖 → 记录基准 → reload
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
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

writeFileSync(PROFILE, conf);
mkdirSync(dirname(BASELINE), { recursive: true });
writeFileSync(BASELINE, conf, { mode: 0o600 });

const reload = run([SURGE, "reload"]);
if (!reload.ok) fail(`已写入 ${PROFILE}，但 reload 失败：\n${reload.output}`);
console.log(`已部署到 ${PROFILE} 并重载`);
