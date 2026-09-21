# Brag Plan: Distyl

## What is this app?
A VS Code extension that turns your entire workspace into a ranked, token-budgeted context payload on your clipboard with one keystroke, so you stop hand-assembling prompts for AI chat.

## The angle
Everyone who uses an AI assistant performs the same unpaid clerical job first: copy a file, copy the error, copy the git diff, paste, trim, paste again. Distyl's own README names it "the invisible ritual," and says the quiet part out loud: the curation happens in your head, **often poorly**. That self-awareness is the angle. The video shows the ritual, kills it with one keystroke, then shows the machine doing the curation better and in public.

This is not a generic dev-tool promo. The centerpiece is Distyl's actual ranking pipeline, rendered in Distyl's actual source-badge colors, ending on Distyl's actual preview panel.

## Hook (first 2-3 seconds)
Four context fragments scattered across a dark editor, each tagged with its real colored source badge, drifting and dim. The line lands hard over them:

**"You curate context by hand. Often poorly."**

The second half is the hook. It is the product accusing the viewer, using the product's own words.

## Key moments (the middle)
- `⌘⇧C` pressed, then the prompt field types out `fix the auth bug` (the README's own CLI example) with key ticks
- The four scattered fragments snap into a ranked column, each source badge igniting in its real hex: ACTIVE FILE `#4a9eff`, RECENT EDIT `#e6a817`, GIT DIFF `#e88230`, TERMINAL `#a855f7`
- A boost tag flicks onto two rows: `×1.3 recent` and `×1.2 same dir` — the real multipliers from the README
- The token meter fills and settles on `8,000 tokens · standard`, with the overflow rows dimming out to show the packer discarding

## Outro / punchline
The preview panel resolves, the `Copy to clipboard` button depresses, and the payload lands. Final card: the Distyl wordmark over **"Nothing leaves your machine."** — because the whole ranker runs locally on a 22M-parameter model, which is the most underrated claim in the README.

## User flow worth showing
Yes, and it is the centerpiece:
1. **Entry** — press `⌘⇧C`, type what you're about to ask
2. **Key action** — gather from active file / recent edits / git / terminal → rank with local MiniLM embeddings → pack into the token budget
3. **Result** — payload on the clipboard, preview panel showing exactly what was sent and why

Scenes 2, 3, and 4 are that flow in order. No landing-page recreation, because this project has no landing page — it has a working pipeline, which is better material.

## Tone
- Preset: `polished`
- Creative direction: a precise developer-tool product film, dark editor aesthetic, no jokes and no hype
- Interpretation: fewer scenes, longer holds, restraint over energy. Distyl is a well-engineered tool built by someone who cares about measurement (87% overlap against a hand-built eval set). The video should feel like the tool: exact, quiet, confident. Motion is crisp but never frantic; every claim on screen is one the README can back.

## Format: landscape — 1920x1080
## Duration: 21 seconds

## Visual identity (from the project)
Pulled from `src/core/preview.ts`, which is the extension's only rendered surface.

- Background: `#1e1e1e` (`--vscode-editor-background` fallback)
- Card background: `#252526` · Code background: `#2d2d2d` · Border: `#3a3a3a`
- Text: `#d4d4d4` · Secondary text: `#9e9e9e`
- Accent (button): `#0e639c`, hover `#1177bb`
- Source badge palette (the signature visual): active-file `#4a9eff`, recent-edit `#e6a817`, git-diff `#e88230`, git-log/branch `#8a8a8a`, terminal `#a855f7`
- Display font: Segoe UI · Body font: Segoe UI · Mono: Courier New
- Strongest visual element: the chunk card with its uppercase colored source badge, path, and token count

## Share copy (draft)
Every prompt starts with the same unpaid clerical job. Distyl does it in one keystroke: ranks your whole workspace with a local model, packs it to your token budget, hands you the clipboard. Nothing leaves your machine.

## Audio direction
- Role: sparse professional accents over a low music bed
- Music: `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` (114.84 BPM), entering under the hook
- Music treatment: start near 1.4s so the first strong cue at 1.60s carries the hook line. Sit low, around -18 to -20 LUFS under the SFX. Fade out across the final 1.5s so the closing line lands in near-silence.
- Music cue guidance: preset read from `assets/music/cues/`. Target strong cues at **3.70s** (keystroke), **8.96s** (ranked column snaps together), **12.65s** (token meter settles). Sequential badge ignitions should use the beat grid at every *other* beat (~1.05s apart, not 0.52s) so each label clears the readable floor. Restraint note: polished tone — cues guide timing, they never add visible beat-reactive decoration.
- Audio-reactive treatment: subtle. Music RMS may breathe the preview panel's glow very slightly. No waveform bars, no pulsing, no scale-on-beat.
- SFX posture: sparse and motion-matched. Roughly six cues across 21 seconds.
- Audio-coupled moments: key ticks under the typed prompt (`keyboard/keypress-*.wav`), a soft UI click per source badge ignition, one dry confirm on the clipboard land, one low settle when the token meter stops
- Restraint rule: no whooshes, no risers, no cinematic impacts. If a sound is not matched to something physically moving on screen, it does not belong.

## Storyboard

### Scene 1 — The ritual — 4.0s
Dark `#1e1e1e` field. Four context fragments float in loose disorder at ~45% opacity: a TypeScript snippet, a git diff hunk with +/- lines, a terminal line, a doc paragraph. Each carries its real uppercase source badge in its real hex. They drift slightly, unsorted, overlapping — the mess in your head.

At 1.6s the hook slams in center, large, and **holds 1.6s settled**:
> **You curate context by hand.**
> *Often poorly.*

Second line in `#9e9e9e`, smaller, arriving 0.4s after the first.

Sequential/interaction: none — the fragments are already present and drifting.
Audio intent: music enters low and unhurried. No SFX. The silence is the setup.
Audio-coupled idea: none.
Music: low bed, first strong cue at 1.60s under the hook line.
Transition mood: clean → Scene 2

### Scene 2 — One keystroke — 5.0s
Hard cut to a centered command bar on the dark field. The `⌘⇧C` keycap graphic presses down at 3.70s with a single key tick.

The prompt field then types out, character by character, with light key ticks:
> `fix the auth bug`

Cursor blinks once. Enter. The bar flashes `#0e639c` for 120ms.

Sequential/interaction: **yes** — simulated typing, character by character, roughly 22 chars over 1.3s. The keycap press is a simulated interaction and must read as a physical press (down, hold, release).
Audio intent: this is the turn. Key ticks give it tactility and mark the exact moment the work stops being manual.
Audio-coupled idea: typed text with `keyboard/keypress-*.wav`, varied across presses so it does not sound like one looped sample.
Music: bed continues, unchanged.
Transition mood: soft → Scene 3

### Scene 3 — Gather, rank, pack — 7.0s
**The centerpiece.** The four scattered fragments from Scene 1 fly back in and snap into a single ranked vertical column of chunk cards, ordered by score. Cards use `#252526` on `#1e1e1e` with `#3a3a3a` borders.

Beat A (~8.96s, strong cue): the column locks into place.
Beat B: source badges ignite one at a time, every other beat (~1.05s apart), each with a soft UI click — ACTIVE FILE `#4a9eff`, then RECENT EDIT `#e6a817`, then GIT DIFF `#e88230`, then TERMINAL `#a855f7`. Each badge holds at least 0.8s settled.
Beat C: two small boost tags flick in beside their rows — `×1.3 recent`, `×1.2 same dir`. Hold 0.9s.
Beat D (~12.65s, strong cue): a token meter fills left to right and settles on **`8,000 tokens · standard`** with a low settle sound. The two lowest-ranked cards dim to 20% and drop away — the packer discarding overflow.

Sequential/interaction: **yes** — badge ignition is explicitly one by one on every other beat, then boost tags, then the meter. Four distinct arrivals, each held to the readable floor. Do not compress these onto consecutive beats.
Audio intent: precision. Each arrival is a small mechanical confirmation, not a celebration.
Audio-coupled idea: one `ui/click*.ogg` per badge; one low `impact/impactSoft_medium_*.ogg` when the meter stops.
Music: bed continues, slightly more present.
Transition mood: soft → Scene 4

### Scene 4 — Payload, and the quiet claim — 5.0s
The column resolves into the real preview panel. Header row shows the genuine UI strings:
> `fix the auth bug`
> `12 chunks` · `8,000 tokens · standard`

with the `Copy to clipboard` button in `#0e639c` at the right. The cursor moves to it, the button depresses to `#1177bb`, and one dry confirm fires as the payload lands.

The panel then recedes and the final card holds for 2.0s:
> **Distyl**
> Nothing leaves your machine.

Small line beneath in `#9e9e9e`: `all-MiniLM-L6-v2 · runs locally · VS Code Marketplace`

Sequential/interaction: **yes** — simulated cursor move and button press with a real depress state.
Audio intent: the confirm is the payoff. Then the music fades and the last line sits in near-silence, which is the whole point of the claim.
Audio-coupled idea: `ui/mouseclick1.ogg` on the button press; music fade-out across the final 1.5s.
Music: fades to zero by the end of the card.
Transition mood: — (end)

**Music mood for this video:** understated, steady, professional — present enough to carry pacing, quiet enough that the SFX and the closing silence do the work.
**Audio summary:** A low bed enters under an accusatory hook, key ticks mark the moment manual work ends, sparse mechanical clicks confirm each stage of the ranking pipeline, a single dry confirm lands the payload, and the music clears out so the final privacy claim reads in silence.

## Scene duration check
4.0 + 5.0 + 7.0 + 5.0 = **21.0s** ✓ (target 15-25s, sweet spot 18-22s)
