(() => {
  const section = document.querySelector('.simulation-section');
  if (!section) return;
  const methods = [
    { id: 'pi05', label: 'π₀.₅', color: '#626975', ink: '#3e4653' },
    { id: 'dsrl', label: 'DSRL', color: '#d49146', ink: '#8a511b' },
    { id: 'anchorq', label: 'AnchorQ', color: '#14977c', ink: '#076b56' },
  ];
  const taskSVG = section.querySelector('#sim-task-plot');
  const averageSVG = section.querySelector('#sim-average-plot');
  const taskScroll = section.querySelector('.sim-task-scroll');
  const chart = section.querySelector('.sim-chart');
  const tooltip = section.querySelector('#sim-tooltip');
  const taskSelect = section.querySelector('#sim-video-task');
  const checkpointSlider = section.querySelector('#sim-video-checkpoint');
  const playButton = section.querySelector('#sim-play-pair');
  const replayButton = section.querySelector('#sim-replay-pair');
  const status = section.querySelector('#sim-video-status');
  const videoMethods = ['dsrl', 'anchorq'];
  const pair = videoMethods.map(method => section.querySelector(`#sim-${method}-video`));
  let suite = 'libero15';
  let checkpoint = 500000;
  let videoTask = 81;
  let focusedTarget = null;
  let mediaGeneration = 0;
  let loadingPair = false;
  let mediaAbort = new AbortController();

  const escape = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const number = value => Number(value.toFixed(1)).toString();
  const score = value => `${number(value[0])} ± ${number(value[1])}%`;
  const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);
  const result = () => simulationData.suites[suite].results[checkpoint];
  const y = value => 234 - Math.max(0, Math.min(100, value)) * 2.04;

  function grid(width, left) {
    return [0, 25, 50, 75, 100].map(tick => `
      <line x1="${left}" x2="${width - 6}" y1="${y(tick)}" y2="${y(tick)}" stroke="${tick ? '#e4e9e6' : '#adbab1'}" />
      <text x="${left - 7}" y="${y(tick) + 4}" text-anchor="end">${tick}</text>`).join('');
  }

  function bars(values, center, width, showValues = false) {
    const gap = showValues ? 7 : 2;
    const start = center - (3 * width + 2 * gap) / 2;
    return methods.map((method, index) => {
      const [mean, sem] = values[method.id];
      const x = start + index * (width + gap);
      const mid = x + width / 2;
      const low = Math.max(0, mean - sem), high = Math.min(100, mean + sem);
      return `
        <rect class="sim-bar" data-method="${method.id}" data-mean="${mean}" data-sem="${sem}"
          x="${x}" y="${y(mean)}" width="${width}" height="${234 - y(mean)}" rx="2.5" fill="${method.color}" />
        ${sem > 0 ? `<path d="M${mid} ${y(low)}V${y(high)}M${mid - 3} ${y(low)}h6M${mid - 3} ${y(high)}h6" fill="none" stroke="${method.ink}" stroke-width="1.2"/>` : ''}
        ${showValues ? `<text class="sim-value" style="fill:${method.ink}" x="${mid}" y="${y(high) - 8}" text-anchor="middle">${number(mean)}</text>` : ''}`;
    }).join('');
  }

  function hideTooltip() {
    if (focusedTarget) focusedTarget.removeAttribute('aria-describedby');
    focusedTarget = null;
    tooltip.hidden = true;
  }

  function showTooltip(target, pointer) {
    hideTooltip();
    focusedTarget = target;
    const id = target.dataset.simTask;
    const average = id === 'average';
    const task = simulationData.suites[suite].tasks.find(item => item.id === Number(id));
    const values = average ? result().average : result().tasks[id];
    tooltip.innerHTML = `<strong>${average ? 'Average across all tasks' : `Task ${id}`}</strong>
      <p>${average ? escape(simulationData.suites[suite].label) : escape(capitalize(task.name))}</p>
      <dl>${methods.map(method => `<dt>${method.label}</dt><dd>${score(values[method.id])}</dd>`).join('')}</dl>`;
    tooltip.hidden = false;
    target.setAttribute('aria-describedby', tooltip.id);
    const bounds = chart.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    const x = pointer ? pointer.clientX : targetBounds.left + targetBounds.width / 2;
    const top = pointer ? pointer.clientY : targetBounds.top;
    tooltip.style.left = `${Math.max(10, Math.min(bounds.width - tooltip.offsetWidth - 10, x - bounds.left - tooltip.offsetWidth / 2))}px`;
    tooltip.style.top = `${Math.max(10, top - bounds.top - tooltip.offsetHeight - 12)}px`;
  }

  function renderPlot() {
    hideTooltip();
    const data = simulationData.suites[suite];
    const values = result();
    const width = Math.max(650, taskScroll.clientWidth);
    const left = 36, band = (width - left - 8) / data.tasks.length;
    const barWidth = Math.min(14, (band - 10) / 3 - 2);
    taskSVG.setAttribute('viewBox', `0 0 ${width} 280`);
    taskSVG.setAttribute('width', width);
    taskSVG.innerHTML = grid(width, left) + data.tasks.map((task, index) => {
      const center = left + (index + .5) * band;
      const description = `Task ${task.id}: ${task.name}. ` + methods.map(method => `${method.label}: ${score(values.tasks[task.id][method.id])}`).join('; ');
      return `<g class="sim-task-target" tabindex="0" role="button" data-sim-task="${task.id}" aria-label="${escape(description)}">
        ${bars(values.tasks[task.id], center, barWidth)}
        <text class="sim-task-label" x="${center}" y="258" text-anchor="middle">${task.id}</text>
        <rect class="sim-hit" x="${left + index * band + 1}" y="16" width="${band - 2}" height="250" rx="4"/>
      </g>`;
    }).join('');
    taskSVG.setAttribute('aria-label', `${data.label}, per-task success at ${checkpoint / 1000}k environment steps`);

    const averageWidth = Math.max(120, averageSVG.getBoundingClientRect().width);
    const averageLeft = 27;
    const averageCenter = averageLeft + (averageWidth - averageLeft - 5) / 2;
    const averageBarWidth = Math.min(38, (averageWidth - averageLeft - 24) / 3);
    averageSVG.setAttribute('viewBox', `0 0 ${averageWidth} 280`);
    averageSVG.innerHTML = grid(averageWidth, averageLeft) + `
      <g class="sim-task-target" tabindex="0" role="button" data-sim-task="average"
        aria-label="${escape('Average: ' + methods.map(method => `${method.label}: ${score(values.average[method.id])}`).join('; '))}">
        ${bars(values.average, averageCenter, averageBarWidth, true)}
        <rect class="sim-hit" x="${averageLeft}" y="12" width="${averageWidth - averageLeft - 3}" height="244" rx="4"/>
      </g>`;
    section.querySelector('#sim-average-caption').textContent = `All ${data.tasks.length} tasks`;
    section.querySelectorAll('[data-sim-suite]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.simSuite === suite)));
    section.querySelectorAll('[data-sim-budget]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.simBudget) === checkpoint)));
    checkpointSlider.value = String(checkpoint);
    checkpointSlider.setAttribute('aria-valuetext', `${checkpoint / 1000}k steps`);
    checkpointSlider.style.setProperty('--sim-progress', `${(checkpoint - 100000) / 4000}%`);
    section.querySelector('#sim-checkpoint-value').value = `${checkpoint / 1000}k`;
  }

  [taskSVG, averageSVG].forEach(svg => {
    svg.addEventListener('pointermove', event => {
      const target = event.target.closest('[data-sim-task]');
      if (target && event.pointerType !== 'touch') showTooltip(target, event);
    });
    svg.addEventListener('pointerleave', () => {
      if (!svg.contains(document.activeElement)) hideTooltip();
    });
    svg.addEventListener('focusin', event => {
      const target = event.target.closest('[data-sim-task]');
      if (target) showTooltip(target);
    });
    svg.addEventListener('focusout', hideTooltip);
    svg.addEventListener('click', event => {
      const target = event.target.closest('[data-sim-task]');
      if (target) showTooltip(target);
    });
    svg.addEventListener('keydown', event => {
      if (event.key === 'Escape') hideTooltip();
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const target = event.target.closest('[data-sim-task]');
        if (target) showTooltip(target);
      }
    });
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('[data-sim-task]')) hideTooltip();
  });
  taskScroll.addEventListener('scroll', hideTooltip);

  function mediaPath(method, extension) {
    return `./media/simulation/task-${String(videoTask).padStart(3, '0')}/${checkpoint / 1000}k/${method}.${extension}`;
  }
  function syncPlaybackButton() {
    if (loadingPair) return;
    const playing = pair.some(video => !video.paused && !video.ended);
    playButton.textContent = playing ? 'Pause both' : pair.every(video => video.ended) ? 'Replay both' : 'Play both';
  }
  function updateVideos() {
    mediaGeneration++;
    mediaAbort.abort();
    mediaAbort = new AbortController();
    loadingPair = false;
    playButton.disabled = false;
    const task = simulationData.suites.libero15.tasks.find(item => item.id === videoTask);
    taskSelect.value = String(videoTask);
    section.querySelector('#sim-task-description').textContent = `Task ${videoTask}: ${capitalize(task.name)}.`;
    pair.forEach((video, index) => {
      const method = videoMethods[index];
      video.pause();
      video.preload = 'none';
      video.poster = mediaPath(method, 'jpg');
      video.querySelector('source[type="video/mp4"]').src = mediaPath(method, 'mp4');
      video.querySelector('source[type="video/webm"]').src = mediaPath(method, 'webm');
      video.querySelector('a').href = mediaPath(method, 'mp4');
      video.setAttribute('aria-label', `${method === 'dsrl' ? 'DSRL' : 'AnchorQ with adaptive particle tilting'}: ${task.name}, ${checkpoint / 1000}k checkpoint.`);
      section.querySelector(`#sim-${method}-step`).textContent = `${checkpoint / 1000}k`;
      video.load();
    });
    status.textContent = `DSRL and AnchorQ rollouts for task ${videoTask} near ${checkpoint / 1000}k environment steps.`;
    syncPlaybackButton();
  }
  function changeCheckpoint(value) {
    checkpoint = Number(value);
    renderPlot();
    updateVideos();
  }
  section.querySelectorAll('[data-sim-suite]').forEach(button => button.addEventListener('click', () => {
    suite = button.dataset.simSuite;
    renderPlot();
  }));
  section.querySelectorAll('[data-sim-budget]').forEach(button => button.addEventListener('click', () => changeCheckpoint(button.dataset.simBudget)));
  checkpointSlider.addEventListener('input', () => changeCheckpoint(checkpointSlider.value));
  taskSelect.innerHTML = simulationData.suites.libero15.tasks.map(task => `<option value="${task.id}">${task.id} · ${escape(capitalize(task.name))}</option>`).join('');
  taskSelect.addEventListener('change', () => {
    videoTask = Number(taskSelect.value);
    updateVideos();
  });

  function ready(video, signal) {
    if (video.readyState >= 3) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        video.removeEventListener('canplay', loaded);
        video.removeEventListener('error', failed);
        signal.removeEventListener('abort', cancelled);
      };
      const loaded = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('Video could not be loaded.')); };
      const cancelled = () => { cleanup(); reject(new Error('Selection changed.')); };
      video.addEventListener('canplay', loaded);
      video.addEventListener('error', failed);
      signal.addEventListener('abort', cancelled, { once: true });
      video.preload = 'auto';
      video.load();
    });
  }
  async function playPair(restart = false) {
    if (loadingPair) return;
    const generation = mediaGeneration;
    loadingPair = true;
    playButton.disabled = true;
    playButton.textContent = 'Loading…';
    try {
      await Promise.all(pair.map(video => ready(video, mediaAbort.signal)));
      if (generation !== mediaGeneration) return;
      if (restart || pair.some(video => video.ended)) pair.forEach(video => { video.currentTime = 0; });
      await Promise.all(pair.map(video => video.play()));
    } catch (error) {
      if (generation === mediaGeneration) {
        pair.forEach(video => video.pause());
        status.textContent = 'The comparison could not start. Use either video’s playback controls to try again.';
      }
    } finally {
      if (generation === mediaGeneration) {
        loadingPair = false;
        playButton.disabled = false;
        syncPlaybackButton();
      }
    }
  }
  playButton.addEventListener('click', () => {
    if (pair.some(video => !video.paused && !video.ended)) pair.forEach(video => video.pause());
    else playPair();
  });
  replayButton.addEventListener('click', () => {
    pair.forEach(video => video.pause());
    playPair(true);
  });
  pair.forEach(video => ['play', 'pause', 'ended'].forEach(event => video.addEventListener(event, syncPlaybackButton)));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pair.forEach(video => video.pause());
  });
  let resizeFrame;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(renderPlot);
  });
  renderPlot();
  updateVideos();
})();
