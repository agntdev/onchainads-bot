import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { adminChatId, inlineButton, inlineKeyboard, registerMainMenuItem, requireOwner } from "../toolkit/index.js";
import { activate, allPurchases, purchase, savePurchase, slots } from "../ad-data.js";

registerMainMenuItem({ label: "Manage purchases", data: "approve_purchase", order: 40 });

const composer = new Composer<Ctx>();

async function ownerNotice(ctx: Ctx, text: string, markup?: ReturnType<typeof inlineKeyboard>): Promise<void> {
  const owner = adminChatId(ctx);
  if (!owner) return;
  try { await ctx.api.sendMessage(owner, text, markup ? { reply_markup: markup } : undefined); } catch { /* A blocked/unstarted owner must not break the buyer flow. */ }
}

composer.callbackQuery("approve_purchase", async (ctx) => {
  if (!(await requireOwner(ctx))) return;
  await ctx.answerCallbackQuery();
  const pending = (await allPurchases(ctx.store)).filter((item) => item.status === "pending_review");
  if (pending.length === 0) { await ctx.reply("There are no purchases waiting for review."); return; }
  await ctx.reply(pending.map((item) => `${item.slotName} — ${item.price}\nTransaction: ${item.txHash ?? "Not submitted"}`).join("\n\n"), {
    reply_markup: inlineKeyboard(pending.flatMap((item) => [[inlineButton(`Approve ${item.slotName}`, `approve_purchase:${item.id}`), inlineButton("Reject", `reject_purchase:${item.id}`)]])),
  });
});

composer.callbackQuery(/^approve_purchase:(.+)$/, async (ctx) => {
  if (!(await requireOwner(ctx))) return;
  await ctx.answerCallbackQuery();
  const item = await purchase(ctx.store, ctx.match[1]);
  if (!item || item.status !== "pending_review") { await ctx.reply("That purchase is no longer waiting for review."); return; }
  const slot = (await slots(ctx.store)).find((entry) => entry.id === item.slotId);
  if (!slot) { await ctx.reply("That ad slot no longer exists, so this purchase can't be approved."); return; }
  const active = (await allPurchases(ctx.store)).some((other) => other.id !== item.id && other.slotId === item.slotId && other.status === "active");
  if (active) {
    await savePurchase(ctx.store, { ...item, status: "conflict" });
    await ctx.reply("This slot already has an active placement, so this purchase can't be approved yet.");
    try { await ctx.api.sendMessage(item.buyer, "Your purchase is waiting because this ad slot is currently active."); } catch { /* buyer may have blocked the bot */ }
    return;
  }
  const approved = activate(item, slot);
  await savePurchase(ctx.store, approved);
  await ctx.reply("Purchase approved and the ad slot is now active.");
  try { await ctx.api.sendMessage(item.buyer, "Your purchase was approved and your ad slot is now active."); } catch { /* buyer may have blocked the bot */ }
  await ownerNotice(ctx, `Ad activated: ${approved.slotName}.`);
});

composer.callbackQuery(/^reject_purchase:(.+)$/, async (ctx) => {
  if (!(await requireOwner(ctx))) return;
  await ctx.answerCallbackQuery();
  const item = await purchase(ctx.store, ctx.match[1]);
  if (!item || item.status !== "pending_review") { await ctx.reply("That purchase is no longer waiting for review."); return; }
  await savePurchase(ctx.store, { ...item, status: "rejected" });
  await ctx.reply("Purchase rejected. The buyer has been notified.");
  try { await ctx.api.sendMessage(item.buyer, "Your purchase was not approved. Contact the ad owner if you need help."); } catch { /* buyer may have blocked the bot */ }
});

export default composer;
