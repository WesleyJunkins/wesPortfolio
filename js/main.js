/* =========================================================
   START-UP
   Runs once, last. Every other file in js/ only DEFINES things; this is
   the one place that calls them, in the order they depend on each other.
   To switch a feature off, remove its line here (and its <script> tag).
   ========================================================= */

randomizeLava();
initBackgrounds();
initDisplayMenu();
cloneOtherProjects();
renderProjectImages();
initA11y();
if (!a11yOn()) ensureGlass();
initNav();
initDropdowns();
initMobileNav();
initDownloads();
initResearchStory();
initShowcases();
initTilt();
showSection("about"); // default page
