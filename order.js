// Landing kit ordering: package builder (choose N of M), à la carte items, cart, checkout.
// Data comes from the page's #lk-data block (written by build.mjs from site.json).
// Payment: when site.order.payment.checkoutEndpoint is set, the order is POSTed there and the
// visitor is sent to the returned { url } (Stripe Checkout or any hosted payment page). Until then
// the order is sent on WhatsApp, prefilled, so the business can reply with a payment link.
(() => {
  const data = JSON.parse(document.getElementById("lk-data").textContent);
  const cur = data.currency;
  const fmt = (n) => `${cur} ${n.toLocaleString("en-US")}`;
  const itemsById = Object.fromEntries(data.items.map((i) => [i.id, i]));
  const pkgsById = Object.fromEntries(data.packages.map((p) => [p.id, p]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---- cart state (kept in this browser only) ----
  let lines = [];
  try {
    lines = JSON.parse(localStorage.getItem(data.storageKey) || "[]").filter((l) =>
      l.kind === "item" ? itemsById[l.id] : pkgsById[l.id],
    );
  } catch {
    lines = [];
  }
  const save = () => {
    try {
      localStorage.setItem(data.storageKey, JSON.stringify(lines));
    } catch {
      /* private mode: the cart still works for this visit */
    }
  };
  const unit = (l) => (l.kind === "item" ? itemsById[l.id].price : pkgsById[l.id].price);
  const label = (l) => (l.kind === "item" ? itemsById[l.id].name : pkgsById[l.id].name);
  const sub = (l) =>
    l.kind === "package"
      ? `Mains: ${l.mains.map((m) => pkgsById[l.id].options.find((o) => o.id === m)?.name).join(" and ")}`
      : "";
  const total = () => lines.reduce((s, l) => s + unit(l) * l.qty, 0);
  const count = () => lines.reduce((s, l) => s + l.qty, 0);

  function add(line) {
    const found = lines.find((l) => l.key === line.key);
    if (found) found.qty += line.qty;
    else lines.push(line);
    save();
    render();
  }
  function setQty(key, qty) {
    lines = lines.map((l) => (l.key === key ? { ...l, qty } : l)).filter((l) => l.qty > 0);
    save();
    render();
  }

  // ---- rendering ----
  const dialog = $("[data-cart]");
  const bar = $("[data-cartbar]");
  function render() {
    const n = count();
    $$("[data-cart-count]").forEach((el) => (el.textContent = String(n)));
    $$("[data-open-cart].cartbtn").forEach((b) => b.setAttribute("aria-label", `Your order, ${n} item${n === 1 ? "" : "s"}`));
    bar.hidden = n === 0;
    $("[data-cartbar-text]").textContent = `View your order · ${n} item${n === 1 ? "" : "s"}`;
    $("[data-cartbar-total]").textContent = fmt(total());

    const list = $("[data-cart-lines]");
    list.innerHTML = "";
    for (const l of lines) {
      const li = document.createElement("li");
      li.className = "cart__line";
      li.innerHTML = `<span class="cart__line-name"></span><span class="price"></span>${
        l.kind === "package" ? '<span class="cart__line-sub"></span>' : ""
      }<div class="stepper" role="group"><button type="button" data-d="-1">−</button><output></output><button type="button" data-d="1">+</button></div>`;
      li.querySelector(".cart__line-name").textContent = label(l);
      li.querySelector(".price").textContent = fmt(unit(l) * l.qty);
      if (l.kind === "package") li.querySelector(".cart__line-sub").textContent = sub(l);
      li.querySelector("output").textContent = String(l.qty);
      li.querySelector(".stepper").setAttribute("aria-label", `Quantity of ${label(l)}`);
      li.querySelector('[data-d="-1"]').setAttribute("aria-label", `Remove one ${label(l)}`);
      li.querySelector('[data-d="1"]').setAttribute("aria-label", `Add one ${label(l)}`);
      li.querySelectorAll("[data-d]").forEach((b) =>
        b.addEventListener("click", () => setQty(l.key, l.qty + Number(b.dataset.d))),
      );
      list.append(li);
    }
    $("[data-cart-empty]").hidden = n > 0;
    $("[data-cart-total]").textContent = fmt(total());
    const min = $("[data-cart-min]");
    const short = data.minimum - total();
    min.hidden = n === 0 || short <= 0;
    min.textContent = short > 0 ? `Minimum order ${fmt(data.minimum)}. Add ${fmt(short)} more.` : "";
    $("[data-checkout]").hidden = n === 0;
    $("[data-pay]").textContent = data.checkoutEndpoint ? `Pay ${fmt(total())}` : "Send the order on WhatsApp";

    const inCart = new Set(lines.filter((l) => l.kind === "item").map((l) => l.id));
    $$("[data-add]").forEach((b) => {
      const on = inCart.has(b.dataset.add);
      b.toggleAttribute("data-in-cart", on);
      const q = on ? lines.find((l) => l.key === `item:${b.dataset.add}`).qty : 0;
      b.textContent = on ? `Added · ${q}` : "Add";
    });
  }

  // ---- package builder ----
  for (const form of $$("[data-package]")) {
    const pkg = pkgsById[form.dataset.package];
    const boxes = $$('input[name="main"]', form);
    const status = $("[data-pick-status]", form);
    const btn = $("[data-pkg-add]", form);
    const qtyEl = $("[data-qty]", form);
    const totalEl = $("[data-pkg-total]", form);
    let qty = 1;
    const sync = () => {
      const picked = boxes.filter((b) => b.checked);
      boxes.forEach((b) => (b.disabled = !b.checked && picked.length >= pkg.count));
      status.textContent = `${picked.length} of ${pkg.count} chosen`;
      const ready = picked.length === pkg.count;
      btn.disabled = !ready;
      btn.textContent = ready
        ? `Add to order · ${fmt(pkg.price * qty)}`
        : `Choose ${pkg.count - picked.length} more main${pkg.count - picked.length === 1 ? "" : "s"}`;
      qtyEl.textContent = String(qty);
      totalEl.textContent = fmt(pkg.price * qty);
    };
    boxes.forEach((b) => b.addEventListener("change", sync));
    $$("[data-step]", form).forEach((b) =>
      b.addEventListener("click", () => {
        qty = Math.max(1, Math.min(20, qty + Number(b.dataset.step)));
        sync();
      }),
    );
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const mains = boxes.filter((b) => b.checked).map((b) => b.value).sort();
      if (mains.length !== pkg.count) return;
      add({ key: `package:${pkg.id}:${mains.join("+")}`, kind: "package", id: pkg.id, mains, qty });
      boxes.forEach((b) => (b.checked = false));
      qty = 1;
      sync();
      open();
    });
    sync();
  }

  // ---- à la carte ----
  $$("[data-add]").forEach((b) =>
    b.addEventListener("click", () => add({ key: `item:${b.dataset.add}`, kind: "item", id: b.dataset.add, qty: 1 })),
  );

  // ---- dialog ----
  let opener = null;
  function open() {
    opener = document.activeElement;
    if (!dialog.open) dialog.showModal();
  }
  $$("[data-open-cart]").forEach((b) => b.addEventListener("click", open));
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target.closest("[data-close-cart]")) dialog.close();
  });
  dialog.addEventListener("close", () => opener && opener.focus && opener.focus());

  // ---- checkout ----
  const form = $("[data-checkout]");
  const err = $("[data-form-error]");
  const dateInput = $("#f-date", form);
  const today = new Date();
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  dateInput.min = iso(today);
  // Default to the next Friday: the day Shabbat packages go out.
  const nextFri = new Date(today);
  nextFri.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7 || 7));
  dateInput.value = iso(nextFri);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.hidden = true;
    const f = Object.fromEntries(new FormData(form).entries());
    const fail = (msg, field) => {
      err.textContent = msg;
      err.hidden = false;
      if (field) form.elements[field].focus();
    };
    if (count() === 0) return fail("Your order is empty.");
    if (total() < data.minimum) return fail(`The minimum order is ${fmt(data.minimum)}.`);
    for (const [k, msg] of [
      ["name", "Please add your name."],
      ["phone", "Please add a phone number we can reach on WhatsApp."],
      ["address", "Please add the address, or the hotel and room."],
      ["date", "Please choose a delivery date."],
    ])
      if (!String(f[k] || "").trim()) return fail(msg, k);
    const day = new Date(`${f.date}T12:00:00`).getDay();
    if (lines.some((l) => l.kind === "package") && data.packageDays.includes("fri") && day !== 5)
      return fail("Shabbat packages are delivered on Friday. Please choose a Friday.", "date");

    const order = {
      lines: lines.map((l) => ({ kind: l.kind, id: l.id, name: label(l), mains: l.mains, qty: l.qty, unit: unit(l) })),
      total: total(),
      currency: cur,
      customer: f,
    };

    if (data.checkoutEndpoint) {
      try {
        const res = await fetch(data.checkoutEndpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(order),
        });
        const out = await res.json();
        if (!res.ok || !out.url) throw new Error(out.error || "payment unavailable");
        location.href = out.url;
      } catch {
        fail("Payment could not start. Please try again, or send the order on WhatsApp.");
      }
      return;
    }

    const text = [
      "Hello Treat Kosher, I would like to order:",
      ...order.lines.map(
        (l) =>
          `- ${l.qty} × ${l.name}${l.mains ? ` (${sub({ kind: "package", id: l.id, mains: l.mains })})` : ""}: ${fmt(l.unit * l.qty)}`,
      ),
      `Total: ${fmt(order.total)}`,
      "",
      `Name: ${f.name}`,
      `Phone: ${f.phone}`,
      f.email ? `Email: ${f.email}` : "",
      `Delivery: ${f.city}, ${f.address}`,
      `Date: ${f.date}, ${f.slot}`,
      f.notes ? `Notes: ${f.notes}` : "",
    ]
      .filter((x) => x !== "")
      .join("\n");
    window.open(`https://wa.me/${data.whatsapp}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  });

  render();
})();
