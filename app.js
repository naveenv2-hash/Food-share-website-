const API = "/api";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let currentUser = null;
let token = localStorage.getItem("foodshare_token") || "";
let authMode = "login";
let availableOnly = true;
let toastTimer;

const icons = { "Prepared meals": "🍱", "Bakery": "🥖", "Produce": "🥬", "Dairy": "🥛", "Packaged goods": "🥫" };
const colorClasses = ["", "peach", "blue", "lime", "pink", "gold", "green"];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Pickup time to be confirmed";
  return d.toLocaleString([], { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });
}
function timeLeft(value) {
  const diff = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(diff)) return "Check pickup deadline";
  if (diff <= 0) return "Pickup deadline passed";
  const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `Pickup in ${h}h ${m}m` : `Pickup in ${Math.max(1,m)}m`;
}
function showToast(message) {
  const el = $("#toast"); el.textContent = message; el.classList.remove("hidden");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add("hidden"), 3200);
}
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(API + path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) { logout(false); }
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}
function setCurrentUser(user, newToken) {
  currentUser = user;
  if (newToken) { token = newToken; localStorage.setItem("foodshare_token", token); }
  renderHeader();
}
function logout(showMessage = true) {
  token = ""; currentUser = null; localStorage.removeItem("foodshare_token"); renderHeader();
  $("#dashboard-modal").classList.add("hidden");
  if (showMessage) showToast("You've been logged out. See you soon!");
}
function renderHeader() {
  const el = $("#header-actions");
  if (!currentUser) {
    el.innerHTML = '<button class="btn btn-ghost" data-open-auth="login">Log in</button><button class="btn btn-dark" data-open-auth="register">Join FoodShare <span>↗</span></button>';
  } else {
    const role = currentUser.role === "recipient" ? "Recipient" : currentUser.role === "admin" ? "Admin" : "Donor";
    el.innerHTML = `<button class="btn btn-ghost" id="header-dashboard">Hi, ${escapeHtml((currentUser.name || "friend").split(" ")[0])}</button>${currentUser.role !== "recipient" && currentUser.role !== "admin" ? '<button class="btn btn-dark" id="header-list">+ List food</button>' : ''}<button class="btn btn-dark" id="header-open-dashboard">${role} space ↗</button>`;
  }
  bindHeaderActions();
}
function bindHeaderActions() {
  $$("[data-open-auth]").forEach(btn => btn.onclick = () => openAuth(btn.dataset.openAuth));
  const open = () => openDashboard();
  const dash = $("#header-dashboard"); if (dash) dash.onclick = open;
  const dash2 = $("#header-open-dashboard"); if (dash2) dash2.onclick = open;
  const list = $("#header-list"); if (list) list.onclick = () => openDonation();
}
function openAuth(mode = "login") {
  if (currentUser) { openDashboard(); return; }
  setAuthMode(mode); $("#auth-modal").classList.remove("hidden"); document.body.style.overflow = "hidden";
  $("#auth-error").classList.add("hidden");
}
function closeModal(id) {
  $("#" + id).classList.add("hidden");
  if ($$(".modal-backdrop:not(.hidden)").length === 0) document.body.style.overflow = "";
}
function setAuthMode(mode) {
  authMode = mode;
  $$(".auth-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.authMode === mode));
  $("#name-field").classList.toggle("hidden", mode !== "register");
  $("#role-field").classList.toggle("hidden", mode !== "register");
  $("#org-field").classList.toggle("hidden", mode !== "register");
  $("#auth-name").required = mode === "register";
  $("#auth-password").autocomplete = mode === "register" ? "new-password" : "current-password";
  $("#modal-title").innerHTML = mode === "register" ? "Make room for<br><em>good things.</em>" : "Welcome to<br><em>FoodShare.</em>";
  $("#auth-submit").innerHTML = mode === "register" ? "Create my account <span>↗</span>" : "Log in <span>↗</span>";
  $("#auth-error").classList.add("hidden");
}
async function loadFoods() {
  const params = new URLSearchParams();
  const search = $("#search-input").value.trim(), category = $("#category-filter").value;
  if (search) params.set("search", search);
  if (category !== "all") params.set("category", category);
  params.set("status", availableOnly ? "available" : "all");
  try {
    const data = await api("/foods?" + params.toString());
    renderFoods(data.foods || []);
  } catch (err) {
    $("#food-grid").innerHTML = `<div class="loading-card">Could not load donations: ${escapeHtml(err.message)}</div>`;
  }
}
function renderFoods(foods) {
  const grid = $("#food-grid");
  $("#empty-state").classList.toggle("hidden", foods.length > 0);
  if (!foods.length) { grid.innerHTML = ""; return; }
  grid.innerHTML = foods.map((food, index) => {
    const color = colorClasses[(index % (colorClasses.length - 1)) + 1];
    const icon = icons[food.category] || "🍱";
    const status = food.status || "available";
    const isRecipient = currentUser && currentUser.role === "recipient";
    const isOwner = currentUser && (currentUser.id === food.donorId || currentUser.role === "admin");
    let action = "";
    if (status === "available" && isRecipient) action = `<button class="card-action" data-claim="${escapeHtml(food.id)}">Claim donation ↗</button>`;
    else if (status === "available" && !currentUser) action = `<button class="card-action" data-signin>Log in to claim ↗</button>`;
    else if (status === "available" && isOwner) action = `<button class="card-action" data-complete="${escapeHtml(food.id)}">Mark complete ✓</button>`;
    else if (status === "claimed") action = `<button class="card-action" disabled>Claimed ✓</button>`;
    else action = `<button class="card-action" disabled>Shared with care ✓</button>`;
    return `<article class="food-card">
      <div class="food-art ${color}"><span class="food-tag ${status === "claimed" ? "claimed" : ""}">${status === "available" ? "● Available" : status === "claimed" ? "↗ Claimed" : "✓ Completed"}</span><span class="big-food">${escapeHtml(food.image && food.image.length < 12 ? food.image : icon)}</span></div>
      <div class="food-body"><div class="food-card-top"><h3>${escapeHtml(food.title)}</h3><span class="quantity">${escapeHtml(food.quantity)}</span></div>
      <p class="food-description">${escapeHtml(food.description || "A little extra food, ready to make a difference.")}</p>
      <div class="food-meta"><span>⌖</span><div>${escapeHtml(food.location)}<small>Pickup location</small></div></div>
      <div class="food-meta"><span>◷</span><div>${escapeHtml(formatDate(food.pickupBy))}<small>${escapeHtml(timeLeft(food.pickupBy))}</small></div></div>
      <hr class="food-divider"><div class="food-card-footer"><span class="donor-mini">From ${escapeHtml(food.donorName || "FoodShare donor")}</span>${action}</div></div>
    </article>`;
  }).join("");
  $$("[data-claim]").forEach(btn => btn.onclick = () => claimFood(btn.dataset.claim));
  $$("[data-signin]").forEach(btn => btn.onclick = () => openAuth("login"));
  $$("[data-complete]").forEach(btn => btn.onclick = () => completeFood(btn.dataset.complete));
}
async function claimFood(id) {
  try {
    const result = await api(`/foods/${encodeURIComponent(id)}/claim`, { method: "POST", body: "{}" });
    showToast(result.message || "Donation claimed. Please coordinate pickup!");
    await loadFoods(); if ($("#dashboard-modal") && !$("#dashboard-modal").classList.contains("hidden")) await openDashboard();
  } catch (e) { showToast(e.message); }
}
async function completeFood(id) {
  try { await api(`/foods/${encodeURIComponent(id)}/complete`, { method: "POST", body: "{}" }); showToast("Donation marked as completed. Thank you!"); await loadFoods(); }
  catch (e) { showToast(e.message); }
}
function openDonation() {
  if (!currentUser) return openAuth("login");
  if (!["donor", "admin"].includes(currentUser.role)) return showToast("Recipient accounts can claim donations from the food cards.");
  $("#donation-form").reset(); $("#donation-error").classList.add("hidden");
  const dt = new Date(Date.now() + 6 * 3600000); dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  $("#food-deadline").min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
  $("#food-deadline").value = dt.toISOString().slice(0,16);
  $("#donation-modal").classList.remove("hidden"); document.body.style.overflow = "hidden";
}
async function openDashboard() {
  if (!currentUser) return openAuth("login");
  $("#dashboard-modal").classList.remove("hidden"); document.body.style.overflow = "hidden";
  $("#dashboard-content").innerHTML = '<p class="dashboard-note">Loading your FoodShare space…</p>';
  try {
    const data = await api("/dashboard");
    const stats = data.stats || {};
    let html = `<div class="dashboard-welcome"><div><strong>Welcome, ${escapeHtml(currentUser.name)}!</strong><small>${escapeHtml(currentUser.organization || currentUser.email)}</small></div><span class="role-pill">${escapeHtml(currentUser.role)}</span></div>
    <div class="dash-stats"><div class="dash-stat"><strong>${stats.available || 0}</strong><span>Available listings</span></div><div class="dash-stat"><strong>${stats.claimed || 0}</strong><span>Claimed</span></div><div class="dash-stat"><strong>${stats.completed || 0}</strong><span>Completed</span></div></div>`;
    if (currentUser.role === "admin") {
      html += `<h3 class="dashboard-section-title">Community members</h3><div class="dashboard-list">${(data.users || []).map(u => `<div class="dashboard-item"><div><strong>${escapeHtml(u.name)} ${u.verified ? "✓" : ""}</strong><small>${escapeHtml(u.email)} · ${escapeHtml(u.role)}</small></div><button class="tiny-btn" data-verify="${escapeHtml(u.id)}">${u.verified ? "Unverify" : "Verify"}</button></div>`).join("") || "<p class='dashboard-note'>No users yet.</p>"}</div>`;
    }
    html += `<h3 class="dashboard-section-title">${currentUser.role === "admin" ? "Recent community listings" : "Your donations & claims"}</h3><div class="dashboard-list">${(currentUser.role === "admin" ? data.recentFoods : data.myFoods).map(f => `<div class="dashboard-item"><div><strong>${escapeHtml(f.title)}</strong><small>${escapeHtml(f.quantity)} · ${escapeHtml(f.location)}</small><small>${f.claimedByName ? "Claimed by " + escapeHtml(f.claimedByName) + " · " : ""}${escapeHtml(formatDate(f.pickupBy))}</small></div><div><span class="status-pill ${escapeHtml(f.status)}">${escapeHtml(f.status)}</span><div class="dashboard-actions" style="margin-top:6px">${f.status !== "completed" && (currentUser.role === "admin" || f.donorId === currentUser.id || f.claimedBy === currentUser.id) ? `<button class="tiny-btn" data-dash-complete="${escapeHtml(f.id)}">Complete</button>` : ""}${currentUser.role === "admin" || f.donorId === currentUser.id ? `<button class="tiny-btn danger" data-delete="${escapeHtml(f.id)}">Remove</button>` : ""}</div></div></div>`).join("") || "<p class='dashboard-note'>Nothing here yet. Your next good thing could start today.</p>"}</div>`;
    html += `<p class="dashboard-note">Please confirm food safety, ingredients, allergens and pickup arrangements directly with the other party. New community accounts may require offline verification.</p>`;
    $("#dashboard-content").innerHTML = html;
    $$("[data-verify]").forEach(btn => btn.onclick = async () => {
      try { await api(`/admin/users/${encodeURIComponent(btn.dataset.verify)}/verify`, { method:"PATCH", body:"{}" }); showToast("Member verification updated."); openDashboard(); }
      catch (e) { showToast(e.message); }
    });
    $$("[data-dash-complete]").forEach(btn => btn.onclick = async () => {
      try { await api(`/foods/${encodeURIComponent(btn.dataset.dashComplete)}/complete`, { method:"POST", body:"{}" }); showToast("Donation completed."); openDashboard(); loadFoods(); }
      catch (e) { showToast(e.message); }
    });
    $$("[data-delete]").forEach(btn => btn.onclick = async () => {
      if (!confirm("Remove this food listing? This cannot be undone.")) return;
      try { await api(`/foods/${encodeURIComponent(btn.dataset.delete)}`, { method:"DELETE" }); showToast("Listing removed."); openDashboard(); loadFoods(); }
      catch (e) { showToast(e.message); }
    });
  } catch (e) { $("#dashboard-content").innerHTML = `<p class="form-error">${escapeHtml(e.message)}</p>`; }
}
async function submitAuth(event) {
  event.preventDefault();
  const form = new FormData($("#auth-form"));
  const payload = Object.fromEntries(form.entries());
  $("#auth-error").classList.add("hidden");
  const endpoint = authMode === "register" ? "/auth/register" : "/auth/login";
  try {
    const data = await api(endpoint, { method:"POST", body:JSON.stringify(payload) });
    setCurrentUser(data.user, data.token); closeModal("auth-modal"); $("#auth-form").reset();
    showToast(authMode === "register" ? "Welcome to FoodShare! You're all set." : `Welcome back, ${data.user.name.split(" ")[0]}!`);
    await loadFoods();
    if (data.user.role === "recipient" || data.user.role === "admin") openDashboard();
  } catch (e) { $("#auth-error").textContent = e.message; $("#auth-error").classList.remove("hidden"); }
}
async function submitDonation(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData($("#donation-form")).entries());
  payload.pickupBy = new Date(payload.pickupBy).toISOString();
  $("#donation-error").classList.add("hidden");
  try {
    await api("/foods", { method:"POST", body:JSON.stringify(payload) });
    closeModal("donation-modal"); showToast("Your donation is live. Thanks for sharing good!"); await loadFoods();
  } catch (e) { $("#donation-error").textContent = e.message; $("#donation-error").classList.remove("hidden"); }
}
async function restoreSession() {
  if (!token) return;
  try { const data = await api("/auth/me"); setCurrentUser(data.user); }
  catch { token = ""; localStorage.removeItem("foodshare_token"); }
}
function debounce(fn, wait) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); }; }

$("#auth-form").addEventListener("submit", submitAuth);
$("#donation-form").addEventListener("submit", submitDonation);
$("#close-auth").onclick = () => closeModal("auth-modal");
$("#close-donation").onclick = () => closeModal("donation-modal");
$("#close-dashboard").onclick = () => closeModal("dashboard-modal");
$("#logout-button").onclick = () => logout(true);
$$("[data-auth-mode]").forEach(tab => tab.onclick = () => setAuthMode(tab.dataset.authMode));
$("#use-demo").onclick = () => {
  $("#auth-email").value = "donor@foodshare.demo"; $("#auth-password").value = "FoodShare123!";
  setAuthMode("login"); $("#auth-error").classList.add("hidden");
};
$("#available-filter").onclick = () => {
  availableOnly = !availableOnly;
  $("#available-filter").classList.toggle("active", availableOnly);
  $("#available-filter").innerHTML = availableOnly ? 'Available now <span class="live-dot"></span>' : 'All listings <span>↗</span>';
  loadFoods();
};
$("#search-input").addEventListener("input", debounce(loadFoods, 220));
$("#category-filter").addEventListener("change", loadFoods);
$("#menu-toggle").onclick = () => $(".main-nav").classList.toggle("open");
$$(".main-nav a").forEach(a => a.addEventListener("click", () => $(".main-nav").classList.remove("open")));
$$(".modal-backdrop").forEach(backdrop => backdrop.addEventListener("click", e => { if (e.target === backdrop) closeModal(backdrop.id); }));
document.addEventListener("keydown", e => { if (e.key === "Escape") $$(".modal-backdrop:not(.hidden)").forEach(m => closeModal(m.id)); });
async function loadStats() {
  try {
    const d = await api("/foods?status=all");
    const foods = d.foods || [];
    $("#stat-available").textContent = foods.filter(f => f.status === "available").length.toString().padStart(2, "0");
    $("#stat-claimed").textContent = foods.filter(f => f.status === "claimed" || f.status === "completed").length.toString().padStart(2, "0");
    $("#stat-meals").textContent = (foods.filter(f => f.status === "completed").length * 4).toString().padStart(2, "0");
  } catch {}
}
(async function init() {
  await restoreSession(); renderHeader(); await loadFoods(); await loadStats();
})();
