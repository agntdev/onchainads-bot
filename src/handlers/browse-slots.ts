import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { buyerProfile, slots } from "../ad-data.js";

registerMainMenuItem({ label: "Browse ad slots", data: "browse_slots", order: 10 });

const composer = new Composer<Ctx>();

composer.callbackQuery("browse_slots", async (ctx) => {
  await ctx.answerCallbackQuery();
  const available = (await slots(ctx.store)).filter((slot) => slot.active);
  if (available.length === 0) {
    await ctx.reply("No ad slots are available right now — check back soon.");
    return;
  }
  await ctx.reply("Choose an ad slot to see its price and placement rules.", {
    reply_markup: inlineKeyboard([...available.map((slot) => [inlineButton(`${slot.name} — ${slot.price}`, `slot:${slot.id}`)]), [inlineButton("Back to menu", "menu:main")]]),
  });
});

composer.callbackQuery(/^slot:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const slot = (await slots(ctx.store)).find((item) => item.id === ctx.match[1] && item.active);
  if (!slot) { await ctx.editMessageText("That ad slot is no longer available. Choose another slot."); return; }
  await ctx.editMessageText(`${slot.name}\n${slot.price} for ${slot.durationDays} day${slot.durationDays === 1 ? "" : "s"}.\n${slot.displayRules}`, {
    reply_markup: inlineKeyboard([[inlineButton("Continue to payment", `pay:${slot.id}`)], [inlineButton("Back to slots", "browse_slots")]]),
  });
});

composer.callbackQuery(/^pay:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const slot = (await slots(ctx.store)).find((item) => item.id === ctx.match[1] && item.active);
  if (!slot || !ctx.from) { await ctx.editMessageText("That ad slot is no longer available. Choose another slot."); return; }
  await buyerProfile(ctx.store, ctx.from.id, ctx.from.first_name);
  // The blueprint does not provide a receive-address setting. Do not fabricate
  // a wallet address: users must never send crypto to an invented destination.
  await ctx.editMessageText("Payments aren't set up yet, so you can't submit this purchase safely.", { reply_markup: inlineKeyboard([[inlineButton("Back to slots", "browse_slots")]]) });
});

export default composer;
