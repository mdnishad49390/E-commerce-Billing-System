import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from django.conf import settings
from django.core.mail import EmailMessage, get_connection
from django.utils import timezone

from .models import Invoice, Settings
from .pdf_service import generate_invoice_pdf

logger = logging.getLogger(__name__)


class InvoiceNotificationService:
    """
    Handles automated and manual dispatch of generated invoice PDFs
    to clients via Email (Gmail/SMTP) and WhatsApp (Meta Cloud API or Click-to-Chat).
    """

    @classmethod
    def clean_phone_number(cls, phone: str) -> str:
        """
        Strips non-digit characters and normalizes international phone number.
        Default assumes Bangladesh (+880) prefix if domestic 11-digit mobile (01...).
        """
        if not phone:
            return ""
        digits = re.sub(r"[^\d+]", "", phone.strip())
        if digits.startswith("+"):
            return digits[1:]
        if digits.startswith("01") and len(digits) == 11:
            return f"88{digits}"
        return digits

    @classmethod
    def test_smtp_connection(cls) -> dict:
        """
        Tests SMTP connectivity and authentication with current Django settings.
        """
        try:
            connection = get_connection(fail_silently=False)
            connection.open()
            connection.close()
            host = getattr(settings, 'EMAIL_HOST', 'localhost')
            port = getattr(settings, 'EMAIL_PORT', 25)
            user = getattr(settings, 'EMAIL_HOST_USER', '')
            return {
                "success": True,
                "message": f"SMTP handshake & authentication successful ({host}:{port}, user={user or 'None'})",
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"SMTP connection error: {e}",
            }

    @classmethod
    def get_diagnostics(cls) -> dict:
        """
        Returns full system audit of email and WhatsApp configurations.
        """
        email_backend = getattr(settings, "EMAIL_BACKEND", "")
        email_host = getattr(settings, "EMAIL_HOST", "")
        email_port = getattr(settings, "EMAIL_PORT", 587)
        email_user = getattr(settings, "EMAIL_HOST_USER", "")
        email_pw = getattr(settings, "EMAIL_HOST_PASSWORD", "")
        use_tls = getattr(settings, "EMAIL_USE_TLS", False)
        use_ssl = getattr(settings, "EMAIL_USE_SSL", False)
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "")

        wa_token = getattr(settings, "WHATSAPP_API_TOKEN", "") or os.getenv("WHATSAPP_API_TOKEN", "")
        wa_phone_id = getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "") or os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
        wa_url = getattr(settings, "WHATSAPP_API_URL", "") or os.getenv("WHATSAPP_API_URL", "")

        return {
            "email": {
                "backend": email_backend,
                "host": email_host,
                "port": email_port,
                "use_tls": use_tls,
                "use_ssl": use_ssl,
                "user": email_user,
                "password_configured": bool(email_pw),
                "from_email": from_email,
                "is_smtp": "smtp" in email_backend.lower(),
                "is_console": "console" in email_backend.lower(),
            },
            "whatsapp": {
                "cloud_api_configured": bool(wa_token and (wa_phone_id or wa_url)),
                "phone_number_id": wa_phone_id or "(none)",
                "api_url": wa_url or (f"https://graph.facebook.com/v21.0/{wa_phone_id}/messages" if wa_phone_id else "(none)"),
                "token_configured": bool(wa_token),
                "mode": "Meta Cloud API" if (wa_token and (wa_phone_id or wa_url)) else "Click-to-Chat / Instant Link",
            },
        }

    @classmethod
    def send_invoice_email(
        cls,
        invoice: Invoice,
        pdf_bytes: bytes = None,
        override_recipient: str = None,
    ) -> dict:
        """
        Sends the generated PDF invoice to the client's email address via SMTP.
        """
        recipient_email = (
            override_recipient
            or invoice.client_email
            or (invoice.client.email if invoice.client else "")
        ).strip()

        if not recipient_email:
            err = "Client has no registered email address."
            invoice.email_error = err
            invoice.save(update_fields=["email_error"])
            return {
                "success": False,
                "status": "FAILED",
                "recipient": "",
                "error": err,
            }

        try:
            if pdf_bytes is None:
                pdf_bytes = generate_invoice_pdf(invoice)

            company_name = invoice.company_name or (invoice.company.name if invoice.company else "Billing Department")
            currency = invoice.currency_symbol or "Tk"
            client_name = invoice.client_name or (invoice.client.name if invoice.client else "Valued Client")
            billing_month = invoice.billing_month or "Current Month"
            inv_number = invoice.invoice_number or f"INV-{invoice.id}"

            subject = f"Invoice {inv_number} ({billing_month}) - {company_name}"

            # Payment details snippet
            bank_info = ""
            if invoice.bank_name and invoice.account_number:
                bank_info = (
                    f"\nPayment Details:\n"
                    f" - Bank: {invoice.bank_name}\n"
                    f" - Account Name: {invoice.account_name}\n"
                    f" - Account Number: {invoice.account_number}\n"
                    f" - Branch: {invoice.branch_name}\n"
                    f" - Routing: {invoice.routing_number}\n"
                )

            body = (
                f"Dear {client_name},\n\n"
                f"We hope this email finds you well.\n\n"
                f"Your invoice {inv_number} for {billing_month} has been successfully generated.\n\n"
                f"Invoice Summary:\n"
                f" - Invoice Number: {inv_number}\n"
                f" - Billing Month: {billing_month}\n"
                f" - Payable Amount: {invoice.payable_amount} {currency}\n"
                f" - Due Date: {invoice.due_date or 'Upon Receipt'}\n"
                f"{bank_info}\n"
                f"Please find the official invoice attached as a PDF to this email.\n\n"
                f"If you have any questions or have already made the payment, please let us know.\n\n"
                f"Best regards,\n"
                f"{company_name}\n"
                f"{invoice.company_phone or ''}\n"
                f"{invoice.company_website or ''}\n"
            )

            raw_from = (
                getattr(settings, "DEFAULT_FROM_EMAIL", None)
                or getattr(settings, "EMAIL_HOST_USER", None)
                or "billing@raktch.com"
            )
            # Format sender name cleanly if not already formatted
            if "<" not in raw_from and company_name:
                from_email = f"{company_name} <{raw_from}>"
            else:
                from_email = raw_from

            email = EmailMessage(
                subject=subject,
                body=body,
                from_email=from_email,
                to=[recipient_email],
            )

            filename = f"Invoice_{inv_number}.pdf"
            email.attach(filename, pdf_bytes, "application/pdf")
            email.send(fail_silently=False)

            invoice.email_sent = True
            invoice.email_sent_at = timezone.now()
            invoice.email_error = ""
            invoice.save(update_fields=["email_sent", "email_sent_at", "email_error"])

            logger.info("Successfully sent invoice %s PDF email to %s", inv_number, recipient_email)
            return {
                "success": True,
                "status": "SENT",
                "recipient": recipient_email,
                "error": "",
            }

        except Exception as e:
            logger.warning("Failed to send invoice %s email to %s: %s", invoice.invoice_number, recipient_email, e)
            invoice.email_error = str(e)
            invoice.save(update_fields=["email_error"])
            return {
                "success": False,
                "status": "FAILED",
                "recipient": recipient_email,
                "error": str(e),
            }

    @classmethod
    def send_invoice_whatsapp(
        cls,
        invoice: Invoice,
        pdf_bytes: bytes = None,
        override_phone: str = None,
    ) -> dict:
        """
        Sends/prepares WhatsApp notification for the client with invoice details,
        executing live Meta WhatsApp Cloud API if configured or generating
        a clean universal click-to-chat URL schema.
        """
        raw_phone = (
            override_phone
            or invoice.client_phone
            or (invoice.client.phone if invoice.client else "")
        ).strip()

        if not raw_phone:
            err = "Client has no registered phone/WhatsApp number."
            invoice.whatsapp_error = err
            invoice.save(update_fields=["whatsapp_error"])
            return {
                "success": False,
                "status": "FAILED",
                "recipient": "",
                "error": err,
                "link": "",
                "api_dispatched": False,
            }

        clean_phone = cls.clean_phone_number(raw_phone)
        company_name = invoice.company_name or (invoice.company.name if invoice.company else "Billing Dept")
        currency = invoice.currency_symbol or "Tk"
        client_name = invoice.client_name or (invoice.client.name if invoice.client else "Valued Client")
        billing_month = invoice.billing_month or "Current Month"
        inv_number = invoice.invoice_number or f"INV-{invoice.id}"

        msg_text = (
            f"*INVOICE NOTIFICATION*\n\n"
            f"Dear {client_name},\n\n"
            f"Your invoice *{inv_number}* for *{billing_month}* has been issued.\n\n"
            f"• *Amount Payable:* {invoice.payable_amount} {currency}\n"
            f"• *Status:* {invoice.status}\n"
            f"• *Due Date:* {invoice.due_date or 'Upon Receipt'}\n\n"
            f"Payment Details:\n"
            f"Bank: {invoice.bank_name or '-'}\n"
            f"A/C: {invoice.account_number or '-'}\n\n"
            f"The official PDF invoice has also been sent to your registered email.\n"
            f"Thank you for choosing {company_name}!"
        )

        encoded_text = urllib.parse.quote(msg_text)
        # Universal click-to-chat link
        whatsapp_link = f"https://api.whatsapp.com/send?phone={clean_phone}&text={encoded_text}"

        # Resolve WhatsApp Cloud API / Custom Gateway configuration
        api_token = (
            getattr(settings, "WHATSAPP_API_TOKEN", "")
            or os.getenv("WHATSAPP_API_TOKEN", "")
        ).strip()
        phone_number_id = (
            getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
            or os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
        ).strip()
        custom_url = (
            getattr(settings, "WHATSAPP_API_URL", "")
            or os.getenv("WHATSAPP_API_URL", "")
        ).strip()

        api_url = custom_url or (
            f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
            if phone_number_id else ""
        )

        api_dispatched = False
        api_error_detail = ""

        # Attempt live API dispatch if credentials are provided
        if api_token and api_url:
            try:
                # Meta Graph API format
                if "graph.facebook.com" in api_url or phone_number_id:
                    payload_dict = {
                        "messaging_product": "whatsapp",
                        "recipient_type": "individual",
                        "to": clean_phone,
                        "type": "text",
                        "text": {
                            "preview_url": False,
                            "body": msg_text,
                        },
                    }
                else:
                    # Generic gateway format
                    payload_dict = {
                        "phone": clean_phone,
                        "to": clean_phone,
                        "message": msg_text,
                        "text": msg_text,
                        "invoice_number": inv_number,
                    }

                payload_bytes = json.dumps(payload_dict).encode("utf-8")
                req = urllib.request.Request(
                    api_url,
                    data=payload_bytes,
                    headers={
                        "Authorization": f"Bearer {api_token}",
                        "Content-Type": "application/json",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=12) as resp:
                    if resp.status in (200, 201):
                        api_dispatched = True
                        logger.info("Successfully dispatched WhatsApp Cloud API message for %s to %s", inv_number, clean_phone)
            except urllib.error.HTTPError as http_err:
                try:
                    error_body = http_err.read().decode("utf-8")
                    parsed_err = json.loads(error_body)
                    meta_err_msg = parsed_err.get("error", {}).get("message", error_body)
                except Exception:
                    meta_err_msg = str(http_err)
                api_error_detail = f"WhatsApp API HTTP {http_err.code}: {meta_err_msg}"
                logger.warning("WhatsApp API HTTP error for invoice %s: %s", inv_number, api_error_detail)
            except Exception as api_err:
                api_error_detail = f"WhatsApp API error: {api_err}"
                logger.warning("External WhatsApp API dispatch error: %s", api_err)

        # Determine final state:
        # If API was configured and succeeded: SENT
        # If API was configured but failed: record error on invoice, keep link available
        # If API was not configured (Click-to-Chat mode): prepared and ready with direct link
        if api_token and api_url and not api_dispatched:
            invoice.whatsapp_sent = False
            invoice.whatsapp_error = api_error_detail
            status = "FAILED"
        else:
            invoice.whatsapp_sent = True
            invoice.whatsapp_sent_at = timezone.now()
            invoice.whatsapp_error = ""
            status = "SENT"

        invoice.save(update_fields=["whatsapp_sent", "whatsapp_sent_at", "whatsapp_error"])
        logger.info("WhatsApp notification recorded for invoice %s to %s (api_dispatched=%s)", inv_number, clean_phone, api_dispatched)

        return {
            "success": invoice.whatsapp_sent,
            "status": status,
            "recipient": clean_phone,
            "error": invoice.whatsapp_error,
            "link": whatsapp_link,
            "api_dispatched": api_dispatched,
            "mode": "Meta Cloud API" if (api_token and api_url) else "Click-to-Chat",
        }

    @classmethod
    def dispatch_invoice_notifications(
        cls,
        invoice: Invoice,
        channels: tuple = ("email", "whatsapp"),
        pdf_bytes: bytes = None,
        override_email: str = None,
        override_phone: str = None,
    ) -> dict:
        """
        Dispatches invoice notifications across specified channels.
        Caches generated PDF bytes across channels to avoid duplicate rendering.
        """
        if pdf_bytes is None:
            try:
                pdf_bytes = generate_invoice_pdf(invoice)
            except Exception as pdf_err:
                logger.error("Failed to generate PDF for invoice %s notification: %s", invoice.id, pdf_err)
                pdf_bytes = None

        results = {}

        if "email" in channels:
            results["email"] = cls.send_invoice_email(
                invoice,
                pdf_bytes=pdf_bytes,
                override_recipient=override_email,
            )

        if "whatsapp" in channels:
            results["whatsapp"] = cls.send_invoice_whatsapp(
                invoice,
                pdf_bytes=pdf_bytes,
                override_phone=override_phone,
            )

        return results
