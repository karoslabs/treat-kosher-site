// Landing kit gallery viewer: a photo opens full screen; arrows, swipe and Esc. Without JavaScript the
// links open the 1600 px file itself, so nothing depends on this script.
(() => {
  const viewer = document.querySelector("[data-viewer]");
  if (!viewer || typeof viewer.showModal !== "function") return;
  const links = [...document.querySelectorAll("[data-full]")];
  const img = viewer.querySelector("[data-img]");
  const cap = viewer.querySelector("[data-cap]");
  let index = 0;
  let opener = null;
  const show = (i) => {
    index = (i + links.length) % links.length;
    const thumb = links[index].querySelector("img");
    img.src = links[index].getAttribute("href");
    img.alt = thumb.alt;
    cap.textContent = thumb.alt;
  };
  links.forEach((a, i) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      opener = a;
      show(i);
      viewer.showModal();
    }),
  );
  viewer.querySelector("[data-prev]").addEventListener("click", () => show(index - 1));
  viewer.querySelector("[data-next]").addEventListener("click", () => show(index + 1));
  viewer.querySelector("[data-close]").addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", (e) => e.target === viewer && viewer.close());
  viewer.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });
  viewer.addEventListener("close", () => opener && opener.focus());
  let x0 = null;
  viewer.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  viewer.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
    x0 = null;
  });
})();
