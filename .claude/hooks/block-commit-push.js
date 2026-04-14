#!/usr/bin/env node
// Kenko 마스터플랜 리디자인 세션 전용 가드.
// 대표 지시: 평가자(및 Claude)는 시뮬 15회 + 컨펌 전까지 git commit/push 절대 금지.
// 해제 방법: .claude/hooks/ALLOW_COMMIT 파일 생성 (대표님 승인 신호).

const fs = require("fs");
const path = require("path");

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(input || "{}");
    const cmd = (payload.tool_input && payload.tool_input.command) || "";
    if (!cmd) return process.exit(0);

    const allowFlag = path.join(__dirname, "ALLOW_COMMIT");
    if (fs.existsSync(allowFlag)) return process.exit(0);

    const patterns = [
      /\bgit\s+commit\b/,
      /\bgit\s+push\b/,
      /\bgit\s+am\b/,
      /\bgit\s+cherry-pick\b/,
      /\bgh\s+pr\s+create\b/,
      /\bgh\s+pr\s+merge\b/,
      /\bfirebase\s+deploy\b/,
      /\bfirebase\s+hosting:/,
      /\bfirebase\s+functions:deploy\b/,
      /\bnpm\s+publish\b/,
    ];
    const hit = patterns.find((p) => p.test(cmd));
    if (hit) {
      const msg =
        "BLOCKED by Kenko redesign guard: commit/push 금지. " +
        "대표님 승인 전까지 변경 금지. 해제: .claude/hooks/ALLOW_COMMIT 파일 생성.";
      process.stderr.write(msg + "\n");
      process.exit(2); // non-zero + stderr → Claude에 피드백
    }
    process.exit(0);
  } catch (e) {
    process.exit(0); // 파싱 실패 시 통과 (안전장치 실패로 막히지 않도록)
  }
});
