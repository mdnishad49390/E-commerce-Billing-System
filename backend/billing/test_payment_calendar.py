import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    Client, Company, Invoice, InvoiceItem, Payment, PaymentMethod,
    Service, Subscription, UserProfile,
)
from .payment_calendar import (
    STATUS_DUE, STATUS_NO_PAYMENT, STATUS_OVERDUE, STATUS_PAID,
    STATUS_PARTIALLY_PAID, STATUS_UPCOMING, calendar_data, client_history,
    matrix_data, parse_range, payment_status,
)

D = datetime.date
TODAY = D(2026, 10, 5)  # fixed "now" so results never depend on the real clock


def make_invoice(client, company, amount, due, title="Hosting", **kwargs):
    inv = Invoice.objects.create(
        client=client, company=company, title=title,
        issue_date=kwargs.pop("issue_date", due), due_date=due, **kwargs,
    )
    InvoiceItem.objects.create(invoice=inv, item_name=title, quantity=1, unit_price=Decimal(amount))
    inv.refresh_from_db()
    return inv


class PaymentStatusRuleTests(TestCase):
    due = D(2026, 10, 10)

    def test_rule(self):
        s = lambda paid, today, **kw: payment_status(3000, paid, self.due, today, **kw)
        self.assertEqual(s(3000, D(2026, 10, 20)), STATUS_PAID)
        self.assertEqual(s(1000, D(2026, 10, 9)), STATUS_PARTIALLY_PAID)   # partial, not yet due
        self.assertEqual(s(1000, D(2026, 10, 10)), STATUS_PARTIALLY_PAID)  # partial on due date
        self.assertEqual(s(1000, D(2026, 10, 11)), STATUS_OVERDUE)         # partial but past due
        self.assertEqual(s(0, D(2026, 10, 11)), STATUS_OVERDUE)
        self.assertEqual(s(0, D(2026, 10, 10)), STATUS_DUE)
        self.assertEqual(s(0, D(2026, 10, 9)), STATUS_UPCOMING)
        self.assertEqual(s(0, D(2026, 10, 9), has_bill=False), STATUS_NO_PAYMENT)


class CalendarDataTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name="Raktch")
        self.alpha = Client.objects.create(name="Alpha Ltd")
        self.gamma = Client.objects.create(name="Gamma Ltd")
        self.bkash = PaymentMethod.objects.create(name="bKash")
        self.cash = PaymentMethod.objects.create(name="Cash")

    def day(self, data, iso):
        return next(d for d in data["days"] if d["date"] == iso)

    def test_partial_then_full_payment_updates_status_and_totals(self):
        inv = make_invoice(self.gamma, self.company, "5000", D(2026, 10, 10))
        Payment.objects.create(invoice=inv, amount=Decimal("3000"), payment_date=D(2026, 10, 5), payment_method=self.bkash, transaction_id="TX1")
        row = self.day(calendar_data(2026, 10, today=TODAY), "2026-10-10")["items"][0]
        self.assertEqual((row["status"], row["paid_amount"], row["remaining_amount"]), (STATUS_PARTIALLY_PAID, "3000.00", "2000.00"))
        self.assertEqual(row["payment_method"], "bKash")

        Payment.objects.create(invoice=inv, amount=Decimal("2000"), payment_date=D(2026, 10, 9), payment_method=self.cash)
        data = calendar_data(2026, 10, today=TODAY)
        row = self.day(data, "2026-10-10")["items"][0]
        self.assertEqual((row["status"], row["remaining_amount"], row["payment_count"]), (STATUS_PAID, "0.00", 2))
        self.assertEqual(data["summary"]["total_collected"], "5000.00")
        self.assertEqual(data["summary"]["total_due"], "0.00")

    def test_partial_past_due_is_overdue_but_keeps_partial_info(self):
        inv = make_invoice(self.gamma, self.company, "5000", D(2026, 10, 3))
        Payment.objects.create(invoice=inv, amount=Decimal("1500"), payment_date=D(2026, 10, 1))
        row = self.day(calendar_data(2026, 10, today=TODAY), "2026-10-03")["items"][0]
        self.assertEqual((row["status"], row["is_partial"], row["paid_amount"], row["remaining_amount"]), (STATUS_OVERDUE, True, "1500.00", "3500.00"))
        self.assertEqual(len(row["payments"]), 1)

    def test_month_summary_and_day_aggregate(self):
        a = make_invoice(self.alpha, self.company, "4000", D(2026, 10, 10))
        make_invoice(self.gamma, self.company, "6000", D(2026, 10, 10))
        make_invoice(self.gamma, self.company, "1000", D(2026, 11, 10))  # other month
        Payment.objects.create(invoice=a, amount=Decimal("4000"), payment_date=D(2026, 10, 1))
        data = calendar_data(2026, 10, today=TODAY)
        day = self.day(data, "2026-10-10")
        self.assertEqual((day["count"], day["expected"], day["collected"], day["due"]), (2, "10000.00", "4000.00", "6000.00"))
        s = data["summary"]
        self.assertEqual((s["total_expected"], s["total_collected"], s["total_due"], s["paid_clients"]), ("10000.00", "4000.00", "6000.00", 1))
        self.assertEqual((s["counts"]["PAID"], s["counts"]["UPCOMING"]), (1, 1))

    def test_filters_and_cancelled_excluded(self):
        a = make_invoice(self.alpha, self.company, "4000", D(2026, 10, 10))
        make_invoice(self.gamma, self.company, "6000", D(2026, 10, 12), status="CANCELLED")
        Payment.objects.create(invoice=a, amount=Decimal("1000"), payment_date=D(2026, 10, 1), payment_method=self.bkash)
        n = lambda **kw: calendar_data(2026, 10, today=TODAY, **kw)["summary"]["total_bills"]
        self.assertEqual(n(), 1)
        self.assertEqual(n(client_id=self.gamma.id), 0)
        self.assertEqual(n(method_id=self.bkash.id), 1)
        self.assertEqual(n(method_id=self.cash.id), 0)
        self.assertEqual(n(status=STATUS_PARTIALLY_PAID), 1)

    def test_subscription_without_invoice_is_no_payment_and_not_duplicated(self):
        svc = Service.objects.create(name="Support", default_price=Decimal("2500"))
        sub = Subscription.objects.create(client=self.alpha, service=svc, start_date=D(2026, 1, 1))
        rows = [i for d in calendar_data(2026, 10, today=TODAY)["days"] for i in d["items"]]
        self.assertEqual([(r["status"], r["expected_amount"], r["has_invoice"]) for r in rows], [(STATUS_NO_PAYMENT, "2500.00", False)])
        self.assertEqual(Invoice.objects.count(), 0)  # nothing created

        # Once the real invoice exists for that period, the placeholder disappears.
        inv = make_invoice(self.alpha, self.company, "2500", D(2026, 10, 1), subscription=sub, billing_period="2026-10")
        rows = [i for d in calendar_data(2026, 10, today=TODAY)["days"] for i in d["items"]]
        self.assertEqual([r["invoice_id"] for r in rows], [inv.id])

    def test_client_history(self):
        aug = make_invoice(self.gamma, self.company, "3000", D(2026, 8, 10))
        make_invoice(self.gamma, self.company, "3000", D(2026, 9, 10))
        Payment.objects.create(invoice=aug, amount=Decimal("3000"), payment_date=D(2026, 8, 9))
        hist = client_history(self.gamma.id, months=3, end_year=2026, end_month=10)["history"]
        self.assertEqual([(h["label"], h["paid"], h["due"]) for h in hist], [("August 2026", "3000.00", "0.00"), ("September 2026", "0.00", "3000.00")])
        self.assertEqual(hist[0]["status"], STATUS_PAID)


class MatrixTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name="Raktch")
        self.alpha = Client.objects.create(name="Alpha Ltd")
        self.gamma = Client.objects.create(name="Gamma Ltd")

    def test_empty_database(self):
        m = matrix_data(D(2026, 10, 1), D(2026, 10, 31), today=TODAY)
        self.assertEqual((len(m["days"]), m["clients"], m["summary"]["total_bills"]), (31, [], 0))

    def test_columns_for_every_month_and_leap_years(self):
        def days(y, mth):
            first, last = parse_range({"year": y, "month": mth})
            return matrix_data(first, last)["days"]
        self.assertEqual([len(days(2026, m)) for m in range(1, 13)], [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])
        self.assertEqual(len(days(2024, 2)), 29)   # leap
        self.assertEqual(len(days(2025, 2)), 28)   # non-leap
        self.assertEqual(len(days(2100, 2)), 28)   # century non-leap
        oct_days = days(2026, 10)
        self.assertEqual((oct_days[0]["weekday"], oct_days[1]["weekday"], oct_days[7]["weekday"]), ("Thu", "Fri", "Thu"))

    def test_rows_cells_and_client_summary(self):
        a1 = make_invoice(self.alpha, self.company, "3000", D(2026, 10, 3))
        make_invoice(self.alpha, self.company, "1000", D(2026, 10, 20))
        g = make_invoice(self.gamma, self.company, "4000", D(2026, 10, 10))
        Payment.objects.create(invoice=a1, amount=Decimal("3000"), payment_date=D(2026, 10, 2))
        Payment.objects.create(invoice=g, amount=Decimal("1000"), payment_date=D(2026, 10, 4))
        m = matrix_data(D(2026, 10, 1), D(2026, 10, 31), today=TODAY)
        self.assertEqual([c["client_name"] for c in m["clients"]], ["Alpha Ltd", "Gamma Ltd"])
        alpha, gamma = m["clients"]
        self.assertEqual((alpha["cells"]["2026-10-03"]["status"], alpha["cells"]["2026-10-20"]["status"]), (STATUS_PAID, STATUS_UPCOMING))
        self.assertEqual(gamma["cells"]["2026-10-10"]["status"], STATUS_PARTIALLY_PAID)
        self.assertEqual(alpha["summary"], {
            "paid": 1, "due": 0, "overdue": 0, "partially_paid": 0, "upcoming": 1, "no_payment": 0,
            "expected": "4000.00", "collected": "3000.00", "outstanding": "1000.00", "collection_rate": "75.00",
        })
        self.assertEqual(alpha["monthly_amount"], "4000.00")
        self.assertEqual(m["summary"]["total_expected"], "8000.00")

    def test_two_bills_same_day_in_one_cell(self):
        make_invoice(self.alpha, self.company, "1000", D(2026, 10, 10), title="Hosting")
        make_invoice(self.alpha, self.company, "500", D(2026, 10, 10), title="Domain")
        cell = matrix_data(D(2026, 10, 1), D(2026, 10, 31), today=TODAY)["clients"][0]["cells"]["2026-10-10"]
        self.assertEqual((cell["count"], len(cell["items"])), (2, 2))

    def test_date_range_search_and_status_filters(self):
        make_invoice(self.alpha, self.company, "1000", D(2026, 10, 3))
        make_invoice(self.gamma, self.company, "2000", D(2026, 10, 20))
        r = lambda **kw: [c["client_name"] for c in matrix_data(kw.pop("first", D(2026, 10, 1)), kw.pop("last", D(2026, 10, 31)), today=TODAY, **kw)["clients"]]
        self.assertEqual(r(), ["Alpha Ltd", "Gamma Ltd"])
        self.assertEqual(r(first=D(2026, 10, 10)), ["Gamma Ltd"])                   # start date
        self.assertEqual(r(last=D(2026, 10, 10)), ["Alpha Ltd"])                    # end date
        self.assertEqual(r(search="gam"), ["Gamma Ltd"])                            # name search
        self.assertEqual(r(client_id=self.alpha.id), ["Alpha Ltd"])                 # client filter
        self.assertEqual(r(status=STATUS_OVERDUE), ["Alpha Ltd"])
        self.assertEqual(r(status=STATUS_PAID), [])

    def test_parse_range_validation(self):
        self.assertEqual(parse_range({"start_date": "2026-10-05", "end_date": "2026-10-09"}), (D(2026, 10, 5), D(2026, 10, 9)))
        for bad in ({"start_date": "nope"}, {"start_date": "2026-10-09", "end_date": "2026-10-05"},
                    {"start_date": "2026-01-01", "end_date": "2026-12-31"}, {"month": "13"}):
            with self.assertRaises(ValueError, msg=str(bad)):
                parse_range(bad)


class PaymentApiTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user("acct", password="x")
        UserProfile.objects.create(user=user, role=UserProfile.ROLE_ACCOUNTANT)
        self.api = APIClient()
        self.api.force_authenticate(user)
        company = Company.objects.create(name="Raktch")
        self.client_obj = Client.objects.create(name="Gamma Ltd")
        # Due 5 days from the real "today" so statuses are stable whenever this runs.
        self.due = timezone.localdate() + datetime.timedelta(days=5)
        self.params = {"month": self.due.month, "year": self.due.year}
        self.invoice = make_invoice(self.client_obj, company, "3000", self.due)

    def test_calendar_summary_history_status_matrix_endpoints(self):
        r = self.api.get("/api/payments/calendar/", self.params)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["summary"]["total_expected"], "3000.00")
        self.assertEqual(self.api.get("/api/payments/summary/", self.params).data["total_due"], "3000.00")
        self.assertEqual(self.api.get(f"/api/payments/client/{self.client_obj.id}/history/").status_code, 200)
        self.assertEqual(self.api.get("/api/payments/status/", {"invoice": self.invoice.id}).data["remaining_amount"], "3000.00")
        m = self.api.get("/api/payments/matrix/", {**self.params, "search": "gamma"})
        self.assertEqual(m.status_code, 200)
        self.assertEqual([c["client_name"] for c in m.data["clients"]], ["Gamma Ltd"])

    def test_bad_params_are_400_not_500(self):
        self.assertEqual(self.api.get("/api/payments/calendar/", {"month": 13}).status_code, 400)
        self.assertEqual(self.api.get("/api/payments/calendar/", {"month": "x"}).status_code, 400)
        self.assertEqual(self.api.get("/api/payments/calendar/", {"status": "BOGUS"}).status_code, 400)
        self.assertEqual(self.api.get("/api/payments/matrix/", {"start_date": "bad"}).status_code, 400)
        self.assertEqual(self.api.get("/api/payments/matrix/", {"start_date": "2026-10-09", "end_date": "2026-10-01"}).status_code, 400)
        self.assertEqual(self.api.get("/api/payments/client/9999/history/").status_code, 404)

    def test_overpayment_and_zero_rejected_on_both_endpoints(self):
        for amount in ("3000.01", "0", "-5"):
            r = self.api.post("/api/payments/", {"invoice": self.invoice.id, "amount": amount, "payment_date": self.due.isoformat()}, format="json")
            self.assertEqual(r.status_code, 400, amount)
            r = self.api.post(f"/api/invoices/{self.invoice.id}/record_payment/", {"amount": amount}, format="json")
            self.assertEqual(r.status_code, 400, amount)
        self.assertEqual(Payment.objects.count(), 0)

    def test_multiple_payments_then_matrix_updates(self):
        pay = lambda amt: self.api.post(f"/api/invoices/{self.invoice.id}/record_payment/", {"amount": amt}, format="json")
        self.assertEqual(pay("1000").status_code, 201)
        self.assertEqual(pay("500").status_code, 201)
        m = self.api.get("/api/payments/matrix/", self.params).data
        s = m["clients"][0]["summary"]
        self.assertEqual((s["partially_paid"], s["collected"], s["outstanding"]), (1, "1500.00", "1500.00"))
        self.assertEqual(pay("2000").status_code, 400)  # exceeds remaining 1500
        self.assertEqual(pay("1500").status_code, 201)
        m = self.api.get("/api/payments/matrix/", self.params).data
        self.assertEqual((m["clients"][0]["summary"]["paid"], m["summary"]["total_due"]), (1, "0.00"))


class ObligationsTests(TestCase):
    """The Payments table: filtered by BILLING month/year (never due date), one row per invoice."""

    def setUp(self):
        self.company = Company.objects.create(name="Raktch")
        self.rose = Client.objects.create(name="Rose International")
        self.abc = Client.objects.create(name="ABC Limited")
        user = get_user_model().objects.create_user("acct2", password="x")
        UserProfile.objects.create(user=user, role=UserProfile.ROLE_ACCOUNTANT)
        self.api = APIClient()
        self.api.force_authenticate(user)

    def data(self, year=2026, month=10, **kw):
        from .payment_calendar import obligations_data
        kw.setdefault("today", TODAY)
        return obligations_data(year, month, **kw)

    def rows(self, year=2026, month=10, **kw):
        return self.data(year, month, **kw)["rows"]

    def bill(self, client, amount, issue, due, billing_month="", period="", title="Hosting"):
        return make_invoice(client, self.company, amount, due, title=title, issue_date=issue,
                            billing_month=billing_month, billing_period=period)

    # ---- month filter uses the billing month ------------------------------------------

    def test_selected_month_is_the_billing_month_not_issue_or_due_date(self):
        self.bill(self.rose, "3000", D(2026, 9, 25), D(2026, 10, 10), "October 2026")      # issued Sep
        self.bill(self.abc, "5000", D(2026, 10, 28), D(2026, 11, 10), "November 2026")     # issued Oct
        self.bill(self.abc, "700", D(2026, 10, 2), D(2026, 11, 20), "October 2026", title="SSL")  # due Nov
        names = lambda **kw: sorted((r["client_name"], r["purpose"]) for r in self.rows(**kw))
        self.assertEqual(names(month=10), [("ABC Limited", "SSL"), ("Rose International", "Hosting")])
        self.assertEqual(names(month=11), [("ABC Limited", "Hosting")])
        self.assertEqual(names(month=9), [])  # Rose was only *issued* in September

    def test_year_selects_the_billing_year(self):
        self.bill(self.rose, "100", D(2025, 10, 5), D(2025, 10, 20), "October 2025")
        self.bill(self.rose, "200", D(2026, 10, 5), D(2026, 10, 20), "October 2026")
        amount = lambda y: [r["expected_amount"] for r in self.rows(year=y, month=10)]
        self.assertEqual((amount(2025), amount(2026), amount(2027)), (["100.00"], ["200.00"], []))

    def test_billing_period_beats_typed_text_and_blank_falls_back_to_issue_month(self):
        from .payment_calendar import billing_ym
        self.assertEqual(billing_ym("2026-10", "April-2026", D(2026, 9, 1)), (2026, 10))   # period wins
        self.assertEqual(billing_ym("", "april 2026", D(2026, 10, 8)), (2026, 4))
        self.assertEqual(billing_ym("", "October", D(2026, 9, 25)), (2026, 10))            # year from issue
        self.assertEqual(billing_ym("", "January", D(2026, 12, 28)), (2027, 1))            # issued Dec, billed Jan
        self.assertEqual(billing_ym("", "Marketing", D(2026, 10, 11)), (2026, 10))         # not a month name
        self.assertEqual(billing_ym("", "", D(2026, 10, 11)), (2026, 10))                  # blank -> issue month
        self.assertEqual(billing_ym("May-2026", "", D(2026, 10, 11)), (2026, 5))

    def test_summary_cards_follow_the_selected_billing_period(self):
        paid = self.bill(self.rose, "3000", D(2026, 9, 25), D(2026, 10, 10), "October 2026")
        Payment.objects.create(invoice=paid, amount=Decimal("1000"), payment_date=D(2026, 10, 1))
        self.bill(self.abc, "500", D(2026, 10, 1), D(2026, 10, 3), "October 2026")        # overdue
        self.bill(self.abc, "9000", D(2026, 10, 28), D(2026, 11, 10), "November 2026")
        s = lambda m: self.data(month=m)["summary"]
        self.assertEqual((s(10)["total_expected"], s(10)["total_collected"], s(10)["total_due"], s(10)["counts"]["OVERDUE"]),
                         ("3500.00", "1000.00", "2500.00", 1))
        self.assertEqual((s(11)["total_expected"], s(11)["total_collected"], s(11)["total_due"]), ("9000.00", "0.00", "9000.00"))
        self.assertEqual(s(12)["total_bills"], 0)

    # ---- issue date column / due date still drives the status ----------------------------

    def test_row_carries_issue_date_and_status_uses_the_due_date(self):
        # Billed for October, issued Sep 25, due Sep 30 -> already overdue on Oct 5.
        self.bill(self.rose, "3000", D(2026, 9, 25), D(2026, 9, 30), "October 2026")
        (row,) = self.rows(month=10)
        self.assertEqual((row["issue_date"], row["due_date"], row["status"]), ("2026-09-25", "2026-09-30", STATUS_OVERDUE))
        # Same invoice: before its due date it is Upcoming, so the status follows the due date.
        (earlier,) = self.rows(month=10, today=D(2026, 9, 28))
        self.assertEqual(earlier["status"], STATUS_UPCOMING)

    def test_issue_date_range_narrows_within_the_billing_month(self):
        self.bill(self.rose, "100", D(2026, 9, 25), D(2026, 10, 10), "October 2026")
        self.bill(self.abc, "200", D(2026, 10, 15), D(2026, 10, 25), "October 2026")
        who = lambda **kw: [r["client_name"] for r in self.rows(month=10, **kw)]
        self.assertEqual(who(), ["Rose International", "ABC Limited"])
        self.assertEqual(who(issue_from=D(2026, 10, 1)), ["ABC Limited"])
        self.assertEqual(who(issue_to=D(2026, 9, 30)), ["Rose International"])

    # ---- unchanged behaviour: purpose, rows, statuses, search -----------------------------

    def test_purpose_comes_from_invoice_item_and_billing_month_is_readable(self):
        self.bill(self.rose, "3000", D(2026, 10, 10), D(2026, 10, 10), "October-2026", title="1. Website Maintenance (October-2026)")
        (row,) = self.rows()
        self.assertEqual((row["purpose"], row["billing_month"]), ("Website Maintenance", "October 2026"))

    def test_hand_typed_month_suffixes_and_billing_months_are_normalised(self):
        issue = D(2026, 10, 10)
        cases = [  # title, billing_month, billing_period, purpose, label, (year, month)
            ("Supershop Software (april 2026)", "april 2026", "", "Supershop Software", "April 2026", (2026, 4)),
            ("Supershop Software (October)", "October", "", "Supershop Software", "October 2026", (2026, 10)),
            ("Support (Premium)", "April-2026", "", "Support (Premium)", "April 2026", (2026, 4)),
            ("Marketing (Marketing)", "Marketing", "", "Marketing (Marketing)", "October 2026", (2026, 10)),
            ("Hosting", "whatever", "2026-10", "Hosting", "October 2026", (2026, 10)),
            ("Domain", "", "", "Domain", "October 2026", (2026, 10)),
        ]
        for title, billing_month, period, *_ in cases:
            self.bill(self.rose, "100", issue, issue, billing_month, period, title=title)
        for _t, _bm, _p, purpose, label, (y, m) in cases:
            got = [(r["purpose"], r["billing_month"]) for r in self.rows(year=y, month=m)]
            self.assertIn((purpose, label), got, f"{purpose} not found in {y}-{m}: {got}")

    def test_each_invoice_is_its_own_row_with_one_status(self):
        self.bill(self.rose, "3000", D(2026, 10, 10), D(2026, 10, 10), title="Website Maintenance")
        paid = self.bill(self.rose, "2000", D(2026, 10, 3), D(2026, 10, 3), title="Hosting & Domain Renewal")
        Payment.objects.create(invoice=paid, amount=Decimal("2000"), payment_date=D(2026, 10, 1))
        rows = self.rows()
        self.assertEqual([(r["client_name"], r["purpose"], r["status"]) for r in rows], [
            ("Rose International", "Hosting & Domain Renewal", STATUS_PAID),
            ("Rose International", "Website Maintenance", STATUS_UPCOMING),
        ])

    def test_partial_past_due_is_overdue_with_balance(self):
        inv = self.bill(self.abc, "5000", D(2026, 10, 3), D(2026, 10, 3))
        Payment.objects.create(invoice=inv, amount=Decimal("1000"), payment_date=D(2026, 10, 1))
        (row,) = self.rows()
        self.assertEqual((row["status"], row["remaining_amount"]), (STATUS_OVERDUE, "4000.00"))

    def test_search_company_invoice_number_and_purpose(self):
        a = self.bill(self.rose, "3000", D(2026, 10, 10), D(2026, 10, 10), title="Website Maintenance")
        self.bill(self.abc, "5000", D(2026, 10, 15), D(2026, 10, 15), title="Software Development")
        names = lambda **kw: [r["client_name"] for r in self.rows(**kw)]
        self.assertEqual(names(search="rose"), ["Rose International"])
        self.assertEqual(names(search=a.invoice_number), ["Rose International"])
        self.assertEqual(names(search="software dev"), ["ABC Limited"])
        self.assertEqual(names(search="nothing-matches"), [])

    def test_status_filter_and_unbilled_subscriptions_are_not_rows(self):
        svc = Service.objects.create(name="Support", default_price=Decimal("2500"))
        Subscription.objects.create(client=self.rose, service=svc, start_date=D(2026, 1, 1))
        self.assertEqual(self.rows(), [])
        self.bill(self.rose, "100", D(2026, 10, 3), D(2026, 10, 3))
        self.assertEqual(len(self.rows(status=STATUS_OVERDUE)), 1)
        self.assertEqual(self.rows(status=STATUS_PAID), [])

    def test_endpoint_billing_month_issue_range_and_validation(self):
        self.bill(self.rose, "3000", D(2026, 9, 25), D(2026, 10, 10), "October 2026")
        self.bill(self.abc, "5000", D(2026, 10, 28), D(2026, 11, 10), "November 2026")
        get = lambda **p: self.api.get("/api/payments/obligations/", p)
        oct_ = get(month=10, year=2026)
        self.assertEqual([r["client_name"] for r in oct_.data["rows"]], ["Rose International"])
        self.assertEqual(oct_.data["summary"]["total_expected"], "3000.00")
        self.assertEqual([r["client_name"] for r in get(month=11, year=2026).data["rows"]], ["ABC Limited"])
        self.assertEqual(len(get(month=10, year=2026, start_date="2026-10-01").data["rows"]), 0)  # issued Sep 25
        self.assertEqual(len(get(month=10, year=2026, end_date="2026-09-30").data["rows"]), 1)
        for bad in ({"month": 13}, {"month": "x"}, {"year": "abc"}, {"month": 5, "status": "BOGUS"},
                    {"month": 5, "start_date": "nope"}, {"month": 5, "start_date": "2026-05-09", "end_date": "2026-05-01"}):
            self.assertEqual(get(**bad).status_code, 400, bad)
