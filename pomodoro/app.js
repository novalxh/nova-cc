// SVG 圆环周长：2πr = 2 × π × 120 ≈ 754
const CIRCUMFERENCE = 2 * Math.PI * 120;

// 三种模式的配置：时长（秒）、中文标签、主题色
const CONFIG = {
  focus    : { duration: 25 * 60, label: '专注时间', accent: '#ff6b6b' },
  shortBreak: { duration: 5 * 60, label: '短休息',   accent: '#51cf66' },
  longBreak : { duration: 15 * 60, label: '长休息',   accent: '#5c7cfa' },
};

// --- 全局状态 ---
// mode: 'focus' | 'shortBreak' | 'longBreak'
// status: 'idle' | 'running' | 'paused'
// cyclePos: 当前是这一轮（4个番茄）中的第几个
// lastTickAt: 上次 tick 的时间戳，用于计算真实流逝时间
const state = {
  mode: 'focus',
  status: 'idle',
  timeLeft: CONFIG.focus.duration,
  completed: 0,
  cyclePos: 1,
  timerId: null,
  lastTickAt: null,
};

// 当前模式的总时长（由 CONFIG 推导，不存冗余状态）
const duration = () => CONFIG[state.mode].duration;

// --- DOM 引用 ---
const $ = (id) => document.getElementById(id);
const timerDisplay   = $('timerDisplay');
const timerLabel     = $('timerLabel');
const progressRing   = $('progressRing');
const mainBtn        = $('mainBtn');
const resetBtn       = $('resetBtn');
const completedCount = $('completedCount');
const cycleCount     = $('cycleCount');
const modeTabs       = document.querySelectorAll('.mode-tab');

// 初始化进度环：CSS 中不硬编码周长了，由 JS 统一设置
progressRing.style.strokeDasharray = CIRCUMFERENCE;

// --- 工具函数：秒数转 MM:SS 格式 ---
function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// --- 更新 SVG 进度环 ---
// stroke-dashoffset = 0 表示满环，= 周长 表示空环
function setProgress(pct) {
  progressRing.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
}

// --- 用 Web Audio API 生成蜂鸣声 ---
// 复用同一个 AudioContext，避免浏览器限制和内存泄漏
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
  } catch (_) { /* 浏览器不支持时静默降级 */ }
}

// 将当前 mode 应用到 timer 的时长
function resetTimer() {
  state.timeLeft = duration();
}

// --- 完整 UI 渲染（非热路径调用）---
function updateUI() {
  const cfg = CONFIG[state.mode];
  timerDisplay.textContent = fmt(state.timeLeft);
  timerLabel.textContent = cfg.label;
  progressRing.style.stroke = cfg.accent;

  const pct = state.timeLeft / duration();
  setProgress(pct);

  completedCount.textContent = state.completed;
  cycleCount.textContent = `${state.cyclePos} / 4`;

  if (state.status === 'running') {
    mainBtn.textContent = '暂停';
    mainBtn.classList.add('running');
  } else {
    mainBtn.textContent = state.status === 'paused' ? '继续' : '开始';
    mainBtn.classList.remove('running');
  }

  modeTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === state.mode);
  });
}

// --- 热路径：tick 时只更新变化的内容 ---
function tickUI() {
  timerDisplay.textContent = fmt(state.timeLeft);
  setProgress(state.timeLeft / duration());
}

// --- 切换模式 ---
// 运行中禁止切换，必须暂停或结束后才能切
function setMode(mode) {
  if (state.status === 'running') return;
  state.mode = mode;
  state.status = 'idle';
  clearTick();
  resetTimer();
  updateUI();
}

// --- 计时器核心 ---
function clearTick() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

// 每次 tick：用 Date.now() 计算真实流逝秒数
// 不依赖 setInterval 累加（浏览器后台标签页会冻结 interval）
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

// --- 倒计时完成 ---
// 自动切换到下一个模式
function onComplete() {
  clearTick();
  beep();
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

// --- 用户操作 ---
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
  if (state.status === 'running') pause();
  else start();
}

// --- 绑定事件 ---
mainBtn.addEventListener('click', toggleMain);
resetBtn.addEventListener('click', reset);

modeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    if (state.status === 'running') return;
    setMode(tab.dataset.mode);
  });
});

// --- 初始化渲染 ---
updateUI();
