/* ==========================================================
   app.js – shared UI helpers + page logic (one init per page)
   ========================================================== */
const $ = (sel, root = document) => root.querySelector(sel);

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const excerpt = (text, n = 130) => (text.length > n ? text.slice(0, n).trim() + '…' : text);
const wordCount = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);
const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

let toastTimer;
function toast(message, type = '') {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = message;
  el.className = `${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function requireLogin() {
  if (!Api.currentUser()) { window.location.replace('login.html'); return false; }
  return true;
}
function redirectIfLoggedIn() { if (Api.currentUser()) window.location.replace('dashboard.html'); }

/* ---------- Navbar + footer ---------- */
function renderChrome() {
  const page = document.body.dataset.page;
  const user = Api.currentUser();
  const link = (href, label, key, cls = '') =>
    `<li><a href="${href}" class="${cls} ${page === key ? 'active' : ''}">${label}</a></li>`;

  const items = user
    ? link('index.html', 'Home', 'home') + link('dashboard.html', 'Dashboard', 'dashboard') +
      link('create-blog.html', 'Create Blog', 'create') +
      `<li><button id="logoutBtn">Logout (${esc(user.name.split(' ')[0])})</button></li>`
    : link('index.html', 'Home', 'home') + link('login.html', 'Login', 'login') +
      link('register.html', 'Register', 'register', 'cta');

  const nav = $('#navbar');
  if (nav) {
    nav.className = 'navbar';
    nav.innerHTML = `<div class="container">
      <a class="brand" href="index.html">📝 BlogApp</a>
      <button class="menu-toggle" id="menuToggle" aria-label="Toggle menu">☰</button>
      <ul class="nav-links" id="navLinks">${items}</ul></div>`;
    $('#menuToggle').addEventListener('click', () => $('#navLinks').classList.toggle('open'));
    $('#logoutBtn')?.addEventListener('click', () => { Api.logout(); window.location.href = 'index.html'; });
  }
  const foot = $('#footer');
  if (foot) foot.textContent = `© ${new Date().getFullYear()} BlogApp · Express + MongoDB`;
}

function blogCard(b) {
  return `<article class="card blog-card">
    <span class="tag">${esc(b.category)}</span>
    <h3><a href="blog.html?id=${encodeURIComponent(b.id)}" style="color:inherit">${esc(b.title)}</a></h3>
    <p class="excerpt">${esc(excerpt(b.content))}</p>
    <div class="meta">by ${esc(b.authorName)} · ${fmtDate(b.createdAt)}</div>
    <a class="btn btn-outline btn-sm" href="blog.html?id=${encodeURIComponent(b.id)}" style="align-self:flex-start">Read more</a>
  </article>`;
}

/* ---------- Pages ---------- */
const Pages = {
  async home() {
    const grid = $('#blogGrid'), pager = $('#pagination');
    const state = { page: 1 };

    const load = async () => {
      grid.innerHTML = '<div class="loading">Loading blogs…</div>';
      try {
        const data = await Api.getBlogs({ page: state.page, search: $('#search').value.trim(), category: $('#category').value });
        grid.innerHTML = data.blogs.length ? data.blogs.map(blogCard).join('') : '<div class="empty">No blogs found.</div>';
        pager.innerHTML = data.pages > 1
          ? `<button class="btn btn-outline btn-sm" id="prev" ${data.page <= 1 ? 'disabled' : ''}>← Previous</button>
             <span>Page ${data.page} of ${data.pages}</span>
             <button class="btn btn-outline btn-sm" id="next" ${data.page >= data.pages ? 'disabled' : ''}>Next →</button>`
          : '';
        $('#prev')?.addEventListener('click', () => { state.page--; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
        $('#next')?.addEventListener('click', () => { state.page++; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      } catch (e) {
        grid.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
        pager.innerHTML = '';
      }
    };

    const reset = () => { state.page = 1; load(); };
    $('#search').addEventListener('input', debounce(reset));
    $('#category').addEventListener('change', reset);

    const cta = $('#heroCta');
    if (Api.currentUser()) { cta.textContent = 'Write a blog'; cta.href = 'create-blog.html'; }
    load();
  },

  register() {
    redirectIfLoggedIn();
    $('#registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, err = $('#formError'), btn = f.querySelector('button[type=submit]');
      err.textContent = '';
      const name = f.name.value.trim(), email = f.email.value.trim(), pw = f.password.value;
      if (name.length < 2) return (err.textContent = 'Please enter your name.');
      if (pw.length < 6) return (err.textContent = 'Password must be at least 6 characters.');
      if (pw !== f.confirm.value) return (err.textContent = 'Passwords do not match.');
      btn.disabled = true;
      try {
        await Api.register({ name, email, password: pw });
        toast('Account created!', 'success');
        setTimeout(() => (window.location.href = 'dashboard.html'), 600);
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    });
  },

  login() {
    redirectIfLoggedIn();
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, err = $('#formError'), btn = f.querySelector('button[type=submit]');
      err.textContent = '';
      btn.disabled = true;
      try {
        await Api.login({ email: f.email.value, password: f.password.value });
        window.location.href = 'dashboard.html';
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    });
  },

  async dashboard() {
    if (!requireLogin()) return;
    const user = Api.currentUser();
    $('#welcome').textContent = `Welcome back, ${user.name}!`;
    const list = $('#myPosts');

    const render = async () => {
      list.innerHTML = '<div class="loading">Loading your posts…</div>';
      let mine;
      try { mine = await Api.getMyBlogs(); }
      catch (e) { if (!Api.currentUser()) return requireLogin(); list.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; return; }

      $('#statPosts').textContent = mine.length;
      $('#statWords').textContent = mine.reduce((n, b) => n + wordCount(b.content), 0);
      $('#statLatest').textContent = mine[0] ? fmtDate(mine[0].createdAt) : '—';
      list.innerHTML = mine.length
        ? mine.map((b) => `<div class="card post-row">
            <div><h3>${esc(b.title)}</h3><div class="meta">${esc(b.category)} · ${fmtDate(b.createdAt)}</div></div>
            <div class="post-actions">
              <a class="btn btn-outline btn-sm" href="blog.html?id=${encodeURIComponent(b.id)}">View</a>
              <a class="btn btn-sm" href="create-blog.html?edit=${encodeURIComponent(b.id)}">Edit</a>
              <button class="btn btn-danger btn-sm" data-del="${esc(b.id)}">Delete</button>
            </div></div>`).join('')
        : '<div class="card empty">You haven\'t written any posts yet. <a href="create-blog.html">Create your first blog</a>.</div>';
    };

    list.addEventListener('click', async (e) => {
      const id = e.target.dataset.del;
      if (id && confirm('Delete this post? This cannot be undone.')) {
        try { await Api.deleteBlog(id); toast('Post deleted', 'success'); render(); }
        catch (ex) { toast(ex.message, 'error'); }
      }
    });
    render();
  },

  async create() {
    if (!requireLogin()) return;
    const f = $('#blogForm'), content = f.content, counter = $('#charCount');
    const editId = new URLSearchParams(location.search).get('edit');
    let existing = null;

    if (editId) {
      try {
        existing = await Api.getBlog(editId);
        if (existing.authorId !== Api.currentUser().id) throw new Error('You can only edit your own posts.');
      } catch (ex) {
        toast(ex.message, 'error');
        return setTimeout(() => (window.location.href = 'dashboard.html'), 1000);
      }
      $('#pageTitle').textContent = 'Edit blog';
      $('#submitBtn').textContent = 'Save changes';
      f.title.value = existing.title; f.category.value = existing.category; f.content.value = existing.content;
    }
    const count = () => (counter.textContent = `${wordCount(content.value)} words`);
    content.addEventListener('input', count); count();

    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#formError'), btn = $('#submitBtn');
      err.textContent = '';
      const data = { title: f.title.value, category: f.category.value, content: f.content.value };
      if (data.title.trim().length < 3) return (err.textContent = 'Title must be at least 3 characters.');
      if (wordCount(data.content) < 10) return (err.textContent = 'Content must be at least 10 words.');
      btn.disabled = true;
      try {
        const blog = existing ? await Api.updateBlog(existing.id, data) : await Api.createBlog(data);
        toast(existing ? 'Changes saved' : 'Blog published!', 'success');
        setTimeout(() => (window.location.href = `blog.html?id=${encodeURIComponent(blog.id)}`), 700);
      } catch (ex) {
        err.textContent = ex.message; btn.disabled = false;
        if (!Api.currentUser()) setTimeout(() => (window.location.href = 'login.html'), 1200);
      }
    });
  },

  async detail() {
    const box = $('#article');
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { box.innerHTML = '<div class="empty">No blog specified. <a href="index.html">Back to home</a></div>'; return; }
    try {
      const b = await Api.getBlog(id);
      document.title = `${b.title} | BlogApp`;
      const me = Api.currentUser();
      const owner = me && me.id === b.authorId;
      const edited = b.updatedAt && new Date(b.updatedAt) - new Date(b.createdAt) > 60000;
      box.innerHTML = `
        <span class="tag">${esc(b.category)}</span>
        <h1>${esc(b.title)}</h1>
        <div class="meta">by ${esc(b.authorName)} · ${fmtDate(b.createdAt)}${edited ? ` · edited ${fmtDate(b.updatedAt)}` : ''} · ${wordCount(b.content)} words</div>
        <div class="body">${esc(b.content)}</div>
        <div class="actions">
          <a class="btn btn-outline btn-sm" href="index.html">← All blogs</a>
          ${owner ? `<a class="btn btn-sm" href="create-blog.html?edit=${encodeURIComponent(b.id)}">Edit</a>
                     <button class="btn btn-danger btn-sm" id="delBtn">Delete</button>` : ''}
        </div>`;
      $('#delBtn')?.addEventListener('click', async () => {
        if (!confirm('Delete this post? This cannot be undone.')) return;
        try { await Api.deleteBlog(b.id); toast('Post deleted', 'success'); setTimeout(() => (window.location.href = 'dashboard.html'), 600); }
        catch (ex) { toast(ex.message, 'error'); }
      });
    } catch (e) {
      box.innerHTML = `<div class="empty"><h2>Blog not available</h2><p>${esc(e.message)}</p><a href="index.html">← Back to home</a></div>`;
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  renderChrome();
  Pages[document.body.dataset.page]?.();
});
