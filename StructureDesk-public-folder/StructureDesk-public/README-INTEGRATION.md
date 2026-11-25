# StructureDesk public assets

Copy the contents of this folder into your app's existing `public/` directory.
Do not create `public/public/`.

## Included
- `logo.png` — full transparent StructureDesk wordmark
- `favicon.svg` and `icons/favicon-64.png` — browser icon assets
- `icons/icon-192.png`, `icons/icon-512.png` — PWA icons
- `icons/icon-512-maskable.png` — Android maskable icon
- `icons/apple-touch-icon.png` — iOS home-screen icon
- `manifest.webmanifest` — PWA manifest
- `sw.js` — lightweight service worker for static icon/manifest caching

## Add to your HTML `<head>`
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#09111f" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

## Register the service worker once
Add this to your app's client entry point (for example `src/main.jsx`, `src/main.tsx`, or your equivalent):
```js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  });
}
```

If your app already has a service worker or PWA plugin, do not register a second one.
Merge these assets into the existing PWA setup instead.

## Important
This package provides the public assets and integration snippets. It does not modify your live Railway deployment or source repository. After copying the assets and adding the HTML/registration snippets, rebuild and redeploy your app.
