/* AVÉLIS — catalogue and demonstration bag state. No page elements here, and nothing leaves the browser.
   AVÉLIS is a fictional concept brand: these prices are demonstration values and nothing can be bought. */
window.AVELIS_STORE = (function () {
  "use strict";

  var ROOT = new URL("..", document.currentScript.src).href;   // works from the home page and from /products/
  var KEY = "avelis.demo-bag.v1";
  var MAX_EACH = 9;

  var CATALOGUE = {
    "hydrating-cream": {
      name: "Hydrating Cream", price: 48, volume: "50 ml",
      page: "products/hydrating-cream.html",
      thumb: "assets/cgi/avelis_tube_02_cutout_75.webp"
    },
    "satin-lipstick": {
      name: "Satin Lipstick", price: 39, volume: null,
      page: "products/satin-lipstick.html",
      thumb: "assets/cgi/avelis_lipstick_02_cutout_75.webp"
    },
    "nourishing-balm": {
      name: "Nourishing Balm", price: 42, volume: "50 ml",
      page: "products/nourishing-balm.html",
      thumb: "assets/cgi/avelis_jar_01_cutout_75.webp"
    }
  };

  var money = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  var listeners = [];
  var memory = null;     // used only if the browser refuses storage: the bag then lasts until the page is left

  /* Stored data can be edited, stale or corrupt, so everything read back is checked against the catalogue. */
  function clean(value) {
    if (!Array.isArray(value)) return [];
    var seen = {};
    return value.reduce(function (out, row) {
      var id = row && row.id;
      var qty = row && Math.floor(Number(row.qty));
      if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(CATALOGUE, id) || seen[id]) return out;
      if (!Number.isFinite(qty) || qty < 1) return out;
      seen[id] = true;
      out.push({ id: id, qty: Math.min(qty, MAX_EACH) });
      return out;
    }, []);
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      return clean(raw ? JSON.parse(raw) : []);
    } catch (error) {
      return clean(memory);
    }
  }

  var items = load();

  function save() {
    memory = items;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(items));
    } catch (error) { /* kept in memory instead */ }
    notify();
  }

  function notify() {
    listeners.forEach(function (listener) { listener(); });
  }

  function find(id) {
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }

  /* Another tab changed the bag, or the page came back from the browser's back/forward cache. */
  function sync() {
    items = load();
    notify();
  }
  window.addEventListener("storage", function (event) { if (event.key === KEY || event.key === null) sync(); });
  window.addEventListener("pageshow", function (event) { if (event.persisted) sync(); });

  return {
    MAX_EACH: MAX_EACH,
    product: function (id) { return CATALOGUE[id]; },
    url: function (path) { return new URL(path, ROOT).href; },
    format: function (amount) { return money.format(amount); },
    items: function () { return items.map(function (row) { return { id: row.id, qty: row.qty }; }); },
    quantity: function (id) { var row = find(id); return row ? row.qty : 0; },
    count: function () { return items.reduce(function (sum, row) { return sum + row.qty; }, 0); },
    total: function () { return items.reduce(function (sum, row) { return sum + row.qty * CATALOGUE[row.id].price; }, 0); },
    subscribe: function (listener) { listeners.push(listener); },

    /* Returns how many were really added, so that the page can say so when the limit is reached. */
    add: function (id, qty) {
      if (!CATALOGUE[id]) return 0;
      var row = find(id);
      var before = row ? row.qty : 0;
      var after = Math.min(before + qty, MAX_EACH);
      if (after === before) return 0;
      if (row) row.qty = after; else items.push({ id: id, qty: after });
      save();
      return after - before;
    },
    setQuantity: function (id, qty) {
      var row = find(id);
      if (!row) return;
      var next = Math.max(1, Math.min(qty, MAX_EACH));
      if (next === row.qty) return;
      row.qty = next;
      save();
    },
    /* Returns what is needed to undo the removal. */
    remove: function (id) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) {
          var removed = { id: id, qty: items[i].qty, index: i };
          items.splice(i, 1);
          save();
          return removed;
        }
      }
      return null;
    },
    restore: function (removed) {
      if (!removed || find(removed.id)) return;
      items.splice(Math.min(removed.index, items.length), 0, { id: removed.id, qty: removed.qty });
      save();
    },
    clear: function () {
      items = [];
      save();
    }
  };
})();
