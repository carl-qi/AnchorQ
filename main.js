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

const resultTasks = {
  "stack-cups": "Stack Cups",
  "toast-bread": "Toast Bread",
  "hang-towel": "Hang Towel",
};
const resultMethods = {
  anchorq: "AnchorQ",
  pi05: "π₀.₅",
  dsrl: "DSRL",
};
const resultsVideo = document.querySelector("#results-video");
const taskLinks = document.querySelectorAll("[data-results-task]");
const methodLinks = document.querySelectorAll("[data-results-method]");
const resultsStatus = document.querySelector("#results-status");
const resultsDownload = document.querySelector("#results-download");
let selectedTask = "stack-cups";
let selectedMethod = "anchorq";

function resultPath(task, method, extension = "mp4") {
  return `./media/results/${task}-${method}.${extension}`;
}

function updateResults() {
  resultsVideo.pause();
  resultsVideo.poster = resultPath(selectedTask, selectedMethod, "jpg");
  resultsVideo.querySelector('source[type^="video/mp4"]').src =
    resultPath(selectedTask, selectedMethod);
  resultsVideo.querySelector('source[type^="video/webm"]').src =
    resultPath(selectedTask, selectedMethod, "webm");
  resultsDownload.href = resultPath(selectedTask, selectedMethod);
  resultsVideo.setAttribute(
    "aria-label",
    `${resultTasks[selectedTask]} with ${resultMethods[selectedMethod]}: 20 trials. Green borders indicate success and red borders indicate failure.`,
  );

  taskLinks.forEach((link) => {
    const task = link.dataset.resultsTask;
    link.href = resultPath(task, selectedMethod);
    if (task === selectedTask) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
  methodLinks.forEach((link) => {
    const method = link.dataset.resultsMethod;
    link.href = resultPath(selectedTask, method);
    if (method === selectedMethod) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });

  resultsStatus.textContent =
    `Showing ${resultMethods[selectedMethod]} on ${resultTasks[selectedTask]}.`;
  resultsVideo.autoplay = !reducedMotion.matches;
  resultsVideo.load();
  if (!reducedMotion.matches) {
    resultsVideo.play().catch(() => {
      // Native controls remain available if autoplay is blocked.
    });
  }
}

function selectsInPlace(event) {
  return event.button === 0 &&
    !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

taskLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    if (!selectsInPlace(event)) return;
    event.preventDefault();
    if (selectedTask === link.dataset.resultsTask) return;
    selectedTask = link.dataset.resultsTask;
    updateResults();
  });
});

methodLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    if (!selectsInPlace(event)) return;
    event.preventDefault();
    if (selectedMethod === link.dataset.resultsMethod) return;
    selectedMethod = link.dataset.resultsMethod;
    updateResults();
  });
});
