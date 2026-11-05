/* AVÉLIS — shopping bag panel, add-to-bag controls and quantity selectors. No dependencies.
   The panel is the native dialog element: it provides the focus trap, the Escape key and the inert page behind it. */
(function () {
  "use strict";

  var store = window.AVELIS_STORE;
  if (!store) return;

  var DISCLOSURE = "AVÉLIS is a fictional concept brand. Prices and checkout are for demonstration purposes only.";
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* A number changing gives a small lift: transform and opacity only, and none with reduced motion. */
  function tick(element) {
    if (motion.matches || !element.animate) return;
    element.animate(
      [{ transform: "translateY(5px)", opacity: 0.25 }, { transform: "none", opacity: 1 }],
      { duration: 260, easing: "cubic-bezier(.23, 1, .32, 1)" }
    );
  }

  /* ---------------------------------------------------------------- the panel */
  var bag = document.createElement("dialog");
  bag.className = "bag";
  bag.setAttribute("aria-labelledby", "bag-title");
  bag.innerHTML =
    '<div class="bag__panel">' +
      '<div class="bag__head">' +
        '<h2 class="d bag__title" id="bag-title">Your bag</h2>' +
        '<button class="tool" type="button" data-bag-close>Close</button>' +
      '</div>' +
      '<div class="bag__body">' +
        '<p class="bag__undo" data-undo hidden><span data-undo-text></span> ' +
          '<button class="link" type="button" data-undo-button>Undo</button></p>' +
        '<ul class="bag__list" data-list></ul>' +
        '<div class="bag__empty" data-empty hidden>' +
          '<p class="d bag__empty-title">Your bag is empty.</p>' +
          '<a class="link" href="' + store.url("index.html#collection") + '" data-bag-leave>Discover the collection</a>' +
        '</div>' +
      '</div>' +
      '<div class="bag__foot">' +
        '<div data-summary>' +
          '<p class="bag__total"><span>Total<small>Concept prices</small></span><strong class="d" data-total></strong></p>' +
          '<a class="primary" href="' + store.url("checkout.html") + '" data-checkout>Proceed to demonstration checkout</a>' +
        '</div>' +
        '<button class="link bag__continue" type="button" data-bag-close>Continue shopping</button>' +
        '<p class="bag__disclosure">' + DISCLOSURE + '</p>' +
      '</div>' +
      '<p class="sr-only" aria-live="polite" data-live></p>' +
    '</div>';
  document.body.appendChild(bag);

  var list = bag.querySelector("[data-list]");
  var empty = bag.querySelector("[data-empty]");
  var summary = bag.querySelector("[data-summary]");
  var totalEl = bag.querySelector("[data-total]");
  var live = bag.querySelector("[data-live]");
  var undoBox = bag.querySelector("[data-undo]");
  var undoText = bag.querySelector("[data-undo-text]");
  var undoButton = bag.querySelector("[data-undo-button]");
  var lastRemoved = null;

  function say(message) { live.textContent = message; }

  function createLine(id) {
    var product = store.product(id);
    var meta = (product.volume ? product.volume + " · " : "") + store.format(product.price) + " each";
    var line = document.createElement("li");
    line.className = "line";
    line.dataset.id = id;
    line.innerHTML =
      '<a class="line__image line__image--' + id + '" href="' + store.url(product.page) + '" tabindex="-1" aria-hidden="true">' +
        '<img src="' + store.url(product.thumb) + '" alt="" loading="lazy" decoding="async">' +
      '</a>' +
      '<div class="line__main">' +
        '<a class="d line__name" href="' + store.url(product.page) + '">' + product.name + '</a>' +
        '<p class="line__meta">' + meta + '</p>' +
        '<div class="qty qty--small" role="group" aria-label="Quantity of ' + product.name + '">' +
          '<button type="button" data-step="-1" aria-label="Decrease quantity of ' + product.name + '">−</button>' +
          '<output data-qty></output>' +
          '<button type="button" data-step="1" aria-label="Increase quantity of ' + product.name + '">+</button>' +
        '</div>' +
      '</div>' +
      '<div class="line__side">' +
        '<p class="line__subtotal" data-subtotal></p>' +
        '<button class="line__remove" type="button" data-remove aria-label="Remove ' + product.name + ' from the bag">Remove</button>' +
      '</div>';
    return line;
  }

  /* Lines are updated in place, so that keyboard focus stays on the control the visitor is using. */
  function render() {
    var items = store.items();
    var ids = items.map(function (row) { return row.id; });

    list.querySelectorAll(".line").forEach(function (line) {
      if (ids.indexOf(line.dataset.id) === -1) line.remove();
    });

    items.forEach(function (row, index) {
      var product = store.product(row.id);
      var line = list.querySelector('[data-id="' + row.id + '"]') || createLine(row.id);
      if (list.children[index] !== line) list.insertBefore(line, list.children[index] || null);

      var qty = line.querySelector("[data-qty]");
      var subtotal = line.querySelector("[data-subtotal]");
      var text = String(row.qty);
      if (qty.textContent !== text) {
        if (qty.textContent) { tick(qty); tick(subtotal); }
        qty.textContent = text;
      }
      subtotal.textContent = store.format(row.qty * product.price);
      line.querySelector('[data-step="-1"]').setAttribute("aria-disabled", String(row.qty <= 1));
      line.querySelector('[data-step="1"]').setAttribute("aria-disabled", String(row.qty >= store.MAX_EACH));
    });

    var isEmpty = items.length === 0;
    empty.hidden = !isEmpty;
    summary.hidden = isEmpty;
    list.hidden = isEmpty;
    totalEl.textContent = store.format(store.total());

    var count = store.count();
    document.querySelectorAll("[data-bag-open]").forEach(function (button) {
      var number = button.querySelector(".tool__count");
      if (number && number.textContent !== String(count)) {
        if (number.textContent !== "") tick(number);
        number.textContent = String(count);
      }
      button.setAttribute("aria-label", "Bag, " + count + (count === 1 ? " item" : " items"));
    });
  }

  function openBag() {
    if (bag.open) return;
    var menu = document.querySelector("dialog.menu[open]");
    if (menu) menu.close();
    status.classList.remove("is-on");
    bag.showModal();
    bag.querySelector("[data-bag-close]").focus();
  }

  bag.addEventListener("close", function () {
    undoBox.hidden = true;
    lastRemoved = null;
  });

  bag.addEventListener("click", function (event) {
    var target = event.target;
    if (target === bag) { bag.close(); return; }     // the backdrop

    var step = target.closest("[data-step]");
    if (step) {
      var stepLine = step.closest(".line");
      var stepId = stepLine.dataset.id;
      var stepName = store.product(stepId).name;
      var before = store.quantity(stepId);
      if (step.getAttribute("aria-disabled") === "true") {
        if (Number(step.dataset.step) > 0) say("Your bag holds up to " + store.MAX_EACH + " of each piece in this demonstration.");
        return;
      }
      store.setQuantity(stepId, before + Number(step.dataset.step));
      say(stepName + ", quantity " + store.quantity(stepId) + ". Total " + store.format(store.total()) + ".");
      return;
    }

    var remove = target.closest("[data-remove]");
    if (remove) {
      var removeId = remove.closest(".line").dataset.id;
      var name = store.product(removeId).name;
      lastRemoved = store.remove(removeId);
      undoText.textContent = name + " removed.";
      undoBox.hidden = false;
      undoButton.focus();
      return;
    }

    if (target.closest("[data-undo-button]")) {
      if (!lastRemoved) return;
      var restored = lastRemoved;
      store.restore(restored);
      lastRemoved = null;
      undoBox.hidden = true;
      say(store.product(restored.id).name + " returned to your bag.");
      var back = list.querySelector('[data-id="' + restored.id + '"] [data-remove]');
      if (back) back.focus();
      return;
    }

    if (target.closest("[data-bag-close]") || target.closest("[data-bag-leave]")) bag.close();
  });

  /* ---------------------------------------------------------------- confirmation outside the panel */
  var status = document.createElement("div");
  status.className = "status";
  status.setAttribute("role", "status");
  status.innerHTML = '<span data-status-text></span> <button class="status__action" type="button" hidden>View bag</button>';
  document.body.appendChild(status);
  var statusText = status.querySelector("[data-status-text]");
  var statusAction = status.querySelector(".status__action");
  var statusTimer;

  function announce(message, withAction) {
    statusText.textContent = message;
    statusAction.hidden = !withAction;
    status.classList.add("is-on");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { status.classList.remove("is-on"); }, 5000);
  }
  statusAction.addEventListener("click", function () {
    status.classList.remove("is-on");
    openBag();
  });
  /* Pausing the timer while the pointer or focus is on the message keeps its button reachable. */
  ["mouseenter", "focusin"].forEach(function (name) {
    status.addEventListener(name, function () { clearTimeout(statusTimer); });
  });
  ["mouseleave", "focusout"].forEach(function (name) {
    status.addEventListener(name, function () {
      statusTimer = setTimeout(function () { status.classList.remove("is-on"); }, 2500);
    });
  });

  /* ---------------------------------------------------------------- add to bag and quantity selectors */
  function bindQuantity(box) {
    var value = box.querySelector("[data-qty-value]");
    var minus = box.querySelector('[data-qty-step="-1"]');
    var plus = box.querySelector('[data-qty-step="1"]');
    box._quantity = 1;

    function set(next) {
      var clamped = Math.max(1, Math.min(next, store.MAX_EACH));
      if (clamped !== box._quantity) tick(value);
      box._quantity = clamped;
      value.textContent = String(clamped);
      minus.setAttribute("aria-disabled", String(clamped <= 1));
      plus.setAttribute("aria-disabled", String(clamped >= store.MAX_EACH));
    }
    box._setQuantity = set;
    minus.addEventListener("click", function () { set(box._quantity - 1); });
    plus.addEventListener("click", function () { set(box._quantity + 1); });
    set(1);
  }
  document.querySelectorAll("[data-purchase]").forEach(bindQuantity);

  document.addEventListener("click", function (event) {
    var opener = event.target.closest("[data-bag-open]");
    if (opener) { openBag(); return; }

    var add = event.target.closest("[data-add]");
    if (!add) return;
    var id = add.dataset.add;
    var product = store.product(id);
    var box = add.closest("[data-purchase]");
    var wanted = box ? box._quantity : 1;
    var added = store.add(id, wanted);

    if (added === 0) {
      announce("Your bag already holds " + store.MAX_EACH + " " + product.name + ", the limit in this demonstration.", true);
      return;
    }
    announce(
      product.name + (added > 1 ? " × " + added : "") + " added to your bag." +
        (added < wanted ? " The limit is " + store.MAX_EACH + " of each piece in this demonstration." : ""),
      true
    );
    if (box) box._setQuantity(1);

    var label = add.dataset.label || (add.dataset.label = add.textContent);
    add.textContent = "Added to bag";
    clearTimeout(add._reset);
    add._reset = setTimeout(function () { add.textContent = label; }, 1800);
  });

  store.subscribe(render);
  render();
})();
