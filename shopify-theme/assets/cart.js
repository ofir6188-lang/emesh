(function () {
  'use strict';

  var drawer = document.getElementById('CartDrawer');

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cart-drawer-open');
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cart-drawer-open');
  }

  function refreshDrawer() {
    return fetch('/?sections=cart-drawer')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var html = data['cart-drawer'];
        var temp = document.createElement('div');
        temp.innerHTML = html;
        var fresh = temp.querySelector('#CartDrawer');
        if (drawer && fresh) {
          var wasOpen = drawer.classList.contains('is-open');
          drawer.replaceWith(fresh);
          drawer = fresh;
          if (wasOpen) openDrawer();
          bindDrawerEvents();
        }
        return fetch('/cart.js').then(function (r) { return r.json(); });
      })
      .then(function (cart) {
        document.querySelectorAll('.cart-count').forEach(function (el) {
          el.textContent = cart.item_count;
        });
      });
  }

  function bindDrawerEvents() {
    if (!drawer) return;
    drawer.querySelectorAll('[data-cart-close]').forEach(function (el) {
      el.addEventListener('click', closeDrawer);
    });
    drawer.querySelectorAll('[data-cart-qty-increase]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var line = btn.getAttribute('data-line');
        var qtyEl = btn.parentElement.querySelector('.qty-value');
        var newQty = parseInt(qtyEl.textContent, 10) + 1;
        changeLine(line, newQty);
      });
    });
    drawer.querySelectorAll('[data-cart-qty-decrease]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var line = btn.getAttribute('data-line');
        var qtyEl = btn.parentElement.querySelector('.qty-value');
        var newQty = Math.max(0, parseInt(qtyEl.textContent, 10) - 1);
        changeLine(line, newQty);
      });
    });
    drawer.querySelectorAll('[data-cart-remove]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        changeLine(el.getAttribute('data-line'), 0);
      });
    });
  }

  function changeLine(line, quantity) {
    fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line: line, quantity: quantity })
    })
      .then(function () { return refreshDrawer(); })
      .catch(function (err) { console.error('cart change failed', err); });
  }

  document.querySelectorAll('.cart-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openDrawer();
    });
  });

  bindDrawerEvents();

  // product form: add to cart (works whether or not a variant picker is present)
  var productForm = document.getElementById('ProductForm');
  if (productForm) {
    productForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var submitBtn = document.getElementById('AddToCart');
      var textEl = document.getElementById('AddToCartText');
      var originalText = textEl ? textEl.textContent : '';
      if (submitBtn) submitBtn.disabled = true;
      if (textEl) textEl.textContent = textEl.getAttribute('data-adding-text') || originalText;

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: document.getElementById('ProductVariantId').value,
          quantity: document.getElementById('ProductQuantity') ? document.getElementById('ProductQuantity').value : 1
        })
      })
        .then(function (res) {
          if (!res.ok) return res.json().then(function (err) { throw err; });
          return res.json();
        })
        .then(function () {
          if (submitBtn) submitBtn.disabled = false;
          if (textEl) textEl.textContent = originalText;
          return refreshDrawer();
        })
        .then(function () {
          openDrawer();
        })
        .catch(function (err) {
          if (submitBtn) submitBtn.disabled = false;
          if (textEl) textEl.textContent = originalText;
          alert((err && err.description) || 'שגיאה בהוספה לעגלה');
        });
    });
  }

  // variant picker: sync selects -> matching variant -> hidden id / price / availability
  var variantScript = document.querySelector('[id^="ProductVariants-"]');
  var selects = document.querySelectorAll('.product-option-select');
  if (variantScript && selects.length) {
    var variants = JSON.parse(variantScript.textContent);

    function findMatchingVariant() {
      var selected = Array.prototype.map.call(selects, function (s) { return s.value; });
      return variants.filter(function (v) {
        return selected.every(function (val, i) { return v.options[i] === val; });
      })[0];
    }

    function onOptionChange() {
      var match = findMatchingVariant();
      var idInput = document.getElementById('ProductVariantId');
      var submitBtn = document.getElementById('AddToCart');
      var textEl = document.getElementById('AddToCartText');
      if (!match) return;
      idInput.value = match.id;
      if (submitBtn) submitBtn.disabled = !match.available;
      if (textEl) textEl.textContent = match.available ? (textEl.getAttribute('data-in-stock-text') || textEl.textContent) : (textEl.getAttribute('data-sold-out-text') || 'אזל מהמלאי');
    }

    selects.forEach(function (s) { s.addEventListener('change', onOptionChange); });
  }

  // quick-add buttons on product cards (grid/collection listings)
  document.querySelectorAll('[data-quick-add]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var originalText = btn.textContent;
      btn.disabled = true;
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: btn.getAttribute('data-variant-id'), quantity: 1 })
      })
        .then(function (res) {
          if (!res.ok) return res.json().then(function (err) { throw err; });
          return res.json();
        })
        .then(function () { return refreshDrawer(); })
        .then(function () {
          btn.disabled = false;
          btn.textContent = originalText;
          openDrawer();
        })
        .catch(function (err) {
          btn.disabled = false;
          btn.textContent = originalText;
          alert((err && err.description) || 'שגיאה בהוספה לעגלה');
        });
    });
  });

  // product image thumbnails
  document.querySelectorAll('.product-thumb').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mainImg = document.getElementById('ProductMainImage');
      if (mainImg) mainImg.src = btn.getAttribute('data-image-url');
    });
  });

  // scroll-reveal entrance animation
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  // close the mobile menu panel after a link is tapped
  var navToggle = document.getElementById('nav-toggle');
  if (navToggle) {
    document.querySelectorAll('.mobile-panel a').forEach(function (a) {
      a.addEventListener('click', function () { navToggle.checked = false; });
    });
  }
})();
