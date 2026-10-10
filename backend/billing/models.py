import datetime
from decimal import Decimal, ROUND_HALF_UP
import io
import os
import uuid
from django.db import models, transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils import timezone
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
import qrcode


class UserProfile(models.Model):
    ROLE_ADMIN = "ADMIN"
    ROLE_ACCOUNTANT = "ACCOUNTANT"
    ROLE_STAFF = "STAFF"

    ROLE_CHOICES = [
        (ROLE_ADMIN, "Admin"),
        (ROLE_ACCOUNTANT, "Accountant"),
        (ROLE_STAFF, "Staff"),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_STAFF)
    phone = models.CharField(max_length=50, blank=True)
    department = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"


class InvoiceSequence(models.Model):
    """Tracks sequence numbers per prefix atomically to guarantee unique, gapless, transaction-safe invoice numbers."""
    prefix = models.CharField(max_length=50, unique=True)
    last_number = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.prefix}: {self.last_number}"


class Company(models.Model):
    name = models.CharField(max_length=255, default="RAKTCH TECHNOLOGY & SOFTWARE")
    tagline = models.CharField(max_length=255, blank=True, default="TECHNOLOGY & SOFTWARE")
    address = models.TextField(
        default="Sector 6, Road 5, House 20, 7th floor, Uttara, Dhaka -1230, Bangladesh"
    )
    website = models.CharField(max_length=255, blank=True, default="www.raktch.com")
    email = models.CharField(max_length=255, blank=True, default="raktchme@gmail.com, support@raktch.com")
    phone = models.CharField(max_length=100, blank=True, default="+8801581677077")
    logo = models.ImageField(upload_to="company_logos/", blank=True, null=True)
    authorization_signature = models.ImageField(upload_to="signatures/", blank=True, null=True)
    is_default = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Companies"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.is_default:
            Company.objects.exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class BankAccount(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="bank_accounts")
    bank_name = models.CharField(max_length=255, default="Islami Bank PLC")
    account_name = models.CharField(max_length=255, default="RAKTCH TECHNOLOGY AND SOFTWARE")
    account_number = models.CharField(max_length=100, default="20502180100311104")
    branch_name = models.CharField(max_length=255, default="Haji Camp, Ashkona, Dakkhin khan")
    routing_number = models.CharField(max_length=100, default="125261995")
    is_default = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.bank_name} - {self.account_number} ({self.account_name})"

    def save(self, *args, **kwargs):
        if self.is_default:
            BankAccount.objects.filter(company=self.company).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class Settings(models.Model):
    currency_symbol = models.CharField(max_length=10, default="Tk")
    currency_code = models.CharField(max_length=10, default="BDT")
    default_company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True)
    default_bank_account = models.ForeignKey(BankAccount, on_delete=models.SET_NULL, null=True, blank=True)
    default_nb_text = models.TextField(default="[N.B Please send the bill to]")
    invoice_footer_note = models.CharField(max_length=255, blank=True, default="www.raktch.com")

    # Automated Recurring Billing Settings
    auto_billing_enabled = models.BooleanField(default=False, help_text="Enable automatic recurring bill generation")
    auto_billing_day = models.PositiveSmallIntegerField(default=1, help_text="Day of month to run auto-generation (1-31)")
    auto_billing_time = models.TimeField(default=datetime.time(0, 0), help_text="Time of day to run auto-generation")
    auto_billing_timezone = models.CharField(max_length=50, default="Asia/Dhaka", help_text="Timezone for scheduler")
    scheduler_heartbeat = models.DateTimeField(null=True, blank=True, help_text="Timestamp of the most recent scheduler execution/heartbeat")

    # Project Module Configuration
    project_code_prefix = models.CharField(max_length=20, default="PRJ")
    project_code_digits = models.PositiveSmallIntegerField(default=4)
    project_code_include_year = models.BooleanField(default=True)
    project_receipt_allowed_extensions = models.CharField(
        max_length=255, default="pdf,png,jpg,jpeg"
    )
    project_receipt_max_size_mb = models.PositiveIntegerField(default=5)
    project_doc_allowed_extensions = models.CharField(
        max_length=255, default="pdf,docx,xlsx,png,jpg,zip"
    )
    project_doc_max_size_mb = models.PositiveIntegerField(default=25)
    project_list_default_columns = models.JSONField(
        default=list,
        blank=True,
        help_text="Visible columns and ordering for Project list"
    )

    class Meta:
        verbose_name_plural = "Settings"

    def __str__(self):
        return "Global Billing Settings"


class PaymentMethod(models.Model):
    name = models.CharField(max_length=100)  # Bank Transfer, bKash, Cash, Cheque
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Client(models.Model):
    name = models.CharField(max_length=255)  # e.g. Rose International
    contact_person = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Service(models.Model):
    BILLING_CYCLE_CHOICES = [
        ("MONTHLY", "Monthly"),
        ("QUARTERLY", "Quarterly"),
        ("YEARLY", "Yearly"),
        ("ONE_TIME", "One Time"),
    ]
    name = models.CharField(max_length=255)  # e.g. Supershop Software
    code = models.CharField(max_length=50, blank=True)
    default_tech_specification = models.TextField(default="Hosting & Maintenance Bill")
    default_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1000.00"))
    billing_cycle = models.CharField(max_length=20, choices=BILLING_CYCLE_CHOICES, default="MONTHLY")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.default_price} Tk)"


class ClientServicePrice(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="client_services")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="client_pricings")
    custom_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Custom name for this client's bill, e.g. 'Supershop Software'"
    )
    custom_tech_specification = models.TextField(
        blank=True,
        help_text="Custom specification, e.g. 'Hosting & Maintenance Bill'"
    )
    custom_price = models.DecimalField(max_digits=12, decimal_places=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("client", "service")

    def __str__(self):
        return f"{self.client.name} - {self.service.name}: {self.custom_price} Tk"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Keep corresponding Subscription synchronized for backward compatibility
        try:
            cycle = self.service.billing_cycle if self.service and self.service.billing_cycle in ["MONTHLY", "QUARTERLY", "YEARLY"] else "MONTHLY"
            Subscription.objects.update_or_create(
                client=self.client,
                service=self.service,
                defaults={
                    "custom_name": self.custom_name,
                    "custom_tech_specification": self.custom_tech_specification,
                    "custom_price": self.custom_price,
                    "billing_cycle": cycle,
                    "is_active": self.is_active,
                }
            )
        except Exception:
            pass


class Subscription(models.Model):
    CYCLE_MONTHLY = "MONTHLY"
    CYCLE_QUARTERLY = "QUARTERLY"
    CYCLE_YEARLY = "YEARLY"
    CYCLE_CHOICES = [
        (CYCLE_MONTHLY, "Monthly"),
        (CYCLE_QUARTERLY, "Quarterly"),
        (CYCLE_YEARLY, "Yearly"),
    ]

    STATUS_DRAFT = "DRAFT"
    STATUS_ISSUED = "ISSUED"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_ISSUED, "Issued"),
    ]

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="subscriptions")
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name="subscriptions")
    custom_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Custom name for bill item, e.g. 'Supershop Software'"
    )
    custom_tech_specification = models.TextField(
        blank=True,
        help_text="Custom specification for bill item"
    )
    custom_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    billing_cycle = models.CharField(max_length=20, choices=CYCLE_CHOICES, default=CYCLE_MONTHLY)
    start_date = models.DateField(default=timezone.localdate)
    end_date = models.DateField(null=True, blank=True)
    auto_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ISSUED,
        help_text="Default status for auto-generated invoices (DRAFT needs review, ISSUED is final)"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("client", "service")

    def __str__(self):
        return f"{self.client.name} - {self.effective_name} ({self.effective_price} Tk/{self.billing_cycle})"

    @property
    def effective_price(self):
        if self.custom_price is not None:
            return self.custom_price
        return self.service.default_price if self.service else Decimal("0.00")

    @property
    def effective_name(self):
        return self.custom_name or (self.service.name if self.service else "Service")

    @property
    def effective_tech_specification(self):
        return self.custom_tech_specification or (self.service.default_tech_specification if self.service else "")


class InvoiceTemplate(models.Model):
    name = models.CharField(max_length=100, default="Standard Software Monthly Bill")
    title_pattern = models.CharField(
        max_length=255,
        default="{service_name} Monthly Bill ({month_year})",
        help_text="Supported placeholders: {service_name}, {month_year}, {client_name}"
    )
    invoice_number_prefix = models.CharField(max_length=20, default="INV-")
    nb_text = models.TextField(default="[N.B Please send the bill to]")
    authorization_label = models.CharField(max_length=100, default="Authorization")
    received_by_label = models.CharField(max_length=100, default="Received by")
    is_default = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.is_default:
            InvoiceTemplate.objects.exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class Invoice(models.Model):
    STATUS_CHOICES = [
        ("DRAFT", "Draft"),
        ("ISSUED", "Issued"),
        ("PAID", "Paid"),
        ("PARTIALLY_PAID", "Partially Paid"),
        ("CANCELLED", "Cancelled"),
    ]

    invoice_number = models.CharField(max_length=50, unique=True, blank=True)
    title = models.CharField(
        max_length=255,
        help_text="e.g. Supershop Software Monthly Bill (April-2026)"
    )
    billing_month = models.CharField(max_length=50, blank=True, help_text="e.g. April-2026")
    issue_date = models.DateField(default=timezone.localdate)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ISSUED")

    # Linked Entities
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="invoices")
    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="invoices")
    bank_account = models.ForeignKey(BankAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name="invoices")
    template = models.ForeignKey(InvoiceTemplate, on_delete=models.SET_NULL, null=True, blank=True)

    # 1. Company Snapshot (Historical freeze)
    company_name = models.CharField(max_length=255, blank=True)
    company_tagline = models.CharField(max_length=255, blank=True)
    company_address = models.TextField(blank=True)
    company_website = models.CharField(max_length=255, blank=True)
    company_email = models.CharField(max_length=255, blank=True)
    company_phone = models.CharField(max_length=100, blank=True)
    company_logo_snapshot = models.ImageField(upload_to="invoices/logos/", blank=True, null=True)
    company_signature_snapshot = models.ImageField(upload_to="invoices/signatures/", blank=True, null=True)

    # 2. Client Snapshot (Historical freeze)
    client_name = models.CharField(max_length=255, blank=True)
    client_contact_person = models.CharField(max_length=150, blank=True)
    client_address = models.TextField(blank=True)
    client_phone = models.CharField(max_length=50, blank=True)
    client_email = models.EmailField(blank=True)

    # 3. Bank Account Snapshot (Historical freeze)
    bank_name = models.CharField(max_length=255, blank=True)
    account_name = models.CharField(max_length=255, blank=True)
    account_number = models.CharField(max_length=100, blank=True)
    branch_name = models.CharField(max_length=255, blank=True)
    routing_number = models.CharField(max_length=100, blank=True)
    nb_text = models.TextField(blank=True, default="[N.B Please send the bill to]")

    # Financials (All high precision Decimal)
    currency_symbol = models.CharField(max_length=10, default="Tk")
    sub_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"), help_text="VAT rate percentage, e.g. 5.00 for 5%")
    vat_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    payable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), help_text="subtotal - discount + vat")
    advance_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), help_text="Advance payment received")
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), help_text="Sum of recorded payments")
    due_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), help_text="payable - advance - paid")

    # Labels & Verification
    authorization_label = models.CharField(max_length=100, default="Authorization")
    received_by_label = models.CharField(max_length=100, default="Received by")
    qr_code = models.ImageField(upload_to="invoices/qrcodes/", blank=True, null=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Linked Subscription and Period Tracking for Auto-billing
    subscription = models.ForeignKey(
        "Subscription",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoices"
    )
    billing_period = models.CharField(
        max_length=50,
        blank=True,
        db_index=True,
        help_text="Standardized period key e.g. '2026-05' or 'May-2026'"
    )

    class Meta:
        ordering = ["-issue_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["subscription", "billing_period"],
                name="unique_invoice_per_subscription_period",
                condition=models.Q(subscription__isnull=False),
            )
        ]

    def __str__(self):
        return f"{self.invoice_number or 'Draft'} - {self.client_name or self.client.name} ({self.payable_amount} {self.currency_symbol})"

    def populate_snapshots(self):
        """Copies company, client, and bank details to freeze them on the invoice"""
        if self.company:
            if not self.company_name:
                self.company_name = self.company.name
            if not self.company_tagline:
                self.company_tagline = self.company.tagline
            if not self.company_address:
                self.company_address = self.company.address
            if not self.company_website:
                self.company_website = self.company.website
            if not self.company_email:
                self.company_email = self.company.email
            if not self.company_phone:
                self.company_phone = self.company.phone
            if self.company.logo and not self.company_logo_snapshot:
                self.company_logo_snapshot = self.company.logo
            if self.company.authorization_signature and not self.company_signature_snapshot:
                self.company_signature_snapshot = self.company.authorization_signature

        if self.client:
            if not self.client_name:
                self.client_name = self.client.name
            if not self.client_contact_person:
                self.client_contact_person = self.client.contact_person
            if not self.client_address:
                self.client_address = self.client.address
            if not self.client_phone:
                self.client_phone = self.client.phone
            if not self.client_email:
                self.client_email = self.client.email

        if self.bank_account:
            if not self.bank_name:
                self.bank_name = self.bank_account.bank_name
            if not self.account_name:
                self.account_name = self.bank_account.account_name
            if not self.account_number:
                self.account_number = self.bank_account.account_number
            if not self.branch_name:
                self.branch_name = self.bank_account.branch_name
            if not self.routing_number:
                self.routing_number = self.bank_account.routing_number

        if self.template:
            if not self.nb_text:
                self.nb_text = self.template.nb_text
            if not self.authorization_label:
                self.authorization_label = self.template.authorization_label
            if not self.received_by_label:
                self.received_by_label = self.template.received_by_label

    @classmethod
    def generate_next_invoice_number(cls, prefix="INV-", date=None):
        """Transaction-safe, concurrency-safe, gapless invoice number generator"""
        if date is None:
            date = timezone.now().date()
        year_month = date.strftime("%Y%m")
        sequence_key = f"{prefix}{year_month}-"

        with transaction.atomic():
            seq, _ = InvoiceSequence.objects.select_for_update().get_or_create(
                prefix=sequence_key,
                defaults={"last_number": 0}
            )
            seq.last_number += 1
            seq.save()
            return f"{sequence_key}{seq.last_number:04d}"

    def calculate_totals(self):
        """Pure Decimal arithmetic for subtotal, discount, VAT, advance, and due"""
        items_total = sum((item.total for item in self.items.all()), Decimal("0.00"))
        self.sub_total = items_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        discount_val = Decimal(str(self.discount or "0.00")).quantize(Decimal("0.01"))
        
        # Tax base after discount
        tax_base = max(self.sub_total - discount_val, Decimal("0.00"))

        # VAT calculation
        vat_rate_val = Decimal(str(self.vat_rate or "0.00"))
        if vat_rate_val > Decimal("0.00"):
            self.vat_amount = (tax_base * (vat_rate_val / Decimal("100.00"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            self.vat_amount = Decimal(str(self.vat_amount or "0.00")).quantize(Decimal("0.01"))

        # Payable amount
        self.payable_amount = (tax_base + self.vat_amount).quantize(Decimal("0.01"))

        # Advance & Payments
        advance_val = Decimal(str(self.advance_amount or "0.00")).quantize(Decimal("0.01"))
        self.paid_amount = sum((payment.amount for payment in Payment.objects.filter(invoice=self)), Decimal("0.00")).quantize(Decimal("0.01"))
        
        total_settled = advance_val + self.paid_amount
        self.due_amount = max(self.payable_amount - total_settled, Decimal("0.00")).quantize(Decimal("0.01"))

        # Status transition (Unpaid -> Partial -> Paid)
        if self.status != "CANCELLED":
            if self.due_amount == Decimal("0.00") and self.payable_amount > Decimal("0.00"):
                self.status = "PAID"
            elif Decimal("0.00") < total_settled < self.payable_amount:
                self.status = "PARTIALLY_PAID"
            elif total_settled == Decimal("0.00"):
                if self.status in ["PAID", "PARTIALLY_PAID"]:
                    self.status = "ISSUED"

    def generate_qr_code(self, force=False):
        if self.qr_code and not force:
            return

        website = (self.company_website or "www.raktch.com").strip()
        if not website.startswith("http://") and not website.startswith("https://"):
            target_url = f"https://{website}"
        else:
            target_url = website
        if not target_url.endswith("/"):
            target_url += "/"

        # Append invoice verification query parameter
        inv_param = self.invoice_number or (f"INV-{self.id}" if self.id else "temp")
        qr_content = f"{target_url}?invoice={inv_param}"

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=5,
            border=2,
        )
        qr.add_data(qr_content)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        file_name = f"qr_{self.invoice_number or 'temp'}.png"
        self.qr_code.save(file_name, ContentFile(buffer.getvalue()), save=False)

    def save(self, *args, **kwargs):
        with transaction.atomic():
            if self.issue_date and isinstance(self.issue_date, datetime.datetime):
                self.issue_date = self.issue_date.date()
            if self.due_date and isinstance(self.due_date, datetime.datetime):
                self.due_date = self.due_date.date()

            self.populate_snapshots()
            if not self.invoice_number:
                prefix = self.template.invoice_number_prefix if self.template else "INV-"
                self.invoice_number = self.generate_next_invoice_number(prefix=prefix, date=self.issue_date)

            # Initial math check
            sub_total_val = Decimal(str(self.sub_total or "0.00")).quantize(Decimal("0.01"))
            discount_val = Decimal(str(self.discount or "0.00")).quantize(Decimal("0.01"))
            vat_val = Decimal(str(self.vat_amount or "0.00")).quantize(Decimal("0.01"))
            advance_val = Decimal(str(self.advance_amount or "0.00")).quantize(Decimal("0.01"))
            paid_val = Decimal(str(self.paid_amount or "0.00")).quantize(Decimal("0.01"))

            tax_base = max(sub_total_val - discount_val, Decimal("0.00"))
            self.payable_amount = tax_base + vat_val
            self.due_amount = max(self.payable_amount - advance_val - paid_val, Decimal("0.00"))

            if not self.qr_code:
                self.generate_qr_code()

            super().save(*args, **kwargs)


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")
    sl = models.PositiveIntegerField(default=1)
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True)
    item_name = models.CharField(max_length=255)  # e.g. 1. Supershop Software (April-2026)
    technical_specification = models.TextField(blank=True, default="Hosting & Maintenance Bill")
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1.00"))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["sl", "id"]

    def __str__(self):
        return f"{self.sl}. {self.item_name} ({self.total})"

    def save(self, *args, skip_invoice_recalc=False, **kwargs):
        qty = Decimal(str(self.quantity or "1.00"))
        price = Decimal(str(self.unit_price or "0.00"))
        self.total = (qty * price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        super().save(*args, **kwargs)
        if not skip_invoice_recalc:
            # Recalculate invoice totals
            self.invoice.calculate_totals()
            Invoice.objects.filter(pk=self.invoice.pk).update(
                sub_total=self.invoice.sub_total,
                vat_amount=self.invoice.vat_amount,
                payable_amount=self.invoice.payable_amount,
                advance_amount=self.invoice.advance_amount,
                paid_amount=self.invoice.paid_amount,
                due_amount=self.invoice.due_amount,
                status=self.invoice.status,
            )


class Payment(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateField(default=timezone.localdate)
    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.SET_NULL, null=True, blank=True)
    transaction_id = models.CharField(max_length=100, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def receipt_number(self):
        date_str = self.payment_date.strftime("%Y%m") if self.payment_date else timezone.localdate().strftime("%Y%m")
        return f"MR-{date_str}-{self.id:04d}" if self.id else "MR-PENDING"

    def __str__(self):
        return f"Payment {self.amount} for {self.invoice.invoice_number}"

    def save(self, *args, **kwargs):
        if self.payment_date and isinstance(self.payment_date, datetime.datetime):
            self.payment_date = self.payment_date.date()
        self.amount = Decimal(str(self.amount)).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)
        if hasattr(self.invoice, "_prefetched_objects_cache"):
            self.invoice._prefetched_objects_cache.pop("payments", None)
        self.invoice.calculate_totals()
        Invoice.objects.filter(pk=self.invoice.pk).update(
            sub_total=self.invoice.sub_total,
            vat_amount=self.invoice.vat_amount,
            payable_amount=self.invoice.payable_amount,
            advance_amount=self.invoice.advance_amount,
            paid_amount=self.invoice.paid_amount,
            due_amount=self.invoice.due_amount,
            status=self.invoice.status,
        )

    def delete(self, *args, **kwargs):
        invoice_id = self.invoice_id
        res = super().delete(*args, **kwargs)
        if invoice_id:
            try:
                inv = Invoice.objects.get(pk=invoice_id)
                inv.calculate_totals()
                Invoice.objects.filter(pk=inv.pk).update(
                    sub_total=inv.sub_total,
                    vat_amount=inv.vat_amount,
                    payable_amount=inv.payable_amount,
                    advance_amount=inv.advance_amount,
                    paid_amount=inv.paid_amount,
                    due_amount=inv.due_amount,
                    status=inv.status,
                )
            except Invoice.DoesNotExist:
                pass
        return res


@receiver(post_delete, sender=Payment)
def payment_post_delete(sender, instance, **kwargs):
    if instance.invoice_id:
        try:
            inv = Invoice.objects.get(pk=instance.invoice_id)
            inv.calculate_totals()
            Invoice.objects.filter(pk=inv.pk).update(
                sub_total=inv.sub_total,
                vat_amount=inv.vat_amount,
                payable_amount=inv.payable_amount,
                advance_amount=inv.advance_amount,
                paid_amount=inv.paid_amount,
                due_amount=inv.due_amount,
                status=inv.status,
            )
        except Invoice.DoesNotExist:
            pass


@receiver(post_delete, sender=InvoiceItem)
def invoice_item_post_delete(sender, instance, **kwargs):
    if instance.invoice_id:
        try:
            inv = Invoice.objects.get(pk=instance.invoice_id)
            inv.calculate_totals()
            Invoice.objects.filter(pk=inv.pk).update(
                sub_total=inv.sub_total,
                vat_amount=inv.vat_amount,
                payable_amount=inv.payable_amount,
                advance_amount=inv.advance_amount,
                paid_amount=inv.paid_amount,
                due_amount=inv.due_amount,
                status=inv.status,
            )
        except Invoice.DoesNotExist:
            pass


class AuditLog(models.Model):
    ACTION_LOGIN_SUCCESS = "LOGIN_SUCCESS"
    ACTION_LOGIN_FAILED = "LOGIN_FAILED"
    ACTION_LOGOUT = "LOGOUT"
    ACTION_CREATE = "CREATE"
    ACTION_UPDATE = "UPDATE"
    ACTION_DELETE = "DELETE"
    ACTION_STATUS_CHANGE = "STATUS_CHANGE"
    ACTION_PASSWORD_CHANGE = "PASSWORD_CHANGE"

    ACTION_CHOICES = [
        (ACTION_LOGIN_SUCCESS, "Login Success"),
        (ACTION_LOGIN_FAILED, "Login Failed"),
        (ACTION_LOGOUT, "Logout"),
        (ACTION_CREATE, "Created"),
        (ACTION_UPDATE, "Updated"),
        (ACTION_DELETE, "Deleted"),
        (ACTION_STATUS_CHANGE, "Status Changed"),
        (ACTION_PASSWORD_CHANGE, "Password Changed"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    username = models.CharField(max_length=150, blank=True)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=100, blank=True)
    object_repr = models.CharField(max_length=255, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.CharField(max_length=45, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["action", "timestamp"]),
            models.Index(fields=["model_name", "object_id"]),
        ]

    def __str__(self):
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {self.username} - {self.action} on {self.model_name or 'System'} ({self.object_repr})"


class LoginAttempt(models.Model):
    username = models.CharField(max_length=150, unique=True, db_index=True)
    ip_address = models.CharField(max_length=45, blank=True)
    failed_attempts = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    last_attempt = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["username", "ip_address"]),
        ]

    def is_locked(self):
        if self.locked_until and self.locked_until > timezone.now():
            return True
        return False


class RecurringRun(models.Model):
    TRIGGER_AUTO = "AUTO"
    TRIGGER_MANUAL = "MANUAL"
    TRIGGER_CHOICES = [
        (TRIGGER_AUTO, "Automatic"),
        (TRIGGER_MANUAL, "Manual"),
    ]

    STATUS_SUCCESS = "SUCCESS"
    STATUS_PARTIAL = "PARTIAL"
    STATUS_FAILED = "FAILED"
    STATUS_CHOICES = [
        (STATUS_SUCCESS, "Success"),
        (STATUS_PARTIAL, "Partial"),
        (STATUS_FAILED, "Failed"),
    ]

    run_time = models.DateTimeField(default=timezone.now)
    trigger = models.CharField(max_length=20, choices=TRIGGER_CHOICES, default=TRIGGER_AUTO)
    target_period = models.CharField(max_length=50, blank=True, help_text="e.g. 2026-05 or May-2026")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_SUCCESS)
    created_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    details = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-run_time"]

    def __str__(self):
        return f"[{self.run_time.strftime('%Y-%m-%d %H:%M')}] {self.trigger} ({self.status}) - Created: {self.created_count}, Skipped: {self.skipped_count}, Failed: {self.failed_count}"


# ==============================================================================
# Dynamic Projects Module: Lookup & Core Models
# ==============================================================================

def project_receipt_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    safe_name = f"{uuid.uuid4().hex}{ext}"
    return os.path.join("protected_media", "project_receipts", safe_name)


def project_document_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    safe_name = f"{uuid.uuid4().hex}{ext}"
    return os.path.join("protected_media", "project_documents", safe_name)


class ConfigOption(models.Model):
    """
    Abstract base for dynamic configuration lookup models.
    Supports name (English), optional Bengali name (name_bn), color, sort order,
    active flag, and default flag.
    """
    name = models.CharField(max_length=100)
    name_bn = models.CharField(max_length=100, blank=True, default="")
    color = models.CharField(max_length=50, default="#64748B")
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        if self.name:
            clean_name = self.name.strip()
            qs = self.__class__.objects.filter(name__iexact=clean_name)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError({"name": f"An option with name '{clean_name}' already exists."})

        # Cannot deactivate the last active option of a type
        if self.pk and not self.is_active:
            active_count = self.__class__.objects.filter(is_active=True).exclude(pk=self.pk).count()
            if active_count == 0:
                raise ValidationError({"is_active": "Cannot deactivate the last active option."})

    def save(self, *args, **kwargs):
        self.clean()
        with transaction.atomic():
            # Exactly one default per type:
            if self.is_default:
                self.__class__.objects.exclude(pk=self.pk).filter(is_default=True).update(is_default=False)
            else:
                has_default = self.__class__.objects.exclude(pk=self.pk).filter(is_default=True).exists()
                # If no other option is default and this is being saved, make it default
                if not has_default and not self.__class__.objects.exclude(pk=self.pk).exists():
                    self.is_default = True
            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Rows in use cannot be hard-deleted
        for rel in self._meta.related_objects:
            accessor_name = rel.get_accessor_name()
            if accessor_name and hasattr(self, accessor_name):
                related_mgr = getattr(self, accessor_name)
                if related_mgr.exists():
                    raise ValidationError(
                        f"Cannot delete option '{self.name}' because it is in use by existing records. Deactivate it instead."
                    )
        super().delete(*args, **kwargs)


class ProjectStatus(ConfigOption):
    is_closed = models.BooleanField(
        default=False,
        help_text="If True, project is closed (no new expenses or modules unless privileged)"
    )
    is_initial = models.BooleanField(
        default=False,
        help_text="Assigned automatically to newly created projects"
    )
    allow_staff_set = models.BooleanField(
        default=False,
        help_text="STAFF role may transition projects to this status"
    )

    class Meta(ConfigOption.Meta):
        verbose_name_plural = "Project Statuses"

    def save(self, *args, **kwargs):
        if self.is_initial:
            ProjectStatus.objects.exclude(pk=self.pk).filter(is_initial=True).update(is_initial=False)
        super().save(*args, **kwargs)


class ProjectPriority(ConfigOption):
    weight = models.IntegerField(default=0, help_text="Used for priority sorting (higher = more urgent)")

    class Meta(ConfigOption.Meta):
        verbose_name_plural = "Project Priorities"


class BillingMethod(ConfigOption):
    class Meta(ConfigOption.Meta):
        verbose_name_plural = "Billing Methods"


class DocumentCategory(ConfigOption):
    class Meta(ConfigOption.Meta):
        verbose_name_plural = "Document Categories"


class ProjectSequence(models.Model):
    """Tracks sequence numbers per project prefix atomically to guarantee unique, concurrency-safe project codes."""
    prefix = models.CharField(max_length=50, unique=True)
    last_number = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.prefix}: {self.last_number}"

    @classmethod
    def generate_next_code(cls, date=None):
        from .models import Settings
        st = Settings.objects.first()
        prefix = getattr(st, "project_code_prefix", "PRJ") if st else "PRJ"
        digits = getattr(st, "project_code_digits", 4) if st else 4
        include_year = getattr(st, "project_code_include_year", True) if st else True

        if date is None:
            date = timezone.now().date()

        if include_year:
            seq_key = f"{prefix}-{date.year}-"
        else:
            seq_key = f"{prefix}-"

        with transaction.atomic():
            seq, _ = cls.objects.select_for_update().get_or_create(
                prefix=seq_key,
                defaults={"last_number": 0}
            )
            seq.last_number += 1
            seq.save()
            return f"{seq_key}{seq.last_number:0{digits}d}"


class ProjectRolePermission(models.Model):
    role = models.CharField(max_length=20, choices=UserProfile.ROLE_CHOICES, unique=True)
    can_view = models.BooleanField(default=True)
    can_create = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    can_manage_expenses = models.BooleanField(default=False)
    can_manage_documents = models.BooleanField(default=False)
    can_manage_modules = models.BooleanField(default=False)
    can_change_status = models.BooleanField(default=False)
    can_manage_config = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Project Permissions for {self.role}"

    def save(self, *args, **kwargs):
        # Admin role always possesses all permissions
        if self.role == UserProfile.ROLE_ADMIN:
            self.can_view = True
            self.can_create = True
            self.can_edit = True
            self.can_delete = True
            self.can_manage_expenses = True
            self.can_manage_documents = True
            self.can_manage_modules = True
            self.can_change_status = True
            self.can_manage_config = True
        super().save(*args, **kwargs)


class Project(models.Model):
    code = models.CharField(max_length=50, unique=True, editable=False)
    name = models.CharField(max_length=255)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="projects")
    start_date = models.DateField(default=timezone.localdate)
    end_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    status = models.ForeignKey(ProjectStatus, on_delete=models.PROTECT, related_name="projects")
    priority = models.ForeignKey(ProjectPriority, on_delete=models.PROTECT, related_name="projects")
    billing_method = models.ForeignKey(BillingMethod, on_delete=models.PROTECT, related_name="projects")
    total_budget = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    estimated_cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects_created"
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["client"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def clean(self):
        super().clean()
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "End date cannot be earlier than start date."})

    def save(self, *args, **kwargs):
        self.clean()
        if not self.code:
            self.code = ProjectSequence.generate_next_code(date=self.start_date or timezone.now().date())
        if not hasattr(self, "status") or not self.status_id:
            initial_status = ProjectStatus.objects.filter(is_initial=True, is_active=True).first()
            if not initial_status:
                initial_status = ProjectStatus.objects.filter(is_default=True, is_active=True).first()
            if initial_status:
                self.status = initial_status
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Do not hard-delete projects with expenses, documents, or modules
        if self.expenses.exists() or self.documents.exists() or self.modules.exists():
            raise ValidationError(
                "Cannot delete project with existing expenses, documents, or modules. Update status to closed instead."
            )
        super().delete(*args, **kwargs)

    @property
    def actual_cost(self):
        res = self.expenses.aggregate(total=models.Sum("amount"))["total"]
        return res if res is not None else Decimal("0.00")

    @property
    def used_budget(self):
        # Assumption: used_budget equals actual_cost (total expenses incurred so far)
        return self.actual_cost

    @property
    def remaining_budget(self):
        return self.total_budget - self.used_budget

    @property
    def is_over_budget(self):
        return self.remaining_budget < Decimal("0.00")

    @property
    def overall_progress(self):
        res = self.modules.aggregate(avg=models.Avg("progress_percent"))["avg"]
        return round(float(res), 1) if res is not None else 0.0

    @property
    def documents_count(self):
        return self.documents.count()

    @property
    def billable_total(self):
        res = self.expenses.filter(is_billable=True).aggregate(total=models.Sum("amount"))["total"]
        return res if res is not None else Decimal("0.00")

    @property
    def non_billable_total(self):
        res = self.expenses.filter(is_billable=False).aggregate(total=models.Sum("amount"))["total"]
        return res if res is not None else Decimal("0.00")


class ProjectModule(models.Model):
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="modules")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    progress_percent = models.PositiveSmallIntegerField(default=0)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.project.code} - {self.name} ({self.progress_percent}%)"

    def clean(self):
        super().clean()
        if self.progress_percent < 0 or self.progress_percent > 100:
            raise ValidationError({"progress_percent": "Progress percentage must be between 0 and 100."})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class ProjectExpense(models.Model):
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="expenses")
    expense_name = models.CharField(max_length=255)
    date = models.DateField(default=timezone.localdate)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    description = models.TextField(blank=True)
    is_billable = models.BooleanField(default=True)
    receipt = models.FileField(upload_to=project_receipt_upload_path, blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"{self.project.code} - {self.expense_name}: {self.amount}"

    def clean(self):
        super().clean()
        if self.amount is not None and self.amount <= Decimal("0.00"):
            raise ValidationError({"amount": "Expense amount must be greater than zero."})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class ProjectDocument(models.Model):
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="documents")
    title = models.CharField(max_length=255)
    category = models.ForeignKey(DocumentCategory, on_delete=models.PROTECT, related_name="documents")
    file = models.FileField(upload_to=project_document_upload_path)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.project.code} - {self.title}"


