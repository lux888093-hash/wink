# Project Instructions

## Encoding Safety Rules

When reading, searching, or writing CJK text on Windows:

- Before running shell commands that may print or pipe non-ASCII text, force UTF-8 in that shell session:
  `$utf8 = [System.Text.UTF8Encoding]::new($false)`
  `[Console]::InputEncoding = $utf8`
  `[Console]::OutputEncoding = $utf8`
  `$OutputEncoding = $utf8`
  `chcp 65001 > $null`
- Treat terminal-rendered CJK text as untrusted until the file is re-read with explicit UTF-8.
- Prefer direct UTF-8 file IO such as `Get-Content -Encoding UTF8` and `fs.readFileSync(path, 'utf8')`.
- Default new or edited text files to UTF-8 without BOM unless the repo clearly requires another encoding.
- Do not patch CJK text from garbled terminal output. Re-open the source file with explicit encoding first.
- After editing files that contain CJK text, re-read them as UTF-8 and scan for mojibake markers such as `U+FFFD`, doubled UTF-8/Latin-1 fragments, or unexpected `?` inside CJK strings.
- If a file's encoding is unclear, detect it first. Do not guess and write back.
- If shell output still looks wrong, inspect file bytes or use a direct script instead of copying terminal text.
- Git may quote UTF-8 paths in status output; that alone is not file corruption.

## Mini Program Real-Device UI Scale

The project was tuned on April 19, 2026 to avoid looking too small on real phones. Future UI changes should keep the current dense-but-readable scale instead of reverting to tiny mini-program defaults.

- Keep the existing dark wine/gold visual system unless the task explicitly asks for a redesign.
- Use system text fonts with `SF Pro Text` / `SF Pro Display` first, then Chinese fallbacks.
- Body text, list descriptions, form inputs, fee rows, address/contact text: prefer `21rpx`-`24rpx`.
- Section titles and important row titles: prefer `26rpx`-`32rpx`.
- Hero or page-level titles: prefer `30rpx`-`36rpx`, only larger when the layout already supports it.
- Micro labels are allowed, but do not use `12rpx`-`18rpx` for primary readable content on real devices.
- Primary buttons, sticky bars, tabbar items, SKU options, address cards, and icon buttons must keep comfortable touch targets. Use at least `68rpx` for compact icon actions and `76rpx`-`90rpx` for primary row/button actions.
- Chips and status pills should generally be at least `44rpx` high with text around `20rpx`-`22rpx`.
- Page horizontal padding should normally stay around `24rpx`-`28rpx`; avoid narrow layouts that make the whole interface feel scaled down.
- Avoid negative or wide letter spacing in mini-program UI. Use `letter-spacing: 0` unless a very specific decorative label needs otherwise.
- Keep bottom fixed bars clear of content by increasing page bottom padding or `.tabbar-gap` when their height changes.
- Before finishing UI edits, scan modified `wxss` for accidental tiny content text (`font-size: 12rpx`-`18rpx`) and for negative `letter-spacing`.

## Product UI Copy Guardrail

Never place task discussion, prompt wording, design rationale, or chat-derived requirement summaries directly into product UI text.

- Do not expose phrases that sound like implementation notes or request summaries, such as "当前需求", "本次对话", "固定规则", "后台只保留", "不再逐条绑定", "按这次需求收敛", or similar wording derived from collaboration chat.
- UI copy must read as real product text for operators or end users: labels, helper text, empty states, status text, or concise operational instructions.
- This applies to all user-facing surfaces in this repo, including admin dashboards, login pages, dialogs, empty states, helper text, and error/status copy.
- If a business rule must appear in UI, express it as neutral product guidance, not as an explanation of why the code or design was changed.
- Before finishing any UI task, scan changed text for prompt-like language, meta commentary, or references to the design process and remove them.
