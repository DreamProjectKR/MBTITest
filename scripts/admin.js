const DATA_URL = '../assets/data/mbti-tests.json';
const AXIS_MAP = {
  EI: ['E', 'I'],
  SN: ['S', 'N'],
  TF: ['T', 'F'],
  JP: ['J', 'P']
};
const MBTI_ORDER = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISTP',
  'ESTJ',
  'ESTP',
  'ISFJ',
  'ISFP',
  'ESFJ',
  'ESFP'
];

const elements = {
  metaForm: document.querySelector('[data-test-meta-form]'),
  questionForm: document.querySelector('[data-question-form]'),
  questionList: document.querySelector('[data-question-list]'),
  resultForm: document.querySelector('[data-result-form]'),
  resultList: document.querySelector('[data-result-list]'),
  jsonInput: document.querySelector('[data-json-input]'),
  exportButton: document.querySelector('[data-export-json]'),
  testSelect: document.querySelector('[data-test-select]'),
  createTestButton: document.querySelector('[data-create-test]')
};

const state = {
  payload: {},
  tests: [],
  activeTestId: null
};

let isHydratingMeta = false;

initAdmin();

async function initAdmin() {
  if (!elements.metaForm) return;

  wireStaticEvents();
  setupForms();

  try {
    const payload = await fetchJson(DATA_URL);
    applyPayload(payload);
  } catch (error) {
    console.warn('초기 데이터 로딩 실패', error);
  }
}

function wireStaticEvents() {
  elements.jsonInput?.addEventListener('change', handleJsonUpload);
  elements.exportButton?.addEventListener('click', exportJson);
  elements.createTestButton?.addEventListener('click', createTest);
  elements.testSelect?.addEventListener('change', (event) => {
    setActiveTest(event.target.value);
  });
}

function setupForms() {
  elements.metaForm?.addEventListener('input', handleMetaInput);

  elements.questionForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(elements.questionForm);
    const question = {
      id: crypto.randomUUID?.() ?? `q-${Date.now()}`,
      prompt: data.get('prompt')?.trim() ?? '',
      answers: [
        buildAnswer('answerA', data),
        buildAnswer('answerB', data)
      ]
    };

    const activeTest = getActiveTest();
    if (!activeTest) return;
    activeTest.questions = activeTest.questions ?? [];
    activeTest.questions.push(question);
    renderQuestions(activeTest.questions);
    elements.questionForm.reset();
  });

  elements.questionList?.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-question]');
    if (removeButton) {
      removeQuestion(removeButton.dataset.removeQuestion);
      return;
    }

    const moveButton = event.target.closest('[data-move-question]');
    if (moveButton) {
      reorderQuestion(moveButton.dataset.questionId, moveButton.dataset.moveQuestion);
    }
  });

  elements.resultForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(elements.resultForm);
    const code = data.get('code')?.toUpperCase();
    if (!code) return;

    const activeTest = getActiveTest();
    if (!activeTest) return;
    activeTest.results = activeTest.results ?? {};
    activeTest.results[code] = {
      image: data.get('image'),
      summary: data.get('summary')
    };
    renderResults(activeTest.results);
    elements.resultForm.reset();
  });

  elements.resultList?.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-result]');
    if (!removeButton) return;
    const code = removeButton.dataset.removeResult;
    const activeTest = getActiveTest();
    if (!activeTest?.results) return;
    delete activeTest.results[code];
    renderResults(activeTest.results);
  });
}

async function handleJsonUpload(event) {
  const [file] = event.target.files ?? [];
  if (!file) return;

  try {
    const text = await file.text();
    const json = JSON.parse(text);
    applyPayload(json);
  } catch (error) {
    alert('JSON 파싱에 실패했습니다.');
    console.error(error);
  } finally {
    event.target.value = '';
  }
}

function applyPayload(payload) {
  state.payload = payload ?? {};
  state.tests = normalizeTests(state.payload.tests ?? []);
  state.activeTestId = state.tests[0]?.id ?? null;
  populateTestSelector();
  refreshActiveTest();
}

function normalizeTests(tests) {
  return tests.map((test) => ({
    id: test.id ?? `test-${(crypto.randomUUID ? crypto.randomUUID() : String(Date.now()))}`,
    title: test.title ?? '',
    description: test.description ?? '',
    tags: Array.isArray(test.tags) ? [...test.tags] : [],
    thumbnail: test.thumbnail ?? '',
    questions: Array.isArray(test.questions)
      ? test.questions.map((question) => ({
          ...question,
          answers: Array.isArray(question.answers) ? [...question.answers] : []
        }))
      : [],
    results: { ...(test.results ?? {}) }
  }));
}

function populateTestSelector() {
  if (!elements.testSelect) return;
  elements.testSelect.innerHTML = '';
  state.tests.forEach((test) => {
    const option = document.createElement('option');
    option.value = test.id;
    option.textContent = `${test.title || '제목 없는 테스트'} (${test.id})`;
    if (test.id === state.activeTestId) {
      option.selected = true;
    }
    elements.testSelect.append(option);
  });
  elements.testSelect.disabled = state.tests.length === 0;
}

function refreshActiveTest() {
  const activeTest = getActiveTest();
  hydrateForms(activeTest);
  renderQuestions(activeTest?.questions ?? []);
  renderResults(activeTest?.results ?? {});
}

function getActiveTest() {
  return state.tests.find((test) => test.id === state.activeTestId);
}

function setActiveTest(testId) {
  state.activeTestId = testId;
  refreshActiveTest();
}

function createTest() {
  const rawId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const newTest = {
    id: `test-${rawId.slice(0, 8)}`,
    title: '새 테스트',
    description: '',
    tags: [],
    thumbnail: '',
    questions: [],
    results: {}
  };
  state.tests.push(newTest);
  state.activeTestId = newTest.id;
  populateTestSelector();
  refreshActiveTest();
}

function hydrateForms(test) {
  if (!elements.metaForm) return;
  const form = elements.metaForm;
  isHydratingMeta = true;
  form.elements['title'].value = test?.title ?? '';
  form.elements['description'].value = test?.description ?? '';
  form.elements['tags'].value = (test?.tags ?? []).join(', ');
  form.elements['thumbnail'].value = test?.thumbnail ?? '';
  isHydratingMeta = false;
}

function handleMetaInput() {
  if (isHydratingMeta) return;
  const activeTest = getActiveTest();
  if (!activeTest) return;
  const form = elements.metaForm;
  activeTest.title = form.elements['title'].value;
  activeTest.description = form.elements['description'].value;
  activeTest.tags = form.elements['tags'].value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  activeTest.thumbnail = form.elements['thumbnail'].value;
  populateTestSelector();
}

function removeQuestion(questionId) {
  const activeTest = getActiveTest();
  if (!activeTest?.questions) return;
  activeTest.questions = activeTest.questions.filter((question) => question.id !== questionId);
  renderQuestions(activeTest.questions);
}

function reorderQuestion(questionId, direction) {
  const activeTest = getActiveTest();
  if (!activeTest?.questions) return;
  const index = activeTest.questions.findIndex((question) => question.id === questionId);
  if (index === -1) return;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= activeTest.questions.length) return;
  const [item] = activeTest.questions.splice(index, 1);
  activeTest.questions.splice(targetIndex, 0, item);
  renderQuestions(activeTest.questions);
}

function renderQuestions(questions) {
  if (!elements.questionList) return;
  if (!questions.length) {
    elements.questionList.innerHTML =
      '<li><div class="ds-alert">등록된 문항이 없습니다. 새로운 문항을 추가하세요.</div></li>';
    return;
  }

  elements.questionList.innerHTML = '';
  questions.forEach((question, index) => {
    const item = document.createElement('li');
    item.className = 'ds-card ds-card--compact';

    const content = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `${index + 1}. ${question.prompt}`;
    content.append(title);

    const chipRow = document.createElement('div');
    chipRow.className = 'ds-chip-row';
    (question.answers ?? []).forEach((answer) => {
      const chip = document.createElement('span');
      chip.className = 'ds-chip';
      const label = document.createElement('span');
      label.textContent = answer.label;
      const detail = document.createElement('small');
      detail.textContent = `${answer.mbtiAxis} → ${answer.direction}`;
      chip.append(label, detail);
      chipRow.append(chip);
    });
    content.append(chipRow);
    item.append(content);

    const controls = document.createElement('div');
    controls.className = 'question-item__controls';
    controls.append(
      createQuestionControlButton('위로', 'up', question.id),
      createQuestionControlButton('아래로', 'down', question.id),
      createRemoveQuestionButton(question.id)
    );
    item.append(controls);

    elements.questionList.append(item);
  });
}

function renderResults(results = {}) {
  if (!elements.resultList) return;
  const entries = MBTI_ORDER.filter((code) => Boolean(results[code])).map((code) => [code, results[code]]);

  if (!entries.length) {
    elements.resultList.innerHTML =
      '<li><div class="ds-alert">등록된 결과가 없습니다. 16개 MBTI를 모두 채워주세요.</div></li>';
    return;
  }

  elements.resultList.innerHTML = '';
  entries.forEach(([code, detail]) => {
    const item = document.createElement('li');
    item.className = 'ds-card ds-card--compact';

    const badge = document.createElement('div');
    badge.className = 'ds-badge';
    const media = document.createElement('div');
    media.className = 'ds-badge__media';
    const img = document.createElement('img');
    img.src = detail.image;
    img.alt = `${code} 이미지`;
    img.loading = 'lazy';
    media.append(img);
    badge.append(media);

    const textWrap = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = code;
    const summary = document.createElement('p');
    summary.textContent = detail.summary;
    textWrap.append(strong, summary);
    badge.append(textWrap);

    const controls = document.createElement('div');
    controls.className = 'result-item__controls';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'ds-button ds-button--ghost ds-button--small';
    removeBtn.type = 'button';
    removeBtn.textContent = '삭제';
    removeBtn.dataset.removeResult = code;
    controls.append(removeBtn);

    item.append(badge, controls);
    elements.resultList.append(item);
  });
}

function createQuestionControlButton(label, direction, questionId) {
  const button = document.createElement('button');
  button.className = 'ds-button ds-button--ghost ds-button--small';
  button.type = 'button';
  button.textContent = label;
  button.dataset.moveQuestion = direction;
  button.dataset.questionId = questionId;
  return button;
}

function createRemoveQuestionButton(questionId) {
  const button = document.createElement('button');
  button.className = 'ds-button ds-button--ghost ds-button--small';
  button.type = 'button';
  button.textContent = '삭제';
  button.dataset.removeQuestion = questionId;
  return button;
}

function buildAnswer(prefix, data) {
  const axis = data.get(`${prefix}Mbti`) || 'EI';
  const directionPref = data.get(`${prefix}Pole`) || 'positive';
  const [positive, negative] = AXIS_MAP[axis] ?? AXIS_MAP.EI;
  return {
    id: crypto.randomUUID?.() ?? `${prefix}-${Date.now()}`,
    label: data.get(`${prefix}Text`),
    mbtiAxis: axis,
    direction: directionPref === 'positive' ? positive : negative
  };
}

function fetchJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error('JSON 요청 실패');
    }
    return response.json();
  });
}

function exportJson() {
  const exportPayload = {
    ...state.payload,
    tests: state.tests
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'mbti-tests.json';
  anchor.click();
  URL.revokeObjectURL(url);
}
