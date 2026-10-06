import { expect, test } from "bun:test";
import { join } from "node:path";
import { denyStrings, parseEnv, type PrivateLayer } from "../private";
import { build, GENERATED_HEADER, render, ROOT } from "../template";

const layer = (vars: Record<string, string>, snippets: Record<string, string> = {}, deny: string[] = []): PrivateLayer => ({
  vars: new Map(Object.entries(vars)),
  snippets: new Map(Object.entries(snippets)),
  deny,
});

test("替换变量、内联片段", () => {
  expect(render("a = {{A}}\n{{> extra}}\nb = 1", layer({ A: "x" }, { extra: "c = 2\n\n" }))).toBe("a = x\nc = 2\nb = 1");
});

test("未定义、缺失、未使用、格式不对都报错", () => {
  const t = () => render("a = {{A}}\n{{> nope}}\nb = {{lower}}", layer({ UNUSED: "x" }, { extra: "" }));
  expect(t).toThrow("未定义变量 A");
  expect(t).toThrow("缺少片段 snippets/nope.conf");
  expect(t).toThrow("变量 UNUSED 在模板中未使用");
  expect(t).toThrow("片段 snippets/extra.conf 在模板中未使用");
  expect(t).toThrow("格式不对的占位符");
  expect(() => render("a = {B}", layer({}))).toThrow("格式不对的占位符");
});

test("parseEnv 取第一个 = 之后的全部内容，拒绝重复与非法键", () => {
  expect(parseEnv("# c\n\nA=x=y, z\n")).toEqual(new Map([["A", "x=y, z"]]));
  expect(() => parseEnv("A=1\nA=2")).toThrow("重复");
  expect(() => parseEnv("a=1")).toThrow("格式错误");
});

test("扫描清单只含 SECRET_*、deny.txt 与片段里的域名", () => {
  const deny = denyStrings(
    layer({ SECRET_URL: "https://s.example/x", HTTP_API_KEY: "surge" }, { r: "# a.example.com\nDOMAIN, p.example.org, DIRECT" }, ["abc"]),
  );
  expect(deny.sort()).toEqual(["abc", "https://s.example/x", "p.example.org"]);
});

// CI 只有示例私有层：保证模板与示例同步，且顺序约束成立
test("模板用 private.example 能完整渲染，模板说明换成生成说明", () => {
  const conf = build(join(ROOT, "private.example"));
  expect(conf).not.toContain("{{");
  expect(conf).toStartWith(GENERATED_HEADER);
  expect(conf).not.toContain("配置模板");
});
