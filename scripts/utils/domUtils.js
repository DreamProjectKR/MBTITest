/**
 * DOM 조작 헬퍼 함수들
 */

/**
 * 단일 요소를 선택
 * @param {string} selector - CSS 선택자
 * @param {Element} parent - 부모 요소 (기본값: document)
 * @returns {Element|null} 선택된 요소 또는 null
 */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * 여러 요소를 선택
 * @param {string} selector - CSS 선택자
 * @param {Element} parent - 부모 요소 (기본값: document)
 * @returns {NodeList} 선택된 요소들
 */
export function $$(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/**
 * 요소를 생성하고 속성을 설정
 * @param {string} tagName - 태그 이름
 * @param {Object} attributes - 속성 객체
 * @param {string|Element} content - 내용 (텍스트 또는 요소)
 * @returns {Element} 생성된 요소
 */
export function createElement(tagName, attributes = {}, content = null) {
  const element = document.createElement(tagName);

  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else if (key.startsWith('aria-') || key === 'role' || key === 'tabindex') {
      element.setAttribute(key, value);
    } else {
      element[key] = value;
    }
  });

  if (content !== null) {
    if (typeof content === 'string') {
      element.textContent = content;
    } else if (content instanceof Element) {
      element.appendChild(content);
    } else if (Array.isArray(content)) {
      content.forEach((item) => {
        if (item instanceof Element) {
          element.appendChild(item);
        }
      });
    }
  }

  return element;
}

/**
 * 요소에 이벤트 리스너를 안전하게 추가
 * @param {Element|null} element - 대상 요소
 * @param {string} event - 이벤트 타입
 * @param {Function} handler - 이벤트 핸들러
 * @param {Object} options - 이벤트 옵션
 */
export function safeAddEventListener(element, event, handler, options = {}) {
  if (!element) return;
  element.addEventListener(event, handler, options);
}

/**
 * 컨테이너의 내용을 비우기
 * @param {Element} container - 컨테이너 요소
 */
export function clearContainer(container) {
  if (container) {
    container.innerHTML = '';
  }
}

/**
 * 요소를 안전하게 제거
 * @param {Element} element - 제거할 요소
 */
export function removeElement(element) {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * 요소의 스타일 속성을 설정
 * @param {Element} element - 대상 요소
 * @param {Object} styles - 스타일 객체
 */
export function setStyles(element, styles) {
  if (!element) return;
  Object.entries(styles).forEach(([property, value]) => {
    element.style[property] = value;
  });
}

/**
 * 요소에 CSS 클래스를 안전하게 추가
 * @param {Element} element - 대상 요소
 * @param {string} className - 추가할 클래스 이름
 */
export function addClass(element, className) {
  if (element && className) {
    element.classList.add(className);
  }
}

/**
 * 요소에서 CSS 클래스를 안전하게 제거
 * @param {Element} element - 대상 요소
 * @param {string} className - 제거할 클래스 이름
 */
export function removeClass(element, className) {
  if (element && className) {
    element.classList.remove(className);
  }
}

