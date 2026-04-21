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
