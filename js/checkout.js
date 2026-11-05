/* AVÉLIS — demonstration checkout. Runs entirely in the browser: there is no server, no network request and no payment.
   Contact and shipping details stay in this page's memory only: they are never stored or sent, and a refresh clears them.
   The only thing kept after completion is the demo reference and the products, for this tab, so that a refresh keeps the screen. */
(function () {
  "use strict";

  var store = window.AVELIS_STORE;
  if (!store) return;

  var CONFIRMATION_KEY = "avelis.demo-confirmation.v1";
  var ORDER = ["bag", "contact", "shipping", "summary"];
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var wide = window.matchMedia("(min-width: 960px)");

  var details = { contact: null, shipping: null };   // in memory only

  var SAMPLE = {
    contact: { "first-name": "Alex", "last-name": "Morgan", "email": "alex.morgan@example.com" },
    shipping: { "address": "1 Example Street", "address2": "", "city": "Sampleton", "postcode": "00000", "country": "Demonstration Country" }
  };

  function required(name, message, min) {
    return function (value) { return value.length >= (min || 2) ? "" : message; };
  }
  var RULES = {
    "first-name": required("first-name", "Enter a first name."),
    "last-name": required("last-name", "Enter a last name."),
    "email": function (value) {
      if (!value) return "Enter an email address.";
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? "" : "Enter an email in the format name@example.com.";
    },
    "address": required("address", "Enter an address.", 3),
    "city": required("city", "Enter a city."),
    "postcode": function (value) {
      if (!value) return "Enter a postal code.";
      return /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/.test(value) ? "" : "Use 2 to 10 letters, numbers, spaces or hyphens.";
    },
    "country": required("country", "Enter a country.")
  };

  var q = function (selector, root) { return (root || document).querySelector(selector); };
  var qa = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
  var live = q("[data-live]");
  function say(message) { live.textContent = message; }

  function tick(element) {
    if (motion.matches || !element.animate) return;
    element.animate(
      [{ transform: "translateY(5px)", opacity: 0.25 }, { transform: "none", opacity: 1 }],
      { duration: 260, easing: "cubic-bezier(.23, 1, .32, 1)" }
    );
  }

  /* ---------------------------------------------------------------- saved confirmation */
  function readConfirmation() {
    try {
      var value = JSON.parse(window.sessionStorage.getItem(CONFIRMATION_KEY));
      return value && /^DEMO-[A-Z0-9]{6}$/.test(value.ref) && Array.isArray(value.items) ? value : memoryConfirmation;
    } catch (error) { return memoryConfirmation; }
  }
  var memoryConfirmation = null;
  function saveConfirmation(value) {
    memoryConfirmation = value;
    try { window.sessionStorage.setItem(CONFIRMATION_KEY, JSON.stringify(value)); } catch (error) { /* memory only */ }
  }
  function forgetConfirmation() {
    memoryConfirmation = null;
    try { window.sessionStorage.removeItem(CONFIRMATION_KEY); } catch (error) { /* nothing to do */ }
  }

  function createReference() {
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no easily confused characters
    var values = new Uint8Array(6);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(values);
    else for (var i = 0; i < 6; i++) values[i] = Math.floor(Math.random() * 256);
    return "DEMO-" + Array.prototype.map.call(values, function (v) { return alphabet[v % alphabet.length]; }).join("");
  }

  /* ---------------------------------------------------------------- bag lines */
  function metaFor(product) {
    return (product.volume ? product.volume + " · " : "") + store.format(product.price) + " each";
  }

  function createLine(id) {
    var product = store.product(id);
    var line = document.createElement("li");
    line.className = "line";
    line.dataset.id = id;
    line.innerHTML =
      '<span class="line__image line__image--' + id + '"><img src="' + store.url(product.thumb) + '" alt="" decoding="async"></span>' +
      '<div class="line__main">' +
        '<a class="d line__name" href="' + store.url(product.page) + '">' + product.name + '</a>' +
        '<p class="line__meta">' + metaFor(product) + '</p>' +
        '<div class="qty qty--small" role="group" aria-label="Quantity of ' + product.name + '">' +
          '<button type="button" data-step-qty="-1" aria-label="Decrease quantity of ' + product.name + '">−</button>' +
          '<output data-qty></output>' +
          '<button type="button" data-step-qty="1" aria-label="Increase quantity of ' + product.name + '">+</button>' +
        '</div>' +
      '</div>' +
      '<div class="line__side">' +
        '<p class="line__subtotal" data-subtotal></p>' +
        '<button class="line__remove" type="button" data-remove aria-label="Remove ' + product.name + ' from the bag">Remove</button>' +
      '</div>';
    return line;
  }

  function renderLines() {
    var list = q("[data-lines]");
    var items = store.items();
    var ids = items.map(function (row) { return row.id; });
    qa(".line", list).forEach(function (line) { if (ids.indexOf(line.dataset.id) === -1) line.remove(); });
    items.forEach(function (row, index) {
      var line = q('[data-id="' + row.id + '"]', list) || createLine(row.id);
      if (list.children[index] !== line) list.insertBefore(line, list.children[index] || null);
      var qty = q("[data-qty]", line);
      var subtotal = q("[data-subtotal]", line);
      if (qty.textContent !== String(row.qty)) {
        if (qty.textContent) { tick(qty); tick(subtotal); }
        qty.textContent = String(row.qty);
      }
      subtotal.textContent = store.format(row.qty * store.product(row.id).price);
      q('[data-step-qty="-1"]', line).setAttribute("aria-disabled", String(row.qty <= 1));
      q('[data-step-qty="1"]', line).setAttribute("aria-disabled", String(row.qty >= store.MAX_EACH));
    });
  }

  function renderAside() {
    var total = store.format(store.total());
    qa("[data-total]").forEach(function (el) { el.textContent = total; });
    q("[data-aside-total]").textContent = total;
    var list = q("[data-aside-lines]");
    list.textContent = "";
    store.items().forEach(function (row) {
      var product = store.product(row.id);
      var li = document.createElement("li");
      li.innerHTML = '<span class="line__image line__image--' + row.id + '"><img src="' + store.url(product.thumb) + '" alt="" decoding="async"></span>' +
        '<span class="aside__name"><span class="d">' + product.name + '</span><small>Quantity ' + row.qty + '</small></span>' +
        '<span class="aside__price">' + store.format(row.qty * product.price) + '</span>';
      list.appendChild(li);
    });
  }

  /* ---------------------------------------------------------------- forms */
  function fieldError(input, message) {
    var error = q("#" + input.id + "-error");
    error.textContent = message;
    error.hidden = !message;
    if (message) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", error.id);
    } else {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
    return !message;
  }
  function checkField(input) {
    var rule = RULES[input.name];
    return fieldError(input, rule ? rule(input.value.trim()) : "");
  }
  function readForm(form) {
    var data = {};
    qa("input", form).forEach(function (input) { data[input.name] = input.value.trim(); });
    return data;
  }

  qa("[data-form]").forEach(function (form) {
    var name = form.dataset.form;
    form.addEventListener("submit", function (event) {
      event.preventDefault();         // nothing is ever submitted: the form only moves to the next step
      var inputs = qa("input", form);
      var invalid = inputs.filter(function (input) { return !checkField(input); });
      if (invalid.length) {
        say(invalid.length === 1 ? "One field needs attention." : invalid.length + " fields need attention.");
        invalid[0].focus();
        return;
      }
      details[name] = readForm(form);
      location.hash = name === "contact" ? "shipping" : "summary";
    });
    /* An error clears as soon as it is corrected; nothing is flagged before the first attempt to continue. */
    form.addEventListener("input", function (event) {
      if (event.target.getAttribute("aria-invalid") === "true") checkField(event.target);
    });
    form.addEventListener("focusout", function (event) {
      if (event.target.matches && event.target.matches("input") && event.target.getAttribute("aria-invalid") === "true") checkField(event.target);
    });
  });

  qa("[data-sample]").forEach(function (button) {
    button.addEventListener("click", function () {
      var name = button.dataset.sample;
      var form = q('[data-form="' + name + '"]');
      Object.keys(SAMPLE[name]).forEach(function (key) {
        var input = form.elements[key];
        input.value = SAMPLE[name][key];
        fieldError(input, "");
      });
      say("Sample details filled in.");
      q('button[type="submit"]', form).focus();
    });
  });

  function renderReview() {
    var contact = details.contact;
    var shipping = details.shipping;
    q('[data-review="contact"]').textContent = contact["first-name"] + " " + contact["last-name"] + "\n" + contact.email;
    q('[data-review="shipping"]').textContent = [
      shipping.address, shipping.address2, shipping.city + " " + shipping.postcode, shipping.country
    ].filter(Boolean).join("\n");
    /* Shown on phones, where the bag panel is folded away: the products stay visible before completing. */
    q('[data-review="bag"]').textContent = store.items().map(function (row) {
      return store.product(row.id).name + " × " + row.qty;
    }).join("\n");
    q('[data-review="total"]').textContent = store.format(store.total()) + ", concept prices";
  }

  /* ---------------------------------------------------------------- steps */
  var views = { empty: q('[data-view="empty"]'), flow: q('[data-view="flow"]'), confirmation: q('[data-view="confirmation"]') };
  function showView(name) {
    Object.keys(views).forEach(function (key) { views[key].hidden = key !== name; });
    document.body.dataset.checkoutView = name;
  }

  /* The furthest step allowed by what has been completed so far. */
  function furthest() {
    if (!details.contact) return "contact";
    if (!details.shipping) return "shipping";
    return "summary";
  }

  function focusHeading(root) {
    var heading = q("h1", root);
    window.scrollTo({ top: 0, behavior: "instant" });
    if (heading) heading.focus({ preventScroll: true });
  }

  function renderConfirmation(saved) {
    q("[data-confirm-ref]").textContent = saved.ref;
    q("[data-confirm-total]").textContent = store.format(saved.total);
    var objects = q("[data-confirm-objects]");
    var lines = q("[data-confirm-lines]");
    objects.textContent = "";
    lines.textContent = "";
    saved.items.forEach(function (row) {
      var product = store.product(row.id);
      if (!product) return;
      var object = document.createElement("span");
      object.className = "line__image line__image--" + row.id;
      object.innerHTML = '<img src="' + store.url(product.thumb) + '" alt="" decoding="async">';
      objects.appendChild(object);
      var li = document.createElement("li");
      li.innerHTML = '<span>' + product.name + ' × ' + row.qty + '</span><span>' + store.format(row.qty * product.price) + '</span>';
      lines.appendChild(li);
    });
    objects.dataset.count = String(saved.items.length);
  }

  var firstRender = true;

  function route() {
    var wanted = location.hash.replace("#", "");
    var saved = readConfirmation();
    var empty = store.count() === 0;

    if (wanted === "confirmation" || (empty && saved && ORDER.indexOf(wanted) !== -1)) {
      if (saved) {
        if (wanted !== "confirmation") { history.replaceState(null, "", "#confirmation"); }
        renderConfirmation(saved);
        showView("confirmation");
        document.title = "Demonstration complete — AVÉLIS";
        if (!firstRender) focusHeading(views.confirmation);
        firstRender = false;
        return;
      }
      wanted = "bag";
    }
    if (empty) {
      showView("empty");
      document.title = "Demonstration checkout — AVÉLIS";
      if (!firstRender) focusHeading(views.empty);
      firstRender = false;
      return;
    }
    if (saved) forgetConfirmation();      // a new bag starts a new demonstration

    var step = ORDER.indexOf(wanted) === -1 ? "bag" : wanted;
    if (step !== "bag" && ORDER.indexOf(step) > ORDER.indexOf(furthest())) step = furthest();
    if ("#" + step !== location.hash) history.replaceState(null, "", "#" + step);

    showView("flow");
    document.body.dataset.checkoutStep = step;
    qa("[data-step]").forEach(function (section) { section.hidden = section.dataset.step !== step; });
    if (step === "summary") renderReview();
    renderSteps(step);

    var titles = { bag: "Review your bag", contact: "Contact", shipping: "Demonstration shipping", summary: "Order summary" };
    document.title = titles[step] + " — AVÉLIS demonstration checkout";
    if (!firstRender) focusHeading(q('[data-step="' + step + '"]'));
    firstRender = false;
  }

  function renderSteps(step) {
    var current = ORDER.indexOf(step);
    var limit = ORDER.indexOf(furthest());
    qa("[data-steps] li").forEach(function (li, index) {
      var link = q("a", li);
      li.classList.toggle("is-current", index === current);
      li.classList.toggle("is-done", index < current);
      if (index === current) link.setAttribute("aria-current", "step"); else link.removeAttribute("aria-current");
      /* A step that cannot be reached yet is not offered as a link. */
      if (index > limit) {
        link.removeAttribute("href");
      } else {
        link.setAttribute("href", "#" + ORDER[index]);
      }
    });
  }

  window.addEventListener("hashchange", route);

  /* ---------------------------------------------------------------- bag step controls */
  var undoBox = q("[data-undo]");
  var lastRemoved = null;
  var list = q("[data-lines]");

  list.addEventListener("click", function (event) {
    var step = event.target.closest("[data-step-qty]");
    if (step) {
      var id = step.closest(".line").dataset.id;
      if (step.getAttribute("aria-disabled") === "true") {
        if (Number(step.dataset.stepQty) > 0) say("Your bag holds up to " + store.MAX_EACH + " of each piece in this demonstration.");
        return;
      }
      store.setQuantity(id, store.quantity(id) + Number(step.dataset.stepQty));
      say(store.product(id).name + ", quantity " + store.quantity(id) + ". Total " + store.format(store.total()) + ".");
      return;
    }
    var remove = event.target.closest("[data-remove]");
    if (remove) {
      var removeId = remove.closest(".line").dataset.id;
      var name = store.product(removeId).name;
      var wasLast = store.items().length === 1;
      lastRemoved = store.remove(removeId);
      if (wasLast) {
        say(name + " removed. Your bag is empty.");
        return;
      }
      q("[data-undo-text]").textContent = name + " removed.";
      undoBox.hidden = false;
      q("[data-undo-button]").focus();
    }
  });

  q("[data-undo-button]").addEventListener("click", function () {
    if (!lastRemoved) return;
    var restored = lastRemoved;
    store.restore(restored);
    lastRemoved = null;
    undoBox.hidden = true;
    say(store.product(restored.id).name + " returned to your bag.");
    var back = q('[data-id="' + restored.id + '"] [data-remove]', list);
    if (back) back.focus();
  });

  /* ---------------------------------------------------------------- complete */
  q("[data-complete]").addEventListener("click", function () {
    if (!details.contact || !details.shipping || store.count() === 0) { route(); return; }
    saveConfirmation({ ref: createReference(), items: store.items(), total: store.total() });
    details = { contact: null, shipping: null };          // forgotten at once
    qa("[data-form]").forEach(function (form) { form.reset(); });
    store.clear();
    location.hash = "confirmation";
  });

  /* ---------------------------------------------------------------- the aside */
  var aside = q("[data-aside]");
  function syncAside() {
    aside.open = wide.matches;
    q("summary", aside).tabIndex = wide.matches ? -1 : 0;
  }
  if (wide.addEventListener) wide.addEventListener("change", syncAside);
  syncAside();
  q("summary", aside).addEventListener("click", function (event) { if (wide.matches) event.preventDefault(); });

  /* The bag can change here or in another tab: an emptied bag leaves the flow. */
  store.subscribe(function () {
    renderLines();
    renderAside();
    var view = document.body.dataset.checkoutView;
    if ((store.count() === 0 && view === "flow") || (store.count() > 0 && view === "empty")) route();
  });

  renderLines();
  renderAside();
  route();
})();
