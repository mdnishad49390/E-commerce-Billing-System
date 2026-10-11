import sys
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from billing.models import Invoice, Client
from billing.notification_service import InvoiceNotificationService
from billing.pdf_service import generate_invoice_pdf


class Command(BaseCommand):
    help = "Test, audit, and debug live Email and WhatsApp notifications for invoices."

    def add_arguments(self, parser):
        parser.add_argument(
            "invoice_id",
            nargs="?",
            type=str,
            default=None,
            help="Invoice ID or Invoice Number to test with (defaults to the latest invoice).",
        )
        parser.add_argument(
            "--channel",
            type=str,
            choices=["all", "email", "whatsapp"],
            default="all",
            help="Channel to test: 'all' (default), 'email', or 'whatsapp'.",
        )
        parser.add_argument(
            "--email",
            type=str,
            default=None,
            help="Override recipient email address for safe test delivery.",
        )
        parser.add_argument(
            "--phone",
            type=str,
            default=None,
            help="Override recipient WhatsApp phone number for safe test delivery.",
        )
        parser.add_argument(
            "--smtp-test",
            action="store_true",
            help="Test SMTP handshake and authentication without sending an invoice.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Run environment audit and PDF generation without modifying invoice records.",
        )

    def handle(self, *args, **options):
        self.stdout.write("=" * 72)
        self.stdout.write("  INVOICE NOTIFICATION PIPELINE AUDIT & TEST SUITE")
        self.stdout.write("=" * 72)

        # 1. Configuration & Diagnostics Audit
        diag = InvoiceNotificationService.get_diagnostics()
        email_cfg = diag["email"]
        wa_cfg = diag["whatsapp"]

        self.stdout.write("\n[1] EMAIL CONFIGURATION:")
        self.stdout.write(f"  * Backend:          {email_cfg['backend']}")
        self.stdout.write(f"  * SMTP Host & Port: {email_cfg['host']}:{email_cfg['port']}")
        self.stdout.write(f"  * TLS / SSL:        TLS={email_cfg['use_tls']}, SSL={email_cfg['use_ssl']}")
        self.stdout.write(f"  * Auth User:        {email_cfg['user'] or '(not configured)'}")
        self.stdout.write(f"  * Password Set:     {'YES [Configured]' if email_cfg['password_configured'] else 'NO [Empty]'}")
        self.stdout.write(f"  * Default From:     {email_cfg['from_email']}")
        if email_cfg["is_console"]:
            self.stdout.write(self.style.WARNING("  [!] Running Console EmailBackend: emails will print to terminal instead of live SMTP."))

        self.stdout.write("\n[2] WHATSAPP CONFIGURATION:")
        self.stdout.write(f"  * Delivery Mode:    {wa_cfg['mode']}")
        self.stdout.write(f"  * Phone Number ID:  {wa_cfg['phone_number_id']}")
        self.stdout.write(f"  * Cloud API URL:    {wa_cfg['api_url']}")
        self.stdout.write(f"  * API Token Set:    {'YES [Configured]' if wa_cfg['token_configured'] else 'NO (using Click-to-Chat links)'}")

        # 2. SMTP Handshake Test
        if options["smtp_test"] or (email_cfg["is_smtp"] and not options["dry_run"]):
            self.stdout.write("\n[3] TESTING SMTP CONNECTION:")
            smtp_result = InvoiceNotificationService.test_smtp_connection()
            if smtp_result["success"]:
                self.stdout.write(self.style.SUCCESS(f"  [OK] {smtp_result['message']}"))
            else:
                self.stdout.write(self.style.ERROR(f"  [ERROR] {smtp_result['message']}"))
                if options["smtp_test"]:
                    return

        if options["smtp_test"]:
            return

        # 3. Locate or create test invoice
        invoice_ident = options["invoice_id"]
        invoice = None

        if invoice_ident:
            if invoice_ident.isdigit():
                invoice = Invoice.objects.filter(id=int(invoice_ident)).first()
            if not invoice:
                invoice = Invoice.objects.filter(invoice_number__iexact=invoice_ident).first()
            if not invoice:
                raise CommandError(f"Invoice '{invoice_ident}' not found in database.")
        else:
            invoice = Invoice.objects.order_by("-id").first()

        if not invoice:
            self.stdout.write(self.style.WARNING("\nNo existing invoices found. Creating a sample test invoice..."))
            client, _ = Client.objects.get_or_create(
                email="test.client@example.com",
                defaults={"name": "Test Client Ltd", "phone": "01711000000"}
            )
            company = Company.objects.first() or Company.objects.create(name="RAKTCH", email="info@raktch.com")
            invoice = Invoice.objects.create(
                client=client,
                company=company,
                client_name="Test Client Ltd",
                client_email="test.client@example.com",
                client_phone="01711000000",
                billing_month=timezone.now().strftime("%B %Y"),
                sub_total=Decimal("15000.00"),
                payable_amount=Decimal("15000.00"),
                status="ISSUED",
            )
            self.stdout.write(self.style.SUCCESS(f"Created temporary test invoice #{invoice.id} ({invoice.invoice_number})"))

        self.stdout.write(f"\n[4] TEST TARGET INVOICE:")
        self.stdout.write(f"  * Invoice ID:       #{invoice.id}")
        self.stdout.write(f"  * Invoice Number:   {invoice.invoice_number}")
        self.stdout.write(f"  * Client Name:      {invoice.client_name}")
        self.stdout.write(f"  * Client Email:     {options['email'] or invoice.client_email or '(none)'}")
        self.stdout.write(f"  * Client Phone:     {options['phone'] or invoice.client_phone or '(none)'}")
        self.stdout.write(f"  * Payable Amount:   {invoice.payable_amount} {invoice.currency_symbol or 'Tk'}")

        # 4. PDF Generation Benchmark
        self.stdout.write("\n[5] TESTING PDF GENERATION:")
        try:
            pdf_bytes = generate_invoice_pdf(invoice)
            self.stdout.write(self.style.SUCCESS(f"  [OK] PDF generated successfully ({len(pdf_bytes):,} bytes)"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  [ERROR] PDF generation failed: {e}"))
            return

        if options["dry_run"]:
            self.stdout.write(self.style.NOTICE("\n[!] DRY RUN COMPLETED: No live dispatch executed."))
            return

        # 5. Dispatch Live Test
        channel_option = options["channel"]
        channels = ("email", "whatsapp") if channel_option == "all" else (channel_option,)

        self.stdout.write(f"\n[6] EXECUTING LIVE DISPATCH (Channels: {', '.join(channels)}):")

        results = InvoiceNotificationService.dispatch_invoice_notifications(
            invoice=invoice,
            channels=channels,
            pdf_bytes=pdf_bytes,
            override_email=options["email"],
            override_phone=options["phone"],
        )

        # Output Email Result
        if "email" in results:
            res = results["email"]
            if res.get("success"):
                self.stdout.write(self.style.SUCCESS(f"  [OK] EMAIL SENT: To {res.get('recipient')} [Attachment: Invoice_{invoice.invoice_number}.pdf]"))
            else:
                self.stdout.write(self.style.ERROR(f"  [ERROR] EMAIL FAILED: {res.get('error')}"))

        # Output WhatsApp Result
        if "whatsapp" in results:
            res = results["whatsapp"]
            if res.get("success"):
                mode_label = "Cloud API" if res.get("api_dispatched") else "Click-to-Chat Link Ready"
                self.stdout.write(self.style.SUCCESS(f"  [OK] WHATSAPP ({mode_label}): To {res.get('recipient')}"))
                if res.get("link"):
                    self.stdout.write(f"       Direct Web Link: {res.get('link')}")
            else:
                self.stdout.write(self.style.ERROR(f"  [ERROR] WHATSAPP FAILED: {res.get('error')}"))
                if res.get("link"):
                    self.stdout.write(f"       Fallback Link: {res.get('link')}")

        self.stdout.write("\n" + "=" * 72)
        self.stdout.write(self.style.SUCCESS("  NOTIFICATION AUDIT COMPLETE"))
        self.stdout.write("=" * 72 + "\n")
