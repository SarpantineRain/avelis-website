/* AVÉLIS — film controls, end card on portrait screens, header state, menu, page transition, scroll reveal. No dependencies. */
(function () {
  "use strict";

  var ICON_PLAY = "M4 2l10 6-10 6z";
  var ICON_PAUSE = "M4 2h3v12H4zM9 2h3v12H9z";
  var root = document.documentElement;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  var hasObserver = "IntersectionObserver" in window;

  /* Keeps one play/pause button in sync with its video. The button follows the video's own events,
     so it is also right when autoplay is refused (for example in iOS Low Power Mode). */
  function bindToggle(video, button) {
    var label = button.querySelector("[data-toggle-label]");
    var icon = button.querySelector("[data-icon]");

    function render() {
      var playing = !video.paused;
      label.textContent = playing ? "Pause" : "Play";
      icon.setAttribute("d", playing ? ICON_PAUSE : ICON_PLAY);
      button.setAttribute("aria-label", (playing ? "Pause" : "Play") + " the film");
    }

    function toggle() {
      if (video.paused) {
        video.dataset.userPaused = "";
        var attempt = video.play();
        if (attempt) attempt.catch(render);
      } else {
        video.dataset.userPaused = "1";
        video.pause();
      }
    }

    button.addEventListener("click", toggle);
    video.addEventListener("play", render);
    video.addEventListener("pause", render);

    /* If the file cannot load, the poster stays visible and the control says so. */
    video.querySelectorAll("source").forEach(function (source, index, all) {
      if (index !== all.length - 1) return;
      source.addEventListener("error", function () {
        video.dataset.failed = "1";
        button.disabled = true;
        label.textContent = "Film unavailable";
        button.setAttribute("aria-label", "Film unavailable");
      });
    });

    render();
    return toggle;
  }

  /* Off-screen videos stop decoding, and resume only if the visitor had not paused them. */
  function pauseWhenHidden(video, resume) {
    if (!hasObserver) return;
    new IntersectionObserver(function (entries) {
      var entry = entries[entries.length - 1];
      if (!entry.isIntersecting) {
        if (!video.paused) {
          video.dataset.autoPaused = "1";
          video.pause();
        }
      } else if (resume && video.dataset.autoPaused && !video.dataset.userPaused && !video.dataset.failed) {
        video.dataset.autoPaused = "";
        var attempt = video.play();
        if (attempt) attempt.catch(function () {});
      }
    }, { threshold: 0.05 }).observe(video);
  }

  /* Hero film: muted autoplay from the markup, unless the visitor asks for less motion or less data. */
  var heroVideo = document.querySelector("[data-hero-video]");
  var heroToggle = document.querySelector("[data-hero-toggle]");
  var hero = document.querySelector("[data-hero]");
  if (heroVideo && heroToggle) {
    bindToggle(heroVideo, heroToggle);
    if (reducedMotion || saveData) {
      heroVideo.removeAttribute("autoplay");
      heroVideo.dataset.userPaused = "1";
      heroVideo.pause();
    }
    pauseWhenHidden(heroVideo, true);
    bindEndCard(heroVideo, hero);
  }

  /* Portrait screens only. Frame 745 (31.0 s) is pure violet: switching there, from the cropped film to the
     whole frame on the same violet page, cannot be seen. A frame of delay only shows more of the same violet.
     Just before the loop the film fades out, which hides the switch back to the crop. */
  function bindEndCard(video, section) {
    var END_CARD = 31.0;
    var CLOSING = 33.72;
    var portrait = window.matchMedia("(max-aspect-ratio: 5/6)");

    function sync(time) {
      var inEndCard = portrait.matches && time >= END_CARD;
      root.classList.toggle("is-endcard", inEndCard);
      root.classList.toggle("is-closing", inEndCard && time >= CLOSING && !video.paused);
    }
    function fromElement() { sync(video.currentTime); }

    if (video.requestVideoFrameCallback) {
      var onFrame = function (now, frame) {
        sync(frame.mediaTime);
        video.requestVideoFrameCallback(onFrame);
      };
      video.requestVideoFrameCallback(onFrame);
    }
    ["timeupdate", "seeked", "pause"].forEach(function (name) {
      video.addEventListener(name, fromElement);
    });
    if (portrait.addEventListener) portrait.addEventListener("change", fromElement);
  }

  /* Film section: starts only on a press, muted until the visitor turns the sound on.
     The title sits over the still; once the film runs it fades, because bright shots would make it unreadable. */
  var film = document.querySelector("[data-film]");
  var filmVideo = document.querySelector("[data-film-video]");
  var filmToggle = document.querySelector("[data-film-toggle]");
  var soundToggle = document.querySelector("[data-sound-toggle]");
  if (filmVideo && filmToggle) {
    filmVideo.removeAttribute("controls");
    var toggleFilm = bindToggle(filmVideo, filmToggle);
    filmVideo.addEventListener("click", toggleFilm);
    filmVideo.addEventListener("play", function () { film.classList.add("is-playing"); });
    pauseWhenHidden(filmVideo, false);
    if (soundToggle) {
      soundToggle.addEventListener("click", function () {
        filmVideo.muted = !filmVideo.muted;
        soundToggle.textContent = filmVideo.muted ? "Sound off" : "Sound on";
        soundToggle.setAttribute("aria-pressed", String(!filmVideo.muted));
      });
    }
  }

  /* Header: transparent over the hero, a thin ivory surface everywhere else. */
  var header = document.querySelector("[data-header]");
  if (header && hero && hasObserver) {
    new IntersectionObserver(function (entries) {
      var entry = entries[entries.length - 1];
      header.classList.toggle("is-solid", !entry.isIntersecting);
    }, { rootMargin: "-72px 0px 0px 0px" }).observe(hero);
  } else if (header) {
    header.classList.add("is-solid");
  }

  /* Menu on phones and portrait tablets. The native dialog provides the focus trap and the Escape key. */
  var menu = document.querySelector("[data-menu]");
  var menuOpen = document.querySelector("[data-menu-open]");
  var menuClose = document.querySelector("[data-menu-close]");
  if (menu && menuOpen && menuClose && menu.showModal) {
    menuOpen.addEventListener("click", function () { menu.showModal(); });
    menuClose.addEventListener("click", function () { menu.close(); });
    menu.querySelectorAll("[data-menu-link]").forEach(function (link) {
      link.addEventListener("click", function () { menu.close(); });
    });
  }

  /* Page transition, where the browser supports it: from Discover, the product image itself travels to the new page.
     Only the clicked image is named, so that images elsewhere on a long page never fly in from off-screen. */
  document.addEventListener("click", function (event) {
    var link = event.target.closest("[data-product-link]");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var holder = link.closest(".comp, .related__item");
    var image = holder && holder.querySelector("img");
    var hero = document.querySelector(".pdp__product");     // from a product page: only one image may carry the name
    if (hero) hero.style.viewTransitionName = "none";
    if (image) image.style.viewTransitionName = "product-hero";
  });
  window.addEventListener("pageshow", function () {
    var hero = document.querySelector(".pdp__product");
    if (hero) hero.style.viewTransitionName = "";
    document.querySelectorAll("[data-product-link]").forEach(function (link) {
      var holder = link.closest(".comp, .related__item");
      var image = holder && holder.querySelector("img");
      if (image) image.style.viewTransitionName = "";
    });
  });

  /* One soft entrance per composition. Without IntersectionObserver, or with reduced motion, everything simply shows. */
  var reveals = document.querySelectorAll(".reveal");
  if (hasObserver && !reducedMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
    reveals.forEach(function (el) { revealObserver.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }
})();
