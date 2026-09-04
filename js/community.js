const REVIEWS_KEY = "igh_kinglegacy_reviews";
const SESSION_KEY = "igh_kinglegacy_session";
const CLIENT_ID_KEY = "igh_kinglegacy_client_id";

function getReviews() {
  try { return JSON.parse(localStorage.getItem(REVIEWS_KEY) || "[]"); }
  catch (e) { return []; }
}

async function loadReviews() {
  try {
    const response = await fetch("/api/reviews");
    if (!response.ok) throw new Error("reviews unavailable");
    const reviews = await response.json();
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
    return reviews;
  } catch (e) { return getReviews(); }
}

function getClientId() {
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) { clientId = crypto.randomUUID(); localStorage.setItem(CLIENT_ID_KEY, clientId); }
  return clientId;
}

async function getCommunityStats() {
  const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null") || { startedAt: Date.now() };
  session.lastSeen = Date.now();
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  try {
    const response = await fetch("/api/presence", { method: "POST", headers: { "X-Client-Id": getClientId() } });
    if (response.ok) return response.json();
  } catch (e) { /* local demo mode */ }
  return { totalUsers: 1, onlineUsers: navigator.onLine ? 1 : 0 };
}

async function renderCommunity(reviews = getReviews()) {
  const stats = await getCommunityStats();
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const total = document.getElementById("community-total-users");
  if (total) total.textContent = stats.totalUsers;
  const online = document.getElementById("community-online-users");
  if (online) online.textContent = stats.onlineUsers;
  const averageEl = document.getElementById("review-average");
  if (averageEl) averageEl.textContent = average.toFixed(1);
  const count = document.getElementById("review-count");
  if (count) count.textContent = reviews.length;
  const list = document.getElementById("review-list");
  if (!list) return;
  list.innerHTML = reviews.length ? reviews.slice().reverse().slice(0, 5).map(review => `
    <article class="review-item">
      <div class="flex items-center justify-between gap-2">
        <span class="text-amber-300" aria-label="${review.rating} stars">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</span>
        <time class="text-[11px] text-slate-400">${new Date(review.date).toLocaleDateString("th-TH")}</time>
      </div>
      <p class="text-sm mt-1">${escapeReviewText(review.text)}</p>
    </article>`).join("") : `<p class="text-sm text-slate-400 text-center py-3">${t("no_reviews")}</p>`;
}

function escapeReviewText(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[char]));
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("review-form").addEventListener("submit", async event => {
    event.preventDefault();
    const text = document.getElementById("review-text").value.trim();
    const rating = Number(document.querySelector("input[name=rating]:checked")?.value);
    if (!text || rating < 1 || rating > 5) return;
    const review = { rating, text, date: Date.now() };
    let reviews = getReviews();
    try {
      const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(review) });
      if (!response.ok) throw new Error("review unavailable");
      reviews = await response.json();
    } catch (e) {
      reviews.push(review);
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
    }
    event.target.reset();
    renderCommunity(reviews);
    toast(t("review_saved"));
  });
  window.addEventListener("online", renderCommunity);
  window.addEventListener("offline", renderCommunity);
  loadReviews().then(renderCommunity);
  setInterval(async () => {
    try { await fetch("/api/presence", { method: "POST", headers: { "X-Client-Id": getClientId() } }); } catch (e) { /* local demo mode */ }
  }, 30000);
});
