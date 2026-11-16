/* =========================================================
 * 스마트공장 수준확인 심사원 시험 연습 웹앱
 *  - 실전 모의고사: 25문제 / 60분 / 18문제 이상 합격
 *  - 단원별 연습: 바로 채점 + 해설
 *  - 오답노트: 틀린 문제 자동 저장 (localStorage)
 *  - 단답형 연습: 직접 입력 후 정답 확인
 * ========================================================= */

const EXAM = { count: 25, minutes: 60, passLine: 18 };
const MARKS = ['①', '②', '③', '④'];
const SET_LABEL = { all: '전체 200', claude: 'Claude 100', gemini: 'Gemini 100' };
const STORE_KEY = 'sf-quiz-v1';

const app = document.getElementById('app');
const topbarRight = document.getElementById('topbarRight');
const ALL = window.QUESTIONS || [];
const SHORT = window.SHORT_QUESTIONS || [];
const byId = Object.fromEntries(ALL.map((q) => [q.id, q]));

/* ---------- 저장소 (브라우저에 저장, 실패해도 앱은 동작) ---------- */
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { wrong: [], history: [], set: 'all', ...JSON.parse(raw) };
  } catch (e) { /* 저장소 사용 불가 */ }
  return { wrong: [], history: [], set: 'all' };
}
const store = loadStore();
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* 무시 */ }
}
function addWrong(id) {
  if (!store.wrong.includes(id)) store.wrong.push(id);
  saveStore();
}
function removeWrong(id) {
  store.wrong = store.wrong.filter((x) => x !== id);
  saveStore();
}

/* ---------- 유틸 ---------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function poolBySet(set) {
  return set === 'all' ? ALL : ALL.filter((q) => q.set === set);
}
function setName(q) {
  return q.set === 'claude' ? 'Claude' : 'Gemini';
}
function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ---------- 타이머 ---------- */
let timerId = null;
function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
  topbarRight.innerHTML = '';
}

/* =========================================================
 * 1) 홈 화면
 * ========================================================= */
function renderHome() {
  stopTimer();
  const set = store.set;
  const pool = poolBySet(set);
  const last = store.history[store.history.length - 1];

  // 단원 목록 (선택한 문제집 기준)
  const chapters = [];
  pool.forEach((q) => {
    const key = q.set + '|' + q.chapter;
    let c = chapters.find((x) => x.key === key);
    if (!c) chapters.push((c = { key, set: q.set, name: q.chapter, ids: [] }));
    c.ids.push(q.id);
  });

  app.innerHTML = `
    <h1>시험 예상문제 연습 - 서이영 </h1>
    <p class="lead">실제 시험은 25문제 · 60분 · 18문제 이상 맞히면 합격입니다. 같은 조건으로 반복 연습해 보세요.</p>

    <div class="stats">
      <div class="card stat"><div class="num">${pool.length}</div><div class="label">선택한 문제 수</div></div>
      <div class="card stat"><div class="num">${store.wrong.length}</div><div class="label">오답노트</div></div>
      <div class="card stat"><div class="num">${last ? last.score + '/' + last.total : '-'}</div><div class="label">최근 모의고사</div></div>
    </div>

    <div class="section">
      <h2>문제집 선택</h2>
      <div class="segmented" role="group" aria-label="문제집 선택">
        ${Object.keys(SET_LABEL).map((k) => `<button type="button" data-set="${k}" aria-pressed="${k === set}">${SET_LABEL[k]}</button>`).join('')}
      </div>
    </div>

    <div class="section">
      <h2>학습 모드</h2>
      <div class="modes">
        <button class="mode" type="button" data-action="exam">
          <span class="tag">실전</span><strong>모의고사</strong>
          <span class="desc">랜덤 ${EXAM.count}문제 · ${EXAM.minutes}분 타이머 · 제출 후 채점</span>
        </button>
        <button class="mode" type="button" data-action="random">
          <span class="tag">연습</span><strong>랜덤 연습</strong>
          <span class="desc">선택한 문제집 전체를 섞어서 한 문제씩 바로 채점</span>
        </button>
        <button class="mode" type="button" data-action="wrong" ${store.wrong.length ? '' : 'disabled'}>
          <span class="tag">복습</span><strong>오답노트 (${store.wrong.length})</strong>
          <span class="desc">틀린 문제만 다시 풀기 · 맞히면 목록에서 빠집니다</span>
        </button>
        <button class="mode" type="button" data-action="short">
          <span class="tag">암기</span><strong>단답형 연습 (${SHORT.length})</strong>
          <span class="desc">핵심 용어와 숫자를 직접 입력해서 확인</span>
        </button>
      </div>
    </div>

    <div class="section">
      <h2>단원별 연습</h2>
      <div class="chapters">
        ${chapters.map((c, i) => `
          <button class="chapter" type="button" data-chapter="${i}">
            <span>${set === 'all' ? `<span class="set-pill">${c.set === 'claude' ? 'Claude' : 'Gemini'}</span>` : ''}${esc(c.name)}</span>
            <span class="meta">${c.ids.length}문제</span>
          </button>`).join('')}
      </div>
    </div>

    ${store.history.length ? `
    <div class="section">
      <h2>모의고사 기록</h2>
      <div class="card">
        <ul class="history">
          ${store.history.slice(-8).reverse().map((h) => `
            <li><span>${esc(h.date)} · ${esc(SET_LABEL[h.set] || h.set)}</span>
            <span>${h.score}/${h.total} <b class="${h.score >= EXAM.passLine ? 'pass' : 'fail'}">${h.score >= EXAM.passLine ? '합격' : '불합격'}</b></span></li>`).join('')}
        </ul>
      </div>
    </div>` : ''}
  `;

  app.querySelectorAll('[data-set]').forEach((b) =>
    b.addEventListener('click', () => { store.set = b.dataset.set; saveStore(); renderHome(); }));
  app.querySelector('[data-action="exam"]').addEventListener('click', () => startExam(pool));
  app.querySelector('[data-action="random"]').addEventListener('click', () =>
    startPractice(shuffle(pool), `랜덤 연습 · ${SET_LABEL[set]}`));
  app.querySelector('[data-action="wrong"]').addEventListener('click', () =>
    startPractice(shuffle(store.wrong.map((id) => byId[id]).filter(Boolean)), '오답노트', true));
  app.querySelector('[data-action="short"]').addEventListener('click', () => startShort());
  app.querySelectorAll('[data-chapter]').forEach((b) =>
    b.addEventListener('click', () => {
      const c = chapters[Number(b.dataset.chapter)];
      startPractice(c.ids.map((id) => byId[id]), c.name);
    }));
  window.scrollTo(0, 0);
}

/* =========================================================
 * 2) 연습 모드 (한 문제씩 바로 채점 + 해설)
 * ========================================================= */
function startPractice(list, title, isWrongNote = false) {
  if (!list.length) return renderHome();
  const state = { list, title, isWrongNote, i: 0, correct: 0, results: [] };
  renderPracticeQ(state);
}

function renderPracticeQ(state) {
  stopTimer();
  const q = state.list[state.i];
  const n = state.list.length;
  app.innerHTML = `
    <div class="progress"><div style="width:${(state.i / n) * 100}%"></div></div>
    <div class="q-head">
      <span>${esc(state.title)}</span>
      <span>${state.i + 1} / ${n} · 정답 ${state.correct}</span>
    </div>
    <div class="card">
      <div class="q-head"><span>${setName(q)} ${q.no}번 · ${esc(q.chapter)}</span></div>
      <p class="q-text">${esc(q.q)}</p>
      <div class="options">
        ${q.options.map((o, k) => `
          <button class="option" type="button" data-k="${k}">
            <span class="mark">${MARKS[k]}</span><span>${esc(o)}</span>
          </button>`).join('')}
      </div>
      <div id="fb"></div>
    </div>
    <div class="q-actions">
      <button class="btn ghost" type="button" id="quit">그만하기</button>
      <span class="spacer"></span>
      <button class="btn primary" type="button" id="next" disabled>${state.i + 1 < n ? '다음 문제' : '결과 보기'}</button>
    </div>
  `;

  const buttons = app.querySelectorAll('.option');
  buttons.forEach((b) => b.addEventListener('click', () => {
    const pick = Number(b.dataset.k);
    const ok = pick === q.answer;
    buttons.forEach((x) => { x.disabled = true; });
    buttons[q.answer].classList.add('correct');
    if (!ok) b.classList.add('wrong');

    if (ok) {
      state.correct++;
      if (state.isWrongNote) removeWrong(q.id);
    } else {
      addWrong(q.id);
    }
    state.results.push({ id: q.id, pick, ok });

    app.querySelector('#fb').innerHTML = `
      <div class="feedback ${ok ? 'ok' : 'bad'}">
        <strong>${ok ? '정답입니다' : `오답 · 정답은 ${MARKS[q.answer]}`}</strong>
        ${q.explain ? esc(q.explain) : '해설이 없는 문제입니다. 정답 보기를 확인하세요.'}
      </div>`;
    const next = app.querySelector('#next');
    next.disabled = false;
    next.focus();
  }));

  app.querySelector('#next').addEventListener('click', () => {
    state.i++;
    if (state.i < n) renderPracticeQ(state);
    else renderResult({ title: state.title, items: state.results, isExam: false });
  });
  app.querySelector('#quit').addEventListener('click', () =>
    state.results.length ? renderResult({ title: state.title, items: state.results, isExam: false }) : renderHome());
  window.scrollTo(0, 0);
}

/* =========================================================
 * 3) 실전 모의고사 (25문제 / 60분 / 제출 후 채점)
 * ========================================================= */
function startExam(pool) {
  const list = shuffle(pool).slice(0, EXAM.count);
  const state = {
    list,
    answers: Array(list.length).fill(null),
    i: 0,
    endAt: Date.now() + EXAM.minutes * 60 * 1000,
  };
  stopTimer();
  topbarRight.innerHTML = `<span class="timer" id="timer"></span>`;
  const tick = () => {
    const left = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
    const el = document.getElementById('timer');
    if (el) {
      el.textContent = '남은 시간 ' + fmtTime(left);
      el.classList.toggle('low', left <= 300);
    }
    if (left === 0) submitExam(state, true);
  };
  tick();
  timerId = setInterval(tick, 1000);
  renderExamQ(state);
}

function renderExamQ(state) {
  const q = state.list[state.i];
  const n = state.list.length;
  const answered = state.answers.filter((a) => a !== null).length;
  app.innerHTML = `
    <div class="progress"><div style="width:${(answered / n) * 100}%"></div></div>
    <div class="q-head">
      <span>실전 모의고사 · ${SET_LABEL[store.set]}</span>
      <span>답안 ${answered} / ${n}</span>
    </div>
    <div class="card">
      <div class="q-head"><span>문제 ${state.i + 1}</span><span>${setName(q)} ${q.no}번</span></div>
      <p class="q-text">${esc(q.q)}</p>
      <div class="options">
        ${q.options.map((o, k) => `
          <button class="option ${state.answers[state.i] === k ? 'selected' : ''}" type="button" data-k="${k}">
            <span class="mark">${MARKS[k]}</span><span>${esc(o)}</span>
          </button>`).join('')}
      </div>
    </div>
    <div class="q-actions">
      <button class="btn" type="button" id="prev" ${state.i === 0 ? 'disabled' : ''}>이전</button>
      <span class="spacer"></span>
      ${state.i + 1 < n
        ? '<button class="btn primary" type="button" id="next">다음</button>'
        : '<button class="btn primary" type="button" id="submit">제출하기</button>'}
    </div>
    <div class="palette" aria-label="문제 번호로 이동">
      ${state.list.map((_, k) => `
        <button type="button" data-go="${k}" class="${state.answers[k] !== null ? 'answered' : ''} ${k === state.i ? 'current' : ''}">${k + 1}</button>`).join('')}
    </div>
    <div class="q-actions"><span class="spacer"></span>
      <button class="btn small ghost" type="button" id="submit2">지금 제출</button>
    </div>
  `;

  app.querySelectorAll('.option').forEach((b) => b.addEventListener('click', () => {
    state.answers[state.i] = Number(b.dataset.k);
    // 답을 고르면 자동으로 다음 문제로
    if (state.i + 1 < n) state.i++;
    renderExamQ(state);
  }));
  const go = (k) => { state.i = k; renderExamQ(state); };
  app.querySelector('#prev')?.addEventListener('click', () => go(state.i - 1));
  app.querySelector('#next')?.addEventListener('click', () => go(state.i + 1));
  app.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.go))));
  const ask = () => {
    const blank = state.answers.filter((a) => a === null).length;
    if (blank && !window.confirm(`아직 ${blank}문제를 풀지 않았습니다. 제출할까요?`)) return;
    submitExam(state, false);
  };
  app.querySelector('#submit')?.addEventListener('click', ask);
  app.querySelector('#submit2').addEventListener('click', ask);
}

function submitExam(state, timeUp) {
  stopTimer();
  const items = state.list.map((q, k) => {
    const pick = state.answers[k];
    const ok = pick === q.answer;
    if (!ok) addWrong(q.id);
    return { id: q.id, pick, ok };
  });
  const score = items.filter((x) => x.ok).length;
  const d = new Date();
  store.history.push({
    date: `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    set: store.set, score, total: items.length,
  });
  store.history = store.history.slice(-30);
  saveStore();
  renderResult({ title: timeUp ? '시간 종료 · 자동 제출' : '실전 모의고사 결과', items, isExam: true });
}

/* =========================================================
 * 4) 결과 화면
 * ========================================================= */
function renderResult({ title, items, isExam }) {
  stopTimer();
  const score = items.filter((x) => x.ok).length;
  const total = items.length;
  const wrongItems = items.filter((x) => !x.ok);
  const pass = isExam ? score >= EXAM.passLine : score / total >= EXAM.passLine / EXAM.count;

  app.innerHTML = `
    <h1>${esc(title)}</h1>
    <div class="card score">
      <div class="big">${score}<span style="font-size:24px;color:var(--muted)"> / ${total}</span></div>
      <div>
        <span class="badge ${pass ? 'pass' : 'fail'}">${pass ? '합격권' : '불합격권'}</span>
        <p class="lead" style="margin:8px 0 0">정답률 ${Math.round((score / total) * 100)}% · 합격 기준 ${EXAM.passLine}/${EXAM.count} (72%)</p>
      </div>
    </div>
    <div class="q-actions">
      <button class="btn" type="button" id="home">처음으로</button>
      <span class="spacer"></span>
      ${wrongItems.length ? '<button class="btn primary" type="button" id="retry">틀린 문제 다시 풀기</button>' : ''}
    </div>

    <div class="section">
      <h2>${wrongItems.length ? `틀린 문제 ${wrongItems.length}개` : '모두 맞혔습니다 🎉'}</h2>
      <div class="review">
        ${wrongItems.map((x) => {
          const q = byId[x.id];
          return `
          <div class="card item">
            <p class="muted">${setName(q)} ${q.no}번 · ${esc(q.chapter)}</p>
            <p><strong>${esc(q.q)}</strong></p>
            <p class="ans-bad">내 답: ${x.pick === null ? '미응답' : MARKS[x.pick] + ' ' + esc(q.options[x.pick])}</p>
            <p class="ans-ok">정답: ${MARKS[q.answer]} ${esc(q.options[q.answer])}</p>
            ${q.explain ? `<p class="muted">해설: ${esc(q.explain)}</p>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
  app.querySelector('#home').addEventListener('click', renderHome);
  app.querySelector('#retry')?.addEventListener('click', () =>
    startPractice(wrongItems.map((x) => byId[x.id]), '틀린 문제 다시 풀기', true));
  window.scrollTo(0, 0);
}

/* =========================================================
 * 5) 단답형 연습
 * ========================================================= */
function normalize(s) {
  // 공백·괄호·가운뎃점·쉼표를 지우고 소문자로 비교
  return String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[\s·.,()]/g, '');
}
function isShortCorrect(input, answer) {
  const a = normalize(input);
  if (!a) return false;
  const full = normalize(answer.replace(/[()]/g, ''));
  return a === normalize(answer) || a === full || full.includes(a) && a.length >= Math.max(2, normalize(answer).length - 1);
}

function startShort() {
  renderShortQ({ list: shuffle(SHORT), i: 0, correct: 0 });
}

function renderShortQ(state) {
  stopTimer();
  const q = state.list[state.i];
  const n = state.list.length;
  app.innerHTML = `
    <div class="progress"><div style="width:${(state.i / n) * 100}%"></div></div>
    <div class="q-head"><span>단답형 연습</span><span>${state.i + 1} / ${n} · 정답 ${state.correct}</span></div>
    <div class="card">
      <div class="q-head"><span>단답형 ${q.no}번</span></div>
      <p class="q-text">${esc(q.q)}</p>
      <form class="short-input" id="form">
        <input id="ans" type="text" autocomplete="off" placeholder="정답을 입력하고 Enter" aria-label="정답 입력" />
        <button class="btn primary" type="submit">확인</button>
      </form>
      <div id="fb"></div>
    </div>
    <div class="q-actions">
      <button class="btn ghost" type="button" id="quit">그만하기</button>
      <span class="spacer"></span>
      <button class="btn" type="button" id="next" disabled>${state.i + 1 < n ? '다음 문제' : '끝내기'}</button>
    </div>
  `;
  const input = app.querySelector('#ans');
  input.focus();
  app.querySelector('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!app.querySelector('#next').disabled) return;
    const ok = isShortCorrect(input.value, q.answer);
    if (ok) state.correct++;
    input.disabled = true;
    app.querySelector('#fb').innerHTML = `
      <div class="feedback ${ok ? 'ok' : 'bad'}">
        <strong>${ok ? '정답입니다' : '다시 외워 두세요'}</strong>
        정답: ${esc(q.answer)}
      </div>`;
    const next = app.querySelector('#next');
    next.disabled = false;
    next.classList.add('primary');
    next.focus();
  });
  app.querySelector('#next').addEventListener('click', () => {
    state.i++;
    if (state.i < n) renderShortQ(state);
    else {
      app.innerHTML = `
        <h1>단답형 연습 결과</h1>
        <div class="card score"><div class="big">${state.correct}<span style="font-size:24px;color:var(--muted)"> / ${n}</span></div></div>
        <div class="q-actions"><button class="btn" type="button" id="home">처음으로</button><span class="spacer"></span>
        <button class="btn primary" type="button" id="again">한 번 더</button></div>`;
      app.querySelector('#home').addEventListener('click', renderHome);
      app.querySelector('#again').addEventListener('click', startShort);
    }
  });
  app.querySelector('#quit').addEventListener('click', renderHome);
}

/* ---------- 시작 ---------- */
document.getElementById('homeBtn').addEventListener('click', () => {
  if (timerId && !window.confirm('모의고사를 그만두고 처음 화면으로 갈까요?')) return;
  renderHome();
});
renderHome();
