/** Home (`main.js`): two `.NewTestList` sections with shells. */
export const MAIN_PAGE_HTML = `
<header id="headerScroll"><div id="header" class="Head"></div></header>
<main id="MainTop">
  <div class="NewTestList"><div class="NewTestListShell"></div></div>
  <div class="NewTestList"><div class="NewTestListShell"></div></div>
</main>
`;

/** `testlist.js` */
export const TESTLIST_PAGE_HTML = `
<header id="headerScroll"><div id="header" class="Head"></div></header>
<main id="MainTop">
  <div class="NewTestList"><div class="NewTestListShell"></div></div>
</main>
<div class="NewTestShell test1"><div class="NewTest"><h4>x</h4></div></div>
`;

/** `testintro.js` */
export const TESTINTRO_PAGE_HTML = `
<header class="Sticky"><div class="Head"></div></header>
<main class="TestIntroShell">
  <div class="IntroShellImg">
    <img alt="" />
    <div class="NewTestHashTag"></div>
  </div>
  <div class="IntroShellTextBox">
    <h2>제목</h2>
    <div class="Creator"><img alt="" /><p class="CreatorName"></p></div>
    <div class="IntroDescription"></div>
    <div class="IntroBtnShell">
      <div class="TestStart"><button type="button">시작</button></div>
      <div class="TestShare"><button type="button">공유</button></div>
    </div>
  </div>
</main>
`;

/** `testquiz.js` */
export const TESTQUIZ_PAGE_HTML = `
<div class="PageShell">
  <header class="Sticky"><div class="Head"></div></header>
  <main>
    <div class="ProgressBar"><div class="Progress"></div></div>
    <div class="TestImg"><img alt="" /></div>
    <div class="TestSelectBtn"></div>
  </main>
</div>
`;

/** `testresult.js` */
export const TESTRESULT_PAGE_HTML = `
<header class="Sticky"><div class="Head"></div></header>
<main class="ResultShell">
  <div class="ResultShellImg"><img alt="" /></div>
  <div class="ResultShellTextBox">
    <h2>결과</h2>
    <div class="ResultBtnShell">
      <div class="Restart"><button type="button">다시</button></div>
      <div class="TestShare"><button type="button">공유</button></div>
    </div>
  </div>
</main>
`;

/** `layout.js` partial include */
export const LAYOUT_PARTIAL_HTML = `
<div data-include="x" data-include-src="http://127.0.0.1:9/fragment.html"></div>
`;
