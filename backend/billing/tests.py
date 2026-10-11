from unittest.mock import patch, MagicMock
from decimal import Decimal
import datetime
from django.test import TestCase, override_settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from .models import (
    UserProfile,
    Company,
    BankAccount,
    Client,
    Service,
    InvoiceTemplate,
    Invoice,
    InvoiceItem,
    Payment,
    PaymentMethod,
    AuditLog,
    Settings,
)

User = get_user_model()


class InvoiceCalculationAndNumberTest(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name="RAKTCH TECHNOLOGY & SOFTWARE",
            address="Sector 6, Uttara, Dhaka",
            email="support@raktch.com",
            phone="+8801581677077",
            website="www.raktch.com",
        )
        self.bank = BankAccount.objects.create(
            company=self.company,
            bank_name="Islami Bank PLC",
            account_name="RAKTCH TECHNOLOGY AND SOFTWARE",
            account_number="1234567890123",
        )
        self.client = Client.objects.create(
            name="Rose International",
            contact_person="Director",
            phone="+8801700000000",
        )
        self.service = Service.objects.create(
            name="Supershop Software",
            default_tech_specification="Hosting & Maintenance Bill",
            default_price=Decimal("1000.00"),
        )
        self.template = InvoiceTemplate.objects.create(
            name="Standard Template",
            invoice_number_prefix="INV-",
        )

    def test_invoice_calculation_logic(self):
        """
        Verify pure Decimal calculations:
        Subtotal: 2 * 1000.00 = 2000.00
        Discount: 200.00
        Tax base: 1800.00
        VAT (5%): 90.00
        Payable: 1890.00
        Advance: 500.00
        Due: 1390.00
        """
        invoice = Invoice.objects.create(
            title="Monthly Service Bill",
            client=self.client,
            company=self.company,
            bank_account=self.bank,
            template=self.template,
            discount=Decimal("200.00"),
            vat_rate=Decimal("5.00"),
            advance_amount=Decimal("500.00"),
        )

        item1 = InvoiceItem.objects.create(
            invoice=invoice,
            sl=1,
            service=self.service,
            item_name="Supershop Software",
            quantity=Decimal("2.00"),
            unit_price=Decimal("1000.00"),
        )

        invoice.refresh_from_db()
        self.assertEqual(invoice.sub_total, Decimal("2000.00"))
        self.assertEqual(invoice.vat_amount, Decimal("90.00"))
        self.assertEqual(invoice.payable_amount, Decimal("1890.00"))
        self.assertEqual(invoice.advance_amount, Decimal("500.00"))
        self.assertEqual(invoice.due_amount, Decimal("1390.00"))
        self.assertEqual(invoice.status, "PARTIALLY_PAID")

        # Record a payment of 1390.00
        Payment.objects.create(
            invoice=invoice,
            amount=Decimal("1390.00"),
        )

        invoice.refresh_from_db()
        self.assertEqual(invoice.paid_amount, Decimal("1390.00"))
        self.assertEqual(invoice.due_amount, Decimal("0.00"))
        self.assertEqual(invoice.status, "PAID")

    def test_transaction_safe_invoice_number_generator(self):
        """Test that successive calls generate sequential, gapless, unique numbers"""
        date = datetime.date(2026, 4, 1)
        num1 = Invoice.generate_next_invoice_number(prefix="INV-", date=date)
        num2 = Invoice.generate_next_invoice_number(prefix="INV-", date=date)
        num3 = Invoice.generate_next_invoice_number(prefix="INV-", date=date)

        self.assertEqual(num1, "INV-202604-0001")
        self.assertEqual(num2, "INV-202604-0002")
        self.assertEqual(num3, "INV-202604-0003")
        self.assertNotEqual(num1, num2)
        self.assertNotEqual(num2, num3)

    def test_invoice_historical_snapshots(self):
        """Verify snapshots freeze company and bank details at invoice creation time"""
        invoice = Invoice.objects.create(
            title="Snapshot Test Bill",
            client=self.client,
            company=self.company,
            bank_account=self.bank,
        )

        self.assertEqual(invoice.company_name, "RAKTCH TECHNOLOGY & SOFTWARE")
        self.assertEqual(invoice.bank_name, "Islami Bank PLC")
        self.assertEqual(invoice.client_name, "Rose International")

        # Now change the live company name
        self.company.name = "NEW BRAND NAME"
        self.company.save()

        # The invoice snapshot must remain unchanged!
        invoice.refresh_from_db()
        self.assertEqual(invoice.company_name, "RAKTCH TECHNOLOGY & SOFTWARE")

    def test_multipage_pdf_generation_5_20_50_items(self):
        """Test generating PDF with 5, 20, and 50 line items across multiple pages"""
        from .pdf_service import generate_invoice_pdf

        prev_size = 0
        for count in [5, 20, 50]:
            inv = Invoice.objects.create(
                title=f"Multi-Page Bill ({count} items)",
                client=self.client,
                company=self.company,
                bank_account=self.bank,
                billing_month="April-2026",
            )
            for i in range(1, count + 1):
                InvoiceItem.objects.create(
                    invoice=inv,
                    sl=i,
                    service=self.service,
                    item_name=f"Service Line #{i} - Hosting & Maintenance",
                    technical_specification="Cloud infrastructure, backup & security update",
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("100.00"),
                )

            inv.calculate_totals()
            inv.save()

            # Verify math accuracy
            expected_total = Decimal(str(count * 100)).quantize(Decimal("0.01"))
            self.assertEqual(inv.sub_total, expected_total)
            self.assertEqual(inv.payable_amount, expected_total)

            # Generate PDF
            pdf_bytes = generate_invoice_pdf(inv)
            self.assertIsNotNone(pdf_bytes)
            self.assertTrue(pdf_bytes.startswith(b"%PDF"))
            self.assertGreater(len(pdf_bytes), prev_size)
            prev_size = len(pdf_bytes)


class AuthAndRoleAPITest(APITestCase):
    def setUp(self):
        # Admin
        self.admin_user = User.objects.create_user("admin_user", "admin@test.com", "pass123", is_staff=True)
        UserProfile.objects.create(user=self.admin_user, role=UserProfile.ROLE_ADMIN)

        # Accountant
        self.accountant_user = User.objects.create_user("accountant_user", "acc@test.com", "pass123")
        UserProfile.objects.create(user=self.accountant_user, role=UserProfile.ROLE_ACCOUNTANT)

        # Staff
        self.staff_user = User.objects.create_user("staff_user", "staff@test.com", "pass123")
        UserProfile.objects.create(user=self.staff_user, role=UserProfile.ROLE_STAFF)

        self.company = Company.objects.create(name="Test Co")
        self.billing_client = Client.objects.create(name="Test Client")
        self.invoice = Invoice.objects.create(
            title="Invoice 1",
            client=self.billing_client,
            company=self.company,
            status="DRAFT",
        )

    def test_jwt_login(self):
        response = self.client.post("/api/auth/login/", {
            "username": "admin_user",
            "password": "pass123"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        # Use token to call /api/auth/me/
        token = response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        me_resp = self.client.get("/api/auth/me/")
        self.assertEqual(me_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(me_resp.data["username"], "admin_user")
        self.assertEqual(me_resp.data["role"], "ADMIN")

    def test_role_permissions_on_invoice_delete(self):
        # Staff cannot delete invoice
        self.client.force_authenticate(user=self.staff_user)
        resp = self.client.delete(f"/api/invoices/{self.invoice.id}/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        # Accountant cannot delete invoice
        self.client.force_authenticate(user=self.accountant_user)
        resp = self.client.delete(f"/api/invoices/{self.invoice.id}/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        # Admin CAN delete invoice
        self.client.force_authenticate(user=self.admin_user)
        resp = self.client.delete(f"/api/invoices/{self.invoice.id}/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)


class Phase6PaymentAndDueTrackingTest(APITestCase):
    """
    Phase 6 tests:
    1. Payment entry (Method, Date, Transaction ID)
    2. Status Auto Update (Unpaid -> Partial -> Paid) and reverse on deletion
    3. Money Receipt PDF generation and download
    """
    def setUp(self):
        self.admin = User.objects.create_superuser(username="admin6", password="password6", email="admin6@test.com")
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)

        self.company = Company.objects.create(
            name="RAKTCH TECHNOLOGY & SOFTWARE",
            address="Sector 6, Uttara, Dhaka",
            email="support@raktch.com",
            phone="+8801581677077",
            website="www.raktch.com",
        )
        self.client_entity = Client.objects.create(name="ABC Enterprise", contact_person="Karim Ahmed", phone="01711111111")
        self.payment_method = PaymentMethod.objects.create(name="bKash Merchant", description="Direct bKash payment")

        self.invoice = Invoice.objects.create(
            title="Software Monthly Fee",
            client=self.client_entity,
            company=self.company,
            issue_date=datetime.date(2026, 10, 5),
            status="ISSUED",
        )
        InvoiceItem.objects.create(
            invoice=self.invoice,
            sl=1,
            item_name="Enterprise ERP Monthly",
            quantity=Decimal("1.00"),
            unit_price=Decimal("1000.00"),
            total=Decimal("1000.00"),
        )
        self.invoice.calculate_totals()
        self.invoice.save()

    def test_status_auto_update_flow(self):
        """Unpaid (ISSUED) -> Partial (PARTIALLY_PAID) -> Paid (PAID) -> reverse on delete"""
        self.client.force_authenticate(user=self.admin)
        inv = self.invoice
        inv.refresh_from_db()
        self.assertEqual(inv.status, "ISSUED")
        self.assertEqual(inv.due_amount, Decimal("1000.00"))

        # 1. Partial payment: 400.00
        p1_resp = self.client.post(f"/api/invoices/{inv.id}/record_payment/", {
            "amount": "400.00",
            "payment_method": self.payment_method.id,
            "payment_date": "2026-10-05",
            "transaction_id": "TRX-4001",
            "note": "Advance payment via bKash"
        })
        self.assertEqual(p1_resp.status_code, status.HTTP_201_CREATED)
        inv.refresh_from_db()
        self.assertEqual(inv.status, "PARTIALLY_PAID")
        self.assertEqual(inv.paid_amount, Decimal("400.00"))
        self.assertEqual(inv.due_amount, Decimal("600.00"))

        # 2. Settle remaining 600.00 -> PAID
        p2_resp = self.client.post(f"/api/invoices/{inv.id}/record_payment/", {
            "amount": "600.00",
            "payment_method": self.payment_method.id,
            "payment_date": "2026-10-06",
            "transaction_id": "TRX-4002",
            "note": "Final settlement"
        })
        self.assertEqual(p2_resp.status_code, status.HTTP_201_CREATED)
        inv.refresh_from_db()
        self.assertEqual(inv.status, "PAID")
        self.assertEqual(inv.paid_amount, Decimal("1000.00"))
        self.assertEqual(inv.due_amount, Decimal("0.00"))

        # 3. Delete second payment -> Revert to PARTIALLY_PAID
        p2_id = p2_resp.data["payment"]["id"]
        del_resp = self.client.delete(f"/api/payments/{p2_id}/")
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)
        inv.refresh_from_db()
        self.assertEqual(inv.status, "PARTIALLY_PAID")
        self.assertEqual(inv.paid_amount, Decimal("400.00"))
        self.assertEqual(inv.due_amount, Decimal("600.00"))

        # 4. Delete first payment -> Revert to ISSUED (Unpaid)
        p1_id = p1_resp.data["payment"]["id"]
        del_resp2 = self.client.delete(f"/api/payments/{p1_id}/")
        self.assertEqual(del_resp2.status_code, status.HTTP_204_NO_CONTENT)
        inv.refresh_from_db()
        self.assertEqual(inv.status, "ISSUED")
        self.assertEqual(inv.paid_amount, Decimal("0.00"))
        self.assertEqual(inv.due_amount, Decimal("1000.00"))

    def test_money_receipt_pdf_endpoints(self):
        """Test download and preview of Money Receipt PDF"""
        self.client.force_authenticate(user=self.admin)

        p_resp = self.client.post(f"/api/invoices/{self.invoice.id}/record_payment/", {
            "amount": "500.00",
            "payment_method": self.payment_method.id,
            "payment_date": "2026-10-05",
            "transaction_id": "TRX-RCPT-99",
            "note": "Payment for receipt generation"
        })
        p_id = p_resp.data["payment"]["id"]

        # Download Receipt PDF
        dl_resp = self.client.get(f"/api/payments/{p_id}/download_receipt/")
        self.assertEqual(dl_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(dl_resp["Content-Type"], "application/pdf")
        self.assertIn("attachment; filename=", dl_resp["Content-Disposition"])
        self.assertGreater(len(dl_resp.content), 1000)

        # Preview Receipt PDF
        prev_resp = self.client.get(f"/api/payments/{p_id}/preview_receipt/")
        self.assertEqual(prev_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(prev_resp["Content-Type"], "application/pdf")
        self.assertIn("inline; filename=", prev_resp["Content-Disposition"])
        self.assertGreater(len(prev_resp.content), 1000)

    def test_dashboard_summary_and_deletion_deduction(self):
        """Test that deleting a payment or paid invoice immediately deducts from collected and due metrics"""
        self.client.force_authenticate(user=self.admin)

        # 1. Initial summary check
        s1 = self.client.get("/api/invoices/summary/")
        self.assertEqual(s1.status_code, status.HTTP_200_OK)
        self.assertEqual(s1.data["total_billed"], "1000.00")
        self.assertEqual(s1.data["total_collected"], "0.00")
        self.assertEqual(s1.data["total_due"], "1000.00")
        self.assertEqual(s1.data["total_overdue"], "0.00")

        # 2. Record payment
        p_resp = self.client.post(f"/api/invoices/{self.invoice.id}/record_payment/", {
            "amount": "600.00",
            "payment_method": self.payment_method.id,
            "payment_date": "2026-10-05",
        })
        p_id = p_resp.data["payment"]["id"]

        s2 = self.client.get("/api/invoices/summary/")
        self.assertEqual(s2.data["total_collected"], "600.00")
        self.assertEqual(s2.data["total_due"], "400.00")

        # 3. Delete payment -> must immediately deduct from total_collected
        del_p = self.client.delete(f"/api/payments/{p_id}/")
        self.assertEqual(del_p.status_code, status.HTTP_204_NO_CONTENT)

        s3 = self.client.get("/api/invoices/summary/")
        self.assertEqual(s3.data["total_collected"], "0.00")
        self.assertEqual(s3.data["total_due"], "1000.00")

        # 4. Make bill fully paid (received bill), then delete the invoice
        self.client.post(f"/api/invoices/{self.invoice.id}/record_payment/", {
            "amount": "1000.00",
            "payment_method": self.payment_method.id,
            "payment_date": "2026-10-05",
        })
        s4 = self.client.get("/api/invoices/summary/")
        self.assertEqual(s4.data["total_collected"], "1000.00")
        self.assertEqual(s4.data["total_due"], "0.00")

        del_inv = self.client.delete(f"/api/invoices/{self.invoice.id}/")
        self.assertEqual(del_inv.status_code, status.HTTP_400_BAD_REQUEST)

        # Non-draft invoice must be CANCELLED instead
        cancel_res = self.client.patch(f"/api/invoices/{self.invoice.id}/", {"status": "CANCELLED"})
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)

        s5 = self.client.get("/api/invoices/summary/")
        self.assertEqual(s5.data["total_billed"], "0.00")
        self.assertEqual(s5.data["total_collected"], "0.00")
        self.assertEqual(s5.data["total_due"], "0.00")
        self.assertEqual(s5.data["total_overdue"], "0.00")


class SecurityAndRBACPermissionsTest(APITestCase):
    def setUp(self):
        # 1. Admin
        self.admin = User.objects.create_user("admin_sec", "admin_sec@test.com", "AdminPass123!", is_staff=True, is_superuser=True)
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)

        # 2. Accountant
        self.accountant = User.objects.create_user("acc_sec", "acc_sec@test.com", "AccPass123!")
        UserProfile.objects.create(user=self.accountant, role=UserProfile.ROLE_ACCOUNTANT)

        # 3. Staff
        self.staff = User.objects.create_user("staff_sec", "staff_sec@test.com", "StaffPass123!")
        UserProfile.objects.create(user=self.staff, role=UserProfile.ROLE_STAFF)

        # 4. Deactivated User
        self.inactive_user = User.objects.create_user("inactive_user", "inactive@test.com", "InactivePass123!", is_active=False)
        UserProfile.objects.create(user=self.inactive_user, role=UserProfile.ROLE_STAFF)

        # Base billing objects
        self.company = Company.objects.create(name="Security Test Co", is_default=True)
        self.settings = Settings.objects.create(default_company=self.company)
        self.client_entity = Client.objects.create(name="Secure Client")
        self.invoice = Invoice.objects.create(
            title="Secure Invoice",
            client=self.client_entity,
            company=self.company,
            status="ISSUED",
        )
        self.payment = Payment.objects.create(
            invoice=self.invoice,
            amount=Decimal("500.00"),
        )

    def test_unauthenticated_api_and_pdf_endpoints_return_401(self):
        """Unauthenticated requests to all API and PDF endpoints must return 401 Unauthorized"""
        self.client.logout()

        endpoints = [
            f"/api/invoices/",
            f"/api/invoices/{self.invoice.id}/",
            f"/api/invoices/{self.invoice.id}/download_pdf/",
            f"/api/invoices/{self.invoice.id}/preview_pdf/",
            f"/api/payments/",
            f"/api/payments/{self.payment.id}/download_receipt/",
            f"/api/payments/{self.payment.id}/preview_receipt/",
            f"/api/clients/",
            f"/api/settings/",
            f"/api/users/",
            f"/api/audit-logs/",
        ]
        for url in endpoints:
            resp = self.client.get(url)
            self.assertEqual(
                resp.status_code,
                status.HTTP_401_UNAUTHORIZED,
                f"Endpoint {url} did not return 401 for unauthenticated request (got {resp.status_code})"
            )

    def test_staff_cannot_delete_payment_or_modify_settings(self):
        """STAFF role cannot delete payments or modify settings (returns 403)"""
        self.client.force_authenticate(user=self.staff)

        # Attempt to delete payment -> 403
        del_p_resp = self.client.delete(f"/api/payments/{self.payment.id}/")
        self.assertEqual(del_p_resp.status_code, status.HTTP_403_FORBIDDEN)

        # Attempt to modify settings -> 403
        settings_resp = self.client.patch(f"/api/settings/{self.settings.id}/", {"default_nb_text": "Updated by staff"})
        self.assertEqual(settings_resp.status_code, status.HTTP_403_FORBIDDEN)

        # Attempt to modify company -> 403
        comp_resp = self.client.patch(f"/api/companies/{self.company.id}/", {"name": "Hacked Co"})
        self.assertEqual(comp_resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_accountant_cannot_access_user_management_or_audit_logs(self):
        """ACCOUNTANT role cannot access user management or audit logs (returns 403)"""
        self.client.force_authenticate(user=self.accountant)

        # User management list/create -> 403
        users_resp = self.client.get("/api/users/")
        self.assertEqual(users_resp.status_code, status.HTTP_403_FORBIDDEN)

        create_user_resp = self.client.post("/api/users/", {
            "username": "rogue_user",
            "password": "Password123!",
            "role": "ADMIN"
        })
        self.assertEqual(create_user_resp.status_code, status.HTTP_403_FORBIDDEN)

        # Audit logs -> 403
        audit_resp = self.client.get("/api/audit-logs/")
        self.assertEqual(audit_resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_deactivated_user_cannot_login(self):
        """Deactivated user (is_active=False) cannot log in (returns 401)"""
        resp = self.client.post("/api/auth/login/", {
            "username": "inactive_user",
            "password": "InactivePass123!"
        })
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("deactivated", resp.data.get("detail", "").lower())

    def test_logout_blacklists_refresh_token(self):
        """Logging out blacklists the refresh token so it cannot be used again"""
        # 1. Login
        login_resp = self.client.post("/api/auth/login/", {
            "username": "admin_sec",
            "password": "AdminPass123!"
        })
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        refresh_token = login_resp.data["refresh"]
        access_token = login_resp.data["access"]

        # 2. Logout with refresh token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        logout_resp = self.client.post("/api/auth/logout/", {"refresh": refresh_token})
        self.assertEqual(logout_resp.status_code, status.HTTP_200_OK)

        # 3. Try to use blacklisted refresh token to refresh -> 401
        self.client.credentials()  # clear headers
        refresh_resp = self.client.post("/api/auth/refresh/", {"refresh": refresh_token})
        self.assertEqual(refresh_resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_audit_log_properly_created(self):
        """AuditLog entries are created on login, invoice create, payment create, and payment delete"""
        # 1. Login generates audit log
        login_resp = self.client.post("/api/auth/login/", {
            "username": "admin_sec",
            "password": "AdminPass123!"
        })
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        token = login_resp.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        self.assertTrue(AuditLog.objects.filter(action=AuditLog.ACTION_LOGIN_SUCCESS, username="admin_sec").exists())

        # 2. Invoice create generates audit log
        inv_resp = self.client.post("/api/invoices/", {
            "title": "Audited Bill",
            "client": self.client_entity.id,
            "company": self.company.id,
            "status": "ISSUED",
        })
        self.assertEqual(inv_resp.status_code, status.HTTP_201_CREATED)
        new_inv_id = inv_resp.data["id"]
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.ACTION_CREATE, model_name="Invoice", object_id=str(new_inv_id)).exists())

        # 3. Payment delete generates audit log
        del_resp = self.client.delete(f"/api/payments/{self.payment.id}/")
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.ACTION_DELETE, model_name="Payment", object_id=str(self.payment.id)).exists())


class PdfPaginationAndLocalizationTest(TestCase):
    """
    Mandatory unit/integration tests verifying:
    - 1 item: exactly 1 page
    - 10 items
    - 25 items: at least 2 pages, table header present on every page
    - 50 items and 100 items: multi-page scaling
    - Item with very long specification text (word-wrap)
    - Invoice with Bengali name and address (Noto Sans Bengali, conjuncts)
    - Signature / totals block ONLY on the last page
    - 'Page X of Y' correct on every page
    - Money receipt PDF generation with proper layout
    """

    def setUp(self):
        self.company = Company.objects.create(
            name="RAKTCH TECHNOLOGY & SOFTWARE",
            address="Sector 6, Road 5, House 20, 7th floor, Uttara, Dhaka -1230, Bangladesh",
            email="support@raktch.com",
            phone="+8801581677077",
            website="www.raktch.com",
            is_default=True,
        )
        self.bank = BankAccount.objects.create(
            company=self.company,
            bank_name="Islami Bank PLC",
            account_name="RAKTCH TECHNOLOGY AND SOFTWARE",
            account_number="1234567890123",
            branch_name="Haji Camp, Ashkona, Dakkhin khan",
            routing_number="125261995",
            is_default=True,
        )
        self.client_entity = Client.objects.create(
            name="Rose International",
            contact_person="MD. Arif Hossain",
            address="House 12, Road 4, Banani, Dhaka",
            phone="+8801700000000",
        )
        self.template = InvoiceTemplate.objects.create(
            name="Standard Template",
            invoice_number_prefix="INV-",
            is_default=True,
        )

    def _create_invoice(self, count, client_name="Rose International", client_address="House 12, Banani, Dhaka", title="INVOICE", custom_items=None):
        inv = Invoice.objects.create(
            company=self.company,
            client=self.client_entity,
            template=self.template,
            title=title,
            client_name=client_name,
            client_address=client_address,
            client_contact_person="MD. Arif Hossain",
            bank_name=self.bank.bank_name,
            account_name=self.bank.account_name,
            account_number=self.bank.account_number,
            branch_name=self.bank.branch_name,
            routing_number=self.bank.routing_number,
            status="ISSUED",
        )
        if custom_items:
            for sl, (name, spec, qty, price) in enumerate(custom_items, 1):
                InvoiceItem.objects.create(
                    invoice=inv,
                    sl=sl,
                    item_name=name,
                    technical_specification=spec,
                    quantity=Decimal(str(qty)),
                    unit_price=Decimal(str(price)),
                )
        else:
            for i in range(1, count + 1):
                InvoiceItem.objects.create(
                    invoice=inv,
                    sl=i,
                    item_name=f"Software Service Module #{i}",
                    technical_specification=f"Custom architecture, API integration and QA deployment #{i}",
                    quantity=Decimal("1"),
                    unit_price=Decimal("1500.00"),
                )
        inv.calculate_totals()
        inv.refresh_from_db()
        return inv

    def test_one_item_fits_on_one_page(self):
        """1-item invoice must fit on 1 page exactly as before"""
        import io
        from pypdf import PdfReader
        from .pdf_service import generate_invoice_pdf

        inv = self._create_invoice(1, title="1-Item Invoice")
        pdf_bytes = generate_invoice_pdf(inv)
        reader = PdfReader(io.BytesIO(pdf_bytes))

        self.assertEqual(len(reader.pages), 1, f"Expected 1 page, got {len(reader.pages)}")
        page_text = reader.pages[0].extract_text()
        self.assertIn("Page 1 of 1", page_text)
        self.assertIn("Sub Total", page_text)
        self.assertIn("Received by", page_text)
        self.assertIn("Authorization", page_text)

    def test_ten_items_pdf(self):
        """10-item invoice generates clean valid PDF"""
        import io
        from pypdf import PdfReader
        from .pdf_service import generate_invoice_pdf

        inv = self._create_invoice(10, title="10-Item Invoice")
        pdf_bytes = generate_invoice_pdf(inv)
        reader = PdfReader(io.BytesIO(pdf_bytes))
        self.assertGreaterEqual(len(reader.pages), 1)

    def test_twenty_five_items_multipage_and_headers(self):
        """
        25 items: at least 2 pages.
        - Table header present on every page
        - Signature and totals block ONLY on the last page
        - 'Page X of Y' correct on every page
        """
        import io
        from pypdf import PdfReader
        from .pdf_service import generate_invoice_pdf

        inv = self._create_invoice(25, title="25-Item Invoice")
        pdf_bytes = generate_invoice_pdf(inv)
        reader = PdfReader(io.BytesIO(pdf_bytes))
        total_pages = len(reader.pages)

        self.assertGreaterEqual(total_pages, 2, f"Expected at least 2 pages, got {total_pages}")

        for idx, page in enumerate(reader.pages):
            text = page.extract_text()
            # Table header row must be on every page
            self.assertIn("Technical Specification", text, f"Table header missing on page {idx + 1}")
            # Page X of Y must be correct on every page
            self.assertIn(f"Page {idx + 1} of {total_pages}", text, f"Page number wrong on page {idx + 1}")
            # Totals and signature block must NOT appear on prior pages
            if idx < total_pages - 1:
                self.assertNotIn("Received by", text, f"Signature block leaked to page {idx + 1}")
                self.assertNotIn("Authorization", text, f"Signature block leaked to page {idx + 1}")

        # Last page must contain totals and signature block
        last_page_text = reader.pages[-1].extract_text()
        self.assertIn("Received by", last_page_text)
        self.assertIn("Authorization", last_page_text)
        self.assertIn("Sub Total", last_page_text)

    def test_fifty_and_hundred_items_scaling(self):
        """50 and 100 items render cleanly across multiple pages"""
        import io
        from pypdf import PdfReader
        from .pdf_service import generate_invoice_pdf

        # 50 items
        inv_50 = self._create_invoice(50, title="50-Item Invoice")
        pdf_50 = generate_invoice_pdf(inv_50)
        r_50 = PdfReader(io.BytesIO(pdf_50))
        self.assertGreaterEqual(len(r_50.pages), 2)
        self.assertIn("Received by", r_50.pages[-1].extract_text())

        # 100 items
        inv_100 = self._create_invoice(100, title="100-Item Invoice")
        pdf_100 = generate_invoice_pdf(inv_100)
        r_100 = PdfReader(io.BytesIO(pdf_100))
        self.assertGreaterEqual(len(r_100.pages), 3)
        self.assertIn("Received by", r_100.pages[-1].extract_text())

    def test_very_long_specification_text_wrapping(self):
        """Long specification text wraps downwards without crashing or overflowing table"""
        import io
        from pypdf import PdfReader
        from .pdf_service import generate_invoice_pdf

        long_spec = (
            "Enterprise scalable multi-region microservice cluster with Kubernetes orchestration, "
            "PostgreSQL read-replica streaming, Redis distributed caching, enterprise SSL/TLS offloading. "
        ) * 5

        inv = self._create_invoice(
            2,
            title="Long Specification Invoice",
            custom_items=[
                ("Cloud Migration", long_spec, 1, 50000.00),
                ("Security Hardening", long_spec, 1, 30000.00),
            ]
        )
        pdf_bytes = generate_invoice_pdf(inv)
        reader = PdfReader(io.BytesIO(pdf_bytes))
        self.assertGreaterEqual(len(reader.pages), 1)
        self.assertIn("Kubernetes orchestration", reader.pages[0].extract_text())

    def test_bengali_font_and_conjuncts(self):
        """Invoice with Bengali name, address, items, and conjunct characters renders correctly"""
        import io
        from pypdf import PdfReader
        from .pdf_service import generate_invoice_pdf

        bengali_name = "রহিম অ্যান্ড ব্রাদার্স ট্রেডিং কোম্পানি"
        bengali_address = "বাড়ি নং ৪২, রোড নং ৭, ধানমন্ডি, ঢাকা-১২০৫, বাংলাদেশ।"

        inv = self._create_invoice(
            3,
            client_name=bengali_name,
            client_address=bengali_address,
            title="ইনভয়েস বিলিং স্টেটমেন্ট (INVOICE)",
            custom_items=[
                ("ওয়েব অ্যাপ্লিকেশন ডেভেলপমেন্ট", "পূর্ণাঙ্গ ব্যাকএন্ড সিস্টেম ও রিয়েল-টাইম ইনভেন্টরি ম্যানেজমেন্ট", 1, 60000.00),
                ("সার্ভার ক্লাউড হোস্টিং", "২৪/৭ সিকিউরিটি মনিটরিং ও ব্যাকআপ সাপোর্ট", 1, 15000.00),
                ("Consultation Services", "Enterprise cloud consulting (English & বাংলা)", 1, 10000.00),
            ]
        )
        pdf_bytes = generate_invoice_pdf(inv)
        reader = PdfReader(io.BytesIO(pdf_bytes))
        self.assertGreaterEqual(len(reader.pages), 1)
        first_page_text = reader.pages[0].extract_text()
        self.assertTrue("রহিম" in first_page_text or "ব্রাদার্স" in first_page_text)
        self.assertIn("Enterprise cloud consulting", first_page_text)

    def test_money_receipt_pdf_generation(self):
        """Money receipt PDF renders cleanly with branding, header, footer and Bengali font"""
        import io
        from pypdf import PdfReader
        from .pdf_service import generate_money_receipt_pdf

        method = PaymentMethod.objects.create(name="Bank Transfer")
        inv = self._create_invoice(1, client_name="রহিম এন্টারপ্রাইজ", title="Service Invoice")
        payment = Payment.objects.create(
            invoice=inv,
            amount=Decimal("1500.00"),
            payment_method=method,
            transaction_id="TXN-202610-9988",
            note="Payment received with thanks (বাংলা নোট)",
        )
        pdf_bytes = generate_money_receipt_pdf(payment)
        reader = PdfReader(io.BytesIO(pdf_bytes))
        self.assertEqual(len(reader.pages), 1)
        text = reader.pages[0].extract_text()
        self.assertIn("OFFICIAL MONEY RECEIPT", text)
        self.assertIn("Page 1 of 1", text)
        self.assertIn(payment.receipt_number, text)


from django.db.models.deletion import ProtectedError
from django.db import transaction
from django.utils import timezone
from .models import ClientServicePrice, InvoiceSequence, LoginAttempt


class Phase7ArchitectureAndSecurityFixesTest(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username="admin7", password="password7", email="admin7@test.com")
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)

        self.staff = User.objects.create_user(username="staff7", password="password7", email="staff7@test.com")
        UserProfile.objects.create(user=self.staff, role=UserProfile.ROLE_STAFF)

        self.company = Company.objects.create(
            name="RAKTCH TECHNOLOGY & SOFTWARE",
            address="Sector 6, Uttara, Dhaka",
            email="support@raktch.com",
            phone="+8801581677077",
            website="www.raktch.com",
            is_default=True,
        )
        self.client_entity = Client.objects.create(name="Beta Industries", contact_person="Hasan Ali", phone="01722222222")
        self.service = Service.objects.create(
            name="Web Hosting & Maintenance",
            default_tech_specification="Monthly Cloud Hosting",
            default_price=Decimal("1500.00"),
        )
        self.template = InvoiceTemplate.objects.create(
            name="Standard Bill Template",
            invoice_number_prefix="INV-",
            is_default=True,
        )

    def test_cannot_delete_non_draft_invoice(self):
        """Only DRAFT invoices can be deleted; ISSUED or PAID invoices are blocked with 400"""
        self.client.force_authenticate(user=self.admin)
        issued_inv = Invoice.objects.create(
            title="Issued Bill",
            client=self.client_entity,
            company=self.company,
            template=self.template,
            status="ISSUED",
        )
        resp = self.client.delete(f"/api/invoices/{issued_inv.id}/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only DRAFT invoices can be deleted", str(resp.data))

        # But DRAFT invoice deletion succeeds
        draft_inv = Invoice.objects.create(
            title="Draft Bill",
            client=self.client_entity,
            company=self.company,
            template=self.template,
            status="DRAFT",
        )
        draft_resp = self.client.delete(f"/api/invoices/{draft_inv.id}/")
        self.assertEqual(draft_resp.status_code, status.HTTP_204_NO_CONTENT)

    def test_cannot_delete_invoice_with_payments(self):
        """Invoices with associated payments cannot be deleted (via API and protected in DB)"""
        self.client.force_authenticate(user=self.admin)
        inv = Invoice.objects.create(
            title="Draft Bill With Payment",
            client=self.client_entity,
            company=self.company,
            template=self.template,
            status="DRAFT",
        )
        Payment.objects.create(invoice=inv, amount=Decimal("500.00"))

        # API deletion blocked
        resp = self.client.delete(f"/api/invoices/{inv.id}/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("associated payments", str(resp.data))

        # Direct ORM deletion raises ProtectedError
        with self.assertRaises(ProtectedError):
            inv.delete()

    def test_staff_invoice_creation_enforces_draft(self):
        """Staff creation enforces status=DRAFT without mutating request.data"""
        self.client.force_authenticate(user=self.staff)
        payload = {
            "title": "Staff Submitted Bill",
            "client": self.client_entity.id,
            "company": self.company.id,
            "template": self.template.id,
            "status": "ISSUED",  # Staff tries to issue directly
            "items": [
                {
                    "item_name": "Consulting",
                    "technical_specification": "Advisory",
                    "quantity": "1.00",
                    "unit_price": "2000.00",
                }
            ],
        }
        resp = self.client.post("/api/invoices/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], "DRAFT")

    def test_generate_monthly_bills_atomic_no_duplicate_and_clean_names(self):
        """Batch generation is atomic, removes {idx}. from item_name, and skips duplicate clients"""
        self.client.force_authenticate(user=self.admin)
        ClientServicePrice.objects.create(
            client=self.client_entity,
            service=self.service,
            custom_name="ERP Hosting",
            custom_tech_specification="Dedicated Server Hosting",
            custom_price=Decimal("2500.00"),
            is_active=True,
        )

        # 1. First run generates the invoice
        resp1 = self.client.post("/api/invoices/generate_monthly_bills/", {"billing_month": "November-2026"})
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(resp1.data["generated_invoices"]), 1)
        self.assertEqual(len(resp1.data["skipped_clients"]), 0)

        # Verify item_name does NOT contain "{idx}." prefix
        inv = Invoice.objects.get(invoice_number=resp1.data["generated_invoices"][0])
        item = inv.items.first()
        self.assertFalse(item.item_name.startswith("1. "))
        self.assertTrue(item.item_name.startswith("ERP Hosting"))

        # 2. Second run for same month skips duplicate and reports skipped client
        resp2 = self.client.post("/api/invoices/generate_monthly_bills/", {"billing_month": "November-2026"})
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(resp2.data["generated_invoices"]), 0)
        self.assertEqual(len(resp2.data["skipped_clients"]), 1)
        self.assertEqual(resp2.data["skipped_clients"][0]["client_id"], self.client_entity.id)

    def test_login_lockout_per_username_and_proxy_forwarded_for(self):
        """5 failed login attempts per username locks account for 15 mins behind proxy"""
        target_username = "lockout_user"
        User.objects.create_user(username=target_username, password="correct_password")

        proxy_ip = "198.51.100.42"

        for i in range(5):
            res = self.client.post(
                "/api/auth/login/",
                {"username": target_username, "password": "wrong_password"},
                HTTP_X_FORWARDED_FOR=proxy_ip,
            )
            if i < 4:
                self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
            else:
                self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        # 6th attempt is locked out with 429
        locked_res = self.client.post(
            "/api/auth/login/",
            {"username": target_username, "password": "correct_password"},
            HTTP_X_FORWARDED_FOR="198.51.100.99",  # Different IP still locked because lockout is per-username
        )
        self.assertEqual(locked_res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("temporarily locked", str(locked_res.data))

        # A different user from the first IP is NOT locked
        other_user = "other_user"
        User.objects.create_user(username=other_user, password="correct_password")
        other_res = self.client.post(
            "/api/auth/login/",
            {"username": other_user, "password": "correct_password"},
            HTTP_X_FORWARDED_FOR=proxy_ip,
        )
        self.assertEqual(other_res.status_code, status.HTTP_200_OK)

    def test_gapless_invoice_number_rollback(self):
        """Failed invoice creation inside a transaction rolls back InvoiceSequence so no gap is left"""
        prefix = "GAPLESS-"
        date_today = timezone.now().date()
        year_month = date_today.strftime("%Y%m")
        sequence_key = f"{prefix}{year_month}-"

        # Verify initial sequence state
        seq = InvoiceSequence.objects.filter(prefix=sequence_key).first()
        initial_num = seq.last_number if seq else 0

        # Attempt invoice creation that fails inside a transaction
        try:
            with transaction.atomic():
                inv = Invoice(
                    title="Will Fail",
                    client=self.client_entity,
                    company=self.company,
                    issue_date=date_today,
                )
                inv.invoice_number = Invoice.generate_next_invoice_number(prefix=prefix, date=date_today)
                raise RuntimeError("Simulated DB or validation failure during transaction")
        except RuntimeError:
            pass

        # Verify the sequence counter was rolled back to initial_num
        seq_after = InvoiceSequence.objects.filter(prefix=sequence_key).first()
        seq_num_after = seq_after.last_number if seq_after else 0
        self.assertEqual(seq_num_after, initial_num)


from django.db import IntegrityError
import unittest
from .models import Subscription, RecurringRun, Settings
from .services import RecurringBillingService, get_effective_billing_date, is_subscription_due


class Phase8RecurringBillingAutomatedTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username="admin8", password="password8", email="admin8@test.com")
        UserProfile.objects.create(user=self.admin, role=UserProfile.ROLE_ADMIN)

        self.company = Company.objects.create(
            name="RAKTCH TECHNOLOGY & SOFTWARE",
            address="Uttara, Dhaka",
            email="support@raktch.com",
            phone="+8801581677077",
            is_default=True,
        )
        self.client_a = Client.objects.create(name="Delta Global", contact_person="Karim Ullah", is_active=True)
        self.client_b = Client.objects.create(name="Epsilon Trade", contact_person="Fatima Begum", is_active=True)

        self.service_monthly = Service.objects.create(
            name="ERP Hosting",
            default_tech_specification="Monthly Cloud",
            default_price=Decimal("2000.00"),
            billing_cycle="MONTHLY",
        )
        self.service_quarterly = Service.objects.create(
            name="Security Audit",
            default_tech_specification="Quarterly Review",
            default_price=Decimal("6000.00"),
            billing_cycle="QUARTERLY",
        )
        self.service_yearly = Service.objects.create(
            name="Domain & SSL Renewal",
            default_tech_specification="Yearly Maintenance",
            default_price=Decimal("5000.00"),
            billing_cycle="YEARLY",
        )

        self.template = InvoiceTemplate.objects.create(name="Standard Recurring Template", is_default=True)
        self.settings = Settings.objects.create(
            currency_symbol="Tk",
            currency_code="BDT",
            default_company=self.company,
            auto_billing_enabled=True,
            auto_billing_day=1,
            auto_billing_timezone="Asia/Dhaka",
        )

    def test_running_job_twice_creates_no_duplicates(self):
        """Idempotency: running recurring billing job twice generates invoices once without duplicates"""
        sub = Subscription.objects.create(
            client=self.client_a,
            service=self.service_monthly,
            start_date=datetime.date(2026, 1, 1),
            billing_cycle="MONTHLY",
            is_active=True,
        )

        # 1. First run generates the invoice
        res1 = RecurringBillingService.run_recurring_billing(
            target_period="2026-05",
            trigger="MANUAL",
            force=True,
            catch_up=False,
        )
        self.assertEqual(res1["status"], RecurringRun.STATUS_SUCCESS)
        self.assertEqual(res1["created_count"], 1)
        self.assertEqual(res1["skipped_count"], 0)
        self.assertEqual(res1["failed_count"], 0)

        invoice_count = Invoice.objects.filter(subscription=sub, billing_period="2026-05").count()
        self.assertEqual(invoice_count, 1)

        # 2. Second run for same period skips duplicate
        res2 = RecurringBillingService.run_recurring_billing(
            target_period="2026-05",
            trigger="MANUAL",
            force=True,
            catch_up=False,
        )
        self.assertEqual(res2["status"], RecurringRun.STATUS_SUCCESS)
        self.assertEqual(res2["created_count"], 0)
        self.assertEqual(res2["skipped_count"], 1)
        self.assertIn("already exists", res2["skipped_items"][0]["reason"])

        # Still exactly 1 invoice in DB
        self.assertEqual(Invoice.objects.filter(subscription=sub, billing_period="2026-05").count(), 1)

    def test_concurrent_duplicate_protection_db_unique_constraint(self):
        """Database enforces UniqueConstraint on (subscription, billing_period)"""
        sub = Subscription.objects.create(
            client=self.client_a,
            service=self.service_monthly,
            start_date=datetime.date(2026, 1, 1),
            billing_cycle="MONTHLY",
        )

        # First invoice directly in DB
        Invoice.objects.create(
            title="First Invoice",
            client=self.client_a,
            company=self.company,
            template=self.template,
            subscription=sub,
            billing_period="2026-07",
            billing_month="July-2026",
            status="ISSUED",
        )

        # Attempt second invoice for same subscription & billing_period raises IntegrityError
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Invoice.objects.create(
                    title="Duplicate Attempt",
                    client=self.client_a,
                    company=self.company,
                    template=self.template,
                    subscription=sub,
                    billing_period="2026-07",
                    billing_month="July-2026",
                    status="ISSUED",
                )

        # Safe service method catches IntegrityError and flags SKIPPED
        _, err, code = RecurringBillingService.generate_single_invoice(
            subscription=sub,
            year=2026,
            month=7,
            trigger="AUTO",
        )
        self.assertEqual(code, "SKIPPED")

    def test_month_end_date_handling(self):
        """Month-end days (Jan 31, Feb 28/29, Apr 30) adjust correctly to month's last day"""
        # Day 31 in January -> Jan 31
        d_jan = get_effective_billing_date(2026, 1, 31)
        self.assertEqual(d_jan, datetime.date(2026, 1, 31))

        # Day 31 in non-leap February (2026) -> Feb 28
        d_feb_common = get_effective_billing_date(2026, 2, 31)
        self.assertEqual(d_feb_common, datetime.date(2026, 2, 28))

        # Day 31 in leap February (2028) -> Feb 29
        d_feb_leap = get_effective_billing_date(2028, 2, 31)
        self.assertEqual(d_feb_leap, datetime.date(2028, 2, 29))

        # Day 31 in April (30 days) -> Apr 30
        d_apr = get_effective_billing_date(2026, 4, 31)
        self.assertEqual(d_apr, datetime.date(2026, 4, 30))

    def test_quarterly_and_yearly_billing_cycles(self):
        """Respects quarterly (every 3 months) and yearly cycles from subscription start date"""
        # Quarterly starting March 2026
        sub_q = Subscription.objects.create(
            client=self.client_a,
            service=self.service_quarterly,
            start_date=datetime.date(2026, 3, 1),
            billing_cycle="QUARTERLY",
        )

        due_mar, _ = is_subscription_due(sub_q, 2026, 3, 1)
        due_apr, _ = is_subscription_due(sub_q, 2026, 4, 1)
        due_may, _ = is_subscription_due(sub_q, 2026, 5, 1)
        due_jun, _ = is_subscription_due(sub_q, 2026, 6, 1)

        self.assertTrue(due_mar, "March is start month (due)")
        self.assertFalse(due_apr, "April is 1 month in (not due)")
        self.assertFalse(due_may, "May is 2 months in (not due)")
        self.assertTrue(due_jun, "June is 3 months in (due)")

        # Yearly starting August 2025
        sub_y = Subscription.objects.create(
            client=self.client_b,
            service=self.service_yearly,
            start_date=datetime.date(2025, 8, 1),
            billing_cycle="YEARLY",
        )

        due_aug_2026, _ = is_subscription_due(sub_y, 2026, 8, 1)
        due_sep_2026, _ = is_subscription_due(sub_y, 2026, 9, 1)
        due_aug_2027, _ = is_subscription_due(sub_y, 2027, 8, 1)

        self.assertTrue(due_aug_2026, "Anniversary month (due)")
        self.assertFalse(due_sep_2026, "Next month (not due)")
        self.assertTrue(due_aug_2027, "Year 2 anniversary (due)")

    def test_inactive_and_expired_subscriptions_are_skipped(self):
        """Inactive subscriptions, inactive clients, and expired subscriptions are skipped"""
        # Inactive sub
        sub_inactive = Subscription.objects.create(
            client=self.client_a,
            service=self.service_monthly,
            start_date=datetime.date(2026, 1, 1),
            is_active=False,
        )
        due1, r1 = is_subscription_due(sub_inactive, 2026, 5, 1)
        self.assertFalse(due1)
        self.assertIn("inactive", r1.lower())

        # Inactive client
        client_inactive = Client.objects.create(name="Inactive Co", is_active=False)
        sub_inactive_client = Subscription.objects.create(
            client=client_inactive,
            service=self.service_monthly,
            start_date=datetime.date(2026, 1, 1),
            is_active=True,
        )
        due2, r2 = is_subscription_due(sub_inactive_client, 2026, 5, 1)
        self.assertFalse(due2)
        self.assertIn("client is inactive", r2.lower())

        # Expired sub (ended on 2026-03-31)
        sub_expired = Subscription.objects.create(
            client=self.client_a,
            service=self.service_yearly,
            start_date=datetime.date(2026, 1, 1),
            end_date=datetime.date(2026, 3, 31),
            is_active=True,
        )
        due3, r3 = is_subscription_due(sub_expired, 2026, 5, 1)
        self.assertFalse(due3)
        self.assertIn("expired", r3.lower())

    def test_failure_isolation_one_failing_subscription_does_not_block_others(self):
        """One subscription error does not rollback other valid subscriptions"""
        sub_valid = Subscription.objects.create(
            client=self.client_a,
            service=self.service_monthly,
            start_date=datetime.date(2026, 1, 1),
            is_active=True,
        )
        sub_faulty = Subscription.objects.create(
            client=self.client_b,
            service=self.service_monthly,
            start_date=datetime.date(2026, 1, 1),
            is_active=True,
        )

        original_save = InvoiceItem.save

        # Force failure on sub_faulty's item save
        def faulty_save(item_self, *args, **kwargs):
            if item_self.invoice.subscription_id == sub_faulty.id:
                raise ValueError("Simulated unexpected failure on subscription B")
            return original_save(item_self, *args, **kwargs)

        with unittest.mock.patch.object(InvoiceItem, "save", side_effect=faulty_save, autospec=True):
            res = RecurringBillingService.run_recurring_billing(
                target_period="2026-08",
                trigger="MANUAL",
                force=True,
                catch_up=False,
            )

        # sub_valid created its invoice, sub_faulty failed
        self.assertEqual(res["status"], RecurringRun.STATUS_PARTIAL)
        self.assertEqual(res["created_count"], 1)
        self.assertEqual(res["failed_count"], 1)
        self.assertEqual(Invoice.objects.filter(subscription=sub_valid, billing_period="2026-08").count(), 1)
        self.assertEqual(Invoice.objects.filter(subscription=sub_faulty, billing_period="2026-08").count(), 0)

    def test_catch_up_after_missed_run(self):
        """Catches up missed billing periods (last 3 periods) when server was down"""
        sub = Subscription.objects.create(
            client=self.client_a,
            service=self.service_monthly,
            start_date=datetime.date(2026, 2, 1),
            is_active=True,
        )

        # Current period is 2026-04. Sub started 2026-02.
        # No runs occurred for 2026-02, 2026-03, 2026-04.
        res = RecurringBillingService.run_recurring_billing(
            target_period="2026-04",
            trigger="MANUAL",
            force=True,
            catch_up=True,
        )

        # Should generate for 2026-02, 2026-03, 2026-04 (3 missed periods)
        self.assertEqual(res["created_count"], 3)
        self.assertEqual(Invoice.objects.filter(subscription=sub).count(), 3)
        self.assertTrue(Invoice.objects.filter(subscription=sub, billing_period="2026-02").exists())
        self.assertTrue(Invoice.objects.filter(subscription=sub, billing_period="2026-03").exists())
        self.assertTrue(Invoice.objects.filter(subscription=sub, billing_period="2026-04").exists())

        # Second run catches up nothing new
        res2 = RecurringBillingService.run_recurring_billing(
            target_period="2026-04",
            trigger="MANUAL",
            force=True,
            catch_up=True,
        )
        self.assertEqual(res2["created_count"], 0)

    def test_preview_and_api_endpoints(self):
        """Test preview, trigger, and status REST endpoints"""
        self.client.force_authenticate(user=self.admin)
        Subscription.objects.create(
            client=self.client_a,
            service=self.service_monthly,
            start_date=datetime.date(2026, 9, 1),
            is_active=True,
        )

        # 1. Preview endpoint returns simulation without creating DB invoices
        preview_resp = self.client.get("/api/recurring-runs/preview/?period=2026-09")
        self.assertEqual(preview_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(preview_resp.data["total_would_create"], 1)
        self.assertEqual(Invoice.objects.filter(billing_period="2026-09").count(), 0)

        # 2. Trigger endpoint executes run
        trigger_resp = self.client.post("/api/recurring-runs/trigger/", {"period": "2026-09"})
        self.assertEqual(trigger_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(trigger_resp.data["created_count"], 1)
        self.assertEqual(Invoice.objects.filter(billing_period="2026-09").count(), 1)

        # 3. Status endpoint returns summary and warning flags
        status_resp = self.client.get("/api/recurring-runs/status/")
        self.assertEqual(status_resp.status_code, status.HTTP_200_OK)
        self.assertIn("has_warning", status_resp.data)
        self.assertIn("auto_billing_enabled", status_resp.data)
        self.assertEqual(status_resp.data["auto_billing_enabled"], True)

    def test_mail_failure_does_not_abort_run_and_logs_in_recurring_run(self):
        """Mail dispatch exception must not rollback invoices, and error details must be stored in RecurringRun"""
        import unittest.mock
        Subscription.objects.create(
            client=self.client_a,
            service=self.service_monthly,
            start_date=datetime.date(2026, 10, 1),
            is_active=True,
        )

        with unittest.mock.patch("billing.services.send_mail", side_effect=ConnectionError("Simulated SMTP Connection Refused")):
            res = RecurringBillingService.run_recurring_billing(
                target_period="2026-10",
                trigger="MANUAL",
                force=True,
                catch_up=False,
            )

        # Invoices must be successfully created and committed
        self.assertEqual(res["created_count"], 1)
        self.assertEqual(Invoice.objects.filter(billing_period="2026-10").count(), 1)

        # Recurring run record must log the mail error without crashing
        run_record = RecurringRun.objects.filter(target_period="2026-10").first()
        self.assertIsNotNone(run_record)
        self.assertIn("mail_error", run_record.details)
        self.assertIn("Simulated SMTP Connection Refused", run_record.details["mail_error"])



class DemoUserSecurityTest(APITestCase):
    def setUp(self):
        User.objects.filter(username__in=["admin", "accountant", "staff"]).delete()

    def test_login_with_demo_credentials_on_empty_db_returns_401_and_creates_no_user(self):
        """Unseeded DB: login with default credentials must return 401 and create zero users"""
        for user_cred, pass_cred in [("admin", "admin123"), ("accountant", "accountant123"), ("staff", "staff123")]:
            resp = self.client.post("/api/auth/login/", {"username": user_cred, "password": pass_cred})
            self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
            self.assertFalse(User.objects.filter(username=user_cred).exists())

    def test_migrate_creates_no_demo_users(self):
        """Running migrate must never create demo users automatically"""
        call_command("migrate", interactive=False, verbosity=0)
        self.assertFalse(User.objects.filter(username__in=["admin", "accountant", "staff"]).exists())

    @override_settings(DEBUG=False)
    def test_seed_demo_refuses_when_debug_false(self):
        """seed_demo must refuse execution when DEBUG=False"""
        with self.assertRaises(CommandError) as cm:
            call_command("seed_demo")
        self.assertIn("DEBUG is False", str(cm.exception))
        self.assertFalse(User.objects.filter(username__in=["admin", "accountant", "staff"]).exists())

    @override_settings(DEBUG=True)
    def test_seed_demo_and_check_demo_accounts_when_debug_true(self):
        """seed_demo creates accounts in dev, and check_demo_accounts correctly identifies them"""
        call_command("seed_demo")
        self.assertTrue(User.objects.filter(username="admin").exists())
        self.assertTrue(User.objects.filter(username="accountant").exists())
        self.assertTrue(User.objects.filter(username="staff").exists())

        # check_demo_accounts should run cleanly without error
        call_command("check_demo_accounts")


class InvoiceNotificationPipelineTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name="RAKTCH TECHNOLOGY & SOFTWARE",
            email="support@raktch.com",
            phone="+8801581677077",
            website="www.raktch.com",
        )
        self.client = Client.objects.create(
            name="Acme Corp",
            email="billing@acme.com",
            phone="01712345678",
        )
        self.invoice = Invoice.objects.create(
            client=self.client,
            company=self.company,
            client_name="Acme Corp",
            client_email="billing@acme.com",
            client_phone="01712345678",
            invoice_number="INV-202610-TEST",
            billing_month="October 2026",
            sub_total=Decimal("1000.00"),
            payable_amount=Decimal("1000.00"),
            status="ISSUED",
        )

    def test_phone_number_cleaning(self):
        from .notification_service import InvoiceNotificationService
        # 11-digit local BD phone -> 88 prefix
        self.assertEqual(InvoiceNotificationService.clean_phone_number("01712345678"), "8801712345678")
        # Leading + stripped
        self.assertEqual(InvoiceNotificationService.clean_phone_number("+8801712345678"), "8801712345678")
        # International formatting
        self.assertEqual(InvoiceNotificationService.clean_phone_number("+1 (555) 123-4567"), "15551234567")
        # Empty
        self.assertEqual(InvoiceNotificationService.clean_phone_number(""), "")

    def test_diagnostics_structure(self):
        from .notification_service import InvoiceNotificationService
        diag = InvoiceNotificationService.get_diagnostics()
        self.assertIn("email", diag)
        self.assertIn("whatsapp", diag)
        self.assertIn("backend", diag["email"])
        self.assertIn("mode", diag["whatsapp"])

    @patch("billing.notification_service.EmailMessage")
    def test_send_invoice_email_success(self, mock_email_cls):
        from .notification_service import InvoiceNotificationService
        mock_instance = MagicMock()
        mock_email_cls.return_value = mock_instance

        res = InvoiceNotificationService.send_invoice_email(self.invoice, pdf_bytes=b"%PDF-1.4 test")
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "SENT")
        self.assertEqual(res["recipient"], "billing@acme.com")

        self.invoice.refresh_from_db()
        self.assertTrue(self.invoice.email_sent)
        self.assertIsNotNone(self.invoice.email_sent_at)
        self.assertEqual(self.invoice.email_error, "")

    def test_send_invoice_email_no_recipient(self):
        from .notification_service import InvoiceNotificationService
        self.client.email = ""
        self.client.save()
        self.invoice.client_email = ""
        self.invoice.save(update_fields=["client_email"])

        res = InvoiceNotificationService.send_invoice_email(self.invoice, pdf_bytes=b"dummy")
        self.assertFalse(res["success"])
        self.assertEqual(res["status"], "FAILED")
        self.assertIn("no registered email", res["error"])

    def test_send_invoice_whatsapp_click_to_chat(self):
        from .notification_service import InvoiceNotificationService
        res = InvoiceNotificationService.send_invoice_whatsapp(self.invoice, pdf_bytes=b"dummy")
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "SENT")
        self.assertEqual(res["recipient"], "8801712345678")
        self.assertIn("https://api.whatsapp.com/send?phone=8801712345678", res["link"])

        self.invoice.refresh_from_db()
        self.assertTrue(self.invoice.whatsapp_sent)
        self.assertEqual(self.invoice.whatsapp_error, "")

    @patch("urllib.request.urlopen")
    @override_settings(
        WHATSAPP_API_TOKEN="test_token_123",
        WHATSAPP_PHONE_NUMBER_ID="1000999888"
    )
    def test_send_invoice_whatsapp_cloud_api_success(self, mock_urlopen):
        from .notification_service import InvoiceNotificationService
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        res = InvoiceNotificationService.send_invoice_whatsapp(self.invoice, pdf_bytes=b"dummy")
        self.assertTrue(res["success"])
        self.assertTrue(res["api_dispatched"])
        self.assertEqual(res["status"], "SENT")

    @patch("urllib.request.urlopen")
    @override_settings(
        WHATSAPP_API_TOKEN="invalid_token",
        WHATSAPP_PHONE_NUMBER_ID="1000999888"
    )
    def test_send_invoice_whatsapp_cloud_api_failure_fallback(self, mock_urlopen):
        import urllib.error
        from io import BytesIO
        from .notification_service import InvoiceNotificationService

        mock_err = urllib.error.HTTPError(
            url="https://graph.facebook.com/v21.0/1000999888/messages",
            code=401,
            msg="Unauthorized",
            hdrs={},
            fp=BytesIO(b'{"error":{"message":"Invalid OAuth access token."}}')
        )
        mock_urlopen.side_effect = mock_err

        res = InvoiceNotificationService.send_invoice_whatsapp(self.invoice, pdf_bytes=b"dummy")
        self.assertFalse(res["success"])
        self.assertFalse(res["api_dispatched"])
        self.assertEqual(res["status"], "FAILED")
        self.assertIn("Invalid OAuth access token", res["error"])
        # Click-to-chat fallback link is still available for manual sending
        self.assertTrue(res["link"].startswith("https://api.whatsapp.com/send?phone=8801712345678"))

    def test_management_command_test_notifications(self):
        # Verify manage.py test_notifications runs cleanly in dry-run mode
        call_command("test_notifications", str(self.invoice.id), "--dry-run")







