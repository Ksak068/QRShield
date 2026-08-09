"""
QR_Shield Enterprise - Dataset Preparation
===========================================
Downloads PhishTank phishing URLs + Tranco top-1M legit domains,
computes the same 8 features as the app's feature-extractor.ts,
and writes ml/data/features.csv for training.

Usage: python ml/prepare_data.py
"""

import csv
import math
import os
import random
import re
import urllib.request
import zipfile
from collections import Counter
from urllib.parse import urlparse

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
PHISHTANK_URL = "https://github.com/arvindeybram/phishing/raw/refs/heads/master/phishtank.csv"

MAX_PHISHING = 60000
MAX_LEGIT = 60000

SUSPICIOUS_KEYWORDS = [
    "login", "signin", "verify", "update", "confirm", "secure",
    "account", "bank", "paypal", "password", "credential", "authenticate",
    "wallet", "recover", "reset", "support", "service", "alert",
]

FEATURE_NAMES = [
    "domainLength", "subdomainCount", "hasHttps", "entropy",
    "specialCharRatio", "isIpAddress", "hasSuspiciousKeywords", "redirectCount",
]


def download(url: str, dest: str) -> str:
    if os.path.exists(dest):
        print(f"  cached: {dest}")
        return dest
    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"  downloading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 QR_Shield-trainer"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
        with open(dest, "wb") as f:
            f.write(data)
    print(f"  saved {len(data) / 1024 / 1024:.1f} MB -> {dest}")
    return dest


def shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    freq = Counter(s)
    ent = -sum((c / len(s)) * math.log2(c / len(s)) for c in freq.values())
    return round(ent, 2)


def count_subdomains(hostname: str) -> int:
    parts = hostname.split(".")
    return len(parts) - 2 if len(parts) > 2 else 0


def has_suspicious_keywords(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in SUSPICIOUS_KEYWORDS)


def strip_www(hostname: str) -> str:
    return hostname[4:] if hostname.startswith("www.") else hostname


def extract_features(url: str) -> list:
    """Mirror of Ts feature-extractor.ts (redirectCount=0 offline)."""
    if "://" not in url:
        url = "https://" + url
    parsed = urlparse(url)
    hostname = strip_www(parsed.hostname or "")
    is_ip = bool(re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", hostname))

    special_chars = len(re.findall(r"[<>\{\}\|\\\^~\[\]`]", url))
    special_char_ratio = round(special_chars / len(url), 3) if url else 0.0

    return [
        len(hostname),
        count_subdomains(hostname),
        1 if parsed.scheme == "https" else 0,
        shannon_entropy(hostname),
        special_char_ratio,
        1 if is_ip else 0,
        1 if has_suspicious_keywords(url) else 0,
        0,
    ]


def normalize_url(raw: str) -> str | None:
    url = raw.strip().strip('"\'')
    if not url or url.startswith("#"):
        return None
    if "://" not in url:
        url = "https://" + url
    parsed = urlparse(url)
    if not parsed.hostname or "." not in parsed.hostname:
        return None
    if len(url) > 500:
        return None
    return url


def load_phishtank(path: str) -> list[str]:
    urls = set()
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for row in reader:
            u = normalize_url(row.get("url", ""))
            if u:
                urls.add(u)
    return list(urls)


def load_tranco_top_domains(path: str, top_n: int = 200000) -> list[str]:
    domains = []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for i, line in enumerate(f):
            if i >= top_n:
                break
            line = line.strip()
            try:
                rank, domain = line.split(",")[:2]
            except ValueError:
                continue
            domain = normalize_url(domain)
            if domain:
                domains.append(domain)
    return domains


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    random.seed(42)

    print("Step 1/3 - Downloading PhishTank...")
    phish_path = download(PHISHTANK_URL, os.path.join(DATA_DIR, "phishtank.csv"))
    phishing = load_phishtank(phish_path)
    print(f"  {len(phishing)} valid phishing URLs")

    print("Step 2/3 - Downloading Tranco top-1M...")
    tranco_zip = download("https://tranco-list.eu/top-1m.csv.zip", os.path.join(DATA_DIR, "tranco-top1m.csv.zip"))
    with zipfile.ZipFile(tranco_zip) as zf:
        inner = zf.namelist()[0]
        csv_bytes = zf.read(inner)
    tranco_csv = os.path.join(DATA_DIR, "tranco-top1m.csv")
    if not os.path.exists(tranco_csv):
        with open(tranco_csv, "wb") as f:
            f.write(csv_bytes)
    legit = load_tranco_top_domains(tranco_csv)
    print(f"  {len(legit)} legit URLs from top 200k Tranco domains")

    print("Step 3/3 - Building feature matrix...")
    legit_domains = {domain_of(u) for u in legit}
    phishing = [u for u in phishing if domain_of(u) not in legit_domains][:MAX_PHISHING]

    legit_phish_domains = {domain_of(u) for u in phishing}
    legit = [u for u in legit if domain_of(u) not in legit_phish_domains][:MAX_LEGIT]

    # Common legit subdomains: teaches the model that subdomainCount=1 is
    # normal (www./mail./docs./m./app.) instead of mapping it to phishing.
    subdomain_prefixes = ["www", "mail", "docs", "m", "app"]
    variants = []
    for domain in legit[: len(subdomain_prefixes) * 12000]:
        base = urlparse(domain).hostname or ""
        for prefix in subdomain_prefixes:
            variant = f"https://{prefix}.{base}/"
            if domain_of(variant) not in legit_phish_domains:
                variants.append(variant)
    random.shuffle(variants)
    variants = variants[:MAX_LEGIT]

    rows = []
    for url in phishing:
        rows.append(feature_row(url, label=1))
    print(f"  phishing rows: {len(rows)}")

    for url in legit + variants:
        rows.append(feature_row(url, label=0))
    print(f"  legit rows: {len(rows) - len(phishing)}")

    random.shuffle(rows)

    out = os.path.join(DATA_DIR, "training.csv")
    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["url", "label"] + FEATURE_NAMES)
        writer.writerows(rows)

    print(f"\nWrote {len(rows)} rows -> {out}")


def domain_of(url: str) -> str:
    return strip_www(urlparse(url).hostname or "")


def feature_row(url: str, label: int) -> list:
    return [url, label] + extract_features(url)


if __name__ == "__main__":
    main()