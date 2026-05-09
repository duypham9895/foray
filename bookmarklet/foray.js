// Foray Bookmarklet — captures page info and POSTs to /api/capture
// Build: npx esbuild bookmarklet/foray.js --minify --outfile=dist/bookmarklet/foray.min.js
// Encode: tsx scripts/build-bookmarklet.ts
(function () {
  function capturePageInfo() {
    return {
      title: document.title,
      url: window.location.href,
      selectedText: window.getSelection().toString(),
      timestamp: new Date().toISOString(),
    };
  }

  function sendToAPI(data) {
    var API_URL = "http://localhost:3000/api/capture";

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("API error: " + res.status);
        return res.json();
      })
      .then(function (body) {
        if (body.redirectUrl) {
          window.open(body.redirectUrl, "_blank");
        }
      })
      .catch(function (err) {
        console.error("Foray bookmarklet error:", err);
        alert("Foray bookmarklet failed. Check console for details.");
      });
  }

  var pageInfo = capturePageInfo();
  console.log("Foray captured:", pageInfo);
  sendToAPI(pageInfo);
})();
