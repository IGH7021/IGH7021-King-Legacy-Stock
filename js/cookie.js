document.addEventListener("DOMContentLoaded", () => {
  const banner = document.getElementById("cookie-banner");
  if (!banner || localStorage.getItem("igh_cookie_consent") === "accepted") return;
  banner.classList.remove("hidden");
  document.getElementById("cookie-accept")?.addEventListener("click", () => {
    localStorage.setItem("igh_cookie_consent", "accepted");
    banner.classList.add("hidden");
  });
});