/** MBTI codes used by `public/scripts/admin/state.js`. */
export const MBTI_CODES = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISTP",
  "ESTJ",
  "ESTP",
  "ISFJ",
  "ISFP",
  "ESFJ",
  "ESFP",
];

const AXIS_ORDER = ["EI", "SN", "TF", "JP"];
const AXIS_MAP = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};

/**
 * Build 12 questions with valid axes for admin save validation.
 * @param {string} testId
 * @param {string} imagePrefix
 */
export function buildTwelveQuestions(testId, imagePrefix) {
  const questions = [];
  for (let i = 1; i <= 12; i += 1) {
    const axis = AXIS_ORDER[(i - 1) % 4];
    const [left, right] = AXIS_MAP[axis];
    questions.push({
      id: `q${i}`,
      label: `문항 ${i}`,
      questionImage: `${imagePrefix}/q${i}.png`,
      answers: [
        { mbtiAxis: axis, direction: left, label: left },
        { mbtiAxis: axis, direction: right, label: right },
      ],
    });
  }
  return questions;
}

export function emptyResults() {
  return MBTI_CODES.reduce(
    (acc, code) => ({
      ...acc,
      [code]: { image: "", summary: "" },
    }),
    {},
  );
}

/**
 * Full test payload for admin API / detail responses.
 * @param {string} id
 */
export function sampleAdminFullTest(id = "admin-sample") {
  const imagePrefix = `assets/${id}/images`;
  return {
    id,
    title: "샘플 테스트",
    isPublished: false,
    description: ["d1"],
    tags: ["tag"],
    thumbnail: `${imagePrefix}/thumbnail.png`,
    author: "작성자",
    authorImg: `${imagePrefix}/author.png`,
    path: `${id}/test.json`,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-02",
    questions: buildTwelveQuestions(id, imagePrefix),
    results: MBTI_CODES.reduce(
      (acc, code) => ({
        ...acc,
        [code]: {
          image: `${imagePrefix}/results/${code}.png`,
          summary: `${code} 요약`,
        },
      }),
      {},
    ),
  };
}

/**
 * Minimal published quiz (1 question) for quiz/intro/result flows.
 * Expected local MBTI after one answer on EI: ties on other axes resolve to first letter → "ESTJ".
 */
export function minimalPublishedQuizTest(id = "pub-quiz") {
  const imagePrefix = `assets/${id}/images`;
  return {
    id,
    title: "미니 테스트",
    isPublished: true,
    description: ["소개"],
    tags: ["x"],
    thumbnail: `${imagePrefix}/thumbnail.png`,
    author: "작성자",
    authorImg: `${imagePrefix}/author.png`,
    path: `${id}/test.json`,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-02",
    questions: [
      {
        id: "q1",
        label: "Q1",
        questionImage: `${imagePrefix}/q1.png`,
        answers: [
          { mbtiAxis: "EI", direction: "E", label: "E" },
          { mbtiAxis: "EI", direction: "I", label: "I" },
        ],
      },
    ],
    results: MBTI_CODES.reduce(
      (acc, code) => ({
        ...acc,
        [code]: {
          image: `${imagePrefix}/results/${code}.png`,
          summary: "s",
        },
      }),
      {},
    ),
  };
}
