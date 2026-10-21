/* ==========================================================
   api.js – talks to the Express + MongoDB backend via fetch()
   (replaces the localStorage store from Module 1)
   ========================================================== */
const Api = (() => {
  const BASE = '/api';
  const TOKEN = 'bb_token', USER = 'bb_user';

  async function request(path, { method = 'GET', body, auth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const t = localStorage.getItem(TOKEN);
      if (t) headers.Authorization = `Bearer ${t}`;
    }
    let res;
    try {
      res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new Error('Cannot reach the server. Is it running?');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && auth) { localStorage.removeItem(TOKEN); localStorage.removeItem(USER); }
      throw new Error(data.message || 'Request failed.');
    }
    return data;
  }

  const saveSession = (data) => {
    localStorage.setItem(TOKEN, data.token);
    localStorage.setItem(USER, JSON.stringify(data.user));
    return data.user;
  };

  return {
    /* ---- session ---- */
    currentUser() {
      if (!localStorage.getItem(TOKEN)) return null;
      try { return JSON.parse(localStorage.getItem(USER)); } catch { return null; }
    },
    logout() { localStorage.removeItem(TOKEN); localStorage.removeItem(USER); },

    /* ---- auth ---- */
    async register(payload) { return saveSession(await request('/auth/register', { method: 'POST', body: payload })); },
    async login(payload) { return saveSession(await request('/auth/login', { method: 'POST', body: payload })); },

    /* ---- blogs ---- */
    getBlogs({ page = 1, limit = 9, search = '', category = '' } = {}) {
      const q = new URLSearchParams({ page, limit });
      if (search) q.set('search', search);
      if (category) q.set('category', category);
      return request(`/blogs?${q}`);
    },
    async getBlog(id) { return (await request(`/blogs/${encodeURIComponent(id)}`)).blog; },
    async getMyBlogs() { return (await request('/blogs/mine', { auth: true })).blogs; },
    async createBlog(data) { return (await request('/blogs', { method: 'POST', body: data, auth: true })).blog; },
    async updateBlog(id, data) { return (await request(`/blogs/${encodeURIComponent(id)}`, { method: 'PUT', body: data, auth: true })).blog; },
    deleteBlog(id) { return request(`/blogs/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }); },
  };
})();
