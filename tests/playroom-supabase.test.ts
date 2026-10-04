import { expect, test } from "bun:test";
import { assertPlayroomSupabaseUrl, isPlayroomSupabaseUrl, PLAYROOM_SUPABASE_PROJECT_REF } from "../app/lib/playroom-supabase";

test("accepts only the hosted playroom project", () => {
  const url = `https://${PLAYROOM_SUPABASE_PROJECT_REF}.supabase.co`;
  expect(isPlayroomSupabaseUrl(url)).toBe(true);
  expect(assertPlayroomSupabaseUrl(url)).toBe(url);
});

test("rejects the retired development project and malformed URLs", () => {
  expect(isPlayroomSupabaseUrl("https://bkybxirilbbnmgkufxim.supabase.co")).toBe(false);
  expect(isPlayroomSupabaseUrl("not-a-url")).toBe(false);
  expect(() => assertPlayroomSupabaseUrl("https://bkybxirilbbnmgkufxim.supabase.co")).toThrow(/playroom-dev is retired/);
});
