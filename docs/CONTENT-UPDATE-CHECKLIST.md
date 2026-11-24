> Note (2026-11-23): this log predates the reorganisation of the site's files. Where it says `index.css` or `index.js`, the code now lives in `css/` and `js/` (see the README).

# Content Update Checklist — wesleyjunkins.com

Source brief: [wesleyjunkins-content-update.md](wesleyjunkins-content-update.md) (§ numbers below refer to it).
Started: 2026-10-30. Baseline commit before any content edits: `20ade11`.

## How to resume in a new session

1. Open this file and the brief. Tell Claude Code: "Continue the content update from CONTENT-UPDATE-CHECKLIST.md. Start at the first unchecked item in Phase N."
2. Work **one phase at a time**. Claude edits, Wes reviews in the browser, then the item gets checked off here and the phase gets committed.
3. Mark items like this: `- [ ]` not done · `- [x]` done · `- [~]` done but waiting on a VERIFY answer.
4. Update the **Session log** at the bottom before stopping.

## Standing rules (apply to every item — §0)

- Content only. **No changes to index.css, the backdrop, nav behavior, galleries, or the Downloads release lookup.** Sections may be added/removed in index.html; `index.js` is touched only if a removed/added section needs its `data-section` wiring.
- First person ("I") everywhere. Present tense for current work, past tense for completed.
- Wes is a **current** PhD student (started Aug 2026). MS is **conferred** (Aug 2026). No "will pursue / plans to / aims to / proposed / planning phase."
- Length: About ≤ 220 words. Featured project blurbs ≤ 90 words. Other projects ≤ 60 words.
- Use only facts from brief §2 or already on the site. Anything marked **[VERIFY]** waits for Wes.
- Do not commit the Personal Statement text anywhere (Wes keeps a local copy).
- Use Edit/Write tools (not shell rewrites) so changes can be rewound.
- Markup note: only `h3`, `h4`, `p`, and `a` are styled inside `.bubble`, so status tags go in an `h4` line and "bullets" are short `p` lines. No `ul`/`li` (they would render unstyled, and CSS may not change).

---

## ⚠ Open item: STVM paper (blocks nothing else)

Wes is talking to Dr. Gilbert before anything about the Stateless Transparent Voting Machine paper or prototype goes on the site. Every spot that will take it is marked `[~ STVM]` below and as an HTML comment in `index.html`. **Note for Wes:** the brief (`wesleyjunkins-content-update.md`) already names the paper, venue, and prototype details and was committed in `782a851`; if the repo is public, that text is already visible on GitHub.

---

## Phase 0 — Answers needed from Wes (VERIFY items, §4)

Collect these before or during the phases that need them. Record the answer inline.

- [x] **ORCID public URL** — site currently uses the logged-in `my-orcid` link. The iD in that link is `0009-0000-1352-8160`, so the public URL should be `https://orcid.org/0009-0000-1352-8160`. Wes confirms: **Confirmed (2026-10-31).**
- [ ] **STVM paper** — exact title, author order, archival or not, what can be shown publicly (ask Dr. Gilbert). Answer: **ON HOLD (2026-10-31) — Wes is talking to his advisor first. Nothing about the STVM paper or the voting prototype goes on the site until he clears it. Affected spots are marked `[~ STVM]` below.**
- [x] **Publication venues** — (3) "It Wasn't As Bad As I Thought" venue + year; (4) PhysioBots venue; (5) PhysioML venue; (6) BCI Framework for Multi-Party Robot Applications venue. Answers: **(3) SIGCSE TS 2026 — Proceedings of the 57th ACM Technical Symposium on Computer Science Education V. 1, https://doi.org/10.1145/3770762.3772531 (from Wes). (4) CHI EA '25, Yokohama — from the PDF in `papers/`. (5) SIGCSE TS 2025, 56th symposium — from the PDF. (6) ACM Southeast Conference (ACMSE) 2024, poster, Marietta GA — from the PDF.**
- [x] **SIGCSE reviewing year** — July 2025 reviewing is most likely for SIGCSE TS 2026, not 2025. Confirm: **TS 2026 (Wes, 2026-10-31).**
- [~] **Skills to confirm** — Unity? Swift? C/C++? Keep or cut each: **Wes: "I believe so, but cannot remember for sure." Kept on the site for now; Wes gives a final yes/no before the final commit.**
- [x] **Quadruped vs. Wheeled Robots in K-12 STEM** — status/outcome: **Removed — no known outcome and Wes is not pursuing it (2026-10-31). Restore from `20ade11` if he wants it back.**
- [x] **hciXR** — is there real code? Keep as "Exploratory" or remove: **Remove (Wes, 2026-10-31).**
- [x] **Quadruped Robotics & XR in Search and Rescue** — did it progress? Keep or remove: **Remove (Wes, 2026-10-31).**
- [x] **Green Solvents REU / PTK Mental Health** — add the one-sentence mention to About, or drop entirely: **Drop (Wes, 2026-10-31).**
- [x] **Graduate coursework line** (Phase 7 optional item): **Keep (Wes, 2026-10-31).**
- [x] **Structure choices** (Claude's recommendations, accepted 2026-10-31): keep section id `work`, change only the visible label to "Experience"; the new Research section is labeled **"Overview"** inside the Research dropdown.
- [~] **"It Wasn't As Bad As I Thought" author list** — the PDF in `papers/` is the anonymized submission, so no author line is on the site for that paper yet. Wes supplies the camera-ready author order.
- [~] **"First-generation college student"** — this phrase comes from the brief's §3.2 draft, not §2 facts. Wes confirms it is accurate before publishing.

---

## Phase 1 — Head, metadata, privacy fixes (§3.1, §3.13, §4)

Small, mechanical, safe to do first. All in `index.html`.

- [x] `<title>` → `Wesley Junkins — HCI PhD Researcher | Human-AI Interaction & Physiological Computing`
- [x] `<meta name="description">` → "PhD researcher in human-AI interaction and physiological computing at the University of Florida. How sensing becomes meaning, and how we evaluate it for people." (159 chars)
- [x] `og:title` and `twitter:title` → short form
- [x] `og:description` and `twitter:description` → identity line (trimmed)
- [x] `meta keywords` refreshed (no UA / master's wording left in the head)
- [x] **Removed phone number** from the Contact section; kept email (added "Gainesville, FL" in its place)
- [x] **Removed Facebook button**
- [x] **Fixed ORCID button** to `https://orcid.org/0009-0000-1352-8160`
- [x] `site.webmanifest` name/description updated; `sitemap.xml` lastmod → 2026-10-31; `README.md` had nothing to change
- [ ] Wes reviews in browser → commit: "content: metadata, privacy, link fixes"

---

## Phase 2 — About (§3.2)

- [x] Kept the headshot bubble (`data-images='["projectimages/wes.jpg"]'`) as the single About bubble
- [x] Replaced bio with the §3.2 draft, then reworded (2026-10-31, Wes's request) as a transition story: physiological computing + computing education at UA → human-AI interaction + physiological computing at UF. 221 words excluding the tag line and Currently list. Added the four research tags as an `h4` under the heading. Dr. Gilbert links to his Wikipedia page; the lab links to humancenteredcomputing.org.
- [x] Added the **Currently** list as one `p` with line breaks (3 items)
- [~ STVM] The STVM sentence in paragraph 3 and the STVM "Currently" bullet are left out. Paragraph 3 says "the lab's research on trustworthy civic technology" instead.
- [x] No REU / mental-health mention (Wes said drop)
- [x] **Deleted the Personal Statement bubble entirely**
- [x] Nav/mobile label for `objective` still reads "About"
- [ ] Wes reviews → commit: "content: rewrite About"

---

## Phase 3 — New Research section (§3.3)

- [x] Added `<section id="research">` **before** `#projects`, one bubble, page title "Research"
- [x] Content: intro line + **Sensing / Meaning / Evaluation** (bold layer name, italic project map) + "Application areas" line
- [~ STVM] Evaluation line omits the STVM example for now
- [x] Nav: "Overview" (data-section="research") is first in the Research dropdown and in the mobile menu; `index.js` needed no change (switching is driven by `data-section`)
- [ ] Wes reviews → commit: "content: add Research overview section"

---

## Phase 4 — Projects (§3.4)

Status tags are the `h4` line under each title. All `data-images` arrays for kept projects are unchanged.

- [x] 1. **BDR-XR: Brain-Drone Racing in Extended Reality** — *Active · 2026* — 77 words; merged the old "Extended Reality Brain Drone Racing" entry; 3 images kept
- [~ STVM] 2. **Stateless Transparent Voting Machine** — not added (on hold). HTML comment marks the slot.
- [x] 3. **Physiological Computing for K-12 Learning** — *Published · 2025 – 2026 · PhysioBots · PhysioML* — 62 words + links to the three papers
- [x] 4. **Brain-Drone Race** — *Completed · 2024 · Multi-party BCI architecture* — 49 words; links the ACMSE 2024 paper; 6 images kept
- [x] 5. **Neuroevolution & Imitation Learning for UAV Path Following** — *Under review · ICRA 2027 · M.S. thesis* — 43 words; 2 images kept
- [x] 6. **Physiological Scripting Language (PSL)** — *Released · Open source* — 29 words; links to Downloads via `data-section`; 2 images kept. (Version number deliberately not hard-coded; the Downloads card shows the live release.)
- [x] 7. **Object Detection in XR (Apple Vision Pro)** — *Completed · 2024* — 35 words; 3 images kept
- [x] 8. **Olfactory HCI** — *Completed · 2025* — 45 words; 2 images kept
- [x] 9. **Quadruped vs. Wheeled Robots in K-12 STEM** — removed (Phase 0)
- [x] 10. **Smart Controller App** — *Completed · 2024 · Capstone* — 47 words, 2 sentences
- [x] **hciXR** — removed
- [x] **Quadruped Robotics & XR in Search and Rescue** — removed
- [x] **Green Solvents REU (2022)** — removed from Projects (image files kept in `projectimages/ERN2022_project/`)
- [x] **Community College Mental Health (PTK)** — removed from Projects (image files kept in `projectimages/SSCCHIA_project/`)
- [x] Grep for "proposed", "aim to", "plan to", "will" — clear (the Neuroevolution entry keeps the brief's own "a sim-to-real follow-up is planned with the HTIL")
- [ ] Wes confirms every kept project still shows its gallery ("View all N images") in the browser
- [ ] Wes reviews → commit: "content: reorder and rewrite Projects"

---

## Phase 5 — Publications (§3.5, §2 Publications)

- [x] **Profiles** bubble at the top: Google Scholar · ORCID
- [x] Reverse-chronological; Wes's name bolded in every author list that is on the site
- [x] Status in each `h4`: Published / Under review
- [~ STVM] (1) **Stateless Transparent Voting Machine** — not added; HTML comment marks the slot
- [x] (2) **Exploring Predefined Path Following via Neuroevolution and Imitation Learning** — ICRA 2027, Under review — no link to the thesis
- [~] (3) "It Wasn't As Bad As I Thought" — SIGCSE TS 2026, DOI link + PDF; **author list missing** (PDF is anonymized; Wes supplies)
- [x] (4) PhysioBots — CHI EA '25 — authors: Lewis, Joshi, Ingram, **Junkins**, Crawford — DOI + PDF
- [x] (5) PhysioML — SIGCSE TS 2025 — authors: Hernández-Cuevas, Lewis, **Junkins**, Crawford, Denham, Luo — DOI + PDF
- [x] (6) Towards a BCI Framework for Multi-Party Robot Applications — ACMSE 2024 — authors: Lewis, **Junkins**, Setty, Crawford — DOI + PDF
- [x] **Theses** bubble: M.S. thesis, UA, Aug 2026, embargoed pending publication, advisor + committee (no PDF)
- [ ] Wes reviews → commit: "content: update Publications"

---

## Phase 6 — Experience (§3.6, §2 Research experience)

- [x] Label "Work Experience" → **"Experience"** in the Résumé dropdown, mobile menu, and page title. Section id stays `work`.
- [~ STVM] **GRA, CFSG Lab, UF** (Aug 2026 – **Present**) — filled with three safe lines (trustworthy civic technology, dissertation work, fellowships). The STVM co-author / pen-test review / prototype bullets are **not** on the site; HTML comment marks the spot.
- [x] **GRA, HTIL, UA** (Jan 2025 – Aug 2026) — BDR-XR study details, IRB protocol + study software + data collection, mentoring, three co-authored papers
- [x] **Undergraduate RA, HTIL, UA** (May 2023 – Jan 2025) — multi-party BCI architecture, XR systems + robotics integration, olfactory XR + Webots neuroevolution
- [x] **Other Experience:** IT Director, Mt. Pleasant Baptist Church (Oct 2020 – Present) — one line
- [ ] Wes reviews → commit: "content: rewrite Experience"

---

## Phase 7 — Education (§2 Education)

- [x] **Ph.D., Human-Centered Computing**, UF, Aug 2026 – May 2030 (expected), advisor, CFSG Lab, CISE
- [x] Graduate coursework line kept, under the Ph.D. entry, labeled "(UA and UF)" because the listed courses span both schools
- [x] **M.S., Computer Science**, UA, conferred Aug 1, 2026 — thesis (italic), defended June 2026, embargoed (ICRA 2027), advisor, committee, key finding
- [x] **B.S., Computer Science, minor in Mathematics**, UA, Dec 2024, summa cum laude, 4.0 GPA, Accelerated Master's Program folded in
- [x] **A.S., General Studies**, Shelton State, 2022, 4.0 GPA — title + date line only
- [x] **Removed** Bevill State dual-enrollment entry
- [x] **Removed** Gordo High School entry
- [ ] Wes reviews → commit: "content: tighten Education"

---

## Phase 8 — Honors, Societies, Coursework (§3.7, §3.8, §3.9)

**Honors — kept, in brief order, one sentence each:**
- [x] McKnight Doctoral Fellowship, Florida Education Fund — 2026
- [x] SEC Engineering Deans Fellowship, UF — 2026
- [x] CEHPW Fellowship, UF — 2026
- [x] Upsilon Pi Epsilon Outstanding Undergraduate Award, UA — 2024
- [x] Community College Presidential Scholarship (full tuition), UA — 2022
- [x] Coca-Cola Bronze Academic Team, Phi Theta Kappa — 2022
- [x] Leo Sumner Outstanding Sophomore Award, Shelton State — 2022
- [x] MacMillan Emerging Researcher Award, Psi Beta — 2022 (title now matches the brief; the old site called it "Emerging Researcher Award")
- [x] President's List every semester, 2020 – 2024 — one line

**Honors — the brief's cut list, restored 2026-10-31 at Wes's request:**
- [x] All-Alabama Academic Team · Distinguished PTK Officer · Thomas E. Umphrey Freshman Award · Norman C. Cephus Award · Excellence in Calculus — back on the site as one **"Earlier Honors"** bubble at the bottom of the Honors page (one `h4` + one line each, links kept). Accelerated Master's Student stays folded into the B.S. line in Education.

**Societies / Coursework:**
- [x] "Honor Societies" bubble at the end of Honors: "Member: Tau Beta Pi, Phi Kappa Phi, Upsilon Pi Epsilon, Tau Sigma, Phi Theta Kappa (Vice President, Honors in Action), Psi Beta."
- [x] **Deleted `#societies` section** and its nav + mobile items
- [x] **Deleted `#coursework` section** and its nav + mobile items
- [x] `index.js` has no hard-coded reference to `societies` / `coursework` (only `showSection("objective")` as the default)
- [ ] Wes reviews → commit: "content: Honors rewrite; remove Societies and Coursework"

---

## Phase 9 — Service & Teaching (§3.10)

- [x] Renamed "Service" → **"Service & Teaching"** (nav, mobile, page title)
- [x] Reviewer, SIGCSE Technical Symposium 2026 — July 2025 — six submissions
- [x] Instructor, RET Sensors Workshop, UA, Jun – Jul 2025 — tightened; 12 images kept
- [x] Volunteer, ICRA 2025 K-12 Workshop (Thinquebytes), Atlanta, May 2025 — tightened; links kept
- [x] Added: Undergraduate Research Mentor, HTIL, 2025 – 2026
- [ ] Wes reviews → commit: "content: Service & Teaching"

---

## Phase 10 — New Skills section (§3.11, §2 Skills)

- [x] Added `<section id="skills">` (placed where Societies/Coursework were); "Skills" item in the Résumé dropdown + mobile menu
- [x] Six bubbles: Research Methods · Physiological Computing & BCI · AI / ML · XR & Robotics · Software · Communication
- [~] Unity, Swift, C/C++ are listed pending Wes's final yes/no (Phase 0)
- [ ] Wes reviews → commit: "content: add Skills"

---

## Phase 11 — Downloads, Contact, Navigation pass (§3.12, §3.13, §3.14)

- [x] PSL blurb in `#downloads` now matches the Projects entry; release-lookup markup and JS untouched
- [x] Renamed "My Links" → **"Contact"** (nav, mobile, bubble heading)
- [x] Contact shows: email + Gainesville, FL line; buttons Email, LinkedIn, Google Scholar, GitHub, ORCID (public URL), ResearchGate, Resumé Documents — nothing else
- [x] Final nav (reorganised 2026-10-31 at Wes's request) — top level: **About · Research · Projects · Publications · Downloads · CV ▾**. CV ▾: Experience, Education, Skills, Honors, Service & Teaching. Mobile menu mirrors it. **Contact is no longer a page:** its bubble sits on the About page under the About bubble (the `#contact` section and nav items are gone). Publications lost its "Profiles" bubble (Scholar/ORCID are on the Contact bubble) and the Theses bubble was merged into the ICRA 2027 entry. Section ids renamed to match the labels: `objective` → `about`, `links` → `contact`, `work` → `experience` (default page in `index.js` is now `about`). Contact's document button now reads **"CV"** — Wes replaces its Notion href with the CV PDF. Because the bar has seven pills, the name text hides below 1080px and the hamburger now takes over at 860px (was 720px).
- [x] `sitemap.xml` has no section anchors; only lastmod updated
- [ ] Wes reviews → commit: "content: Downloads blurb, Contact, nav labels"

---

## Phase 12 — Final sweep & QA

- [x] Grep `index.html` for banned phrasing: "will pursue", "plans to", "aims to", "proposed", "planning phase", "we aim", "pursuing", "master's degree", "graduate student at" — none left
- [x] Grep for third-person "Wesley is / He / His" — none left (outside author lists)
- [x] Word counts: About 208 (≤ 220, excluding tag line + Currently); featured blurbs 77 and 62 (≤ 90); others 29 – 49 (≤ 60)
- [x] Research tags: Wes dropped **Health HCI** (2026-10-31) because no work on the site backs it; three tags remain (Human-AI Interaction · Physiological Computing & BCI · Trust & Evaluation of AI Systems) in the About `h4`, Research `h4`, and meta keywords. Health stays only as an application area in the Research section.
- [x] Every `data-section` has a matching `<section id>` and vice versa (11 sections)
- [x] HTML tag balance checked with a parser — no unclosed or mismatched tags
- [x] `git diff --stat` — `index.css` and `index.js` had **zero** changes from the content work. **Exception, 2026-10-31, at Wes's request:** a design tweak touched both — `--lava-dim: 0.48` (new token; `.lava { opacity }`) darkens the lava, `--lg-frost` 0.05 → 0.07 and `.bubble` fallback blur 2.5px → 4px add a touch of frost, and `TUNING.outputBlur` 0.5 → 1.6 in `index.js` adds the same frost to the Chromium refraction. Commit these separately: "design: dim lava, add light frost". **Also (2026-10-31):** a lamp glow — `<span class="lava__glow">` in `index.html` (sibling of `.lava__field`) and its rule in `index.css` after the `lava-now` keyframes: a faint radial pool of the live lava colour at the bottom-centre edge, same colour cycle and seed as the blobs and nav. Knobs: `--glow` (strength), width/height (spread). Bumped 2026-10-31: `--glow` 0.55 → 0.85, 95vw×42vh → 110vw×52vh, mid-stop 45% → 55%. **Also (2026-10-31):** slower lava. Drift 400–520s → 600–780s per orbit (`randomizeLava` in `index.js`, plus the inline defaults in `index.html`); colour cycle 120s → 240s everywhere (`lava-color`, both `lava-now` animations, the `--color-delay` seed range); touch path 90s/90s → 135s/180s. **Also (2026-10-31):** slightly thicker text — `body { font-weight: 500 }` (was the 400 default) and `.bubble h4` 600 → 650 in `index.css`. **Also (2026-10-31):** bigger gallery covers — `.gallery-modal-stage` centre cover 640×480 max → 960×720 max (72vw × 66vh), side offsets scaled up to match, modal/stage max width 1280 → 1500px; phones 74vw×46vh → 86vw×52vh. **Light mode was tried and dropped (2026-10-31):** a full `prefers-color-scheme: light` theme plus a shaded 3D lava filter were built, but the lava never looked right on white, so Wes decided the site is **dark-only by design**. Everything light-mode was removed; the only trace is `<meta name="color-scheme" content="dark">` so browser UI matches. If light mode ever comes back, the approach that worked best was SVG lighting (feDiffuseLighting + feSpecularLighting on the goo alpha) with a drop shadow; see git history for the attempt.
- [ ] **Wes:** browser check on desktop + phone width + Safari: every section opens from nav and mobile menu; every gallery still opens; the PSL "Get PSL on the Downloads page" link switches pages; Downloads card still fetches the latest PSL release
- [ ] **Wes:** run the accessibility checks used in commits 625536f / 56d95dc and confirm no regressions
- [ ] Final commit + push → "content: complete content update per brief"

---

## Research overview scroll story (2026-10-31, Wes's request; replaced the click-tree)

- [x] `#research` is a scroll-driven story: a tall `.story` with a sticky 100vh `.story__stage`; scroll progress scrubs a paused Web Animations timeline (`initResearchStory()` in `index.js`; styles under "RESEARCH OVERVIEW" in `index.css`). Beats: Human-Centered Computing orb alone → Physiological Computing + Human-AI Interaction emerge from behind it → a line joins them and drops to the "Where they meet" card → card leaves, Sensing pops out of Physio with its card → Meaning + Evaluation pop out of HAI with their card → cards and parents fade, the three leaves line up with lines 1→2→3, and the summary card (no project references) rises. Scrolling back reverses everything. Orbs are glass surfaces; motion is translate + opacity only. Accessibility mode shows the same content as a static column.
- [x] No "Research" page title on this page; `.story` cancels `main`'s top/bottom padding (now `--main-top` / `--main-bottom` on `main`) so the stage fills the viewport on arrival and the "Scroll" cue is visible without scrolling.
- [ ] Wes checks: the hold at the top ("Scroll" hint), each beat on desktop, phone width, a short laptop window (`max-height: 760px` shrinks the orbs), Safari, accessibility mode.
- [ ] Tuning knobs: `T` (timings) and `P` (positions) at the top of `build()` in `index.js`; `--beats` (scroll length) and `--o-*` (orb sizes) on `.story` in `index.css`.
- [ ] Commit: "feat: research overview scroll story"

---

## RAM / performance pass (2026-10-31, Wes's request; no visual change)

- [x] **Thumbnails:** `projectimages/thumbs/` holds a 640px-short-side WebP for every gallery image (32 files, 1.9 MB total). `thumbFor()` in `index.js` points the page thumbnails at them, with an `onerror` fallback to the original. Galleries still open the originals. Regenerate after adding images: `python3 -I tools/make-thumbs.py`.
- [x] **Lazy gallery slides:** the modal assigns an image `src` only to covers in the fan (centre ± 4) as `show()` runs; far covers stay unloaded until they step in, then stay loaded.
- [x] **Slide layers:** `will-change: transform` now applies only to covers in the fan (`.gallery-modal-slide:not([data-pos^="far"])`), not every slide.
- [ ] Wes checks: thumbnails look identical, every gallery opens and steps through all images, the fly-in/out animation still lands on the thumbnail.
- [ ] Commit: "perf: webp thumbnails, lazy gallery slides"

---

## Phase 13 — Outside the site edit (§5, §6) — tracked here so it isn't lost

- [ ] **Résumé PDF (1 page, industry)** rebuilt from §2 — identity line → Education → Research Experience → Selected Projects → Selected Publications (3) → Skills → Selected Honors
- [ ] **CV PDF (full, academic)** rebuilt from §2
- [ ] Replace the PDFs the "Resumé Documents" link points to; confirm the link works
- [ ] Update LinkedIn headline to the identity line / short form
- [ ] Later: case-study pages for the three featured projects (problem → approach → result → takeaway). New pages, no design changes.
- [ ] Once the STVM paper is cleared: add it to About (paragraph 3 + Currently), Research (Evaluation line), Projects (featured #2), Publications (top), and Experience (UF GRA bullets). Search `index.html` and this file for `STVM`.

---

## Phase 14 — SEO & discoverability (added 2026-10-31 at Wes's request)

Goal: be as findable as a one-page personal site can be for "Wesley Junkins", "Human-Centered Computing", "Human-Computer Interaction", and the UF/lab/project terms, and be fully open to search engines, AI crawlers, and agents.

- [x] `<head>`: description and OG/Twitter descriptions now name both "Human-Centered Computing" and "human-computer interaction (HCI)"; keywords expanded; `og:type` → `profile` with first/last name; `og:locale`, image alt tags, `og:site_name`
- [x] Robots meta: `index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1` for robots, googlebot, bingbot
- [x] `rel="me"` identity links to LinkedIn, Scholar, GitHub, ORCID, ResearchGate; `rel="author"` → ORCID
- [x] JSON-LD structured data: `WebSite` + `ProfilePage` + `Person` (affiliation, alumniOf, knowsAbout, awards, sameAs) + four `ScholarlyArticle` entries with DOIs. **No STVM.** Keep in sync with Publications/Honors.
- [x] About page now has `<h1 class="page-title">Wesley Junkins</h1>` like every other page (first visible H1 is the name). Remove if Wes dislikes the look.
- [x] Research overview opens with "My work sits in human-centered computing and human-computer interaction (HCI)." so the exact phrases appear in body text
- [x] `robots.txt` rewritten: allow all, crawl-delay removed, 25 AI/search crawlers listed explicitly (`/archive` later removed from the site entirely, so no exclusions remain)
- [x] `llms.txt` added (llmstxt.org convention): plain-text summary for language models; also listed in the sitemap
- [x] `sitemap.xml`: image entry for the headshot; llms.txt entry
- [ ] **Wes, off-site (these move the needle most):** add the site URL to the Google Scholar profile homepage field, ORCID "Websites" section, GitHub profile, LinkedIn contact info, ResearchGate; ask that the UF CISE people directory and the CFSG lab roster link to wesleyjunkins.com; register the domain in Google Search Console and Bing Webmaster Tools and submit the sitemap (add their verification meta tags to `<head>` when you have them)
- [ ] **Optional, needs a JS change (outside this content brief):** hash routing so each section is a real URL (`/#projects`, `/#publications`) that can be linked, shared, and indexed on its own; and gallery `img.alt` derived from the bubble title instead of the generic "Project image"
- [ ] Wes reviews → commit: "seo: structured data, robots, llms.txt, metadata"

---

## Session log

| Date | Computer | Phases touched | Stopped at | Notes |
|---|---|---|---|---|
| 2026-10-30 | (first) | — | Checklist created; nothing in the site edited yet | Baseline `20ade11` |
| 2026-10-31 | (first) | 0 – 12 | All content edits done, **uncommitted**, awaiting Wes's browser review | STVM held back everywhere; Skills Unity/Swift/C++ provisional; SIGCSE 2026 paper has no author line yet |
