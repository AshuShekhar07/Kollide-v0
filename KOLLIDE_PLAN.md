# Kollide — Implementation Plan (Navratri 2026 Pilot)

> **For Claude Code:** This file is the source of truth for the build. Work through the phases in order. Finish and test each phase before starting the next. Do not change anything in **Section 2 (Locked decisions)** without asking first. If something here is ambiguous, ask instead of guessing. Security rules (RLS, server-side checks) are never optional, even under time pressure.

---

## 1. Product summary

Kollide is a matchmaking platform for real-world meetups. People use it to find a friend or a group of friends to attend an event with, instead of going alone. It is not a dating app. Tagline: *"Where paths collide."*

- **Cities:** anywhere in India. Each person sees people and groups within 80 km of their location (from the phone, or a city they pick). *(Changed Oct 2 from Bangalore only.)*
- **Pilot:** Sharad Navratri 2026, which runs Oct 11–19, 2026. Garba/Dandiya is the only live activity.
- **Other activities** (treks, sports, concerts, etc.) are listed as "Coming soon" from day one, so the product reads as multi-event, not Garba-only.
- **Target launch:** Sunday, Oct 4, 2026. Hard deadline: Oct 10.
- **Pilot goal:** validate demand and trust. Prioritize verification (trust) and the chat cap (cost control) over UI polish and animations.

---

## 2. Locked decisions

### 2.1 Matching
- **1:1 matching (Hinge-style).** The user sets their gender, a gender preference, and a seeking type (`friend` or `group`, i.e. "a friend to go with" or "a group of friends"). The 1:1 feed only shows people with the same seeking type; users can change it any time on `/profile`. *(Changed Sep 27 from `partner`/`friend`: Kollide is not a dating platform.)* They browse profiles and like or pass. The recipient sees incoming likes, views the liker's profile, and accepts or rejects.
- **Group matching.** A user creates a group tied to an activity and sets a max member count (hard limit 10). Groups have no gender filter.
  - **Joining:** anyone verified can request to join, and the group admin approves or rejects.
  - **Inviting:** the admin can also see interested users and invite them. The invitee accepts or declines.
  - **Group requirements:** every group member must be verified.
  - **Admin leaving:** admin rights transfer to the longest-standing approved member. If none remain, the group is closed.
- **Public identity.** Every user gets a unique public code (e.g. `XBY432`) shown next to their first name. Email, phone and social handles stay private until a match or group approval.

### 2.2 Verification (manual for the pilot)
- **Mandatory at signup:**
  - email (used for login)
  - phone number (collected, not OTP-verified in the pilot)
  - at least one social handle (Instagram, Snapchat, WhatsApp or Telegram)
  - 2–6 profile photos
  - date of birth (must be 18+)
  - a 5–10 second face video recorded in-app, where the user looks straight, then turns left, then turns right
- **Confirmation email.** After signup, the user gets an email confirming their account details were shared with Kollide.
- **Review.** A small internal team reviews each video within 24 hours and approves or rejects it. Reviewer access is restricted and every access is logged.
- **Video retention:**
  - approved accounts: deleted 48 hours after review
  - rejected accounts: deleted 30 days after review, to catch repeat fake signups
  - after that, the file is permanently removed from storage
  - videos are never stored long-term
- **Held interests.** While verification is pending, the user can browse and like normally, but their likes are **held** on the server and invisible to recipients. When the user is approved, every held like becomes visible and the recipients are notified. When the user is rejected, their held likes are discarded silently.
- **Only approved users appear** in discovery and groups.
- **Unverified browsing limit.** Unverified users can view at most `UNVERIFIED_DAILY_VIEW_LIMIT` profiles per day (default 30, stored in a config table). This limits scraping by people who never verify.

### 2.3 Chat
- **When it opens:** when a 1:1 match is accepted, or when a user is approved into a group.
- **Text only.** No photos, video, voice or links. Reject messages containing URLs on the server.
- **Message length:** max 500 characters, enforced by a database constraint and inside the send function.
- **Message cap:** each conversation has a shared cap of **50 × number of members**.
  - Any member can use the shared pool; there is no per-person quota.
  - A 1:1 chat therefore gets 100 messages.
  - For groups, the cap only ever goes up: `cap = GREATEST(cap, 50 × approved_members)`. It never shrinks when someone leaves.
- **Cap UI:**
  - A banner at the top of the chat explains the limit.
  - A counter shows the remaining messages.
  - A reminder appears at 80% and again at 95%.
  - When the cap is reached, the input is replaced by a card showing the other members' social handles and "Continue on socials" links.
- **Encryption copy.** Messages are encrypted at rest using Supabase's storage encryption. They are **not** end-to-end encrypted. Use this exact copy wherever encryption comes up:
  > "Your messages are private. If a conversation is reported, our safety team reviews it to investigate."
  Never use the words "end-to-end" anywhere in the product.
- **No AI chatbot.**

### 2.4 Block and report
- **Block** is instant, one-sided, and needs no review. After a block:
  - both users are hidden from each other everywhere (feed, likes, groups lists)
  - any shared 1:1 chat is frozen
  - in group chats, the blocked user's messages are hidden for the blocker only
- **Report** requires the reporter to tick a consent box agreeing to share the conversation for review. On submit:
  1. The server copies a snapshot of the conversation (all messages, sender IDs, timestamps) into the report.
  2. The conversation is marked `retained` and is exempt from every cleanup job.
  3. The report keeps the reporter ID, reported ID, timestamps, and an access log of every reviewer who opened it.
  4. The reporter is also blocked from the reported user automatically.
- **Ban resolution.** Bans apply to the normalized email, phone and every social handle, not just the account. Signup checks against this ban list.
- **Account deletion.** Reports and their snapshots survive when either party deletes their account.
- **Help link.** For threats or stalking, the report screen shows the national cybercrime helpline 1930 and cybercrime.gov.in.

### 2.5 Monetization
- **Not finalized. Do not build payments in phases 0–5.**
- **Pricing.** The proposed gender-based pricing (₹199 for men, ₹99 for women) is unvalidated and carries discrimination and reputation risk. It is on hold pending pilot data.
- **Schema prep.** Add a nullable `plan` column now, so paid access can be switched on later (see Phase 6).
- **Metrics.** Track the full funnel from day one: signup → video submitted → verified → first like → first match → chat reached cap.

---

## 3. Architecture

This stack replaces the earlier FastAPI + Celery + Redis + R2 suggestion. The team does not want a separately hosted backend, because free-tier servers suffer from cold starts. Everything below is managed, free at pilot scale, and has no always-on server to host.

| Concern | Choice |
|---|---|
| Frontend | React + TypeScript + Vite single-page app, with React Router and Tailwind. Installable as a PWA, so it serves as both the "website and app". |
| Frontend hosting | Cloudflare Workers static assets (free, commercial use allowed, no cold starts), deployed from `web/` via `web/wrangler.jsonc` with SPA fallback. Live at https://kollide-v0.ashushekhar07.workers.dev. Build-time env vars (`VITE_*`) are set under the Worker's **Build** variables. *Alternative: Next.js on Vercel Pro. Vercel's free Hobby plan is non-commercial only.* |
| Database | Supabase Postgres |
| Authorization | Row-Level Security (RLS) on **every** table |
| Business logic | Postgres functions called via RPC, `SECURITY DEFINER` with explicit checks, plus triggers |
| Auth | Supabase Auth: Google sign-in and email OTP / magic link |
| File storage | Supabase Storage, private buckets only; files are served through signed URLs |
| Realtime chat | Supabase Realtime (Postgres changes on `messages`, filtered by conversation) |
| Background jobs | `pg_cron` + `pg_net` calling edge functions |
| Server code needing secrets or external APIs | Supabase Edge Functions (Deno / TypeScript) |
| Email | Resend (or similar) called from an edge function |
| Swipe UI | `react-tinder-card` or similar. Do not build swipe gestures from scratch. |

**Where logic lives:**
- If a rule must be enforced (caps, verification gating, blocks, bans), it lives in Postgres: a constraint, RLS policy, RPC function, or trigger.
- The frontend never decides anything security-relevant.
- Edge functions are used only for signed URLs that need the service role, sending email, and deleting storage files.

**Local development:** use the Supabase CLI (`supabase start`, `supabase migration new`, `supabase db reset`). All schema changes go in migrations. Keep `supabase/seed.sql` with realistic test users in every state (unverified, pending, approved, rejected, banned).

**Suggested repo layout:**
```
/web                      # Vite React app
/supabase/migrations      # SQL migrations
/supabase/functions       # edge functions
/supabase/seed.sql
/supabase/tests           # pgTAP tests for RPC + RLS
PLAN.md                   # this file
```

---

## 4. Data model

All IDs are `uuid`. All timestamps are `timestamptz` with a default of `now()`. Enable RLS on every table.

### 4.1 Tables

**`profiles`** is public-ish: readable by approved users, subject to blocks and bans.
- `id` (PK, FK `auth.users`)
- `first_name`
- `dob` (date; check age ≥ 18)
- `gender` (enum: `man`, `woman`, `non_binary`)
- `gender_preference` (enum[])
- `seeking` (enum: `friend`, `group`)
- `bio` (≤ 300 characters)
- `public_code` (unique, char(6), generated by a trigger: 3 letters + 3 digits, excluding ambiguous characters like O/0 and I/1)
- `verification_status` (enum: `unsubmitted`, `pending`, `approved`, `rejected`)
- `verified_by`, `verified_at`
- `is_banned` (bool)
- `plan` (text, nullable)
- `onboarding_complete` (bool)
- `created_at`

**`profile_private`** holds details only the user and admins can read directly, including `full_name` (asked at signup; its first word becomes the public `first_name`). Matched users see socials only through `get_contact()`.
- `user_id` (PK, FK)
- `email`
- `phone`
- `socials` (jsonb, e.g. `{instagram, snapchat, whatsapp, telegram}`)

**`activities`**
- `id`, `slug`, `name`
- `status` (enum: `live`, `coming_soon`)
- `sort_order`
- Seed data: `garba` is `live`; add 5–6 `coming_soon` activities (final list is an open decision, see Section 9).

**`user_activities`**
- `user_id`, `activity_id`
- PK on both columns

**`photos`**
- `id`, `user_id`
- `storage_path`
- `position` (0–5)
- unique on (`user_id`, `position`)

**`verification_videos`**
- `id`, `user_id`
- `storage_path`
- `status` (enum: `pending`, `approved`, `rejected`)
- `reviewed_by`, `reviewed_at`, `reject_reason`
- `delete_after`, `deleted_at`

**`swipes`**
- `id`
- `from_user`, `to_user`, `activity_id`
- `action` (enum: `like`, `pass`)
- `status` (enum: `held`, `pending`, `accepted`, `rejected`, `discarded`; null for passes)
- `created_at`, `responded_at`
- unique on (`from_user`, `to_user`, `activity_id`)

**`matches`**
- `id`
- `user_a`, `user_b` (store with `user_a < user_b`)
- `activity_id`, `swipe_id`
- `created_at`

**`groups`**
- `id`, `admin_id`, `activity_id`
- `title`, `description`
- `event_date` (date, nullable)
- `venue` (text, nullable)
- `max_members` (2–10)
- `status` (enum: `open`, `full`, `closed`)
- `created_at`

**`group_members`**
- `group_id`, `user_id`
- `role` (enum: `admin`, `member`)
- `status` (enum: `requested`, `invited`, `approved`, `rejected`, `left`, `removed`)
- `created_at`, `approved_at`
- PK on (`group_id`, `user_id`)

**`conversations`**
- `id`
- `kind` (enum: `direct`, `group`)
- `match_id` or `group_id` (exactly one set)
- `message_cap` (int)
- `message_count` (int, default 0)
- `is_frozen` (bool)
- `retained` (bool)
- `created_at`

**`conversation_members`**
- `conversation_id`, `user_id`
- `joined_at`
- `left_at`
- PK on both IDs

**`messages`**
- `id`, `conversation_id`, `sender_id`
- `body` (text; check `char_length(body) between 1 and 500`)
- `created_at`
- Clients never insert into this table directly. Inserts only happen through `send_message()`.

**`blocks`**
- `blocker_id`, `blocked_id`
- `created_at`
- PK on both columns

**`reports`**
- `id`
- `reporter_id`, `reported_id`
- `conversation_id` (nullable)
- `reason` (enum: `harassment`, `fake_profile`, `inappropriate`, `safety_threat`, `spam`, `other`)
- `details` (text)
- `chat_share_consent` (bool; check that it is true)
- `snapshot` (jsonb)
- `status` (enum: `open`, `reviewing`, `resolved`)
- `resolution` (enum: `no_action`, `warning`, `ban`)
- `resolved_by`, `resolved_at`
- `created_at`

**`bans`**
- `id`
- `kind` (enum: `email`, `phone`, `instagram`, `snapchat`, `whatsapp`, `telegram`)
- `value_normalized`
- `report_id`
- `created_at`
- unique on (`kind`, `value_normalized`)

**`admins`**
- `user_id` (PK)
- `created_at`
- Admin status lives here, not in the profile.

**`admin_access_log`**
- `id`, `admin_id`
- `action` (e.g. `view_video`, `view_report`, `review_verification`, `resolve_report`)
- `target_type`, `target_id`
- `created_at`
- Insert-only; admins cannot update or delete rows.

**`notifications`**
- `id`, `user_id`
- `type`
- `payload` (jsonb)
- `read_at`
- `created_at`

**`profile_views`**
- `viewer_id`, `viewed_id`
- `viewed_on` (date)
- Used for the unverified daily view limit.

**`events_log`**
- `id`, `user_id`
- `name`
- `props` (jsonb)
- `created_at`
- Used for funnel metrics.

**`app_config`**
- `key`, `value` (jsonb)
- Holds settings such as `UNVERIFIED_DAILY_VIEW_LIMIT`.
- Anonymous `join_waitlist` and `vote_coming_soon` calls are capped per function per day, and quietly ignored past the cap.
  Change the limit with `ANON_DAILY_EVENT_CAP` here (default 2000); the counters live in `private.anon_rate`.

### 4.2 Storage buckets (both private)

**`photos`**
- Path: `{user_id}/{uuid}.jpg`
- The owner can write.
- Approved users, admins, and the owner can read, via signed URLs.
- Resize and compress photos on the client before upload (max 1080px, JPEG ~80%).

**`verification-videos`**
- Path: `{user_id}/{uuid}.webm` (or `.mp4`)
- The owner can write, one active pending video at a time.
- Nobody reads directly. Admins get a short-lived signed URL (5 min) only through the `admin-video-url` edge function, which logs the access.

---

## 5. Server-side logic

Every RPC below runs as `SECURITY DEFINER` with `search_path` set explicitly. Each one checks `auth.uid()` and raises clear errors, and each needs a pgTAP test.

### 5.1 Onboarding and verification

**`complete_onboarding(...)`**
1. Validates all required fields: age ≥ 18, at least 2 photos, at least 1 social handle, phone format.
2. Normalizes email, phone and socials: lowercase, strip `@`, strip spaces, convert phone to E.164 `+91…`.
3. Checks the normalized values against `bans`. If any match, reject with a generic error message.
4. Sets `onboarding_complete`.
5. Enqueues the "account details shared" email.

**`submit_verification(storage_path)`**
1. Inserts a `verification_videos` row with status `pending`.
2. Sets the profile to `pending`.
3. Rejects the call if the user is already approved or already has a pending video.

**`admin_review_verification(user_id, approve, reason)`** (admins only)
1. Updates the video and profile status.
2. Sets `delete_after` to now + 48h if approved, or now + 30 days if rejected.
3. Writes to `admin_access_log`.
4. Enqueues the result email.

**Trigger on the profile status change to `approved`** (runs in the same transaction):
1. Updates every `held` like from this user to `pending`.
2. Creates a notification for each recipient.

**On `rejected`:** held likes become `discarded`, with no notifications. The user can resubmit a video once.

### 5.2 Discovery and likes

**`get_feed(activity_id, limit)`** returns profiles that:
- are approved, not banned, onboarding complete, and not the caller
- are not blocked in either direction
- have not already been swiped by the caller for this activity
- have the same `seeking` value as the caller
- satisfy mutual gender preference: the target's gender is in the caller's preferences, and the caller's gender is in the target's preferences
- share the activity

For unverified callers, the function also enforces the daily view limit using `profile_views`. Returns first name, public code, age, bio, and photo paths. Never returns private fields.

**`like_profile(target_id, activity_id)`**
1. Checks the like is not to self, the target is not blocked, and neither user is banned.
2. Sets status to `held` if the caller is not approved, otherwise `pending`, and notifies the recipient.
3. If the target has already liked the caller with status `pending`, auto-accepts and creates a match (mutual like).

**`pass_profile(target_id, activity_id)`** records a pass.

**`get_incoming_likes()`** returns only the caller's `pending` incoming likes. Held likes never appear.

**`respond_to_like(swipe_id, accept)`** (recipient only)
- **Accept:** creates the match, a `direct` conversation with `message_cap = 100`, and both members; notifies the liker.
- **Reject:** no notification to the liker.

**`get_contact(user_id)`** returns the other user's socials only if the caller shares a match or an approved group with them and neither has blocked the other.

### 5.3 Groups

**`create_group(activity_id, title, description, event_date, venue, max_members)`**
- Approved users only.
- Creates the group, adds the creator as `admin` with status `approved`, and creates a `group` conversation with `cap = 50`.

**`request_join(group_id)`**
- Approved users only.
- The group must be open and the caller not blocked by the admin.

**`invite_to_group(group_id, user_id)`**
- Admin only.
- The invitee must be approved.

**`respond_join_request(group_id, user_id, approve)`**
- Admin only.
- On approve:
  1. Checks the group has room (`max_members`).
  2. Adds the user to the conversation.
  3. Sets `cap = GREATEST(cap, 50 × approved_count)`.
  4. Marks the group `full` if it has reached `max_members`.
- Notifies the user.

**`respond_invite(group_id, accept)`**
- The invitee accepts or declines.
- On accept, follows the same approve path as above.

**`leave_group(group_id)`**
1. Sets the member status to `left` and sets `left_at` on the conversation membership.
2. If the leaving user is the admin, transfers admin to the earliest approved member. If none remain, closes the group.
3. Never lowers the cap.

**`remove_member(group_id, user_id)`** — admin only.

**`get_group_interested(group_id)`** — admin only. Lists users with pending requests, plus approved users who marked this activity (so the admin has people to invite). Also returns `via_link`, so requests that came through the invite link are marked.

**Invite links** *(added Sep 27)*. The admin can share a link `/join/<token>`. Tokens live in `group_invite_links`, which has no client access.
- `get_group_invite_link(group_id)` / `reset_group_invite_link(group_id)`: admin only. Returns the token, creating it on first use; reset replaces it so the old link stops working.
- `get_group_invite(token)`: open to anyone with the link, including signed-out visitors. Returns a preview (title, activity, date, member count, admin first name) with no venue or description. The group id and the caller's status are returned only to verified users.
- `request_join_by_link(token)`: the same rules as `request_join`, with the request marked `via_link`. The admin still approves.
- Signed-out or unverified visitors keep the token on their device through sign-up and verification, and the app brings them back to the link once they can ask to join.

### 5.4 Chat

**`send_message(conversation_id, body)`**
1. Locks the conversation row with `SELECT … FOR UPDATE`.
2. Checks that:
   - the caller is an active member
   - the conversation is not frozen
   - there is no block between the caller and the other member (for direct chats)
   - the body is trimmed, 1–500 characters, and contains no URLs
   - `message_count < message_cap`
3. Inserts the message and increments `message_count`.
4. Returns `{message, remaining}`.
5. When the count first crosses 80% and 95% of the cap, inserts a system notification.

**`get_messages(conversation_id, before, limit)`** — active members only, with pagination.

**Realtime:** clients subscribe to `messages` inserts filtered by `conversation_id`. RLS on `messages` must allow SELECT only for active members of that conversation.

### 5.5 Block, report, and admin

**`block_user(target_id)`**
1. Inserts the block.
2. Freezes any direct conversation between the two users.
3. Sets any pending swipes between them to `rejected`.

**`report_user(reported_id, conversation_id, reason, details, consent)`**
1. Requires `consent = true`.
2. Builds the snapshot (all messages in the conversation, with sender IDs and timestamps).
3. Sets `conversations.retained = true`.
4. Inserts the report and auto-blocks the reported user.

**`admin_get_report(report_id)`**
- Admins only.
- Writes to `admin_access_log` **before** returning the report and snapshot.

**`admin_resolve_report(report_id, resolution)`**
- For `ban`:
  1. Inserts `bans` rows for the reported user's normalized email, phone and every social handle.
  2. Sets `is_banned`.
  3. Freezes all their conversations.
  4. Hides them from the feed and groups.
- Logs the action.

**`admin_verification_queue()`** returns pending videos, oldest first, with the profile's photos, so reviewers can check the face matches the photos.

### 5.6 Edge functions

**`admin-video-url`**
1. Verifies the caller is an admin (JWT plus a check of the `admins` table).
2. Logs the access.
3. Returns a 5-minute signed URL.

**`send-email`**
- Called by a DB webhook or `pg_net` on queued emails.
- Templates:
  - account details shared
  - verification approved
  - verification rejected (with reason and a resubmit link)
  - new match (optional)

**`cleanup-videos`**
1. Called hourly by `pg_cron` through `pg_net`, using a shared secret header.
2. Finds videos with `delete_after < now()` and `deleted_at is null`.
3. Deletes each file through the Storage API. Deleting rows from `storage.objects` does not remove the file, so the API is required.
4. Sets `deleted_at`.

### 5.7 Scheduled jobs (`pg_cron`)
- **Hourly:** call `cleanup-videos`.
- **Daily:** delete `profile_views` rows older than 2 days.
- **Daily:** delete `waitlist_join` and `account_deleted` events older than 60 days (nothing reads them). Funnel and vote events are kept, because `admin_metrics` totals them all-time.
- **No job may ever delete anything linked to a report or a `retained` conversation.**

---

## 6. Frontend

### 6.1 Routes and screens

**Public pages**
- **`/` (landing):** hero with the tagline, "Find your Garba friends or group", the live activity card, and "Coming soon" cards for the other activities with a one-tap "I'd want this" vote (writes to `events_log`). Also a short trust section covering verified profiles, the private chat copy, and block/report.
- **`/login`:** Google sign-in and email OTP.
- **`/privacy` and `/terms`:** must exist before launch (see Section 8).

**Onboarding (`/onboarding`, multi-step, progress saved after each step)**
1. **Basics:** first name, date of birth, gender, seeking, gender preference.
2. **Photos:** 2–6, with reorder.
3. **Contact:** phone and socials, with a clear note that these are shown only after a match.
4. **Activities:** Garba is pre-selected.
5. **Verification video:** recorded in-browser with `MediaRecorder`.
   - Show on-screen prompts: "Look straight → turn left → turn right".
   - Auto-stop at 10 seconds.
   - Enforce a 5-second minimum.
   - Preview before upload.
   - **Do not allow uploading a file from the gallery.**

**Main app**
- **`/discover`:**
  - swipe deck for 1:1 matching
  - a "Pending verification" banner for unverified users ("Your likes will be delivered once you're verified — usually within 24 hours")
  - a toggle to the Groups tab
- **`/likes`:** incoming likes. Tap to view the full profile, then accept or reject.
- **`/matches`:** list of 1:1 matches and joined groups, with unread indicators.
- **`/chat/:id`:**
  - pinned banner with the cap explanation and the privacy copy
  - remaining-message counter
  - warnings at 80% and 95%
  - when the cap is reached, the input is replaced by a socials card
  - a menu with Report and Block
- **Groups:**
  - **`/groups`:** browse open groups for the activity.
  - **`/groups/new`:** create a group.
  - **`/groups/:id`:** details, a request-to-join button, and the member list (public codes and first names only until approved).
  - **`/groups/:id/manage`** (admin): the invite link, requests, invites, interested users, and member removal.
  - **`/join/:token`** (public): an invite link's group preview and the next step (sign up, finish verification, or ask to join).
- **`/profile`:** edit profile (built so far: "looking for" and gender preference, via `update_preferences`); view verification status.
- **`/settings`:** blocked users, notification preferences, delete account, logout.
- **Report flow (modal):** reason, details, a consent checkbox (required), and helpline info for safety threats.

**Admin (`/admin`, guarded by the `admins` table and hidden from navigation)**
- **Verification queue:** video player (signed URL) next to the user's photos, with Approve, and Reject with reason. Show the queue age prominently.
- **Reports queue:** open reports, a snapshot viewer (every open is logged), and Resolve (no action / warning / ban).
- **Bans list** and a basic metrics page showing funnel counts from `events_log`.

### 6.2 PWA and UX requirements
- Web manifest, icons, service worker for install. Offline support is not needed.
- Mobile-first layout. Test at 360px width.
- Every RPC error maps to a friendly message.
- Loading and empty states on every list.
- Log funnel events: `signup`, `onboarding_complete`, `video_submitted`, `verified`, `first_like`, `first_match`, `chat_cap_reached`, `group_created`, `group_joined`, `coming_soon_vote`.

---

## 7. Build phases

Each phase ends with its acceptance checks passing. Dates assume a start on Sat, Sep 26, 2026.

### Phase 0 — Foundation (Sep 26–27)
1. Initialize the repo (`/web` with Vite + React + TS + Tailwind + React Router; Supabase CLI project).
2. Write migrations for all tables, enums, constraints and indexes in Section 4.
3. Enable RLS on every table and write baseline policies (deny by default).
4. Create the storage buckets and their policies.
5. Seed data: activities, config, 20 test users across all states, and 1 admin.
6. Set up the Supabase client in `/web`, environment handling, and deploy a placeholder to Cloudflare (Workers static assets).
7. **Also today:** put a waitlist/landing page live so marketing can start.

**Acceptance:**
- `supabase db reset` runs clean.
- A pgTAP test confirms an anonymous user and a random logged-in user cannot read `profile_private`, `messages`, `reports`, or `verification_videos`.

### Phase 1 — Auth, onboarding, verification (Sep 28–29)
1. Login with Google and email OTP.
2. The full onboarding flow, including photo upload with client-side compression.
3. Video recording and upload, then `submit_verification`.
4. `complete_onboarding` with ban checking.
5. Public code trigger.
6. Admin verification queue, the `admin-video-url` edge function, and `admin_review_verification`, all with access logging.
7. The `send-email` edge function (account-shared, approved and rejected templates).

**Acceptance:**
- A new user can sign up, record a video, and appear in the admin queue.
- An admin can approve them, and the user receives the email.
- A banned email or phone cannot complete onboarding.
- Every video view creates an access log row.

### Phase 2 — Discovery and matching (Sep 30–Oct 1)
1. `get_feed` with every filter, plus the unverified view limit.
2. Swipe deck UI.
3. `like_profile` / `pass_profile` with held logic.
4. The approval trigger that releases held likes and notifies recipients.
5. Incoming likes screen and `respond_to_like`.
6. Matches list and `get_contact` (socials reveal).

**Acceptance (pgTAP plus manual):**
- Likes from an unverified user are invisible to the recipient. After approval, they appear and a notification is created. After rejection, they never appear.
- The feed never shows blocked, banned, unapproved, already-swiped, or preference-mismatched users.
- `get_contact` fails for non-matched users.

### Phase 3 — Chat, block, report (Oct 1–2)
1. `send_message` with row locking, all checks, and the cap.
2. Chat UI with Realtime, counter, warnings, the socials card at the cap, and the privacy copy.
3. `block_user` and the report flow with consent, snapshot, `retained` flag, and auto-block.
4. Admin reports queue with logged access and `admin_resolve_report`, including ban propagation.

**Acceptance:**
- **Concurrency test:** two clients sending simultaneously can never push `message_count` past `message_cap`.
- 501-character messages and messages containing URLs are rejected.
- Chat is frozen after a block.
- A ban blocks re-signup with the same email, phone or socials.
- Report snapshots survive account deletion.

### Phase 4 — Groups (Oct 2–3)
1. Create, browse, request, invite, respond, leave and remove group functions, with admin transfer on leave.
2. Group chat reusing the chat components. Cap grows as members are approved and never shrinks.
3. The group management screen, including the interested-users list.

**Acceptance:**
- A group never exceeds `max_members`.
- Unverified users cannot join.
- The cap goes from 50 to 100 to 150 as members are approved, and stays at its highest value when someone leaves.
- When the admin leaves, admin rights transfer to the next member.

### Phase 5 — Hardening and launch (Oct 3–4)
1. `cleanup-videos` edge function plus `pg_cron` schedules. Test with a short `delete_after`.
2. Privacy policy and terms pages (Section 8), and the consent checkbox at signup.
3. PWA manifest and install prompt; landing page "coming soon" votes.
4. Funnel event logging and the admin metrics page.
5. Pass over all error, empty and loading states; mobile QA at 360px.
6. **Friends test:** 20–30 real users sign up, verify, match, form groups, chat to the cap, block and report. Fix issues.
7. **Launch Sunday, Oct 4.**

**Acceptance:** everything in Section 8's launch checklist is ticked.

### Phase 6 — After launch (only if decided)
- **Payments:** Razorpay (UPI) is the likely choice.
  - Gate on the `plan` column.
  - Merchant account activation can take several days, so start the Razorpay signup early if payments are likely.
  - Pricing must be decided first (Section 9).
- **Operations Oct 5–19:** verification shifts so the queue never passes 24 hours; daily report review. **No new features during Oct 11–19** — bug fixes only.
- **After Oct 20:** review the funnel and "coming soon" votes, then plan v2: automated verification, a native app, and the next activity.

---

## 8. Launch checklist

**Legal**
- [ ] Privacy policy covers:
  - what is collected (including the face video)
  - why it is collected
  - the video retention periods (48h approved / 30 days rejected)
  - that chats are encrypted at rest and reviewed only when reported
  - that reported conversations are kept as evidence
  - how to delete an account
- [ ] Explicit consent checkbox at signup, stored with a timestamp. This is required under India's DPDP Act. Get a quick legal review if possible; this plan is not legal advice.
- [ ] Terms of service with an 18+ requirement and a code of conduct.

**Copy**
- [ ] The words "end-to-end" appear nowhere. The approved privacy copy is used verbatim.

**Security**
- [ ] RLS tests pass for every table.
- [ ] The service role key exists only inside edge functions, never in `/web`.
- [ ] Both storage buckets are private. A direct URL without a signature returns 403.

**Admin operations**
- [ ] At least 2 admins added.
- [ ] Verification shift schedule agreed.
- [ ] Access logging verified.

**Jobs**
- [ ] Video cleanup cron confirmed to delete real files.
- [ ] Retained conversations confirmed to be untouched.

**Safety**
- [ ] Block, report and ban flow tested end to end.

**Product**
- [ ] Funnel events are firing.
- [ ] Landing page shows "coming soon" activities.

**Supabase**
- [ ] Project is not paused. Free projects pause after about a week of inactivity.

---

## 9. Open decisions (need a human answer)

1. **Pricing.** Free pilot or paid? Should the gender price gap be kept? (Recommended: launch free or at a single flat price, and decide with pilot data.)
2. **"Coming soon" activities.** What is the exact list? (Placeholders: trekking, badminton, concerts, running clubs, board game nights, cafe hopping.)
3. **Phone OTP.** Keep phone unverified for the pilot, or pay for SMS OTP?
4. **Reference frame.** Should one still frame from each approved video be kept for identifying reported users later? Currently **no**: the rule is full deletion after 48h. Revisit if moderation needs it.
5. **Frontend hosting.** ~~Cloudflare Pages or Vercel Pro?~~ Decided: Cloudflare Workers static assets at `kollide-v0.ashushekhar07.workers.dev`. A custom domain can be attached later without code changes.
