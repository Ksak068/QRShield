const fs = require("fs");
const { RandomForestClassifier } = require("ml-random-forest");

const modelData = JSON.parse(fs.readFileSync("public/models/rf-model.json", "utf8"));
const model = RandomForestClassifier.load(modelData);
console.log("model loaded:", modelData.baseModel.nEstimators, "trees");
console.log("metadata:", JSON.stringify(modelData.metadata));

function entropy(s) {
  const f = {};
  for (const c of s) f[c] = (f[c] || 0) + 1;
  let e = 0;
  for (const k in f) {
    const p = f[k] / s.length;
    e -= p * Math.log2(p);
  }
  return Math.round(e * 100) / 100;
}

function features(url) {
  const u = new URL(url);
  const raw = u.hostname;
  const h = raw.startsWith("www.") ? raw.slice(4) : raw;
  const parts = h.split(".");
  const subs = parts.length > 2 ? parts.length - 2 : 0;
  const sc = (url.match(/[<>{}|\\^~[\]`]/g) || []).length;
  const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
  const kw = /login|signin|verify|update|confirm|secure|account|bank|paypal|password|credential|authenticate|wallet|recover|reset|support|service|alert/i.test(url) ? 1 : 0;
  return [
    h.length,
    subs,
    u.protocol === "https:" ? 1 : 0,
    entropy(url),
    Math.round((sc / url.length) * 1000) / 1000,
    isIp ? 1 : 0,
    kw,
    0,
  ];
}

const tests = [
  ["https://www.google.com/", "safe"],
  ["https://github.com/Ksak068/QRShield", "safe"],
  ["https://paypal.com/signin", "legit login"],
  ["http://secure-account-verify-login.bank-update.tk/login.php?user=admin", "phishing"],
  ["https://184.154.53.12/update/confirm/credential/verify/paypal", "phishing"],
  ["http://bit.ly/3kXyZz", "suspicious"],
];

let pass = 0;
for (const [url, expected] of tests) {
  const v = features(url);
  const p = model.predictProbability([v], 1)[0];
  const label = p > 0.5 ? "phishing" : "safe";
  console.log((label + "  ").padEnd(9), "expected:", (expected + " ").padEnd(13), url, "| prob:", p.toFixed(3));
  if (expected !== "suspicious" && label === expected) pass++;
}
console.log("\n" + pass + "/5 exact-match checks passed");
