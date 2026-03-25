/** DOM matching `public/scripts/admin/dom.js`, `render.js` hydrateForms, and `forms.js` bindings. */
export const ADMIN_MINIMAL_HTML = `
<header class="site-header">
  <select data-test-select><option value="t1">t1</option><option value="t2">t2</option></select>
  <button type="button" data-create-test>new</button>
  <button type="button" data-save-test>save</button>
  <span data-save-status>ready</span>
  <button type="button" data-bulk-result-upload>bulk</button>
</header>
<main>
  <section aria-labelledby="test-meta-heading">
    <h2 id="test-meta-heading">meta</h2>
    <form data-test-meta-form>
      <input type="checkbox" name="isPublished" />
      <input type="text" name="author" value="a" />
      <input type="file" name="authorImgFile" accept="image/*" />
      <input type="text" name="authorImg" value="" />
      <input type="text" name="title" value="title" />
      <textarea name="description">line1</textarea>
      <input type="text" name="tags" value="x,y" />
      <input type="file" name="thumbnailFile" accept="image/*" />
      <input type="text" name="thumbnail" value="" />
    </form>
  </section>
  <section aria-labelledby="question-builder-heading">
    <h2 id="question-builder-heading">q</h2>
    <form data-question-form>
      <input type="text" name="questionLabel" value="QL" />
      <input type="file" name="questionImageFile" accept="image/*" />
      <input type="text" name="questionImage" value="assets/t1/q1.png" />
      <select name="axis" aria-label="axis">
        <option value="EI" selected>EI</option>
        <option value="SN">SN</option>
      </select>
      <select name="answerADirection" aria-label="dir">
        <option value="positive" selected>pos</option>
        <option value="negative">neg</option>
      </select>
      <input type="text" name="answerAText" value="A" />
      <input type="text" name="answerBText" value="B" />
      <button type="submit">addq</button>
    </form>
    <ul data-question-list>
      <li><button type="button" data-remove-question="q1">rmq</button></li>
    </ul>
  </section>
  <section aria-labelledby="result-heading">
    <h2 id="result-heading">r</h2>
    <form data-result-form>
      <select name="code"><option value="INTJ">INTJ</option><option value="INTP">INTP</option></select>
      <input type="file" name="resultImageFile" accept="image/*" />
      <input type="file" name="bulkResultFiles" multiple accept="image/*" />
      <textarea name="summary"></textarea>
      <button type="submit">saveres</button>
    </form>
    <ul data-result-list>
      <li><button type="button" data-remove-result="INTJ">rmr</button></li>
    </ul>
  </section>
</main>
`;
