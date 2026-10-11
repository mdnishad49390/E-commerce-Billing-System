from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from billing.models import (
    Company,
    BankAccount,
    Settings,
    PaymentMethod,
    Client,
    Service,
    ClientServicePrice,
    InvoiceTemplate,
    Invoice,
    InvoiceItem,
)
import os
import datetime

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds initial data from sample invoice and creates superuser if needed"

    def handle(self, *args, **options):
        # 1. Superuser
        if not User.objects.filter(is_superuser=True).exists():
            admin_pwd = os.getenv("ADMIN_PASSWORD")
            if admin_pwd:
                User.objects.create_superuser("admin", "admin@raktch.com", admin_pwd)
                self.stdout.write(self.style.SUCCESS("Superuser 'admin' created."))
            else:
                self.stdout.write(
                    self.style.WARNING(
                        "No superuser exists. To create one, run 'python manage.py create_admin' "
                        "or set ADMIN_PASSWORD in your environment."
                    )
                )

        # 2. Company
        company, _ = Company.objects.get_or_create(
            name="RAKTCH TECHNOLOGY & SOFTWARE",
            defaults={
                "tagline": "TECHNOLOGY & SOFTWARE",
                "address": "Sector 6, Road 5, House 20, 7th floor, Uttara, Dhaka -1230, Bangladesh",
                "website": "www.raktch.com",
                "email": "raktchme@gmail.com, support@raktch.com",
                "phone": "+8801581677077",
                "is_default": True,
            }
        )

        # 3. Bank Account
        bank, _ = BankAccount.objects.get_or_create(
            company=company,
            account_number="1234567890123",
            defaults={
                "bank_name": "Islami Bank PLC",
                "account_name": "RAKTCH TECHNOLOGY AND SOFTWARE",
                "branch_name": "Haji Camp, Ashkona, Dakkhin khan,",
                "routing_number": "125261995",
                "is_default": True,
                "is_active": True,
            }
        )

        # 4. Settings
        settings, _ = Settings.objects.get_or_create(
            id=1,
            defaults={
                "currency_symbol": "Tk",
                "currency_code": "BDT",
                "default_company": company,
                "default_bank_account": bank,
                "default_nb_text": "[N.B Please send the bill to]",
                "invoice_footer_note": "www.raktch.com",
            }
        )

        # 5. Payment Methods
        for p_name in ["Islami Bank PLC (Account Transfer)", "bKash", "Nagad", "Cash"]:
            PaymentMethod.objects.get_or_create(name=p_name)

        # 6. Service
        service, _ = Service.objects.get_or_create(
            name="Supershop Software",
            defaults={
                "code": "SUPERSHOP-MONTHLY",
                "default_tech_specification": "Hosting & Maintenance Bill",
                "default_price": 1000.00,
                "billing_cycle": "MONTHLY",
                "is_active": True,
            }
        )

        # 7. Client
        client, _ = Client.objects.get_or_create(
            name="Rose International",
            defaults={
                "contact_person": "Manager",
                "phone": "+8801700000000",
                "email": "info@roseinternational.com",
                "address": "Dhaka, Bangladesh",
                "is_active": True,
            }
        )

        # 8. Client Service Pricing
        ClientServicePrice.objects.get_or_create(
            client=client,
            service=service,
            defaults={
                "custom_name": "Supershop Software",
                "custom_tech_specification": "Hosting & Maintenance Bill",
                "custom_price": 1000.00,
                "is_active": True,
            }
        )

        # 9. Invoice Template
        template, _ = InvoiceTemplate.objects.get_or_create(
            name="Supershop Software Monthly Template",
            defaults={
                "title_pattern": "{service_name} Monthly Bill ({month_year})",
                "invoice_number_prefix": "INV-",
                "nb_text": "[N.B Please send the bill to]",
                "authorization_label": "Authorization",
                "received_by_label": "Received by",
                "is_default": True,
            }
        )

        # 10. Sample Invoice (matching user's PDF)
        if not Invoice.objects.filter(client=client, billing_month="April-2026").exists():
            invoice = Invoice(
                title="Supershop Software Monthly Bill (April-2026)",
                billing_month="April-2026",
                issue_date=datetime.date(2026, 4, 1),
                client=client,
                company=company,
                bank_account=bank,
                template=template,
                status="ISSUED",
                currency_symbol="Tk",
                sub_total=1000.00,
                discount=0.00,
                payable_amount=1000.00,
            )
            invoice.save()

            InvoiceItem.objects.create(
                invoice=invoice,
                sl=1,
                service=service,
                item_name="1. Supershop Software (April-2026)",
                technical_specification="Hosting & Maintenance Bill",
                quantity=1,
                unit_price=1000.00,
                total=1000.00,
            )
            self.stdout.write(self.style.SUCCESS(f"Sample invoice created: {invoice.invoice_number}"))

        self.stdout.write(self.style.SUCCESS("Initial data seeding completed successfully!"))
