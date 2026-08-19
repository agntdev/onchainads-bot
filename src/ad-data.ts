import type { PersistentStore } from "./toolkit/index.js";
import { now } from "./clock.js";

export type PurchaseStatus = "awaiting_payment" | "pending_review" | "active" | "rejected" | "conflict";
export interface AdSlot { id: string; name: string; durationDays: number; price: string; displayRules: string; active: boolean; }
export interface BuyerProfile { telegramId: number; displayName?: string; contactInfo?: string; }
export interface Purchase { id: string; buyer: number; buyerName?: string; slotId: string; slotName: string; price: string; reference: string; txHash?: string; startTime?: string; endTime?: string; status: PurchaseStatus; createdAt: string; }

const PREFIX = "crypto-ad-slots:v1:";
const SLOTS_KEY = PREFIX + "slots";
const PURCHASE_IDS_KEY = PREFIX + "purchase-ids";
const defaults: AdSlot[] = [
  { id: "channel-post", name: "Channel post", durationDays: 1, price: "100 USDC", displayRules: "One sponsored post. Content must be relevant and lawful.", active: true },
  { id: "pinned-post", name: "Pinned post", durationDays: 7, price: "250 USDC", displayRules: "One pinned sponsored post. Content must be relevant and lawful.", active: true },
  { id: "weekly-banner", name: "Weekly banner", durationDays: 7, price: "400 USDC", displayRules: "Banner artwork is supplied after approval and must meet channel guidelines.", active: true },
  { id: "newsletter-feature", name: "Newsletter feature", durationDays: 1, price: "300 USDC", displayRules: "One newsletter feature. Final copy is supplied after approval.", active: true },
  { id: "monthly-partner", name: "Monthly partner", durationDays: 30, price: "900 USDC", displayRules: "One partner placement. Final content must be approved before activation.", active: true },
];

export async function slots(store: PersistentStore): Promise<AdSlot[]> {
  const saved = await store.get<AdSlot[]>(SLOTS_KEY);
  if (saved) return saved;
  await store.put(SLOTS_KEY, defaults);
  return defaults;
}
export async function saveSlots(store: PersistentStore, value: AdSlot[]): Promise<void> { await store.put(SLOTS_KEY, value); }
export async function buyerProfile(store: PersistentStore, buyer: number, displayName?: string): Promise<void> {
  const key = PREFIX + "buyer:" + buyer;
  const existing = await store.get<BuyerProfile>(key);
  await store.put(key, { telegramId: buyer, displayName: displayName ?? existing?.displayName, contactInfo: existing?.contactInfo });
}
export async function createPurchase(store: PersistentStore, purchase: Purchase): Promise<void> {
  await store.put(PREFIX + "purchase:" + purchase.id, purchase);
  const all = (await store.get<string[]>(PURCHASE_IDS_KEY)) ?? [];
  if (!all.includes(purchase.id)) await store.put(PURCHASE_IDS_KEY, [...all, purchase.id]);
  const userKey = PREFIX + "buyer-purchases:" + purchase.buyer;
  const mine = (await store.get<string[]>(userKey)) ?? [];
  if (!mine.includes(purchase.id)) await store.put(userKey, [...mine, purchase.id]);
}
export async function purchase(store: PersistentStore, id: string): Promise<Purchase | undefined> { return store.get(PREFIX + "purchase:" + id); }
export async function savePurchase(store: PersistentStore, value: Purchase): Promise<void> { await store.put(PREFIX + "purchase:" + value.id, value); }
export async function purchasesForBuyer(store: PersistentStore, buyer: number): Promise<Purchase[]> {
  const ids = (await store.get<string[]>(PREFIX + "buyer-purchases:" + buyer)) ?? [];
  return (await Promise.all(ids.map((id) => purchase(store, id)))).filter((x): x is Purchase => Boolean(x));
}
export async function allPurchases(store: PersistentStore): Promise<Purchase[]> {
  const ids = (await store.get<string[]>(PURCHASE_IDS_KEY)) ?? [];
  return (await Promise.all(ids.map((id) => purchase(store, id)))).filter((x): x is Purchase => Boolean(x));
}
export function activate(p: Purchase, slot: AdSlot): Purchase {
  const start = now();
  const end = new Date(start.getTime() + slot.durationDays * 86_400_000);
  return { ...p, status: "active", startTime: start.toISOString(), endTime: end.toISOString() };
}
export function shortId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 12); }
export function validTransactionHash(value: string): boolean { return /^0x[a-fA-F0-9]{64}$/.test(value); }
