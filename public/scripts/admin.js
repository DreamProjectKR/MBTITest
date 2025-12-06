import { createElement } from './utils/domUtils.js';

const API_URL = '/api/tests';
const DATA_URL = API_URL;
const AXIS_MAP = {
  EI: ['E', 'I'],
  SN: ['S', 'N'],
  TF: ['T', 'F'],
  JP: ['J', 'P'],
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
  'ESFP',
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
  createTestButton: document.querySelector('[data-create-test]'),
  uploadButton: document.querySelector('[data-upload-test]'),
  thumbnailInput: document.querySelector('[data-thumbnail-input]'),
  statusText: document.querySelector('[data-admin-status]'),
  preview: {
    root: document.querySelector('[data-preview-panel]'),
    title: document.querySelector('[data-preview-title]'),
    desc: document.querySelector('[data-preview-desc]'),
    tags: document.querySelector('[data-preview-tags]'),
    questionCount: document.querySelector('[data-preview-question-count]'),
    resultCount: document.querySelector('[data-preview-result-count]'),
    thumb: document.querySelector('[data-preview-thumb]'),
    iframe: document.querySelector('[data-preview-iframe]'),
    reloadBtn: document.querySelector('[data-preview-reload]'),
  },
  resultImageInput: document.querySelector('[data-result-image]'),
};

const state = {
  payload: {},
  tests: [],
  activeTestId: null,
};

const uploadState = {
  thumbnail: null,
  resultImages: {},
};

let isHydratingMeta = false;

initAdmin();

async function initAdmin() {
  if (!elements.metaForm) return;

  wireStaticEvents();
  setupForms();

  try {
    // 인덱스 파일 로드
    const indexData = await fetchJson(DATA_URL);

    if (!indexData.tests || !Array.isArray(indexData.tests)) {
      throw new Error('인덱스 파일 형식이 올바르지 않습니다.');
    }

    // API에서 이미 합쳐서 내려줄 경우 바로 적용
    if (indexData.tests.some((test) => Array.isArray(test.questions))) {
      applyPayload(indexData);
      return;
    }

    // 정적 JSON을 읽어야 할 때
    const baseUrl = DATA_URL.includes('/')
      ? DATA_URL.substring(0, DATA_URL.lastIndexOf('/') + 1)
      : '';
    const testPromises = indexData.tests.map(async (testIndex) => {
      const testPath = `${baseUrl}${testIndex.path}`;
      const testData = await fetchJson(testPath);
      return testData;
    });

    const tests = await Promise.all(testPromises);

    const payload = {
      ...indexData,
      tests: tests,
    };

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
  elements.uploadButton?.addEventListener('click', saveActiveTest);
  elements.thumbnailInput?.addEventListener('change', (event) => {
    const [file] = event.target.files ?? [];
    uploadState.thumbnail = file ?? null;
    if (file) {
      const activeTest = getActiveTest();
      if (activeTest) {
        activeTest.thumbnail = URL.createObjectURL(file);
        renderPreview(activeTest);
      }
    }
  });
  elements.preview.reloadBtn?.addEventListener('click', () =>
    reloadPreviewIframe(true),
  );
}

function setupForms() {
  elements.metaForm?.addEventListener('input', handleMetaInput);

  elements.questionForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(elements.questionForm);
    const question = {
      id: crypto.randomUUID?.() ?? `q-${Date.now()}`,
      prompt: data.get('prompt')?.trim() ?? '',
      answers: [buildAnswer('answerA', data), buildAnswer('answerB', data)],
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
      reorderQuestion(
        moveButton.dataset.questionId,
        moveButton.dataset.moveQuestion,
      );
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
    const imageFile = elements.resultImageInput?.files?.[0] ?? null;
    const imageUrl = data.get('image');
    if (imageFile) {
      uploadState.resultImages[code] = imageFile;
    }
    activeTest.results[code] = {
      image: imageFile ? URL.createObjectURL(imageFile) : imageUrl,
      summary: data.get('summary'),
      _file: imageFile,
      imageUrl,
    };
    renderResults(activeTest.results);
    renderPreview(activeTest);
    elements.resultForm.reset();
    if (elements.resultImageInput) {
      elements.resultImageInput.value = '';
    }
  });

  elements.resultList?.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-result]');
    if (!removeButton) return;
    const code = removeButton.dataset.removeResult;
    const activeTest = getActiveTest();
    if (!activeTest?.results) return;
    delete activeTest.results[code];
    delete uploadState.resultImages[code];
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
    id:
      test.id ??
      `test-${crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`,
    title: test.title ?? '',
    description: test.description ?? '',
    tags: Array.isArray(test.tags) ? [...test.tags] : [],
    heroAnimation: test.heroAnimation ?? 'pan',
    thumbnail: test.thumbnail ?? '',
    path: test.path,
    questions: Array.isArray(test.questions)
      ? test.questions.map((question) => ({
          ...question,
          answers: Array.isArray(question.answers) ? [...question.answers] : [],
        }))
      : [],
    results: { ...(test.results ?? {}) },
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
  renderPreview(activeTest);
}

function getActiveTest() {
  return state.tests.find((test) => test.id === state.activeTestId);
}

function setActiveTest(testId) {
  state.activeTestId = testId;
  uploadState.thumbnail = null;
  uploadState.resultImages = {};
  refreshActiveTest();
}

function createTest() {
  const rawId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const newTest = {
    id: `test-${rawId.slice(0, 8)}`,
    title: '새 테스트',
    description: '',
    tags: [],
    heroAnimation: 'pan',
    thumbnail: '',
    questions: [],
    results: {},
  };
  state.tests.push(newTest);
  state.activeTestId = newTest.id;
  uploadState.thumbnail = null;
  uploadState.resultImages = {};
  populateTestSelector();
  refreshActiveTest();
}

function hydrateForms(test) {
  if (!elements.metaForm) return;
  const form = elements.metaForm;
  isHydratingMeta = true;
  form.elements['testId'].value = test?.id ?? '';
  form.elements['title'].value = test?.title ?? '';
  form.elements['description'].value = test?.description ?? '';
  form.elements['tags'].value = (test?.tags ?? []).join(', ');
  form.elements['heroAnimation'].value = test?.heroAnimation ?? 'pan';
  if (form.elements['thumbnail']) {
    form.elements['thumbnail'].value = '';
  }
  isHydratingMeta = false;
}

function handleMetaInput() {
  if (isHydratingMeta) return;
  const activeTest = getActiveTest();
  if (!activeTest) return;
  const form = elements.metaForm;
  const nextId = form.elements['testId']?.value?.trim();
  if (nextId && nextId !== activeTest.id) {
    activeTest.id = nextId;
    state.activeTestId = nextId;
  }
  activeTest.title = form.elements['title'].value;
  activeTest.description = form.elements['description'].value;
  activeTest.tags = form.elements['tags'].value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  activeTest.heroAnimation = form.elements['heroAnimation']?.value ?? 'pan';
  populateTestSelector();
  renderPreview(activeTest);
}

function removeQuestion(questionId) {
  const activeTest = getActiveTest();
  if (!activeTest?.questions) return;
  activeTest.questions = activeTest.questions.filter(
    (question) => question.id !== questionId,
  );
  renderQuestions(activeTest.questions);
}

function reorderQuestion(questionId, direction) {
  const activeTest = getActiveTest();
  if (!activeTest?.questions) return;
  const index = activeTest.questions.findIndex(
    (question) => question.id === questionId,
  );
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
      createRemoveQuestionButton(question.id),
    );
    item.append(controls);

    elements.questionList.append(item);
  });

  const activeTest = getActiveTest();
  if (activeTest) {
    renderPreview(activeTest);
  }
}

function renderResults(results = {}) {
  if (!elements.resultList) return;
  const entries = MBTI_ORDER.filter((code) => Boolean(results[code])).map(
    (code) => [code, results[code]],
  );

  if (!entries.length) {
    elements.resultList.innerHTML =
      '<li><div class="ds-alert">등록된 결과가 없습니다. 16개 MBTI를 모두 채워주세요.</div></li>';
    return;
  }

  elements.resultList.innerHTML = '';
  entries.forEach(([code, detail]) => {
    const item = createElement('li', { className: 'ds-card ds-card--compact' });

    const badge = createElement('div', { className: 'ds-badge' });
    const media = createElement('div', { className: 'ds-badge__media' });
    const img = createElement('img', {
      src: detail.image || detail.imageUrl || '',
      alt: `${code} 이미지`,
      loading: 'lazy',
    });
    media.append(img);
    badge.append(media);

    const textWrap = createElement('div');
    const strong = createElement('strong');
    strong.textContent = code;
    const summary = createElement('p');
    summary.textContent = detail.summary ?? '';
    textWrap.append(strong, summary);
    badge.append(textWrap);

    const controls = createElement('div', {
      className: 'result-item__controls',
    });
    const removeBtn = createElement('button', {
      className: 'ds-button ds-button--ghost ds-button--small',
      type: 'button',
      dataset: { removeResult: code },
    });
    removeBtn.textContent = '삭제';
    controls.append(removeBtn);

    item.append(badge, controls);
    elements.resultList.append(item);
  });

  const activeTest = getActiveTest();
  if (activeTest) {
    renderPreview(activeTest);
  }
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
    direction: directionPref === 'positive' ? positive : negative,
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
    tests: state.tests,
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'mbti-tests.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildResultsPayload(results, test) {
  const payload = {};
  const assetBase = state.payload?.assetBaseUrl?.replace(/\/$/, '');
  const testDir = test?.path?.includes('/')
    ? test.path.substring(0, test.path.lastIndexOf('/'))
    : test?.id;
  const assetPrefix = assetBase && testDir ? `${assetBase}/${testDir}/` : null;
  Object.entries(results ?? {}).forEach(([code, detail]) => {
    let imagePath =
      typeof detail.image === 'string' ? detail.image : detail.imageUrl || '';
    if (assetPrefix && imagePath?.startsWith(assetPrefix)) {
      imagePath = imagePath.replace(assetPrefix, '').replace(/^\/+/, '');
      if (!imagePath.startsWith('images/')) {
        imagePath = `images/${imagePath}`;
      }
    }
    payload[code] = {
      summary: detail.summary ?? '',
      image: imagePath,
    };
  });
  return payload;
}

async function saveActiveTest() {
  const activeTest = getActiveTest();
  if (!activeTest) {
    alert('활성화된 테스트가 없습니다.');
    return;
  }

  setStatus('업로드 중...', 'progress');

  try {
    const missingResults = MBTI_ORDER.filter(
      (code) => !activeTest.results?.[code],
    );
    if (missingResults.length) {
      throw new Error(`MBTI 결과가 부족합니다: ${missingResults.join(', ')}`);
    }

    const missingImages = MBTI_ORDER.filter((code) => {
      const detail = activeTest.results?.[code];
      const hasFile = uploadState.resultImages[code];
      const hasPath = detail?.image || detail?.imageUrl;
      return !hasFile && !hasPath;
    });
    if (missingImages.length) {
      throw new Error(`이미지 미등록: ${missingImages.join(', ')}`);
    }

    if (!uploadState.thumbnail && !activeTest.thumbnail) {
      throw new Error('썸네일 이미지를 등록해 주세요.');
    }

    const formData = new FormData();
    formData.set('testId', activeTest.id ?? '');
    formData.set('title', activeTest.title ?? '');
    formData.set('description', activeTest.description ?? '');
    formData.set('tags', JSON.stringify(activeTest.tags ?? []));
    formData.set('heroAnimation', activeTest.heroAnimation ?? 'pan');
    formData.set('questions', JSON.stringify(activeTest.questions ?? []));
    formData.set(
      'results',
      JSON.stringify(buildResultsPayload(activeTest.results ?? {}, activeTest)),
    );

    if (uploadState.thumbnail) {
      formData.set(
        'thumbnail',
        uploadState.thumbnail,
        uploadState.thumbnail.name,
      );
    }

    Object.entries(uploadState.resultImages).forEach(([code, file]) => {
      if (file) {
        formData.set(`resultImage_${code}`, file, file.name);
      }
    });

    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || '업로드에 실패했습니다.');
    }

    const updatedTest = normalizeTests([payload.test ?? payload])[0];
    const existingIndex = state.tests.findIndex(
      (test) => test.id === updatedTest.id,
    );
    if (existingIndex >= 0) {
      state.tests[existingIndex] = updatedTest;
    } else {
      state.tests.push(updatedTest);
    }
    state.activeTestId = updatedTest.id;
    uploadState.thumbnail = null;
    uploadState.resultImages = {};
    populateTestSelector();
    refreshActiveTest();
    setStatus('업로드 완료', 'success');
  } catch (error) {
    console.error('업로드 실패', error);
    setStatus(error.message || '업로드 실패', 'error');
    alert(error.message || '업로드 실패');
  }
}

function renderPreview(test) {
  if (!elements.preview.root) return;
  elements.preview.title.textContent = test?.title || '테스트를 선택하세요';
  elements.preview.desc.textContent =
    test?.description || '메타 정보를 입력하면 프리뷰가 갱신됩니다.';

  if (elements.preview.tags) {
    elements.preview.tags.innerHTML = '';
    (test?.tags ?? []).forEach((tag) => {
      const chip = document.createElement('span');
      chip.textContent = tag;
      elements.preview.tags.append(chip);
    });
  }

  if (elements.preview.questionCount) {
    elements.preview.questionCount.textContent = `${
      test?.questions?.length ?? 0
    }`;
  }

  if (elements.preview.resultCount) {
    const resultCount = Object.keys(test?.results ?? {}).length;
    elements.preview.resultCount.textContent = `${resultCount}/16`;
  }

  if (elements.preview.thumb) {
    elements.preview.thumb.innerHTML = '';
    const thumbUrl = test?.thumbnail;
    if (thumbUrl) {
      const img = createElement('img', {
        src: thumbUrl,
        alt: '썸네일',
        loading: 'lazy',
      });
      elements.preview.thumb.append(img);
    } else {
      elements.preview.thumb.textContent = '썸네일 미등록';
    }
  }

  reloadPreviewIframe();
}

function setStatus(message, tone = 'default') {
  if (!elements.statusText) return;
  elements.statusText.textContent = message;
  elements.statusText.dataset.tone = tone;
}

function reloadPreviewIframe(force = false) {
  if (!elements.preview.iframe) return;
  const baseSrc = 'index.html';
  const current = elements.preview.iframe.getAttribute('src') || baseSrc;
  const cacheBust = force ? Date.now() : null;
  const nextSrc = cacheBust ? `${baseSrc}?preview=${cacheBust}` : current;
  elements.preview.iframe.setAttribute('src', nextSrc);
}
