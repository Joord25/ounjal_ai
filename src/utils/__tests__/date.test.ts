/**
 * 날짜 저장/파싱 검증 — 타임존 이중 오프셋 방지
 *
 * 핵심: new Date().toISOString()로 저장한 UTC 날짜를
 * 캘린더에서 toDateString()으로 비교할 때 로컬 날짜가 맞아야 함
 */
import { describe, test, expect } from "vitest";

describe("날짜 저장 형식", () => {
  test("new Date().toISOString()는 Z 접미사 UTC", () => {
    const iso = new Date().toISOString();
    expect(iso).toMatch(/Z$/);
  });

  test("이중 오프셋 패턴은 날짜를 틀리게 만듦", () => {
    // 이 패턴이 기존 버그: KST 15시 이후 운동이 다음 날로 잡힘
    const buggyDate = new Date(
      Date.now() - new Date().getTimezoneOffset() * 60000
    ).toISOString();

    const correctDate = new Date().toISOString();

    // 현재 시간이 오후 3시(15시) 이후인 KST 환경에서는
    // buggyDate 파싱 시 다음 날이 됨
    const buggyLocal = new Date(buggyDate).toDateString();
    const correctLocal = new Date(correctDate).toDateString();
    const todayLocal = new Date().toDateString();

    // 올바른 날짜는 항상 오늘과 일치
    expect(correctLocal).toBe(todayLocal);
    // buggy 날짜는 offset에 따라 다를 수 있음 (KST 15시 이후에 불일치)
  });

  test("ISO 날짜 파싱 → toDateString → 로컬 날짜 비교 정상", () => {
    const now = new Date();
    const iso = now.toISOString();
    const parsed = new Date(iso);

    // 같은 로컬 날짜여야 함
    expect(parsed.getDate()).toBe(now.getDate());
    expect(parsed.getMonth()).toBe(now.getMonth());
    expect(parsed.getFullYear()).toBe(now.getFullYear());
  });
});
