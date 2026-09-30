document.querySelectorAll("a[data-placeholder]").forEach((link) => {
  link.addEventListener("click", (event) => event.preventDefault());
});

const videos = document.querySelectorAll("video[autoplay]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function respectMotionPreference() {
  videos.forEach((video) => {
    video.autoplay = !reducedMotion.matches;
    if (reducedMotion.matches) video.pause();
  });
}

respectMotionPreference();
reducedMotion.addEventListener("change", respectMotionPreference);
