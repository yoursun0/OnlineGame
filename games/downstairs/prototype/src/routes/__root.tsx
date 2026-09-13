import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "小朋友落樓梯";

const BOOT_MENU = `(function(){
  if (window.__shaftBoot) return;
  window.__shaftBoot = 1;
  var KEY = "shaft-boot";
  var s = { mode: "solo", difficulty: "normal", traps: { conveyor: 1, spring: 1, fragile: 1 }, play: 0, how: 0 };
  try { var p = JSON.parse(sessionStorage.getItem(KEY) || ""); if (p && p.mode) s = p; } catch (e) {}
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function setSeg(el, on) {
    if (on) {
      el.classList.add("bg-accent", "text-accent-fg");
      el.classList.remove("border", "border-border", "bg-surface-2", "text-muted");
    } else {
      el.classList.remove("bg-accent", "text-accent-fg");
      el.classList.add("border", "border-border", "bg-surface-2", "text-muted");
    }
  }
  function paint() {
    document.querySelectorAll("[data-pick]").forEach(function (el) {
      var k = el.getAttribute("data-pick") || "";
      if (k.indexOf("mode:") === 0) setSeg(el, s.mode === k.slice(5));
      else if (k.indexOf("diff:") === 0) setSeg(el, s.difficulty === k.slice(5));
      else if (k.indexOf("trap:") === 0) {
        var on = !!s.traps[k.slice(5)];
        el.classList.toggle("text-subtle", !on);
        el.classList.toggle("line-through", !on);
        el.classList.toggle("bg-surface-2", on);
        el.classList.toggle("text-fg", on);
      }
    });
  }
  function handle(e) {
    if (window.__shaftHydrated) return;
    var el = e.target && e.target.closest && e.target.closest("[data-pick],[data-boot]");
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    var pick = el.getAttribute("data-pick");
    var boot = el.getAttribute("data-boot");
    if (pick) {
      if (pick.indexOf("mode:") === 0) s.mode = pick.slice(5);
      else if (pick.indexOf("diff:") === 0) s.difficulty = pick.slice(5);
      else if (pick.indexOf("trap:") === 0) {
        var t = pick.slice(5);
        s.traps[t] = s.traps[t] ? 0 : 1;
      }
      s.play = 0;
      save();
      paint();
    }
    if (boot === "play") {
      s.play = 1;
      s.how = 0;
      save();
      el.textContent = "載入中…";
      window.dispatchEvent(new Event("shaft-play"));
    }
    if (boot === "how") {
      s.how = 1;
      save();
    }
  }
  document.addEventListener("pointerup", handle, true);
  document.addEventListener("click", handle, true);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paint);
  else paint();
})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
      { title: APP_NAME },
      { name: "theme-color", content: "#0a2748" },
      { name: "description", content: "單人挑戰與雙人同機對戰的小朋友落樓梯。避開尖刺，活著往下墜。" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
    scripts: [{ children: BOOT_MENU }],
  }),
  component: () => (
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
