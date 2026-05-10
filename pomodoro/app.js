// SVG 圆环: 2πr = 2 × π × 105
const R = 105;
const CIRCUMFERENCE = 2 * Math.PI * R;

const CONFIG = {
  focus: {
    duration: 25 * 60,
    label: '专注时间',
    desc: '集中精力处理重要任务',
    vars: {
      '--accent': '#e8614a',
      '--bg': '#121214',
    },
  },
  shortBreak: {
    duration: 5 * 60,
    label: '短休息',
    desc: '短暂放松，恢复精力',
    vars: {
      '--accent': '#4caf7d',
      '--bg': '#121414',
    },
  },
  longBreak: {
    duration: 15 * 60,
    label: '长休息',
    desc: '充分休息，为下一轮充电',
    vars: {
      '--accent': '#5b7fff',
      '--bg': '#12121c',
    },
  },
};

const state = {
  mode: 'focus',
  status: 'idle',
  timeLeft: CONFIG.focus.duration,
  completed: 0,
  cyclePos: 1,
  timerId: null,
  lastTickAt: null,
};

const duration = () => CONFIG[state.mode].duration;

// --- DOM ---
const $ = (id) => document.getElementById(id);
const timerDisplay = $('timerDisplay');
const timerLabel = $('timerLabel');
const timerDesc = $('timerDesc');
const progressRing = $('progressRing');
const mainBtn = $('mainBtn');
const resetBtn = $('resetBtn');
const modeTabs = document.querySelectorAll('.tab');

progressRing.style.strokeDasharray = CIRCUMFERENCE;

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function setProgress(pct) {
  progressRing.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
}

// --- 音频 ---
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function beep() {
  try {
    const ctx = getAudioCtx();
    const play = (freq, start, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.25, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    play(880, 0, 0.15);
    play(880, 0.2, 0.15);
    play(1100, 0.4, 0.3);
  } catch (_) {}
}

function speak(text) {
  if (!window.speechSynthesis) return;
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = 'zh-CN';
  msg.rate = 0.9;
  speechSynthesis.speak(msg);
}

// 第一次用户交互时初始化语音，绕过浏览器自动播放限制
let _speechReady = false;
function ensureSpeech() {
  if (_speechReady) return;
  speechSynthesis.cancel();
  _speechReady = true;
}

function resetTimer() {
  state.timeLeft = duration();
}

// --- 应用主题变量 ---
function applyTheme() {
  const root = document.documentElement;
  for (const [key, val] of Object.entries(CONFIG[state.mode].vars)) {
    root.style.setProperty(key, val);
  }
}

// --- 完整渲染 ---
function updateUI() {
  const cfg = CONFIG[state.mode];

  applyTheme();

  timerDisplay.textContent = fmt(state.timeLeft);
  timerLabel.textContent = cfg.label;
  timerDesc.textContent = cfg.desc;

  setProgress(state.timeLeft / duration());

  if (state.status === 'running') {
    mainBtn.textContent = '暂停';
    mainBtn.classList.add('running');
    timerDisplay.classList.add('running');
  } else {
    mainBtn.textContent = state.status === 'paused' ? '继续' : '开始';
    mainBtn.classList.remove('running');
    timerDisplay.classList.remove('running');
  }

  modeTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.mode === state.mode);
  });
}

// --- 热路径 ---
function tickUI() {
  timerDisplay.textContent = fmt(state.timeLeft);
  setProgress(state.timeLeft / duration());
}

// --- 模式切换 ---
function setMode(mode) {
  if (state.status === 'running') return;
  state.mode = mode;
  state.status = 'idle';
  clearTick();
  resetTimer();
  updateUI();
}

// --- 计时核心 ---
function clearTick() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function tick() {
  if (state.status !== 'running') return;
  const now = Date.now();
  const elapsed = Math.floor((now - state.lastTickAt) / 1000);
  if (elapsed <= 0) return;

  state.timeLeft = Math.max(0, state.timeLeft - elapsed);
  state.lastTickAt = now;
  tickUI();

  if (state.timeLeft === 0) onComplete();
}

function startTick() {
  state.lastTickAt = Date.now();
  state.timerId = setInterval(tick, 250);
}

function onComplete() {
  clearTick();
  beep();
  speak(CONFIG[state.mode].label + '结束');
  state.status = 'idle';

  if (state.mode === 'focus') {
    state.completed++;
    if (state.cyclePos % 4 === 0) {
      state.mode = 'longBreak';
      state.cyclePos = 0;
    } else {
      state.mode = 'shortBreak';
    }
    state.cyclePos++;
  } else {
    state.mode = 'focus';
  }

  resetTimer();
  updateUI();
}

function start() {
  if (state.status === 'running') return;
  if (state.timeLeft === 0) resetTimer();
  state.status = 'running';
  startTick();
  updateUI();
}

function pause() {
  if (state.status !== 'running') return;
  state.status = 'paused';
  clearTick();
  updateUI();
}

function reset() {
  clearTick();
  state.status = 'idle';
  state.cyclePos = 1;
  resetTimer();
  updateUI();
}

function toggleMain() {
  ensureSpeech();
  if (state.status === 'running') pause();
  else start();
}

// --- 键盘 ---
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === ' ' || e.key === 'Space') {
    e.preventDefault();
    toggleMain();
  }
  if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
    reset();
  }
});

// --- 事件绑定 ---
mainBtn.addEventListener('click', toggleMain);
resetBtn.addEventListener('click', reset);

modeTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    if (state.status === 'running') return;
    setMode(tab.dataset.mode);
  });
});

// --- 初始化 ---
updateUI();
