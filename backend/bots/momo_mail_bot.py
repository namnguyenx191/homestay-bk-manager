import imaplib
import email
import os
import re
import requests
from email.header import decode_header
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

API_BASE = os.getenv("BOT_API_BASE", "http://localhost:5050/api").rstrip("/")
BOT_SYNC_TOKEN = (os.getenv("BOT_SYNC_TOKEN") or "").strip()

IMAP_HOST = os.getenv("BOT_IMAP_HOST", "imap.gmail.com")
IMAP_PORT = int(os.getenv("BOT_IMAP_PORT", "993"))
EMAIL_USER = os.getenv("BOT_EMAIL_USER")
EMAIL_PASS = os.getenv("BOT_EMAIL_PASS")
FROM_FILTER = (os.getenv("BOT_EMAIL_FROM_FILTER", "momo") or "").lower()

REF_REGEX = re.compile(r"\b(HS|AO)-[A-Z0-9]{6,12}\b")
MONEY_REGEX = re.compile(r"(\d[\d\.,]{2,})\s?(VND|VNĐ)?", re.IGNORECASE)


def decode_text(raw_value):
    if not raw_value:
        return ""
    parts = decode_header(raw_value)
    out = []
    for text, enc in parts:
        if isinstance(text, bytes):
            out.append(text.decode(enc or "utf-8", errors="ignore"))
        else:
            out.append(text)
    return "".join(out)


def extract_amount(text):
    m = MONEY_REGEX.search(text or "")
    if not m:
        return 0
    return int(re.sub(r"[^\d]", "", m.group(1)) or "0")


def confirm(reference, amount):
    url = f"{API_BASE}/bookings/bot/confirm-transfer"
    headers = {"x-bot-token": BOT_SYNC_TOKEN}
    payload = {"reference": reference, "amount": amount, "source": "momo_email_python"}
    r = requests.post(url, json=payload, headers=headers, timeout=20)
    if r.status_code >= 300:
        raise RuntimeError(f"{r.status_code}: {r.text}")
    return r.json()


def run():
    if not BOT_SYNC_TOKEN:
        raise RuntimeError("Missing BOT_SYNC_TOKEN")
    if not EMAIL_USER or not EMAIL_PASS:
        raise RuntimeError("Missing BOT_EMAIL_USER / BOT_EMAIL_PASS")

    mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    mail.login(EMAIL_USER, EMAIL_PASS)
    mail.select("INBOX")

    status, data = mail.search(None, "UNSEEN")
    if status != "OK":
        raise RuntimeError("Cannot read inbox")

    for num in data[0].split():
        status, msg_data = mail.fetch(num, "(RFC822)")
        if status != "OK":
            continue

        raw = msg_data[0][1]
        msg = email.message_from_bytes(raw)
        from_text = decode_text(msg.get("From", "")).lower()
        if FROM_FILTER not in from_text:
            continue

        subject = decode_text(msg.get("Subject", ""))
        body_text = ""
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    charset = part.get_content_charset() or "utf-8"
                    body_text += part.get_payload(decode=True).decode(charset, errors="ignore") + "\n"
        else:
            charset = msg.get_content_charset() or "utf-8"
            body_text = msg.get_payload(decode=True).decode(charset, errors="ignore")

        text = f"{subject}\n{body_text}"
        ref_match = REF_REGEX.search(text)
        if not ref_match:
            continue

        reference = ref_match.group(0).upper()
        amount = extract_amount(text)
        try:
            result = confirm(reference, amount)
            print("[SYNC OK]", reference, amount, result.get("scope", ""))
            mail.store(num, "+FLAGS", "\\Seen")
        except Exception as err:
            print("[SYNC FAIL]", reference, str(err))

    mail.close()
    mail.logout()


if __name__ == "__main__":
    run()
