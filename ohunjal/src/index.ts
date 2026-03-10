import {setGlobalOptions} from "firebase-functions";
import {onRequest, Request} from "firebase-functions/https";
import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {getAuth} from "firebase-admin/auth";
import type {Response} from "express";

initializeApp();
const db = getFirestore();

setGlobalOptions({maxInstances: 10, minInstances: 1});

// ─── Helpers ────────────────────────────────────────────────

function cors(res: Response) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function verifyAuth(req: Request): Promise<string> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new Error("No token");
  const token = header.split("Bearer ")[1];
  const decoded = await getAuth().verifyIdToken(token);
  return decoded.uid;
}

// ─── getSubscription ────────────────────────────────────────

export const getSubscription = onRequest(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    const uid = await verifyAuth(req);
    const doc = await db.collection("subscriptions").doc(uid).get();

    if (!doc.exists) {
      res.json({status: "free"});
      return;
    }

    const data = doc.data()!;
    res.json({
      status: data.status || "free",
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt ?? null,
      expiresAt: data.expiresAt?.toDate?.()?.toISOString() ?? data.expiresAt ?? null,
      lastPaymentAt: data.lastPaymentAt?.toDate?.()?.toISOString() ?? data.lastPaymentAt ?? null,
      amount: data.amount ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("getSubscription error:", msg);
    res.status(401).json({error: msg});
  }
});

// ─── subscribe ──────────────────────────────────────────────

export const subscribe = onRequest(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    const uid = await verifyAuth(req);
    const {billingKey} = req.body;

    if (!billingKey) {
      res.status(400).json({error: "billingKey is required"});
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    // TODO: Process first payment via PortOne billing API
    // const paymentResult = await processPortOnePayment(billingKey, uid, 9900);

    await db.collection("subscriptions").doc(uid).set({
      status: "active",
      billingKey,
      amount: 9900,
      createdAt: FieldValue.serverTimestamp(),
      lastPaymentAt: FieldValue.serverTimestamp(),
      expiresAt,
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({status: "active"});
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("subscribe error:", msg);
    res.status(500).json({error: msg});
  }
});

// ─── cancelSubscription ─────────────────────────────────────

export const cancelSubscription = onRequest(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    const uid = await verifyAuth(req);
    const {reason} = req.body;

    const docRef = db.collection("subscriptions").doc(uid);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.status !== "active") {
      res.status(400).json({error: "No active subscription"});
      return;
    }

    await docRef.update({
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
      cancelReason: reason || null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({status: "cancelled"});
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("cancelSubscription error:", msg);
    res.status(500).json({error: msg});
  }
});
