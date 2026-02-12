"""
Email sending logic. Welcome email and transactional emails.
All emails are sent via Zoho SMTP using SMTP_USER and SMTP_PASSWORD.
For paid organizations use smtppro.zoho.in:465 (SMTP_SSL).
"""
import os
import smtplib
import ssl
import logging
import uuid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from urllib.parse import quote
from datetime import datetime as dt
from sqlmodel import Session, select
from typing import Optional, List, Tuple
from backend.models import Student, Lead, Batch, Center, User, UserCenterLink

logger = logging.getLogger(__name__)

# Brand colors for internal notification HTML
TOFA_NAVY = "#0A192F"
TOFA_GOLD = "#D4AF37"
TOFA_GOLD_GRADIENT = "linear-gradient(135deg, #D4AF37 0%, #C9A227 100%)"
MUTED_GREY = "#6B7280"

# Zoho SMTP: paid orgs use smtppro.zoho.in, port 465 (SSL from first byte)
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtppro.zoho.in")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))

# Default CRM base URL for links in internal emails (override with env CRM_BASE_URL).
DEFAULT_CRM_BASE_URL = "https://web-ol2p4uejfa-el.a.run.app"
# Fallback recipient when a center has no group_email set.
ADMIN_FALLBACK_EMAIL = "admin@tofafootballacademy.com"


def get_crm_base_url() -> str:
    """Return base URL for CRM links (no trailing slash). Uses DEFAULT_CRM_BASE_URL if env unset."""
    return (os.getenv("CRM_BASE_URL", DEFAULT_CRM_BASE_URL) or DEFAULT_CRM_BASE_URL).strip().rstrip("/")


def get_center_group_email(db: Session, center_id: Optional[int]) -> Optional[str]:
    """
    Return the notification email for a center: Center.group_email from DB, or ADMIN_FALLBACK_EMAIL.
    Returns None only when center_id is None. Otherwise returns group_email if set, else admin@tofafootballacademy.com.
    """
    if center_id is None:
        return None
    center = db.get(Center, center_id)
    if not center:
        return ADMIN_FALLBACK_EMAIL
    email = (center.group_email or "").strip()
    if email:
        return email
    return ADMIN_FALLBACK_EMAIL


def send_new_lead_alert(
    db: Session,
    center_name: str,
    source: str,
    lead: Optional[Lead] = None,
    player_name: Optional[str] = None,
    phone: Optional[str] = None,
    center_id: Optional[int] = None,
    lead_id: Optional[int] = None,
) -> bool:
    """
    Send a new lead alert to the Center Head group (real-time: Meta/Manual).
    Subject: 'New Lead: [Player Name] ([Center Name])'
    Body includes RefID and timestamp footer. Uses Center.group_email from DB, fallback SMTP_USER.
    """
    if lead is not None:
        player_name = lead.player_name or "Unknown"
        phone = lead.phone or ""
        center_id = lead.center_id
        if lead_id is None and getattr(lead, "id", None) is not None:
            lead_id = lead.id
    if center_id is None:
        return False
    player_name = player_name or "Unknown"
    phone = phone or ""
    base_url = get_crm_base_url()
    subject = f"New Lead: {player_name} ({center_name})"
    link = f"{base_url}/leads?search={quote(phone)}" if phone else f"{base_url}/leads"
    body = (
        f"Player Name: {player_name}\n"
        f"Contact Number: {phone}\n"
        f"Source: {source}\n"
        f"Link: {link}"
    )
    if lead_id is not None:
        body += f"\nRefID: {lead_id} | Sent at: {dt.utcnow().isoformat()}Z"
    return send_internal_notification(db, center_id, subject, body)


def send_new_lead_alert_background(
    center_name: str,
    source: str,
    player_name: str,
    phone: str,
    center_id: int,
    lead_id: int,
) -> None:
    """
    Background-task wrapper for new lead alert. Creates its own DB session; logs errors; never raises.
    """
    try:
        from backend.core.db import engine
        with Session(engine) as db:
            send_new_lead_alert(
                db=db,
                center_name=center_name,
                source=source,
                player_name=player_name,
                phone=phone,
                center_id=center_id,
                lead_id=lead_id,
            )
    except Exception as e:
        logger.exception("New lead email alert failed (%s): %s", source, e)


def send_import_summary_alert(db: Session, center_id: int, center_name: str, count: int) -> bool:
    """
    Send a single summary email to the Center Head after CSV/Excel import.
    Body: 'Summary: [Count] new leads have been added to your center via Excel import.'
    Recipient from Center.group_email or admin fallback.
    """
    subject = f"New Lead Import Summary: {center_name}"
    body = f"Summary: {count} new leads have been added to your center via Excel import."
    return send_internal_notification(db, center_id, subject, body)


def send_import_summary_background(center_id: int, center_name: str, count: int) -> None:
    """
    Background-task wrapper for import summary. Creates its own DB session; logs errors; never raises.
    """
    try:
        from backend.core.db import engine
        with Session(engine) as db:
            send_import_summary_alert(db, center_id, center_name, count)
    except Exception as e:
        logger.exception("Import summary email failed for center %s: %s", center_id, e)


def send_payment_received_alert(
    db: Session,
    lead: Lead,
    center_name: str,
    utr: Optional[str] = None,
    payment_proof_url: Optional[str] = None,
) -> bool:
    """
    Internal email to Center Head when a parent submits UTR: ACTION REQUIRED to verify.
    Uses Center.group_email from DB, fallback SMTP_USER. Link uses CRM_BASE_URL.
    """
    base_url = get_crm_base_url()
    link = f"{base_url}/leads?search={quote(lead.phone or '')}" if lead.phone else f"{base_url}/leads"
    player_name = lead.player_name or "Player"
    subject = f"💰 ACTION REQUIRED: New Payment to Verify for {player_name}"
    body = (
        f"Player Name: {player_name}\n"
        f"Contact: {lead.phone or '—'}\n"
        f"UTR: {utr or '—'}\n"
        f"Payment screenshot: {'Yes' if payment_proof_url else 'No'}\n"
        f"Link: {link}"
    )
    return send_internal_notification(db, lead.center_id, subject, body)


def send_payment_received_parent_email(lead: Lead) -> bool:
    """
    Automated email to parent when they submit UTR: we received your details, wait for verification.
    """
    to_email = (lead.email or "").strip()
    if not to_email:
        return False
    player_name = lead.player_name or "Player"
    subject = "We have received your payment details"
    body = (
        f"Hi,\n\n"
        f"We have received your payment details for {player_name}. "
        f"Please wait for our Team Lead to verify and confirm your enrollment. "
        f"We will get in touch soon.\n\nThank you."
    )
    return _send_via_provider(to_email=to_email, subject=subject, html_body=f"<p>{body.replace(chr(10), '<br>')}</p>")


def _parse_internal_body(body: str) -> Tuple[List[Tuple[str, str]], Optional[str]]:
    """
    Parse plain body into (rows, cta_url). Each line "Label: Value" becomes a row;
    line starting with "Link:" provides cta_url. RefID/timestamp lines kept as single rows.
    """
    rows: List[Tuple[str, str]] = []
    cta_url: Optional[str] = None
    for line in body.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.lower().startswith("link:"):
            cta_url = line[5:].strip()
            continue
        if ": " in line:
            idx = line.index(": ")
            label, value = line[:idx].strip(), line[idx + 2:].strip()
            if label:
                rows.append((label, value or "—"))
        else:
            rows.append(("", line))
    return rows, cta_url


def _build_internal_notification_html(
    card_heading: str,
    rows: List[Tuple[str, str]],
    cta_url: Optional[str],
    system_id: str,
    timestamp_iso: str,
    highlight_labels: Optional[set] = None,
) -> str:
    """
    Build branded HTML for internal notifications. Inline CSS for email clients.
    Header: navy; card: white, gold border; labels: bold navy; CTA: gold button; footer: muted.
    """
    highlight_labels = highlight_labels or set()
    rows_html = []
    for label, value in rows:
        if not label:
            rows_html.append(f'<tr><td colspan="2" style="padding:8px 0;font-family:sans-serif;font-size:14px;color:#374151;">{_escape_html(value)}</td></tr>')
            continue
        is_highlight = label.strip() in highlight_labels
        label_style = (
            "font-weight:700;color:#0A192F;font-size:14px;padding:6px 0 2px 0;"
            if is_highlight
            else "font-weight:700;color:#0A192F;font-size:13px;padding:4px 0 2px 0;"
        )
        value_style = (
            "font-size:15px;color:#0A192F;font-weight:600;padding:2px 0 6px 0;"
            if is_highlight
            else "font-size:14px;color:#374151;padding:2px 0 4px 0;"
        )
        rows_html.append(
            f'<tr><td style="{label_style};font-family:sans-serif;">{_escape_html(label)}</td>'
            f'<td style="{value_style};font-family:sans-serif;">{_escape_html(value)}</td></tr>'
        )
    table_rows = "\n".join(rows_html)
    cta_html = ""
    if cta_url:
        cta_html = f'''
        <p style="margin:24px 0 0 0;font-family:sans-serif;">
          <a href="{_escape_html(cta_url)}" style="display:inline-block;background:{TOFA_GOLD_GRADIENT};color:#0A192F;font-weight:700;font-size:14px;text-decoration:none;padding:12px 24px;border-radius:6px;border:1px solid {TOFA_GOLD};">Open in CRM</a>
        </p>'''
    return f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:{TOFA_NAVY};color:#fff;padding:20px 24px;text-align:center;border-radius:8px 8px 0 0;">
      <span style="font-size:22px;font-weight:700;letter-spacing:0.05em;">TOFA</span>
    </div>
    <div style="background:#fff;border:1px solid {TOFA_GOLD};border-top:none;border-radius:0 0 8px 8px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <h2 style="margin:0 0 20px 0;font-size:18px;font-weight:600;color:#0A192F;font-family:sans-serif;">{_escape_html(card_heading)}</h2>
      <table style="width:100%;border-collapse:collapse;">{table_rows}</table>{cta_html}
    </div>
    <p style="margin:12px 0 0 0;font-size:11px;color:{MUTED_GREY};font-family:sans-serif;">[SystemID: {_escape_html(system_id)}] {_escape_html(timestamp_iso)}</p>
  </div>
</body>
</html>'''


def _escape_html(s: str) -> str:
    if not s:
        return ""
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def send_internal_notification(
    db: Session,
    center_id: Optional[int],
    subject: str,
    body: str,
    card_heading: Optional[str] = None,
    highlight_labels: Optional[set] = None,
) -> bool:
    """
    Send an internal notification email via Zoho SMTP (SMTP_SSL on port 465).
    Resolves recipient from center_id (Center.group_email or admin fallback).
    Sends a branded HTML email: navy header, white card with gold border, table of label/value rows, optional CTA button, muted footer.
    Plain-text fallback is included for accessibility.
    """
    target_email = None
    if center_id is not None:
        target_email = get_center_group_email(db, center_id)
    target_email = (target_email or os.getenv("SMTP_USER", ADMIN_FALLBACK_EMAIL) or ADMIN_FALLBACK_EMAIL).strip() or ADMIN_FALLBACK_EMAIL
    logger.info(
        "Notification attempt: to=%s subject=%s",
        target_email,
        subject,
    )
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    if not user or not password:
        logger.info("SMTP_USER or SMTP_PASSWORD not set; skipping internal notification to %s", target_email)
        return False
    system_id = str(uuid.uuid4())
    timestamp_iso = f"{dt.utcnow().isoformat()}Z"
    body_with_footer = body + f"\n[SystemID: {system_id}] {timestamp_iso}"
    rows, cta_url = _parse_internal_body(body)
    heading = (card_heading or subject).strip()
    html_content = _build_internal_notification_html(
        card_heading=heading,
        rows=rows,
        cta_url=cta_url,
        system_id=system_id,
        timestamp_iso=timestamp_iso,
        highlight_labels=highlight_labels,
    )
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = user
        msg["To"] = target_email
        msg.attach(MIMEText(body_with_footer, "plain"))
        msg.attach(MIMEText(html_content, "html"))
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
            server.login(user, password)
            server.sendmail(user, target_email, msg.as_string())
        print(f'✅ [SUCCESS] Internal email delivered to {target_email} at {dt.now()}')
        logger.info("Internal notification sent to %s: %s", target_email, subject)
        return True
    except Exception as e:
        logger.exception("Failed to send internal notification to %s: %s", target_email, e)
        logger.error("Zoho SMTP full error: %s", repr(e))
        return False


def _format_time(t) -> str:
    """Format datetime.time for display."""
    if t is None:
        return "—"
    return t.strftime("%I:%M %p").lstrip("0")


def _batch_days(batch: Batch) -> str:
    """Return human-readable schedule e.g. Mon, Wed, Fri."""
    days = []
    if batch.is_mon:
        days.append("Mon")
    if batch.is_tue:
        days.append("Tue")
    if batch.is_wed:
        days.append("Wed")
    if batch.is_thu:
        days.append("Thu")
    if batch.is_fri:
        days.append("Fri")
    if batch.is_sat:
        days.append("Sat")
    if batch.is_sun:
        days.append("Sun")
    return ", ".join(days) if days else "—"


def _get_center_contact(db: Session, center_id: int) -> Optional[dict]:
    """Get first user linked to center for contact (name, phone)."""
    link = db.exec(
        select(UserCenterLink).where(UserCenterLink.center_id == center_id).limit(1)
    ).first()
    if not link or not link.user_id:
        return None
    user = db.get(User, link.user_id)
    if not user:
        return None
    return {"full_name": user.full_name, "phone": user.phone or ""}


def send_welcome_email(db: Session, student_id: int) -> dict:
    """
    Send a welcome email for the given student.
    Fetches student, lead, batches, and center; builds HTML and sends via Zoho SMTP.
    Returns dict with success flag and recipient email.
    """
    from sqlalchemy.orm import selectinload

    stmt = (
        select(Student)
        .where(Student.id == student_id)
        .options(
            selectinload(Student.lead),
            selectinload(Student.batches),
            selectinload(Student.center),
        )
    )
    student = db.exec(stmt).first()
    if not student or not student.lead:
        raise ValueError("Student not found")

    lead: Lead = student.lead
    center: Optional[Center] = student.center
    batches = list(student.batches) if student.batches else []

    academy_name = center.display_name if center else "Our Academy"
    player_name = lead.player_name or "Player"
    parent_email = lead.email
    if not parent_email:
        raise ValueError("Lead has no email; cannot send welcome email")

    # Batch timings text
    batch_lines = []
    for b in batches:
        days = _batch_days(b)
        start = _format_time(b.start_time)
        end = _format_time(b.end_time)
        batch_lines.append(f"{b.name}: {days}, {start} – {end}")

    batch_timings_html = "<br>".join(batch_lines) if batch_lines else "—"

    # Center location and map
    location_text = "—"
    map_link = ""
    if center:
        location_text = f"{center.location or center.city or center.display_name}"
        map_link = center.map_link or ""

    # Center manager contact
    contact = _get_center_contact(db, student.center_id) if student.center_id else None
    contact_html = ""
    if contact and (contact.get("full_name") or contact.get("phone")):
        parts = []
        if contact.get("full_name"):
            parts.append(contact["full_name"])
        if contact.get("phone"):
            parts.append(f'<a href="tel:{contact["phone"]}">{contact["phone"]}</a>')
        contact_html = "<br>".join(parts)

    html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to {academy_name}</title>
</head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #1a1a1a;">Welcome to {academy_name}!</h1>
  <p>Hi,</p>
  <p>We're thrilled to have <strong>{player_name}</strong> join us. Here are the details you need:</p>
  <h2 style="font-size: 1.1em; margin-top: 24px;">Batch timings</h2>
  <p>{batch_timings_html}</p>
  <h2 style="font-size: 1.1em; margin-top: 24px;">Center & location</h2>
  <p>{location_text}</p>
  {f'<p><a href="{map_link}" style="color: #2563eb;">View on map</a></p>' if map_link else ''}
  <h2 style="font-size: 1.1em; margin-top: 24px;">Center manager</h2>
  <p>{contact_html if contact_html else "—"}</p>
  <p style="margin-top: 32px;">See you soon!</p>
  <p><strong>{academy_name}</strong></p>
</body>
</html>
"""

    player_name = lead.player_name or "Player"
    subject = f"⚽ WELCOME TO THE SQUAD: {player_name} is officially enrolled!"
    ok = _send_via_provider(to_email=parent_email, subject=subject, html_body=html)
    if not ok:
        logger.warning("Welcome email not sent (email not configured). Set SMTP_USER and SMTP_PASSWORD to enable.")
    return {"success": ok, "to": parent_email}


def _send_via_provider(to_email: str, subject: str, html_body: str) -> bool:
    """
    Send email via Zoho SMTP (SMTP_SSL on port 465).
    Uses SMTP_USER as From (Zoho requires login and sender to match) and SMTP_PASSWORD. Sends html_body as HTML.
    """
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    if not user or not password:
        logger.info("SMTP_USER or SMTP_PASSWORD not set; skipping email to %s", to_email)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = user
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
            server.login(user, password)
            server.sendmail(user, to_email, msg.as_string())
        logger.info("Email sent to %s: %s", to_email, subject)
        return True
    except Exception as e:
        logger.exception("Failed to send email to %s: %s", to_email, e)
        logger.error("Zoho SMTP full error: %s", repr(e))
        return False
