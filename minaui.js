/*!
 * MinaUI v0.2.0
 * Small, dependency-free behavior helpers for MinaUI components.
 * Copyright (c) 2026 oSsmXun
 * Released under the MIT License.
 */

(function (global) {
  "use strict";

  var FOCUSABLE_SELECTOR = [
    "a[href]",
    "area[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type=hidden])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "iframe",
    "object",
    "embed",
    "[contenteditable]",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  var MinaUI = {
    version: "0.2.0",
    _initialized: false,

    _focusable: function (container) {
      if (!container || !container.querySelectorAll) return [];
      return Array.prototype.filter.call(container.querySelectorAll(FOCUSABLE_SELECTOR), function (node) {
        var hidden = node.closest && node.closest("[hidden], [aria-hidden='true']");
        return !hidden;
      });
    },

    _focusLayer: function (target) {
      var container = target.matches(".mina-modal") ? target.querySelector(".mina-modal__dialog") : target;
      if (!container) container = target;

      var initial = target.getAttribute("data-mina-initial-focus");
      var initialTarget = initial && (document.getElementById(initial.replace(/^#/, "")) || document.querySelector(initial));
      var focusTarget = initialTarget && container.contains(initialTarget) ? initialTarget : this._focusable(container)[0];
      if (!focusTarget) {
        focusTarget = container;
        if (!focusTarget.hasAttribute("tabindex")) focusTarget.setAttribute("tabindex", "-1");
      }
      if (typeof focusTarget.focus === "function") focusTarget.focus();
    },

    _trapFocus: function (layer, event) {
      if (layer.getAttribute("data-mina-focus-trap") === "false") return false;
      var container = layer.matches(".mina-modal") ? (layer.querySelector(".mina-modal__dialog") || layer) : layer;
      var focusables = this._focusable(container);
      if (!focusables.length) {
        event.preventDefault();
        if (typeof container.focus === "function") container.focus();
        return true;
      }

      var active = document.activeElement;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (!container.contains(active) || (event.shiftKey && active === container)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return true;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return true;
      }
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
        return true;
      }
      return false;
    },

    _restoreFocus: function (target) {
      var returnFocus = target.__minaUIReturnFocus;
      var active = document.activeElement;
      var isDropdown = target.matches(".mina-dropdown");
      var shouldRestore = !isDropdown || !active || active === document.body || target.contains(active);
      delete target.__minaUIReturnFocus;
      delete target.__minaUITrigger;
      if (!shouldRestore || !returnFocus || typeof returnFocus.focus !== "function") return;
      window.setTimeout(function () {
        if (returnFocus.isConnected !== false) returnFocus.focus();
      }, 0);
    },

    _setDropdownState: function (dropdown, open) {
      var menu = dropdown.querySelector(".mina-dropdown__menu, [role='menu']");
      if (!menu) return;
      menu.setAttribute("aria-hidden", open ? "false" : "true");
      if (open) menu.removeAttribute("inert");
      else menu.setAttribute("inert", "");
    },

    _dropdownItems: function (dropdown) {
      return Array.prototype.filter.call(dropdown.querySelectorAll("[data-mina-dropdown-item]"), function (item) {
        return !item.disabled && item.getAttribute("aria-disabled") !== "true" && !(item.closest && item.closest("[hidden], [aria-hidden='true']"));
      });
    },

    _focusDropdown: function (dropdown, index) {
      var items = this._dropdownItems(dropdown);
      if (!items.length) return null;
      var next = (index + items.length) % items.length;
      items[next].focus();
      return items[next];
    },

    _moveTab: function (tab, event) {
      var group = tab.closest("[data-mina-tabs]") || tab.parentElement;
      if (!group) return false;
      var tabs = Array.prototype.filter.call(group.querySelectorAll("[data-mina-tab]"), function (item) {
        return !item.disabled && item.getAttribute("aria-disabled") !== "true" && !(item.closest && item.closest("[hidden], [aria-hidden='true']"));
      });
      if (tabs.length < 2) return false;

      var tabList = group.querySelector(".mina-tabs") || group;
      var vertical = group.getAttribute("aria-orientation") === "vertical" || tabList.getAttribute("aria-orientation") === "vertical";
      var index = tabs.indexOf(tab);
      var nextIndex;
      if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = tabs.length - 1;
      else if (!vertical && event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      else if (!vertical && event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (vertical && event.key === "ArrowDown") nextIndex = (index + 1) % tabs.length;
      else if (vertical && event.key === "ArrowUp") nextIndex = (index - 1 + tabs.length) % tabs.length;
      else return false;

      event.preventDefault();
      var next = tabs[nextIndex];
      this.selectTab(next);
      next.focus();
      return true;
    },

    _moveDropdown: function (dropdown, event) {
      var trigger = dropdown.querySelector("[data-mina-toggle], [aria-haspopup]");
      var item = event.target.closest && event.target.closest("[data-mina-dropdown-item]");
      var inTrigger = trigger && (event.target === trigger || trigger.contains(event.target));
      var open = dropdown.classList.contains("is-open");
      var isSpace = event.key === " " || event.key === "Spacebar";

      if (!open && inTrigger && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || isSpace)) {
        event.preventDefault();
        this.toggle(trigger);
        if (dropdown.classList.contains("is-open")) this._focusDropdown(dropdown, event.key === "ArrowUp" ? -1 : 0);
        return true;
      }
      if (!open || (!item && !inTrigger)) return false;

      var items = this._dropdownItems(dropdown);
      if (!items.length) return false;
      var index = item ? items.indexOf(item) : -1;
      var nextIndex;
      if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = items.length - 1;
      else if (event.key === "ArrowDown") nextIndex = (index + 1 + items.length) % items.length;
      else if (event.key === "ArrowUp") nextIndex = (index - 1 + items.length) % items.length;
      else if (item && (event.key === "Enter" || isSpace) && item.tagName !== "BUTTON" && item.tagName !== "A") {
        event.preventDefault();
        item.click();
        return true;
      } else return false;

      event.preventDefault();
      this._focusDropdown(dropdown, nextIndex);
      return true;
    },

    /**
     * Initialize delegated interactions. It is safe to call this more than once.
     * The CSS components remain usable without this file.
     */
    init: function (root) {
      root = root || document;
      if (root.__minaUIInitialized) return this;
      root.__minaUIInitialized = true;

      root.addEventListener("click", function (event) {
        var toggle = event.target.closest && event.target.closest("[data-mina-toggle]");
        var close = event.target.closest && event.target.closest("[data-mina-close]");
        var tab = event.target.closest && event.target.closest("[data-mina-tab]");
        var dropdownItem = event.target.closest && event.target.closest("[data-mina-dropdown-item]");
        var copy = event.target.closest && event.target.closest("[data-mina-copy]");
        var theme = event.target.closest && event.target.closest("[data-mina-theme]");

        if (toggle) {
          event.preventDefault();
          MinaUI.toggle(toggle);
          return;
        }
        if (close) {
          event.preventDefault();
          MinaUI.close(MinaUI._target(close) || close.closest(".mina-modal, .mina-drawer"));
          return;
        }
        if (tab) {
          event.preventDefault();
          MinaUI.selectTab(tab);
          return;
        }
        if (dropdownItem) {
          var dropdown = dropdownItem.closest(".mina-dropdown");
          if (dropdown) {
            var value = dropdownItem.getAttribute("data-value") || dropdownItem.textContent.trim();
            var valueNode = dropdown.querySelector("[data-mina-dropdown-value]");
            if (valueNode) valueNode.textContent = dropdownItem.textContent.trim();
            dropdown.querySelectorAll("[data-mina-dropdown-item]").forEach(function (item) {
              item.setAttribute("aria-selected", item === dropdownItem ? "true" : "false");
            });
            dropdown.dispatchEvent(new CustomEvent("mina:change", { detail: { value: value, item: dropdownItem } }));
            MinaUI.close(dropdown);
          }
          return;
        }
        if (copy) {
          event.preventDefault();
          MinaUI.copy(copy);
          return;
        }
        if (theme) {
          event.preventDefault();
          MinaUI.setTheme(theme.getAttribute("data-mina-theme") || "dark");
        }

        var modal = event.target.closest && event.target.closest(".mina-modal");
        if (modal && event.target === modal && modal.getAttribute("data-mina-backdrop-close") !== "false") {
          MinaUI.close(modal);
        }
        if (event.target.closest && !event.target.closest(".mina-dropdown")) {
          document.querySelectorAll(".mina-dropdown.is-open").forEach(function (item) {
            MinaUI.close(item, { restoreFocus: false });
          });
        }
      });

      root.addEventListener("keydown", function (event) {
        var dropdown = event.target.closest && event.target.closest(".mina-dropdown");
        if (event.key === "Escape") {
          var active = (dropdown && dropdown.classList.contains("is-open") && dropdown) || document.querySelector(".mina-dropdown.is-open") || document.querySelector(".mina-modal.is-open, .mina-drawer.is-open");
          if (active) {
            event.preventDefault();
            MinaUI.close(active);
            return;
          }
        }
        var layer = document.querySelector(".mina-modal.is-open, .mina-drawer.is-open");
        if (layer && event.key === "Tab" && MinaUI._trapFocus(layer, event)) return;
        var tab = event.target.closest && event.target.closest("[data-mina-tab]");
        if (tab && MinaUI._moveTab(tab, event)) return;
        if (dropdown) MinaUI._moveDropdown(dropdown, event);
      });

      this._initialized = true;
      return this;
    },

    _target: function (control) {
      if (!control) return null;
      var value = control.getAttribute("data-mina-target") || control.getAttribute("data-mina-toggle");
      if (!value) return null;
      if (value.charAt(0) === "#") return document.querySelector(value);
      return document.getElementById(value) || document.querySelector(value);
    },

    _setExpanded: function (control, open) {
      if (!control) return;
      control.setAttribute("aria-expanded", open ? "true" : "false");
      control.classList.toggle("is-active", open);
    },

    open: function (value, trigger) {
      var target = typeof value === "string" ? (document.getElementById(value.replace(/^#/, "")) || document.querySelector(value)) : value;
      if (!target) return null;
      if (!target.classList.contains("is-open")) {
        var active = trigger || document.activeElement;
        target.__minaUIReturnFocus = active && active !== document.body ? active : null;
      }
      if (trigger) target.__minaUITrigger = trigger;
      target.classList.add("is-open");
      if (target.matches(".mina-modal")) {
        target.setAttribute("aria-hidden", "false");
        // Body scroll lock (html[data-mina-modal-open]) while any modal is open
        MinaUI._modalOpenCount = (MinaUI._modalOpenCount || 0) + 1;
        document.documentElement.setAttribute("data-mina-modal-open", "");
        window.setTimeout(function () {
          if (target.classList.contains("is-open")) MinaUI._focusLayer(target);
        }, 0);
      }
      if (target.matches(".mina-drawer")) {
        target.setAttribute("aria-hidden", "false");
        var overlay = document.querySelector("[data-mina-overlay]");
        if (overlay) overlay.classList.add("is-visible");
      }
      if (target.matches(".mina-dropdown")) {
        var dropdownTrigger = trigger || target.__minaUITrigger || target.querySelector("[data-mina-toggle], [aria-haspopup]");
        if (dropdownTrigger) {
          target.__minaUITrigger = dropdownTrigger;
          dropdownTrigger.setAttribute("aria-expanded", "true");
        }
        this._setDropdownState(target, true);
      }
      return target;
    },

    close: function (value, options) {
      if (!value) return null;
      var target = typeof value === "string" ? (document.getElementById(value.replace(/^#/, "")) || document.querySelector(value)) : value;
      if (!target) return null;
      var wasOpen = target.classList.contains("is-open");
      target.classList.remove("is-open");
      if (target.matches(".mina-modal, .mina-drawer")) target.setAttribute("aria-hidden", "true");
      if (target.matches(".mina-modal") && wasOpen) {
        MinaUI._modalOpenCount = Math.max(0, (MinaUI._modalOpenCount || 0) - 1);
        if (!MinaUI._modalOpenCount) document.documentElement.removeAttribute("data-mina-modal-open");
      }
      if (target.matches(".mina-drawer")) {
        var overlay = document.querySelector("[data-mina-overlay]");
        if (overlay) overlay.classList.remove("is-visible");
      }
      if (target.matches(".mina-dropdown")) this._setDropdownState(target, false);
      var control = target.__minaUITrigger || (target.id && document.querySelector('[data-mina-toggle="#' + target.id + '"], [data-mina-target="#' + target.id + '"]'));
      this._setExpanded(control, false);
      if (options && options.restoreFocus === false) {
        delete target.__minaUIReturnFocus;
        delete target.__minaUITrigger;
      } else if (wasOpen) {
        this._restoreFocus(target);
      }
      return target;
    },

    toggle: function (control) {
      var target = this._target(control);
      if (!target) {
        target = control.closest(".mina-dropdown");
      }
      if (!target) return null;
      var open = target.classList.contains("is-open");
      if (open) this.close(target);
      else {
        if (target.matches(".mina-dropdown")) {
          document.querySelectorAll(".mina-dropdown.is-open").forEach(function (item) { MinaUI.close(item); });
        }
        this.open(target, control);
        this._setExpanded(control, true);
      }
      return target;
    },

    openModal: function (value) {
      return this.open(value);
    },

    closeModal: function (value) {
      return this.close(typeof value === "string" ? document.querySelector(value) : value);
    },

    selectTab: function (tab) {
      var group = tab.closest("[data-mina-tabs]") || tab.parentElement;
      var panelId = tab.getAttribute("data-mina-tab") || tab.getAttribute("aria-controls");
      var panel = panelId && (document.getElementById(panelId.replace(/^#/, "")) || document.querySelector(panelId));
      if (!group) return null;
      group.querySelectorAll("[data-mina-tab]").forEach(function (item) {
        var selected = item === tab;
        item.setAttribute("aria-selected", selected ? "true" : "false");
        item.tabIndex = selected ? 0 : -1;
      });
      if (panel) {
        var panelGroup = panel.parentElement;
        (panelGroup || document).querySelectorAll(".mina-tabs__panel").forEach(function (item) {
          item.hidden = item !== panel;
        });
        panel.hidden = false;
      }
      return panel;
    },

    setTheme: function (theme, options) {
      options = options || {};
      var value = theme === "light" ? "light" : theme === "dark" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", value);
      if (options.persist !== false) {
        try { localStorage.setItem("mina-theme", value); } catch (ignore) {}
      }
      document.dispatchEvent(new CustomEvent("mina:themechange", { detail: { theme: value } }));
      return value;
    },

    copy: function (control) {
      var selector = control.getAttribute("data-mina-copy");
      var target = selector && (document.querySelector(selector) || document.getElementById(selector.replace(/^#/, "")));
      var text = target ? (target.value !== undefined ? target.value : target.textContent) : selector;
      if (!text || !navigator.clipboard) return Promise.resolve(false);
      return navigator.clipboard.writeText(text.trim()).then(function () {
        var original = control.getAttribute("aria-label");
        control.setAttribute("aria-label", "Copied");
        window.setTimeout(function () {
          if (original) control.setAttribute("aria-label", original);
          else control.removeAttribute("aria-label");
        }, 1200);
        return true;
      }).catch(function () { return false; });
    },

    toast: function (message, options) {
      options = options || {};
      var region = document.querySelector(options.region || ".mina-toast-region");
      if (!region) {
        region = document.createElement("div");
        region.className = "mina-toast-region";
        region.setAttribute("aria-live", "polite");
        region.setAttribute("aria-atomic", "false");
        document.body.appendChild(region);
      }
      var toast = document.createElement("article");
      var tone = options.tone ? " mina-toast--" + options.tone : "";
      toast.className = "mina-toast" + tone;
      toast.setAttribute("role", options.tone === "danger" ? "alert" : "status");
      var content = document.createElement("div");
      content.className = "mina-toast__content";
      if (options.title) {
        var title = document.createElement("p");
        title.className = "mina-toast__title";
        title.textContent = options.title;
        content.appendChild(title);
      }
      var body = document.createElement("p");
      body.className = "mina-toast__message";
      body.textContent = message == null ? "" : String(message);
      content.appendChild(body);
      var close = document.createElement("button");
      close.type = "button";
      close.className = "mina-btn mina-btn--ghost mina-btn--icon mina-btn--sm";
      close.setAttribute("aria-label", "Close notification");
      close.textContent = "×";
      close.addEventListener("click", function () { MinaUI._dismissToast(toast); });
      toast.appendChild(content);
      toast.appendChild(close);
      region.appendChild(toast);
      var duration = options.duration === 0 ? 0 : (options.duration || 4500);
      if (duration > 0) window.setTimeout(function () { MinaUI._dismissToast(toast); }, duration);
      return toast;
    },

    /** Fade a toast out (no-op reentry) before removing it from the DOM. */
    _dismissToast: function (toast) {
      if (!toast || !toast.parentNode || toast.getAttribute("data-mina-leaving")) return;
      toast.setAttribute("data-mina-leaving", "true");
      toast.classList.add("mina-fade-out");
      window.setTimeout(function () { toast.remove(); }, 350);
    }
  };

  global.MinaUI = MinaUI;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { MinaUI.init(); });
  } else {
    MinaUI.init();
  }
})(window);
