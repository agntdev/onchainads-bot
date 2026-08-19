# Crypto Ad Slots — Bot specification

**Archetype:** commerce

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot enabling users to purchase ad slots using on-chain crypto payments. Users browse available slots, make payments, and the owner manually approves and activates ads. Payments are verified via transaction hashes, with no automated custody or processing.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Crypto projects
- Token teams
- Individuals seeking ad slots

## Success criteria

- User can browse and purchase ad slots using on-chain crypto
- Owner receives notifications for new purchases and can approve them
- Ad slots activate after owner approval and on-chain confirmation

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu
- **Browse Ad Slots** (button, actor: user, callback: browse_slots) — View available ad slots with price and rules
- **View My Purchases** (button, actor: user, callback: view_purchases) — See the status of purchased ad slots
- **Approve Purchase** (button, actor: owner, callback: approve_purchase) — Owner approves a new purchase notification

## Flows

### Browse and Purchase Ad Slot
_Trigger:_ browse_slots

1. User views available slots
2. User selects a slot
3. Bot displays payment address and amount with unique reference
4. User confirms payment and submits transaction hash
5. Bot shows 'I paid' confirmation

_Data touched:_ Ad Slot, Purchase

### Owner Approval Flow
_Trigger:_ new_purchase

1. Owner receives notification with purchase details
2. Owner reviews transaction hash
3. Owner approves or rejects the purchase

_Data touched:_ Purchase

### View Purchase Status
_Trigger:_ view_purchases

1. User views their active and pending purchases
2. User sees status and transaction details

_Data touched:_ Purchase

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat where new purchases and confirmations are sent
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **Ad Slot** _(retention: persistent)_ — Predefined ad slot with name, duration, price, and display rules
  - fields: name, duration, price, display_rules
- **Purchase** _(retention: persistent)_ — Record of a user's ad slot purchase including transaction hash and status
  - fields: buyer, slot, tx_hash, start_time, end_time, status
- **Buyer Profile** _(retention: persistent)_ — Telegram user profile with optional display name and contact info
  - fields: telegram_id, display_name, contact_info

## Integrations

- **Telegram** (required) — Bot API messaging and notifications
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Define and edit ad slots
- Approve or reject purchases
- View purchase history

## Notifications

- New purchase notification with buyer, slot, amount, and tx hash
- Purchase approval confirmation
- Ad activation confirmation

## Permissions & privacy

- User data is stored only for purchase records and buyer profiles
- Transaction hashes are stored for verification and record-keeping
- No personal data is collected beyond Telegram user ID and optional display name

## Edge cases

- User submits invalid transaction hash
- Owner rejects a purchase after payment
- Ad slot duration overlaps with another active slot

## Required tests

- User can browse and purchase an ad slot
- Owner receives and approves a purchase notification
- Ad activates after approval and on-chain confirmation

## Assumptions

- Slots are owner-defined and seeded with 5 common types
- Payment verification is manual by the owner
- Bot provides a single static receive address per supported chain with unique reference/memo for each purchase
- Owner supplies final ad content after purchase
- Multi-chain support is planned for future implementation
