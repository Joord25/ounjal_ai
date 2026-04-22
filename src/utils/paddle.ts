import { initializePaddle, Paddle } from "@paddle/paddle-js";

let paddleInstance: Paddle | null = null;

export async function getPaddle(): Promise<Paddle | null> {
  if (paddleInstance) return paddleInstance;

  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const env = (process.env.NEXT_PUBLIC_PADDLE_ENV || "sandbox") as "sandbox" | "production";

  if (!token) {
    console.warn("[Paddle] NEXT_PUBLIC_PADDLE_CLIENT_TOKEN missing");
    return null;
  }

  const paddle = await initializePaddle({
    environment: env,
    token,
  });

  if (paddle) paddleInstance = paddle;
  return paddle ?? null;
}

export function getPaddleMonthlyPriceId(): string {
  return process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY || "";
}

/**
 * Paddle 결제 활성화 여부. 심사 통과 전에는 false 로 두고 "Coming soon" 노출.
 * 안전한 기본값: unset 이면 비활성. 프로덕션 실수 방지.
 */
export function isPaddleEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PADDLE_ENABLED === "true";
}
