const state = {
  experience: null,
  sessionId: '',
  currentTab: 'entry',
  trackIndex: 0,
  audio: null
};

const elements = {
  statusText: document.getElementById('status-text'),
  sessionPill: document.getElementById('session-pill'),
  entryCopy: document.getElementById('entry-copy'),
  entryButton: document.getElementById('entry-button'),
  demoEntry: document.getElementById('demo-entry'),
  resetDemo: document.getElementById('reset-demo'),
  detailEyebrow: document.getElementById('detail-eyebrow'),
  detailTitle: document.getElementById('detail-title'),
  detailVintage: document.getElementById('detail-vintage'),
  detailChips: document.getElementById('detail-chips'),
  detailOverview: document.getElementById('detail-overview'),
  detailQuote: document.getElementById('detail-quote'),
  tastingGrid: document.getElementById('tasting-grid'),
  storyTitle: document.getElementById('story-title'),
  storyCopy: document.getElementById('story-copy'),
  scoreRow: document.getElementById('score-row'),
  techGrid: document.getElementById('tech-grid'),
  melodyArt: document.getElementById('melody-art'),
  trackMood: document.getElementById('track-mood'),
  trackTitle: document.getElementById('track-title'),
  trackDescription: document.getElementById('track-description'),
  trackList: document.getElementById('track-list'),
  progressFill: document.getElementById('progress-fill'),
  progressCurrent: document.getElementById('progress-current'),
  progressDuration: document.getElementById('progress-duration'),
  prevTrack: document.getElementById('prev-track'),
  playTrack: document.getElementById('play-track'),
  nextTrack: document.getElementById('next-track'),
  cellarFeatureTitle: document.getElementById('cellar-feature-title'),
  cellarFeatureCopy: document.getElementById('cellar-feature-copy'),
  cellarList: document.getElementById('cellar-list'),
  screens: [...document.querySelectorAll('.screen')],
  navItems: [...document.querySelectorAll('.nav-item')]
};

function setStatus(text) {
  elements.statusText.textContent = text;
}

function setSession(sessionId) {
  state.sessionId = sessionId || '';
  elements.sessionPill.textContent = sessionId ? sessionId.toUpperCase() : 'NO SESSION';
}

function switchScreen(tab) {
  state.currentTab = tab;
  elements.screens.forEach((screen) => {
    screen.classList.toggle('is-visible', screen.dataset.screen === tab);
  });
  elements.navItems.forEach((item) => {
    item.classList.toggle('is-active', item.dataset.tab === tab);
  });
}

function formatSeconds(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

async function request(url, options) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.code || `HTTP_${response.status}`);
  }

  return payload;
}

function renderDetail(experience) {
  const wine = experience.wine;
  elements.detailEyebrow.textContent = wine.eyebrow;
  elements.detailTitle.textContent = wine.title;
  elements.detailVintage.textContent = `Vintage ${wine.vintage}`;
  elements.detailOverview.textContent = wine.overview;
  elements.detailQuote.textContent = wine.quote;

  elements.detailChips.innerHTML = '';
  [wine.region, wine.grapes, wine.abv].forEach((value) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = value;
    elements.detailChips.appendChild(chip);
  });

  elements.tastingGrid.innerHTML = '';
  wine.tasting.forEach((item) => {
    const wrapper = document.createElement('article');
    wrapper.className = 'tasting-item';
    wrapper.innerHTML = `
      <span class="tasting-kicker">${item.icon}</span>
      <h4 class="tasting-title">${item.key}</h4>
      <p class="muted-copy">${item.text}</p>
      ${
        item.meter
          ? `<div class="meter-rail"><div class="meter-fill" style="width:${item.meter}%"></div></div>`
          : ''
      }
    `;
    elements.tastingGrid.appendChild(wrapper);
  });

  elements.storyTitle.textContent = wine.storyTitle;
  elements.storyCopy.textContent = wine.story;
  elements.scoreRow.innerHTML = '';
  wine.scores.forEach((item) => {
    const pill = document.createElement('div');
    pill.className = 'score-pill';
    pill.innerHTML = `
      <span class="score-value">${item.score}</span>
      <span class="score-label">${item.source}</span>
    `;
    elements.scoreRow.appendChild(pill);
  });

  elements.techGrid.innerHTML = '';
  wine.technical.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'tech-row';
    row.innerHTML = `
      <span class="tech-label">${item.label}</span>
      <span class="tech-line"></span>
      <span class="tech-value">${item.value}</span>
    `;
    elements.techGrid.appendChild(row);
  });
}

function trackArtworkClass(track) {
  return `record-shell artwork-${track.art || 'noir'}`;
}

function ensureAudio(track) {
  if (state.audio) {
    state.audio.pause();
  }

  state.audio = new Audio(track.src.replace('/assets/audio/', '/preview-assets/audio/'));
  state.audio.loop = true;
  state.audio.addEventListener('timeupdate', () => {
    const duration = state.audio.duration || 0;
    const current = state.audio.currentTime || 0;
    const progress = duration ? Math.min(100, (current / duration) * 100) : 0;
    elements.progressFill.style.width = `${progress}%`;
    elements.progressCurrent.textContent = formatSeconds(current);
    elements.progressDuration.textContent = track.durationLabel || formatSeconds(duration);
  });
  state.audio.addEventListener('ended', () => {
    elements.playTrack.textContent = 'PLAY';
  });
}

function renderMelody(experience) {
  const tracks = experience.tracks || [];
  const track = tracks[state.trackIndex] || tracks[0];
  if (!track) {
    return;
  }

  elements.trackMood.textContent = track.mood;
  elements.trackTitle.textContent = track.title;
  elements.trackDescription.textContent = track.description;
  elements.melodyArt.className = trackArtworkClass(track);
  elements.progressCurrent.textContent = '00:00';
  elements.progressDuration.textContent = track.durationLabel || '00:00';
  elements.progressFill.style.width = '0%';
  elements.playTrack.textContent = 'PLAY';

  ensureAudio(track);

  elements.trackList.innerHTML = '';
  tracks.forEach((item, index) => {
    const button = document.createElement('button');
    button.className = `track-chip ${index === state.trackIndex ? 'is-active' : ''}`;
    button.textContent = item.title;
    button.addEventListener('click', () => {
      state.trackIndex = index;
      renderMelody(experience);
    });
    elements.trackList.appendChild(button);
  });
}

function renderCellar(experience) {
  const wine = experience.wine;
  elements.cellarFeatureTitle.textContent = `${wine.title} ${wine.vintage}`;
  elements.cellarFeatureCopy.textContent = wine.quote;

  elements.cellarList.innerHTML = '';
  (experience.collection || []).forEach((item) => {
    const card = document.createElement('article');
    card.className = 'cellar-card';
    card.innerHTML = `
      <div class="cellar-art palette-${item.palette || 'amber'}"></div>
      <span class="cellar-vintage">${item.vintage}</span>
      <h4 class="cellar-title">${item.title}</h4>
      <p class="muted-copy">${item.note}</p>
    `;
    elements.cellarList.appendChild(card);
  });
}

function renderExperience(experience) {
  state.experience = experience;
  renderDetail(experience);
  renderMelody(experience);
  renderCellar(experience);
}

async function enterDemo() {
  setStatus('正在生成本地演示卡并消费一次性 token');
  elements.entryCopy.textContent = '正在连接本地服务，请稍候。';

  try {
    const reset = await request('/api/admin/dev/reset', { method: 'POST' });
    const consume = await request('/api/redeem/consume', {
      method: 'POST',
      body: JSON.stringify({ scene: reset.scene })
    });

    setSession(consume.sessionId);
    renderExperience(consume.experience);
    switchScreen('detail');
    setStatus(`已生成并消费一次性卡：${reset.scene}`);
  } catch (error) {
    setStatus(`失败：${error.message}`);
    elements.entryCopy.textContent =
      '本地服务没有启动，或者一次性码消费失败。请确认 Node 服务已运行。';
  }
}

async function resetDemoOnly() {
  setStatus('正在重置演示数据');

  try {
    const reset = await request('/api/admin/dev/reset', { method: 'POST' });
    setSession('');
    state.experience = null;
    state.trackIndex = 0;
    if (state.audio) {
      state.audio.pause();
      state.audio = null;
    }
    switchScreen('entry');
    elements.entryCopy.textContent = `演示卡已重置。当前 scene: ${reset.scene}`;
    setStatus(`已重置，等待消费：${reset.scene}`);
  } catch (error) {
    setStatus(`重置失败：${error.message}`);
  }
}

elements.demoEntry.addEventListener('click', enterDemo);
elements.entryButton.addEventListener('click', enterDemo);
elements.resetDemo.addEventListener('click', resetDemoOnly);

elements.prevTrack.addEventListener('click', () => {
  if (!state.experience) {
    return;
  }
  const count = state.experience.tracks.length;
  state.trackIndex = (state.trackIndex - 1 + count) % count;
  renderMelody(state.experience);
});

elements.nextTrack.addEventListener('click', () => {
  if (!state.experience) {
    return;
  }
  const count = state.experience.tracks.length;
  state.trackIndex = (state.trackIndex + 1) % count;
  renderMelody(state.experience);
});

elements.playTrack.addEventListener('click', () => {
  if (!state.audio) {
    return;
  }

  if (state.audio.paused) {
    state.audio.play();
    elements.playTrack.textContent = 'PAUSE';
    return;
  }

  state.audio.pause();
  elements.playTrack.textContent = 'PLAY';
});

elements.navItems.forEach((button) => {
  button.addEventListener('click', () => {
    const tab = button.dataset.tab;
    if (tab !== 'entry' && !state.experience) {
      setStatus('请先生成并进入演示卡');
      switchScreen('entry');
      return;
    }
    switchScreen(tab);
  });
});

switchScreen('entry');
