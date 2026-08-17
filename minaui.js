/*!
 * MinaUI v0.1.0
 * Small, dependency-free behavior helpers for MinaUI components.
 * Copyright (c) 2026 oSsmXun
 * Released under the MIT License.
 */

(function (global) {
  "use strict";

  var MinaUI = {
    version: "0.1.0",
    _initialized: false,

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
            MinaUI.close(item);
          });
        }
      });

      root.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          var active = document.querySelector(".mina-modal.is-open, .mina-drawer.is-open, .mina-dropdown.is-open");
          if (active) {
            event.preventDefault();
            MinaUI.close(active);
          }
        }
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

    open: function (value) {
      var target = typeof value === "string" ? (document.getElementById(value.replace(/^#/, "")) || document.querySelector(value)) : value;
      if (!target) return null;
      target.classList.add("is-open");
      if (target.matches(".mina-modal")) {
        target.setAttribute("aria-hidden", "false");
        var dialog = target.querySelector(".mina-modal__dialog");
        if (dialog && !dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
        window.setTimeout(function () { if (dialog) dialog.focus(); }, 0);
      }
      if (target.matches(".mina-drawer")) {
        target.setAttribute("aria-hidden", "false");
        var overlay = document.querySelector("[data-mina-overlay]");
        if (overlay) overlay.classList.add("is-visible");
      }
      if (target.matches(".mina-dropdown")) {
        var trigger = target.querySelector("[aria-expanded]");
        if (trigger) trigger.setAttribute("aria-expanded", "true");
      }
      return target;
    },

    close: function (value) {
      if (!value) return null;
      var target = value;
      target.classList.remove("is-open");
      if (target.matches(".mina-modal, .mina-drawer")) target.setAttribute("aria-hidden", "true");
      if (target.matches(".mina-drawer")) {
        var overlay = document.querySelector("[data-mina-overlay]");
        if (overlay) overlay.classList.remove("is-visible");
      }
      var control = document.querySelector('[data-mina-toggle="#' + target.id + '"], [data-mina-target="#' + target.id + '"]');
      this._setExpanded(control, false);
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
        this.open(target);
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
      close.addEventListener("click", function () { toast.remove(); });
      toast.appendChild(content);
      toast.appendChild(close);
      region.appendChild(toast);
      var duration = options.duration === 0 ? 0 : (options.duration || 4500);
      if (duration > 0) window.setTimeout(function () { toast.remove(); }, duration);
      return toast;
    }
  };

  global.MinaUI = MinaUI;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { MinaUI.init(); });
  } else {
    MinaUI.init();
  }
})(window);

