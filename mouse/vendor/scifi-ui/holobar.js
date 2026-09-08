// Carried across whole from amyleesterling/scifi-ui (hologram.js section 5,
// commit d063c2e): builds the .holobar step rail, clicks, drags and arrow
// keys, and reports the step back on a holobar:change event. One deviation
// from upstream: the per-bar builder is exposed as window.holoBar.build so
// panels created after load (the signal-walk chip) can grow a rail too.
// ---- 5. step rail --------------------------------------------------------
(function () {
  // Write <div class="holobar" data-steps="10" data-step="8"></div> and this
  // builds the counter, the rail, the fill and one button per step. Steps are
  // counted from 1 because that is what the counter shows. Reads back three
  // ways: the data-step attribute, a holobar:change event, and el.holobar.
  function pad(n, len) {
    n = String(n);
    while (n.length < len) n = "0" + n;
    return n;
  }

  function buildBar(bar) {
    var steps = Math.max(1, parseInt(bar.getAttribute("data-steps"), 10) || 0);
    var step = Math.min(steps, Math.max(1, parseInt(bar.getAttribute("data-step"), 10) || 1));
    var digits = Math.max(2, String(steps).length);

    bar.textContent = "";
    bar.setAttribute("role", "group");
    if (!bar.getAttribute("aria-label")) bar.setAttribute("aria-label", "Progress");

    var count = document.createElement("span");
    count.className = "holobar-count";
    count.setAttribute("aria-live", "polite");

    var rail = document.createElement("span");
    rail.className = "holobar-rail";
    var fill = document.createElement("span");
    fill.className = "holobar-fill";
    rail.appendChild(fill);

    var ticks = [];
    for (var i = 1; i <= steps; i++) {
      var t = document.createElement("button");
      t.type = "button";
      t.className = "holobar-tick";
      // one tick sits at each end, so the last one lands on 100 per cent
      t.style.left = (steps > 1 ? ((i - 1) / (steps - 1)) * 100 : 50) + "%";
      t.appendChild(document.createElement("i"));
      rail.appendChild(t);
      ticks.push(t);
    }
    bar.appendChild(count);
    bar.appendChild(rail);

    function paint() {
      count.textContent = pad(step, digits);
      var rest = document.createElement("s");
      rest.textContent = " / " + pad(steps, digits);
      count.appendChild(rest);
      // the fill stops at the dot you are on rather than one step past it, so
      // it still reads correctly at three steps as well as at thirty
      rail.style.setProperty("--holobar-progress",
        steps > 1 ? (step - 1) / (steps - 1) : 1);
      for (var k = 0; k < ticks.length; k++) {
        var n = k + 1, el = ticks[k];
        if (n === step) el.setAttribute("aria-current", "step");
        else el.removeAttribute("aria-current");
        if (n < step) el.setAttribute("data-done", "");
        else el.removeAttribute("data-done");
        el.tabIndex = n === step ? 0 : -1;
        el.setAttribute("aria-label", "Step " + n + " of " + steps);
      }
      bar.setAttribute("data-step", step);
    }

    function set(n, moveFocus) {
      n = Math.min(steps, Math.max(1, n | 0));
      if (n !== step) {
        step = n;
        paint();
        bar.dispatchEvent(new CustomEvent("holobar:change", {
          bubbles: true, detail: { step: step, steps: steps }
        }));
      }
      if (moveFocus) ticks[step - 1].focus();
    }

    // dragging. pointerdown anywhere on the rail or on a tick starts it,
    // pointermove updates the step continuously, pointerup ends it. The rail
    // captures the pointer so the drag survives leaving the element, which is
    // most of why it feels like a control rather than a row of buttons.
    var dragging = false, moved = false, clickDeadline = 0;

    function stepAt(clientX) {
      var r = rail.getBoundingClientRect();
      if (!r.width || steps < 2) return 1;
      var f = (clientX - r.left) / r.width;
      f = Math.min(1, Math.max(0, f));
      return Math.round(f * (steps - 1)) + 1;
    }

    rail.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      moved = false;
      bar.classList.add("is-dragging");
      if (rail.setPointerCapture) {
        try { rail.setPointerCapture(e.pointerId); } catch (err) {}
      }
      set(stepAt(e.clientX), false);
      // focus lands on the tick you grabbed, so the arrow keys carry on from
      // where the drag started rather than from wherever it was before
      ticks[step - 1].focus({ preventScroll: true });
    });

    rail.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      moved = true;
      e.preventDefault();
      set(stepAt(e.clientX), false);
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      bar.classList.remove("is-dragging");
      if (rail.releasePointerCapture && e && e.pointerId !== undefined) {
        try { rail.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      if (!moved) return;
      // the roving tabindex has moved to the tick you dropped on, so focus
      // has to follow it or the focused tick is no longer the current one
      ticks[step - 1].focus({ preventScroll: true });
      // and the click a browser fires after a drag has to be ignored, or it
      // snaps the step back to whichever tick was under the pointer when the
      // button came up. A deadline rather than a flag, because a drag that
      // ends on the rail itself produces no tick click at all to consume it.
      clickDeadline = (window.performance ? performance.now() : Date.now()) + 300;
      moved = false;
    }

    rail.addEventListener("pointerup", endDrag);
    rail.addEventListener("pointercancel", endDrag);
    rail.addEventListener("lostpointercapture", endDrag);

    ticks.forEach(function (t, k) {
      t.addEventListener("click", function () {
        var now = window.performance ? performance.now() : Date.now();
        if (now < clickDeadline) return;
        set(k + 1, true);
      });
    });

    // roving tabindex: only the current tick is in the tab order, and the
    // arrows move the selection, which is the whole point of the control
    rail.addEventListener("keydown", function (e) {
      var n = null;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") n = step + 1;
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") n = step - 1;
      else if (e.key === "Home") n = 1;
      else if (e.key === "End") n = steps;
      else return;
      e.preventDefault();
      set(n, true);
    });

    bar.holobar = {
      steps: steps,
      get step() { return step; },
      set step(n) { set(n, false); },
      next: function () { set(step + 1, false); },
      prev: function () { set(step - 1, false); }
    };

    paint();
  }

  document.querySelectorAll(".holobar").forEach(buildBar);
  window.holoBar = { build: buildBar };
})();

