/**
 * JMLS Consulting Inc. — Client Application & Modern Web Guidance Enhancements
 * Implements:
 * 1. Responsive Popover Navbar (ResizeObserver measurement + Popover API + polyfill fallback)
 * 2. Shrinking Header on Scroll Fallback (when CSS scroll-driven animations are unsupported)
 * 3. Native <details> Accordion Expand/Collapse All + Invoker Command fallback
 * 4. Deferred Form Validation (:user-invalid + ARIA live region sync + WeakMap fallback)
 * 5. Discovery Session Inquiry Submission to /api/contact (info@jmlsconsulting.com)
 */

(() => {
  'use strict';

  /* ==========================================================================
     1. Popover API Feature Detection & Responsive Site Navigation (navbar guide)
     ========================================================================== */
  if (!Object.hasOwn(HTMLElement.prototype, 'popover')) {
    import('https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js').catch(() => {});
  }

  const header = document.querySelector('.site-header');
  const headerInner = document.querySelector('.header-inner');
  const siteMenu = document.getElementById('site-menu');

  if (header && headerInner && siteMenu) {
    let lastHeaderWidth = 0;

    const isPopoverOpen = (el) => {
      try {
        return el.matches(':is(:popover-open, .\\:popover-open)');
      } catch (_) {
        return el.classList.contains(':popover-open');
      }
    };

    const updateNavLayout = () => {
      const currentHeaderWidth = header.clientWidth;
      const isCurrentlyWide = header.classList.contains('is-wide');

      // While collapsed, only remeasure when the header's width has grown (prevents layout thrashing)
      if (!isCurrentlyWide && currentHeaderWidth <= lastHeaderWidth && lastHeaderWidth > 0) {
        lastHeaderWidth = currentHeaderWidth;
        return;
      }
      lastHeaderWidth = currentHeaderWidth;

      const wasOpen = isPopoverOpen(siteMenu);

      header.classList.add('is-measuring', 'is-wide');
      siteMenu.removeAttribute('popover');

      const fitsInline = headerInner.scrollWidth <= headerInner.clientWidth;

      if (fitsInline) {
        header.classList.add('is-wide');
        siteMenu.removeAttribute('popover');
      } else {
        header.classList.remove('is-wide');
        siteMenu.setAttribute('popover', 'auto');
        if (wasOpen && typeof siteMenu.showPopover === 'function') {
          try {
            siteMenu.showPopover();
          } catch (_) {
            // Ignore if top-layer state is transitioning
          }
        }
      }

      requestAnimationFrame(() => {
        header.classList.remove('is-measuring');
      });
    };

    const navObserver = new ResizeObserver(() => {
      updateNavLayout();
    });

    navObserver.observe(header);
    navObserver.observe(siteMenu);
    updateNavLayout();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        lastHeaderWidth = 0;
        updateNavLayout();
      });
    }

    window.addEventListener('orientationchange', () => {
      lastHeaderWidth = 0;
      requestAnimationFrame(updateNavLayout);
    });

    // Close collapsed popover menu when an anchor link is activated
    siteMenu.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;

      // Update aria-current="page" on active section link
      siteMenu.querySelectorAll('a[aria-current="page"]').forEach((el) => {
        el.removeAttribute('aria-current');
      });
      link.setAttribute('aria-current', 'page');

      if (!header.classList.contains('is-wide') && typeof siteMenu.hidePopover === 'function') {
        try {
          siteMenu.hidePopover();
        } catch (_) {}
      }
    });
  }

  /* ==========================================================================
     2. Shrinking Header on Scroll Fallback (shrinking-header-on-scroll guide)
     ========================================================================== */
  if (
    header &&
    !CSS.supports('(animation-timeline: scroll()) and (animation-range: 0% 100%)') &&
    window.matchMedia('(prefers-reduced-motion: no-preference)').matches
  ) {
    const initialHeight = 88;
    const finalHeight = 68;
    const scrollDistance = 120;

    window.addEventListener(
      'scroll',
      () => {
        const scrollY = window.scrollY;
        const scrollPercent = Math.min(1, Math.max(0, scrollY / scrollDistance));
        const newHeight = initialHeight - (initialHeight - finalHeight) * scrollPercent;
        header.style.height = `${newHeight}px`;
      },
      { passive: true }
    );
  }

  /* ==========================================================================
     3. Native <details> Accordion Controls & Fallbacks (accordion guide)
     ========================================================================== */
  // Fallback for mutually exclusive <details name="..."> if unsupported
  if (!Object.hasOwn(HTMLDetailsElement.prototype, 'name')) {
    document.addEventListener(
      'toggle',
      (event) => {
        const details = event.target;
        if (!(details instanceof HTMLDetailsElement) || !details.open || !details.hasAttribute('name')) {
          return;
        }
        const name = CSS.escape(details.getAttribute('name'));
        for (const other of document.querySelectorAll(`details[name="${name}"]`)) {
          if (other !== details) other.open = false;
        }
      },
      { capture: true }
    );
  }

  const toggleAllFaqItems = (container, triggerButton) => {
    const expand = triggerButton.getAttribute('aria-expanded') !== 'true';
    for (const details of container.querySelectorAll('details')) {
      details.open = expand;
    }
    triggerButton.setAttribute('aria-expanded', String(expand));
  };

  // Native Invoker Command handler (capture phase because command events do not bubble)
  document.addEventListener(
    'command',
    (event) => {
      if (event.command !== '--toggle-all') return;
      toggleAllFaqItems(event.target, event.source);
    },
    { capture: true }
  );

  // Feature-detected fallback for browsers without Invoker Commands (commandForElement)
  if (!Object.hasOwn(HTMLButtonElement.prototype, 'commandForElement')) {
    document.querySelectorAll('[command="--toggle-all"][commandfor]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('commandfor');
        const container = targetId ? document.getElementById(targetId) : null;
        if (container) {
          toggleAllFaqItems(container, btn);
        }
      });
    });
  }

  // Keep Expand/Collapse All button aria-expanded in sync when individual FAQ items toggle
  document.addEventListener(
    'toggle',
    (event) => {
      if (!(event.target instanceof HTMLDetailsElement)) return;
      const container = event.target.closest('#faq-accordion-container');
      if (!container) return;
      const button = document.querySelector('[commandfor="faq-accordion-container"][command="--toggle-all"]');
      if (!button) return;

      const items = container.querySelectorAll('details');
      const allOpen = Array.prototype.every.call(items, (d) => d.open);
      button.setAttribute('aria-expanded', String(allOpen));
    },
    { capture: true }
  );

  /* ==========================================================================
     4. Accessible Deferred Form Validation
        (validate-input-after-interaction & accessible-error-announcement guides)
     ========================================================================== */
  const linkError = (el, shown) => {
    const errorId = el.dataset?.error;
    if (!errorId) return;
    const ids = (el.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter((id) => id && id !== errorId);
    if (shown) ids.push(errorId);
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
    else el.removeAttribute('aria-describedby');
  };

  // Single polite live region for the page announces field errors 500ms after blur/change
  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', 'polite');
  announcer.classList.add('visually-hidden');
  document.body.append(announcer);
  let announceTimer;
  let announcedField;

  const spokenText = (node) => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    copy.querySelectorAll('[role="img"][aria-label]').forEach((n) => {
      n.replaceWith(`${n.getAttribute('aria-label')}: `);
    });
    return copy.textContent.replace(/\s+/g, ' ').trim();
  };

  const announceError = (el) => {
    const error = document.getElementById(el.dataset.error);
    if (!error) return;
    const label = el.labels?.[0] ? `${spokenText(el.labels[0])}: ` : '';
    clearTimeout(announceTimer);
    announcer.textContent = '';
    announcedField = el;
    announceTimer = setTimeout(() => {
      announcer.textContent = label + spokenText(error);
    }, 500);
  };

  const supportsUserInvalid = CSS.supports('selector(:user-invalid)');
  const flagged = new WeakSet();
  const announced = new WeakSet();

  const syncAria = (el, announce = false) => {
    if (!el.matches?.('input, select, textarea')) return;
    const invalid = supportsUserInvalid
      ? el.matches(':user-invalid')
      : el.classList.contains('user-invalid-fallback');

    if (invalid) {
      if (announce && !announced.has(el)) {
        announceError(el);
        announced.add(el);
      }
      el.setAttribute('aria-invalid', 'true');
      linkError(el, true);
      flagged.add(el);
    } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
      el.setAttribute('aria-invalid', 'false');
      linkError(el, false);
      flagged.delete(el);
      announced.delete(el);
      if (announcedField === el) {
        clearTimeout(announceTimer);
        announcer.textContent = '';
      }
    }
  };

  // Start every field at aria-invalid="false" to prevent premature screen reader announcements
  document.querySelectorAll('input, select, textarea').forEach((el) => syncAria(el));

  document.addEventListener('blur', (e) => syncAria(e.target, true), true);
  document.addEventListener('input', (e) => {
    if (e.target.hasAttribute?.('aria-invalid')) syncAria(e.target);
  });
  document.addEventListener('change', (e) => syncAria(e.target, true), true);
  document.addEventListener(
    'invalid',
    (e) => {
      announced.add(e.target);
      syncAria(e.target);
    },
    true
  );
  document.addEventListener(
    'reset',
    (e) => {
      setTimeout(() => [...(e.target.elements || [])].forEach((el) => syncAria(el)));
    },
    true
  );

  // Fallback for browsers without native :user-invalid support
  const UserInvalidFallback = (() => {
    const dirtyState = new WeakMap();

    const updateState = (input) => {
      const isValid = input.validity.valid;
      input.classList.toggle('user-invalid-fallback', !isValid);
      input.classList.toggle('user-valid-fallback', isValid);
      input.setAttribute('aria-invalid', isValid ? 'false' : 'true');
      linkError(input, !isValid);
    };

    const handleEvent = (event) => {
      const input = event.target;
      if (event.type === 'reset') {
        const controls = input.elements || [];
        for (const control of controls) {
          dirtyState.delete(control);
          control.classList.remove('user-invalid-fallback', 'user-valid-fallback');
          if (control.matches('input, select, textarea')) control.setAttribute('aria-invalid', 'false');
          if (control.dataset?.error) linkError(control, false);
        }
        return;
      }
      if (!input.checkValidity) return;

      if (event.type === 'invalid') {
        dirtyState.set(input, { hasInteracted: true, hasBlurred: true });
        updateState(input);
        return;
      }
      if (event.type === 'input' || event.type === 'change') {
        const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
        state.hasInteracted = true;
        dirtyState.set(input, state);
        if (state.hasBlurred) updateState(input);
      } else if (event.type === 'blur') {
        const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
        state.hasBlurred = true;
        dirtyState.set(input, state);
        if (state.hasInteracted) updateState(input);
      }
    };

    const init = (root = document) => {
      if (CSS.supports('selector(:user-invalid)')) return;
      root.querySelectorAll('input, select, textarea').forEach((el) => {
        if (!el.hasAttribute('aria-invalid')) el.setAttribute('aria-invalid', 'false');
      });
      root.addEventListener('blur', handleEvent, true);
      root.addEventListener('input', handleEvent);
      root.addEventListener('change', handleEvent);
      root.addEventListener('invalid', handleEvent, true);
      root.addEventListener('reset', handleEvent, true);
    };

    return { init };
  })();

  const discoveryForm = document.getElementById('discovery-form');
  if (discoveryForm) {
    UserInvalidFallback.init(discoveryForm);

    const statusBanner = document.getElementById('form-status-banner');
    const submitBtn = document.getElementById('discovery-submit-btn');

    discoveryForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!discoveryForm.checkValidity()) {
        const firstInvalid = discoveryForm.querySelector(':invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      const formData = new FormData(discoveryForm);
      const payload = Object.fromEntries(formData.entries());

      const originalBtnHTML = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.textContent = 'SENDING INQUIRY...';
      statusBanner.hidden = true;
      statusBanner.className = 'form-status-banner';

      const mailtoSubject = encodeURIComponent(
        `Discovery Session Inquiry: ${payload.name}${payload.company ? ` (${payload.company})` : ''} — ${payload.topic || 'Fractional CFO'}`
      );
      const mailtoBody = encodeURIComponent(
        `Hello John,\n\n${payload.message}\n\n---\nName: ${payload.name}\nCompany: ${payload.company || 'N/A'}\nEmail: ${payload.email}\nFocus Area: ${payload.topic || 'Fractional CFO Advisory'}`
      );
      const mailtoHref = `mailto:info@jmlsconsulting.com?subject=${mailtoSubject}&body=${mailtoBody}`;

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({ ok: false }));

        if (response.ok && result.ok) {
          statusBanner.classList.add('form-status-success');
          statusBanner.innerHTML = `<strong>Thank you, ${escapeHtml(payload.name)}.</strong> Your discovery session request has been recorded for <strong>info@jmlsconsulting.com</strong>. ${
            result.forwarded
              ? 'We will be in touch shortly.'
              : `To also open this message directly in your email client right now, <a href="${mailtoHref}" style="text-decoration:underline;font-weight:700;">click here to send via info@jmlsconsulting.com</a>.`
          }`;
          statusBanner.hidden = false;
          discoveryForm.reset();
        } else {
          throw new Error(result.error || 'Submission fallback triggered');
        }
      } catch (_) {
        statusBanner.classList.add('form-status-success');
        statusBanner.innerHTML = `<strong>Thank you, ${escapeHtml(payload.name)}.</strong> We have prepared your inquiry for <strong>info@jmlsconsulting.com</strong>. <a href="${mailtoHref}" style="text-decoration:underline;font-weight:700;">Click here to dispatch your email directly to John Scalise</a>.`;
        statusBanner.hidden = false;
        window.location.href = mailtoHref;
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
      }
    });
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
