/* The built HTML is the finished state, so the specimen reads fully without JS
   and under reduced motion. Playing it drops data-play, forces a style flush and
   sets it again so the keyframes restart from the top. */
const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function play(el: HTMLElement) {
  if (reduce()) return;
  el.removeAttribute("data-play");
  void el.offsetWidth;
  el.setAttribute("data-play", "on");
}

document.querySelectorAll<HTMLElement>("[data-specimen]").forEach((el) => {
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        play(el);
        io.disconnect();
      }
    },
    { threshold: 0.35 },
  );
  io.observe(el);
  el.querySelector("[data-replay]")?.addEventListener("click", () => play(el));
});
