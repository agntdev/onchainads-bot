import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem, requireOwner } from "../toolkit/index.js";
import { saveSlots, shortId, slots } from "../ad-data.js";

registerMainMenuItem({ label: "Manage ad slots", data: "slots:manage", order: 30 });
const composer = new Composer<Ctx>();

async function desk(ctx: Ctx): Promise<void> {
  const list = await slots(ctx.store);
  await ctx.reply(list.map((slot) => `${slot.name} — ${slot.price} for ${slot.durationDays} days${slot.active ? "" : " (hidden)"}`).join("\n"), {
    reply_markup: inlineKeyboard([
      ...list.map((slot) => [inlineButton(`Edit ${slot.name}`, `slots:edit:${slot.id}`)]),
      [inlineButton("Add ad slot", "slots:add")],
      [inlineButton("Back to menu", "menu:main")],
    ]),
  });
}

composer.callbackQuery("slots:manage", async (ctx) => {
  if (!(await requireOwner(ctx))) return;
  await ctx.answerCallbackQuery();
  await desk(ctx);
});
composer.callbackQuery("slots:add", async (ctx) => {
  if (!(await requireOwner(ctx))) return;
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_slot_name";
  ctx.session.draftSlot = {};
  await ctx.reply("Type the ad slot name.");
});
composer.callbackQuery(/^slots:edit:(.+)$/, async (ctx) => {
  if (!(await requireOwner(ctx))) return;
  await ctx.answerCallbackQuery();
  const slot = (await slots(ctx.store)).find((item) => item.id === ctx.match[1]);
  if (!slot) { await ctx.reply("That ad slot no longer exists."); return; }
  ctx.session.step = "awaiting_slot_edit_price";
  ctx.session.editSlotId = slot.id;
  await ctx.reply(`Type the new price for ${slot.name}, including its currency.`);
});
composer.on("message:text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  if (!ctx.session.step?.startsWith("awaiting_slot_")) return next();
  if (!(await requireOwner(ctx))) { ctx.session.step = undefined; ctx.session.draftSlot = undefined; return; }
  if (ctx.session.step === "awaiting_slot_edit_price") {
    const id = ctx.session.editSlotId;
    const list = await slots(ctx.store);
    const slot = list.find((item) => item.id === id);
    if (!slot || text.length < 2 || text.length > 40) { await ctx.reply("Use a clear price and currency, then try again."); return; }
    await saveSlots(ctx.store, list.map((item) => item.id === id ? { ...item, price: text } : item));
    ctx.session.step = undefined;
    ctx.session.editSlotId = undefined;
    await ctx.reply("Ad slot price updated.");
    return;
  }
  if (text.length < 2 || text.length > 60) { await ctx.reply("Use a name between 2 and 60 characters."); return; }
  if (ctx.session.step === "awaiting_slot_name") {
    ctx.session.draftSlot = { name: text };
    ctx.session.step = "awaiting_slot_price";
    await ctx.reply("Type the price and currency, for example 250 USDC.");
    return;
  }
  if (ctx.session.step === "awaiting_slot_price") {
    ctx.session.draftSlot = { ...ctx.session.draftSlot, price: text };
    ctx.session.step = "awaiting_slot_duration";
    await ctx.reply("Type the placement length in whole days.");
    return;
  }
  if (ctx.session.step === "awaiting_slot_duration") {
    const durationDays = Number(text);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) { await ctx.reply("Use a whole number from 1 to 365 days."); return; }
    ctx.session.draftSlot = { ...ctx.session.draftSlot, durationDays };
    ctx.session.step = "awaiting_slot_rules";
    await ctx.reply("Type the display rules for this slot.");
    return;
  }
  const draft = ctx.session.draftSlot;
  if (!draft?.name || !draft.price || !draft.durationDays || text.length < 2) { await ctx.reply("Add clear display rules, then try again."); return; }
  const list = await slots(ctx.store);
  await saveSlots(ctx.store, [...list, { id: "custom-" + shortId(), name: draft.name, price: draft.price, durationDays: draft.durationDays, displayRules: text, active: true }]);
  ctx.session.step = undefined;
  ctx.session.draftSlot = undefined;
  await ctx.reply("Ad slot added. It is now available to buyers.");
});
export default composer;
