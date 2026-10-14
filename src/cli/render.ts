// bun run render [私有层目录，默认 private/]
// 同时重新生成根目录下的公开配置 Surge-*.conf（不依赖私有层）
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildProfile, PROFILES } from "../public";
import { build, DIST, ROOT } from "../template";

try {
  const conf = build(process.argv[2]);
  mkdirSync(dirname(DIST), { recursive: true });
  writeFileSync(DIST, conf);
  for (const p of PROFILES) writeFileSync(join(ROOT, p.file), buildProfile(p));
  console.log(`已生成 ${DIST} 与 ${PROFILES.length} 份公开配置 Surge-*.conf，规则顺序约束全部满足`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
