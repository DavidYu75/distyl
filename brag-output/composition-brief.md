# Hyperframes Composition Brief: Distyl

## Objective
Create a short launch-style brag video for Distyl, a VS Code extension that distils a workspace into a ranked, token-budgeted context payload on the clipboard.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 21 seconds

## Source Material
- Project root: `/Users/clawd/agents/coding/work/distyl`
- Primary files read: `README.md`, `package.json`, `src/core/preview.ts` (the extension's only rendered surface), `src/core/ranker/miniLM.ts`, `src/core/optimizer/packer.ts`
- Product name: Distyl
- Tagline / strongest claim: "Distil your VS Code workspace into a prompt-ready context payload — automatically ranked, token-budgeted, clipboard-ready."
- Key UI to recreate: the **preview panel** from `src/core/preview.ts` — header row with the prompt text, a `N chunks` + `8,000 tokens · standard` meta row, a `Copy to clipboard` button, and chunk cards each carrying an uppercase colored source badge, a file path, and a token count.
- Copy that must appear verbatim:
  - `You curate context by hand.`
  - `Often poorly.`
  - `fix the auth bug`
  - `8,000 tokens · standard`
  - `Copy to clipboard`
  - `Nothing leaves your machine.`
  - `ACTIVE FILE`, `RECENT EDIT`, `GIT DIFF`, `TERMINAL` (source badges, uppercase as the source does)
  - `×1.3 recent`, `×1.2 same dir`

## Creative Direction
- Tone preset: `polished`
- Creative direction: a precise developer-tool product film, dark editor aesthetic, no jokes and no hype
- Interpretation: fewer scenes, longer holds, restraint over energy. Crisp motion, never frantic. Every on-screen claim is backed by the README. Confidence is expressed through stillness and exactness, not through speed.
- Angle: Everyone using an AI assistant performs the same unpaid clerical job first — copy the file, copy the error, copy the git diff, paste, trim, paste again. Distyl's README names it "the invisible ritual" and admits the curation happens in your head, *often poorly*. The video shows the ritual, ends it with one keystroke, then shows the machine doing the curation better and in the open.
- Hook: four dim, unsorted context fragments drifting in a dark editor, then the line `You curate context by hand.` / `Often poorly.`
- Outro / punchline: the Distyl wordmark over `Nothing leaves your machine.`
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Any claim not present in the README

## Visual Identity
Exact values from `src/core/preview.ts`.

- Background: `#1e1e1e`
- Card background: `#252526` · Code background: `#2d2d2d` · Border: `#3a3a3a`
- Text: `#d4d4d4` · Secondary text: `#9e9e9e`
- Accent: `#0e639c` (button), `#1177bb` (hover/active)
- Source badge palette — the signature visual: active-file `#4a9eff`, recent-edit `#e6a817`, git-diff `#e88230`, git-log/branch `#8a8a8a`, terminal `#a855f7`
- Display font: Segoe UI (fallback: system sans stack)
- Body font: Segoe UI · Mono: Courier New / monospace for paths and code
- Visual references from the project: the chunk card (badge + path + token count), the header meta row, the `Copy to clipboard` button, the four source categories as a color system

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. **The ritual** — 4.0s — four dim unsorted fragments with real source badges; hook line lands at ~1.6s and holds 1.6s settled
2. **One keystroke** — 5.0s — `⌘⇧C` keycap presses at ~3.70s; prompt field types out `fix the auth bug` character by character
3. **Gather, rank, pack** — 7.0s — fragments snap into a ranked column at ~8.96s; four source badges ignite one at a time on every *other* beat (~1.05s apart, each held ≥0.8s); `×1.3 recent` and `×1.2 same dir` boost tags flick in; token meter settles on `8,000 tokens · standard` at ~12.65s and two low-ranked cards dim out
4. **Payload, and the quiet claim** — 5.0s — preview panel resolves with real header strings; cursor presses `Copy to clipboard`; final card holds 2.0s on the wordmark and `Nothing leaves your machine.`

## Audio
- Audio role: sparse professional accents over a low music bed
- Audio arc: bed enters under the hook → key ticks mark the end of manual work → sparse mechanical clicks confirm each pipeline stage → one dry confirm lands the payload → music clears so the closing claim reads in near-silence
- Music: `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` (114.84 BPM)
- Music treatment: start near 1.4s so the 1.60s strong cue carries the hook. Sit low under the SFX. Fade to zero across the final 1.5s — the last line must land in near-silence.
- Music cue guidance: bundled preset at `~/.claude/skills/brag/assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json`. Strong cues available at 1.60, 3.70, 5.80, 6.34, 8.96, 9.50, 12.65, 17.91, 22.65s. **Lock three:** 3.70s (keycap press), 8.96s (column snaps together), 12.65s (token meter settles). Beat grid is ~0.52s at this tempo — for the four badge ignitions use **every other beat** (~1.05s apart) so each label clears the readable floor.
- Audio-reactive treatment: subtle. Music RMS may gently breathe the preview panel's glow or card presence. No waveform bars, no equalizers, no strobing, no scale-on-beat.
- Audio-coupled moments:
  - Scene 2 keycap press — simulated interaction, single key tick
  - Scene 2 prompt field — typed text, varied key ticks across ~22 characters
  - Scene 3 badge ignitions — card/stat sequence, one soft click each, on the beat grid
  - Scene 3 token meter — counter settle, one low soft impact
  - Scene 4 button press — simulated interaction, one dry confirm
- SFX selection guidance: match sound to motion. Keyboard samples for typing, UI clicks for badge arrivals, a mouse click for the button press, a soft low impact for the meter settling. Roughly six cues across 21 seconds. No whooshes, no risers, no cinematic impacts. If a sound is not matched to something physically moving on screen, it does not belong. Vary the keypress samples so typing does not sound looped.
- SFX analysis guidance: `~/.claude/skills/brag/assets/sfx/sfx-analysis.md` — prefer low high-frequency-risk files given the polished tone and the repeated badge clicks.
- Exact SFX choice: Hyperframes chooses filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copy the chosen music and any selected SFX into `brag-output/composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-cli`. /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions.

Requirements:
- Show at least one real UI element from the project — the preview panel in Scene 4 is mandatory, and the chunk cards with source badges in Scene 3.
- Keep all text readable: short labels hold ≥0.8s settled, the hook line holds ≥1.6s.
- Total duration 21s, within the 15-25s bound.
- Include the music and SFX layer.
- Choose SFX after the visual animation exists.
- Lock the three named strong cues within ±0.15s and mark them `// beat-locked`.
- Snap the four badge ignitions to every other beat within ±0.10s and mark them `// beat-grid`.
- Honor the final music fade-out so the closing claim sits in near-silence.
- Wire at least one visual element to audio RMS, subtly; document it if extraction is unavailable.
- Use local assets for audio and any runtime dependencies.
- Run `hyperframes check` before render — it is brag's single gate.
