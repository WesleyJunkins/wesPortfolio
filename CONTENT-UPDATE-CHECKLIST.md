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

---

## Phase 0 — Answers needed from Wes (VERIFY items, §4)

Collect these before or during the phases that need them. Record the answer inline.

- [ ] **ORCID public URL** — site currently uses the logged-in `my-orcid` link. The iD in that link is `0009-0000-1352-8160`, so the public URL should be `https://orcid.org/0009-0000-1352-8160`. Wes confirms: ______
- [ ] **STVM paper** — exact title, author order, archival or not, what can be shown publicly (ask Dr. Gilbert). Answer: ______
- [ ] **Publication venues** — (3) "It Wasn't As Bad As I Thought" venue + year; (4) PhysioBots venue; (5) PhysioML venue; (6) BCI Framework for Multi-Party Robot Applications venue. Answers: ______
- [ ] **SIGCSE reviewing year** — July 2025 reviewing is most likely for SIGCSE TS 2026, not 2025. Confirm: ______
- [ ] **Skills to confirm** — Unity? Swift? C/C++? Keep or cut each: ______
- [ ] **Quadruped vs. Wheeled Robots in K-12 STEM** — status/outcome: ______
- [ ] **hciXR** — is there real code? Keep as "Exploratory" or remove: ______
- [ ] **Quadruped Robotics & XR in Search and Rescue** — did it progress? Keep or remove: ______
- [ ] **Green Solvents REU / PTK Mental Health** — add the one-sentence mention to About, or drop entirely: ______

---

## Phase 1 — Head, metadata, privacy fixes (§3.1, §3.13, §4)

Small, mechanical, safe to do first. All in `index.html`.

- [ ] `<title>` → `Wesley Junkins — HCI PhD Researcher | Human-AI Interaction & Physiological Computing` (line ~16)
- [ ] `<meta name="description">` → "PhD researcher in human-AI interaction and physiological computing at the University of Florida. How sensing becomes meaning, and how we evaluate it for people." (≤ 160 chars) (line ~17)
- [ ] `og:title` and `twitter:title` → short form: `Wesley Junkins — HCI PhD Researcher · Human-AI Interaction & Physiological Computing · University of Florida` (lines ~23, ~32)
- [ ] `og:description` and `twitter:description` → identity line (trimmed) (line ~24 and twitter equivalent)
- [ ] Grep whole file for any remaining "University of Alabama graduate student" / "master's degree" / "pursuing" wording in meta/OG tags and remove
- [ ] **Remove phone number** `+1 (205) 463-7800` from the Links section (line ~205); keep email
- [ ] **Remove Facebook button** (line ~209)
- [ ] **Fix ORCID button** to the public profile URL (line ~212) — needs Phase 0 answer
- [ ] Check `site.webmanifest`, `sitemap.xml`, and `README.md` for the old title/description and update if present
- [ ] Wes reviews in browser → commit: "content: metadata, privacy, link fixes"

---

## Phase 2 — About (§3.2)

Replace the entire `#objective` section (both the third-person bio bubble and the Personal Statement bubble).

- [ ] Keep the existing headshot bubble (`data-images='["projectimages/wes.jpg"]'`) as the single About bubble
- [ ] Replace bio with the §3.2 draft: identity line paragraph → drone-origin paragraph → UF paragraph → first-gen/McKnight line (≤ 220 words total; check word count)
- [ ] Add the **Currently** list (4 bullets from §3.2)
- [ ] Optional one-sentence mention of chem-eng REU / community mental health research — only if Wes said yes in Phase 0
- [ ] **Delete the Personal Statement bubble entirely** (do not move it anywhere in the repo)
- [ ] Confirm the nav/mobile label for `objective` still reads "About"
- [ ] Wes reviews → commit: "content: rewrite About"

---

## Phase 3 — New Research section (§3.3)

- [ ] Add `<section id="research">` **before** `#projects` using the existing bubble markup pattern
- [ ] Content: intro line + three layers (**Sensing / Meaning / Evaluation**) each with its one-line project map, + "Application areas" line, per §3.3 draft
- [ ] Wire it into nav: add "Research" item (data-section="research") under the Research dropdown and in the mobile menu; confirm `index.js` section switching needs no change (it is driven by `data-section`)
- [ ] Note: the dropdown is already labeled "Research ▾" — decide whether the new section item is called "Research" or "Overview" inside it (Claude's recommendation: "Overview", first in the list)
- [ ] Wes reviews → commit: "content: add Research overview section"

---

## Phase 4 — Projects (§3.4)

Reorder, rewrite, prune `#projects`. Keep all `data-images` arrays intact for kept projects. Add a one-line status tag to each (Active / Published / Completed / Under review / Released / Archived).

**Featured (top three, in order):**
- [ ] 1. **BDR-XR: Brain-Drone Racing in Extended Reality** — *Active · 2026* — §3.4 blurb; **merge** the existing "Extended Reality Brain Drone Racing" entry into it; keep its 3 images
- [ ] 2. **Stateless Transparent Voting Machine** — *Published · EVT/WOTE 2026* — §3.4 blurb; images only after Phase 0 clearance
- [ ] 3. **Physiological Computing for K-12 Learning (PhysioBots · PhysioML)** — *Published · 2025* — §3.4 blurb (27 students, self-efficacy gains, three papers)

**Other projects (≤ 60 words each):**
- [ ] 4. **Brain-Drone Race (multi-party BCI architecture)** — *Completed · 2024* — trim current text; link the 2024 paper; keep 6 images
- [ ] 5. **Neuroevolution & Imitation Learning for UAV Path Following** — *Under review · ICRA 2027* — rewrite from "Circular Lap-Based…" entry using §3.4 text; keep 2 images
- [ ] 6. **Physiological Scripting Language (PSL)** — *Released · v0.1.0* — rewrite from "PhysioLab (proposed)" using §3.4 text; link to Downloads; keep 2 images
- [ ] 7. **Object Detection in XR (Apple Vision Pro)** — *Completed* — keep, trim
- [ ] 8. **Olfactory HCI** — *Completed* — keep, trim
- [ ] 9. **Quadruped vs. Wheeled Robots in K-12 STEM** — *Completed* — keep, trim; status per Phase 0
- [ ] 10. **Smart Controller App** (capstone) — *Completed · 2024* — trim to 3 sentences

**Remove or archive:**
- [ ] **hciXR** — remove, or relabel "Exploratory" per Phase 0
- [ ] **Quadruped Robotics & XR in Search and Rescue** — remove unless it progressed (Phase 0)
- [ ] **Green Solvents REU (2022)** — remove from Projects (keep image files in `projectimages/`)
- [ ] **Community College Mental Health (PTK)** — remove from Projects (keep image files)
- [ ] Grep the section for "proposed", "aim to", "plan to", "will" and clear every instance
- [ ] Confirm every kept project still shows its gallery ("View all N images") in the browser
- [ ] Wes reviews → commit: "content: reorder and rewrite Projects"

---

## Phase 5 — Publications (§3.5, §2 Publications)

- [ ] Add a **Google Scholar · ORCID** link pair at the top of `#publications`
- [ ] Reorder reverse-chronological per §2 and **bold Wes's name** in every author list
- [ ] Add status badge to each: Published / Accepted / Under review
- [ ] Add (1) **Stateless Transparent Voting Machine** — EVT/WOTE 2026, Accepted — title/authors from Phase 0
- [ ] Add (2) **Exploring Predefined Path Following via Neuroevolution and Imitation Learning** — ICRA 2027, Under review — **no link** to the embargoed thesis
- [ ] (3) "It Wasn't As Bad As I Thought" — fill venue + year from Phase 0
- [ ] (4) PhysioBots — Apr 2025 — venue from Phase 0; keep existing DOI/PDF link
- [ ] (5) PhysioML — Feb 2025 — venue from Phase 0; keep existing link
- [ ] (6) Towards a BCI Framework for Multi-Party Robot Applications — Apr 2024 — venue from Phase 0; keep existing link
- [ ] Add **Theses** subsection: M.S. thesis, UA, Aug 2026, "embargoed pending publication" (no PDF)
- [ ] Wes reviews → commit: "content: update Publications"

---

## Phase 6 — Experience (§3.6, §2 Research experience)

Rename section and rewrite entries with 2–4 outcome-oriented bullets each.

- [ ] Rename "Work Experience" → **"Experience"** in the Résumé dropdown and mobile menu (section id `work` can stay, or rename to `experience` and update all `data-section="work"` references — pick one and be consistent)
- [ ] **GRA, CFSG Lab, UF** (Aug 2026–**present**, not Aug 2027) — fill the currently-empty entry: STVM co-author (EVT/WOTE 2026), pen-test report review ("Hack It If You Can"), transparent-display voting prototype build, beginning dissertation work
- [ ] **GRA, HTIL, UA** (Jan 2025–Aug 2026) — BDR-XR study (n = 13, within-subjects, 3 conditions, TLX/IMI/SUS), wrote IRB protocol, mentored undergrad RAs, co-authored PhysioBots + PhysioML
- [ ] **Undergraduate RA, HTIL, UA** (May 2023–Jan 2025) — multi-party BCI architecture (Neurosity SDK), XR systems (Babylon.js, WebXR, AVP/Create ML), robotics integration (MQTT, ROS, sockets), olfactory XR prototype, Webots neuroevolution sim
- [ ] **Other experience:** IT Director, Mt. Pleasant Baptist Church, Gordo, AL (Oct 2020–present) — one line
- [ ] Wes reviews → commit: "content: rewrite Experience"

---

## Phase 7 — Education (§2 Education)

- [ ] **Ph.D., Human-Centered Computing**, UF, 2026–2030 (expected), advisor Juan E. Gilbert, CFSG Lab
- [ ] **M.S., Computer Science**, UA, conferred Aug 1, 2026 — thesis title, advisor Chris Crawford, committee (Anderson-Herzog, Gurbuz, He), one-line key finding, "embargoed pending publication (ICRA 2027)"
- [ ] **B.S., Computer Science, minor Mathematics**, UA, Dec 2024, summa cum laude, 4.0 GPA, Accelerated Master's Program (folded into this line)
- [ ] **A.S., General Studies**, Shelton State CC, 2022, 4.0 GPA — one line, no award list (awards move to Honors)
- [ ] **Remove** Bevill State dual-enrollment entry
- [ ] **Remove** Gordo High School entry
- [ ] Optional single line under PhD or MS: "Graduate coursework: Brain-Computer Interfaces, Reinforcement Learning, Artificial Intelligence, Autonomous Robotics, High-Performance Computing, UX Design, Natural Language Processing (Spring 2027)." — Wes decides: keep ☐ / drop ☐
- [ ] Wes reviews → commit: "content: tighten Education"

---

## Phase 8 — Honors, Societies, Coursework (§3.7, §3.8, §3.9)

**Honors — keep (fill the three empty 2026 fellowship entries with one sentence each):**
- [ ] McKnight Doctoral Fellowship, Florida Education Fund — 2026
- [ ] SEC Engineering Deans Fellowship, UF — 2026
- [ ] CEHPW Fellowship, UF — 2026
- [ ] Upsilon Pi Epsilon Outstanding Undergraduate Award, UA — 2024
- [ ] Community College Presidential Scholarship (full tuition), UA — 2022
- [ ] Coca-Cola Bronze Academic Team, Phi Theta Kappa — 2022
- [ ] Leo Sumner Outstanding Sophomore Award, Shelton State — 2022
- [ ] MacMillan Emerging Researcher Award, Psi Beta — 2022
- [ ] President's List every semester, 2020–2024 — one line

**Honors — cut from site (they stay in the CV PDF):**
- [ ] All-Alabama Academic Team
- [ ] Distinguished PTK Officer
- [ ] Thomas E. Umphrey Freshman Award
- [ ] Norman C. Cephus Award
- [ ] Excellence in Calculus
- [ ] Accelerated Master's Student (now part of the B.S. line)

**Societies / Coursework:**
- [ ] Add one line at the end of Honors: "Member: Tau Beta Pi, Phi Kappa Phi, Upsilon Pi Epsilon, Tau Sigma, Phi Theta Kappa (VP, Honors in Action), Psi Beta."
- [ ] **Delete `#societies` section** and its "Societies" nav + mobile items
- [ ] **Delete `#coursework` section** and its "Coursework" nav + mobile items
- [ ] Check `index.js` for any hard-coded reference to `societies` / `coursework` (e.g. default section lists) and remove
- [ ] Wes reviews → commit: "content: Honors rewrite; remove Societies and Coursework"

---

## Phase 9 — Service & Teaching (§3.10)

- [ ] Rename "Service" → **"Service & Teaching"** (nav, mobile, section heading)
- [ ] Reviewer, SIGCSE Technical Symposium — year per Phase 0 — 6 papers
- [ ] Instructor, RET Sensors Workshop, UA, Jun–Jul 2025 — 7-week workshop for middle/high-school teachers on sensors, microcontrollers, IoT (keep its 12 images)
- [ ] Volunteer, ICRA 2025 K-12 Workshop (Thinquebytes), Atlanta, May 2025
- [ ] Add: Mentored undergraduate research assistants, HTIL, 2025–2026
- [ ] Wes reviews → commit: "content: Service & Teaching"

---

## Phase 10 — New Skills section (§3.11, §2 Skills)

- [ ] Add `<section id="skills">` under the Résumé dropdown (nav + mobile item "Skills")
- [ ] Six groups, one line each: Research methods · Physiological computing / BCI · AI/ML · XR & robotics · Software · Communication (text in §2)
- [ ] Apply Phase 0 answers for Unity / Swift / C/C++
- [ ] Wes reviews → commit: "content: add Skills"

---

## Phase 11 — Downloads, Contact, Navigation pass (§3.12, §3.13, §3.14)

- [ ] Tighten the PSL blurb in `#downloads` to match the Phase 4 item 6 text — **do not touch** the release-lookup markup or JS
- [ ] Rename "My Links" → **"Contact"** (nav, mobile, section heading)
- [ ] Confirm Contact shows: email, LinkedIn, Google Scholar, GitHub, ORCID (public URL), ResearchGate, Résumé Documents — and nothing else
- [ ] Final nav audit — Résumé dropdown: Education, Experience, Honors & Awards, Skills. Research dropdown: Overview/Research, Projects, Publications, Service & Teaching. Top level: About, Contact, Downloads. Mobile menu mirrors this.
- [ ] Update `sitemap.xml` if it lists section anchors
- [ ] Wes reviews → commit: "content: Downloads blurb, Contact, nav labels"

---

## Phase 12 — Final sweep & QA

- [ ] Grep `index.html` for banned phrasing: "will pursue", "plans to", "aims to", "proposed", "planning phase", "we aim", "pursuing", "master's degree", "graduate student at The University of Alabama"
- [ ] Grep for third-person "Wesley is / He " outside author lists and fix to first person
- [ ] Word counts: About ≤ 220; featured blurbs ≤ 90; other projects ≤ 60
- [ ] Only four research tags appear anywhere: Human-AI Interaction · Physiological Computing & BCI · Health HCI · Trust & Evaluation of AI systems
- [ ] Browser check on desktop + phone width + Safari: every section opens from nav and mobile menu; every gallery still opens; Downloads card still fetches the latest PSL release; private `/archive` untouched
- [ ] Run the site's accessibility checks that were used in commits 625536f / 56d95dc (whatever Wes used) and confirm no regressions
- [ ] `git diff --stat 20ade11` — confirm `index.css` has **zero** changes
- [ ] Final commit + push → "content: complete content update per brief"

---

## Phase 13 — Outside the site edit (§5, §6) — tracked here so it isn't lost

- [ ] **Résumé PDF (1 page, industry)** rebuilt from §2 — identity line → Education → Research Experience → Selected Projects → Selected Publications (3) → Skills → Selected Honors
- [ ] **CV PDF (full, academic)** rebuilt from §2
- [ ] Replace the PDFs the "Résumé Documents" link points to; confirm the link works
- [ ] Update LinkedIn headline to the identity line / short form
- [ ] Later: case-study pages for the three featured projects (problem → approach → result → takeaway). New pages, no design changes.

---

## Session log

| Date | Computer | Phases touched | Stopped at | Notes |
|---|---|---|---|---|
| 2026-10-30 | (first) | — | Checklist created; nothing in the site edited yet | Baseline `20ade11` |
