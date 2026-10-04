const REVIEWS_KEY = "igh_kinglegacy_reviews";
const SESSION_KEY = "igh_kinglegacy_session";
const CLIENT_ID_KEY = "igh_kinglegacy_client_id";
let communityReviewsCache = null;
let communityStatsCache = null;

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

async function renderCommunity(reviews = getReviews(), stats = null) {
  communityReviewsCache = reviews;
  stats = stats || communityStatsCache || await getCommunityStats();
  communityStatsCache = stats;
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const total = document.getElementById("community-total-users");
  if (total) { total.textContent = stats.totalUsers; total.removeAttribute("aria-hidden"); }
  const online = document.getElementById("community-online-users");
  if (online) { online.textContent = stats.onlineUsers; online.removeAttribute("aria-hidden"); }
  const averageEl = document.getElementById("review-average");
  if (averageEl) { averageEl.textContent = average.toFixed(1); averageEl.removeAttribute("aria-hidden"); }
  const count = document.getElementById("review-count");
  if (count) { count.textContent = reviews.length; count.removeAttribute("aria-hidden"); }
  const list = document.getElementById("review-list");
  if (!list) return;
  list.innerHTML = reviews.length ? reviews.slice().reverse().slice(0, 5).map(review => `
    <article class="review-item">
      <div class="flex items-center justify-between gap-2">
        <span class="text-amber-300" aria-label="${t("review_stars", { count: review.rating })}">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</span>
        <time class="text-[11px] text-slate-400">${new Date(review.date).toLocaleDateString(currentLang === "th" ? "th-TH" : "en-US")}</time>
      </div>
      <p class="review-message text-sm mt-1">${escapeReviewText(review.text)}</p>
    </article>`).join("") : `<p class="text-sm text-slate-400 text-center py-3">${t("no_reviews")}</p>`;
  list.setAttribute("aria-busy", "false");
  document.getElementById("community-section")?.setAttribute("aria-busy", "false");
}
window.refreshCommunityTranslations = () => communityReviewsCache === null ? Promise.resolve() : renderCommunity(communityReviewsCache, communityStatsCache);

function escapeReviewText(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[char]));
}

document.addEventListener("DOMContentLoaded", () => {
  const communitySection = document.getElementById("community-section");
  const reviewList = document.getElementById("review-list");
  const skeletonTimer = setTimeout(() => {
    communitySection?.querySelectorAll(".skeleton-pending").forEach(element => element.classList.remove("skeleton-pending"));
  }, 200);
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
  window.addEventListener("online", () => renderCommunity());
  window.addEventListener("offline", () => renderCommunity());
  Promise.all([loadReviews(), getCommunityStats()])
    .then(([reviews, stats]) => renderCommunity(reviews, stats))
    .catch(error => {
      console.error("Could not load community reviews:", error);
      if (reviewList) reviewList.innerHTML = `<p class="text-sm text-rose-300">${t("community_load_failed")}</p>`;
      ["community-total-users", "community-online-users", "review-average", "review-count"].forEach(id => {
        const value = document.getElementById(id);
        if (value) { value.textContent = "—"; value.removeAttribute("aria-hidden"); }
      });
      communitySection?.setAttribute("aria-busy", "false");
      reviewList?.setAttribute("aria-busy", "false");
    })
    .finally(() => {
      clearTimeout(skeletonTimer);
      communitySection?.querySelectorAll(".skeleton-pending").forEach(element => element.classList.remove("skeleton-pending"));
    });
  setInterval(async () => {
    try { await fetch("/api/presence", { method: "POST", headers: { "X-Client-Id": getClientId() } }); } catch (e) { /* local demo mode */ }
  }, 30000);
});
