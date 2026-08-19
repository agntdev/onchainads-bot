import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { purchasesForBuyer } from "../ad-data.js";

registerMainMenuItem({ label: "My purchases", data: "view_purchases", order: 20 });

const composer = new Composer<Ctx>();

composer.callbackQuery("view_purchases", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;
  const purchases = await purchasesForBuyer(ctx.store, ctx.from.id);
  if (purchases.length === 0) { await ctx.reply("You don't have any purchases yet — browse ad slots to get started."); return; }
  const text = purchases.map((p) => `${p.slotName} — ${p.status.replace(/_/g, " ")}${p.txHash ? "\nTransaction: " + p.txHash : ""}`).join("\n\n");
  await ctx.reply(text, { reply_markup: inlineKeyboard([[inlineButton("Browse ad slots", "browse_slots")], [inlineButton("Back to menu", "menu:main")]]) });
});

export default composer;
