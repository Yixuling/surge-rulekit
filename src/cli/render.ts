// bun run render [私有层目录，默认 private/]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { build, DIST } from "../template";

try {
  const conf = build(process.argv[2]);
  mkdirSync(dirname(DIST), { recursive: true });
  writeFileSync(DIST, conf);
  console.log(`已生成 ${DIST}，规则顺序约束全部满足`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
