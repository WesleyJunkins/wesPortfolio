/* =========================================================
   DOWNLOADS — live version, OS highlight, copy button
   Markup is described in the DOWNLOADS comment in index.html. Everything
   here is best effort: links are static GitHub "latest release" permalinks,
   so the page works with none of this.
   ========================================================= */
function initDownloads() {
  const ua = navigator.userAgent || "";
  // Browsers can't tell Apple Silicon from Intel, so both Mac links light
  // up. iPhone/iPad UAs contain "Mac OS X" and Android ones contain "Linux";
  // neither can run the binaries, so they're excluded.
  const os = /Macintosh/.test(ua) && !/iPhone|iPad/.test(ua) ? "mac"
    : /Linux/.test(ua) && !/Android/.test(ua) ? "linux"
    : null;

  document.querySelectorAll(".download-card").forEach((card) => {
    // Highlight the visitor's OS with the same glow the nav uses for the
    // current page. aria-label tells screen-reader users which ones match.
    if (os) {
      card.querySelectorAll(`.download-card__platform[data-os="${os}"]`).forEach((a) => {
        a.classList.add("is-current");
        a.setAttribute("aria-label", `${a.textContent.trim()} (matches your system)`);
      });
    }

    // Copy the install command. navigator.clipboard needs a secure context
    // (https or localhost); the button just stays quiet elsewhere.
    card.querySelectorAll(".download-card__copy").forEach((btn) => {
      const code = btn.parentElement?.querySelector("code");
      if (!code || !navigator.clipboard) return;
      const label = btn.textContent;
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(code.textContent.trim()).then(() => {
          btn.textContent = "Copied";
          setTimeout(() => (btn.textContent = label), 1500);
        }).catch(() => {});
      });
    });

    // Latest release tag (one unauthenticated API call; GitHub allows 60 per
    // hour per visitor IP). Fails silently for a private repo, offline, or
    // when rate-limited — the version span simply stays empty.
    const repo = (card.dataset.ghRepo || "").trim();
    const version = card.querySelector(".download-card__version");
    if (!version || !/^[\w.-]+\/[\w.-]+$/.test(repo) || typeof fetch !== "function") return;
    fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((rel) => { if (rel?.tag_name) version.textContent = rel.tag_name; })
      .catch(() => {});
  });
}
