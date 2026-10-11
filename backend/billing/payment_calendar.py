"""
Monthly payment tracking logic (client x date matrix + month summaries).

The database is the source of truth: every figure here is derived from
Invoice (payable / advance / paid / due) and Payment rows. No new tables are
used and nothing is ever written - invoices are never created by viewing
the calendar. The frontend only renders what these functions return.

Status rule (single place, reused everywhere) -> `payment_status()`.
"""
import calendar
import datetime
import re
from collections import defaultdict
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone

from .models import Client, Invoice, Settings, Subscription
from .services import get_effective_billing_date

ZERO = Decimal("0.00")

STATUS_PAID = "PAID"
STATUS_PARTIALLY_PAID = "PARTIALLY_PAID"
STATUS_DUE = "DUE"
STATUS_OVERDUE = "OVERDUE"
STATUS_UPCOMING = "UPCOMING"
STATUS_NO_PAYMENT = "NO_PAYMENT"

VALID_STATUSES = {
    STATUS_PAID, STATUS_PARTIALLY_PAID, STATUS_DUE,
    STATUS_OVERDUE, STATUS_UPCOMING, STATUS_NO_PAYMENT,
}

# When several bills share a cell/month, show the one needing most attention.
ATTENTION_ORDER = [
    STATUS_OVERDUE, STATUS_DUE, STATUS_PARTIALLY_PAID,
    STATUS_NO_PAYMENT, STATUS_UPCOMING, STATUS_PAID,
]

MAX_RANGE_DAYS = 62


def payment_status(expected, paid, due_date, today=None, has_bill=True):
    """
    The one status rule used by the matrix, summaries and client history.

    - no bill exists for the period          -> NO_PAYMENT
    - paid >= expected                       -> PAID
    - unpaid balance and today > due date    -> OVERDUE
        (even if partly paid: the partial amounts stay visible in the row)
    - 0 < paid < expected, not yet overdue   -> PARTIALLY_PAID
    - unpaid, today == due date              -> DUE
    - unpaid, today < due date               -> UPCOMING
    """
    if not has_bill:
        return STATUS_NO_PAYMENT
    today = today or timezone.localdate()
    expected = Decimal(expected or 0)
    paid = Decimal(paid or 0)
    if paid >= expected:
        return STATUS_PAID
    if today > due_date:
        return STATUS_OVERDUE
    if paid > 0:
        return STATUS_PARTIALLY_PAID
    if today == due_date:
        return STATUS_DUE
    return STATUS_UPCOMING


def _money(value):
    return str(Decimal(value or 0).quantize(Decimal("0.01")))


def _month_bounds(year, month):
    last = calendar.monthrange(year, month)[1]
    return datetime.date(year, month, 1), datetime.date(year, month, last)


def _months_between(first, last):
    y, m = first.year, first.month
    while (y, m) <= (last.year, last.month):
        yield y, m
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


def _worst(statuses):
    return next(s for s in ATTENTION_ORDER if s in statuses)


# Trailing "(April-2026)", "(april 2026)" or "(October)": only real month names, so a
# purpose such as "Hosting (Premium)" is left untouched.
_MONTH_WORDS = (
    "january|february|march|april|may|june|july|august|september|october|november|december|"
    "jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec"
)  # whole names or exact abbreviations only ("Marketing" is not March)
_MONTH_SUFFIX = re.compile(rf"\s*\((?:{_MONTH_WORDS})(?:[\s-]+\d{{4}})?\)\s*$", re.IGNORECASE)
_LIST_PREFIX = re.compile(r"^\s*\d+\.\s*")
_BILLING_MONTH = re.compile(rf"^\s*({_MONTH_WORDS})[\s-]*(\d{{4}})?\s*$", re.IGNORECASE)
_MONTH_BY_NAME = {name.lower()[:3]: i for i, name in enumerate(calendar.month_name) if name}


def _purpose(inv):
    """
    What the payment is for, taken from the invoice's own line items:
    the item name (minus a trailing "(Month-Year)" and list numbering),
    else the linked service name, else the invoice title.
    """
    names = []
    for item in inv.items.all():
        name = _MONTH_SUFFIX.sub("", _LIST_PREFIX.sub("", item.item_name or "")).strip()
        if not name and item.service_id and item.service:
            name = item.service.name
        if name and name not in names:
            names.append(name)
    return ", ".join(names) or inv.title


def billing_ym(billing_period, billing_month, issue_date):
    """
    The (year, month) an invoice is billed for. Never uses the due date.

    1. billing_period "YYYY-MM" (set by recurring billing), or "May-2026" style.
    2. else the typed billing_month ("April-2026", "april 2026", "October").
       A missing year is taken from the issue date; a month more than six
       months behind the issue month is read as next year (issued Dec,
       billed "January").
    3. else (blank / unreadable) the issue date's own month, so such
       invoices stay visible instead of disappearing.
    """
    m = re.match(r"^\s*(\d{4})-(\d{1,2})\s*$", billing_period or "")
    if m and 1 <= int(m.group(2)) <= 12:
        return int(m.group(1)), int(m.group(2))
    for text in (billing_period, billing_month):
        m = _BILLING_MONTH.match(text or "")
        if m:
            month = _MONTH_BY_NAME[m.group(1).lower()[:3]]
            if m.group(2):
                year = int(m.group(2))
            else:
                year = issue_date.year + (1 if month + 6 < issue_date.month else 0)
            return year, month
    return issue_date.year, issue_date.month


def _billing_label(inv):
    """'October 2026' for an invoice's resolved billing period."""
    y, m = billing_ym(inv.billing_period, inv.billing_month, inv.issue_date)
    return f"{calendar.month_name[m]} {y}"


def _invoice_row(inv, today):
    """Serialize one invoice as a payment obligation row."""
    due_date = inv.due_date or inv.issue_date
    expected = inv.payable_amount
    paid = (inv.advance_amount or ZERO) + (inv.paid_amount or ZERO)
    remaining = inv.due_amount
    payments = sorted(inv.payments.all(), key=lambda p: (p.payment_date, p.id))
    last = payments[-1] if payments else None
    return {
        "key": f"inv-{inv.id}",
        "has_invoice": True,
        "invoice_id": inv.id,
        "invoice_number": inv.invoice_number,
        "invoice_status": inv.status,
        "client_id": inv.client_id,
        "client_name": inv.client_name or inv.client.name,
        "title": inv.title,
        "purpose": _purpose(inv),
        "billing_month": _billing_label(inv),
        "currency_symbol": inv.currency_symbol,
        "issue_date": inv.issue_date.isoformat(),
        "due_date": due_date.isoformat(),
        "expected_amount": _money(expected),
        "paid_amount": _money(paid),
        "remaining_amount": _money(remaining),
        "is_partial": 0 < paid < expected,
        "status": payment_status(expected, paid, due_date, today),
        "payment_id": last.id if last else None,
        "payment_date": last.payment_date.isoformat() if last else None,
        "payment_method": last.payment_method.name if last and last.payment_method else None,
        "transaction_id": last.transaction_id if last else None,
        "payment_count": len(payments),
        "payments": [
            {
                "id": p.id,
                "receipt_number": p.receipt_number,
                "amount": _money(p.amount),
                "payment_date": p.payment_date.isoformat(),
                "payment_method": p.payment_method.name if p.payment_method else None,
                "transaction_id": p.transaction_id,
                "note": p.note,
            }
            for p in payments
        ],
    }


def _virtual_rows(year, month, client_filter):
    """
    Active monthly subscriptions that have no invoice yet for this month.
    Nothing is written to the database - these rows exist only in the
    response, so they can never create duplicate bills.
    """
    first, last = _month_bounds(year, month)
    settings_obj = Settings.objects.first()
    billing_day = settings_obj.auto_billing_day if settings_obj else 1
    currency = settings_obj.currency_symbol if settings_obj else "Tk"

    subs = (
        Subscription.objects.filter(
            is_active=True,
            billing_cycle=Subscription.CYCLE_MONTHLY,
            client__is_active=True,
            start_date__lte=last,
        )
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=first))
        .select_related("client", "service")
    )
    if client_filter is not None:
        subs = subs.filter(client_filter("client"))

    period_keys = {f"{year}-{month:02d}", f"{calendar.month_name[month]}-{year}"}
    billed = set(
        Invoice.objects.filter(subscription__in=subs, billing_period__in=period_keys)
        .exclude(status="CANCELLED")
        .values_list("subscription_id", flat=True)
    )

    due_date = get_effective_billing_date(year, month, billing_day)
    rows = []
    for sub in subs:
        if sub.pk in billed:
            continue
        expected = sub.effective_price
        rows.append({
            "key": f"sub-{sub.pk}-{year}-{month}",
            "has_invoice": False,
            "invoice_id": None,
            "invoice_number": None,
            "invoice_status": None,
            "client_id": sub.client_id,
            "client_name": sub.client.name,
            "title": f"{sub.effective_name} ({calendar.month_name[month]}-{year})",
            "purpose": sub.effective_name,
            "billing_month": f"{calendar.month_name[month]} {year}",
            "currency_symbol": currency,
            "issue_date": None,
            "due_date": due_date.isoformat(),
            "expected_amount": _money(expected),
            "paid_amount": _money(ZERO),
            "remaining_amount": _money(expected),
            "is_partial": False,
            "status": STATUS_NO_PAYMENT,
            "payment_id": None,
            "payment_date": None,
            "payment_method": None,
            "transaction_id": None,
            "payment_count": 0,
            "payments": [],
        })
    return rows


def _client_q(search=None, client_id=None):
    """Returns a function prefix -> Q for the client filters (or None)."""
    search = (search or "").strip()
    if not search and not client_id:
        return None

    def build(prefix):
        q = Q()
        if client_id:
            q &= Q(**{f"{prefix}_id": client_id})
        if search:
            s = Q(**{f"{prefix}__name__icontains": search})
            if search.isdigit():
                s |= Q(**{f"{prefix}_id": int(search)})
            q &= s
        return q

    return build


def _invoice_search_q(search):
    """Company name, invoice number, title, or purpose (item / service name)."""
    return (
        Q(client__name__icontains=search)
        | Q(invoice_number__icontains=search)
        | Q(title__icontains=search)
        | Q(items__item_name__icontains=search)
        | Q(items__service__name__icontains=search)
    )


def _apply_invoice_filters(qs, search, client_id, method_id):
    """Company / invoice number / purpose search, client and payment-method filters."""
    if client_id:
        qs = qs.filter(client_id=client_id)
    if search:
        qs = qs.filter(_invoice_search_q(search)).distinct()
    if method_id:
        qs = qs.filter(payments__payment_method_id=method_id).distinct()
    return qs


def billing_period_rows(year, month, issue_from=None, issue_to=None, search=None, client_id=None,
                        status=None, method_id=None, today=None):
    """
    Invoices BILLED for (year, month) - see billing_ym(); the due date plays no part
    in choosing the month. Optional issue_from/issue_to narrow by issue date.
    Each row's status is still computed from its own balance and due date.
    """
    today = today or timezone.localdate()
    ids = [
        pk
        for pk, period, typed, issued in (
            Invoice.objects.exclude(status="CANCELLED")
            .values_list("id", "billing_period", "billing_month", "issue_date")
        )
        if billing_ym(period, typed, issued) == (year, month)
    ]
    qs = (
        Invoice.objects.filter(id__in=ids)
        .select_related("client")
        .prefetch_related("payments__payment_method", "items__service")
    )
    if issue_from:
        qs = qs.filter(issue_date__gte=issue_from)
    if issue_to:
        qs = qs.filter(issue_date__lte=issue_to)
    qs = _apply_invoice_filters(qs, (search or "").strip(), client_id, method_id)

    rows = [_invoice_row(inv, today) for inv in qs]
    if status:
        rows = [r for r in rows if r["status"] == status]
    rows.sort(key=lambda r: (r["issue_date"], r["client_name"].lower(), r["invoice_number"]))
    return rows


def rows_between(first, last, search=None, client_id=None, status=None, method_id=None, today=None,
                 include_unbilled=True):
    """
    All obligations whose (effective) due date is in [first, last], filtered.
    include_unbilled=False returns real invoices only (no subscription placeholders).
    """
    today = today or timezone.localdate()
    search = (search or "").strip()
    client_filter = _client_q(search, client_id)  # used for the unbilled placeholders

    qs = (
        Invoice.objects.exclude(status="CANCELLED")
        .filter(
            Q(due_date__range=(first, last))
            | Q(due_date__isnull=True, issue_date__range=(first, last))
        )
        .select_related("client")
        .prefetch_related("payments__payment_method", "items__service")
    )
    qs = _apply_invoice_filters(qs, search, client_id, method_id)

    rows = [_invoice_row(inv, today) for inv in qs]
    # Virtual "no bill yet" rows have no payments, so a method filter excludes them.
    if include_unbilled and not method_id:
        iso_first, iso_last = first.isoformat(), last.isoformat()
        for y, m in _months_between(first, last):
            rows += [r for r in _virtual_rows(y, m, client_filter) if iso_first <= r["due_date"] <= iso_last]

    if status:
        rows = [r for r in rows if r["status"] == status]
    rows.sort(key=lambda r: (r["due_date"], r["client_name"].lower()))
    return rows


def month_rows(year, month, client_id=None, status=None, method_id=None, today=None, search=None):
    first, last = _month_bounds(year, month)
    return rows_between(first, last, search=search, client_id=client_id, status=status, method_id=method_id, today=today)


def _totals(rows):
    expected = sum((Decimal(r["expected_amount"]) for r in rows), ZERO)
    collected = sum((Decimal(r["paid_amount"]) for r in rows), ZERO)
    outstanding = sum((Decimal(r["remaining_amount"]) for r in rows), ZERO)
    return expected, collected, outstanding


def summarize(rows):
    """Aggregate summary cards from rows (the same rows the views show)."""
    expected, collected, outstanding = _totals(rows)
    by_status = defaultdict(set)
    counts = defaultdict(int)
    for r in rows:
        by_status[r["status"]].add(r["client_id"])
        counts[r["status"]] += 1
    return {
        "total_expected": _money(expected),
        "total_collected": _money(collected),
        "total_due": _money(outstanding),
        "paid_clients": len(by_status[STATUS_PAID]),
        "due_clients": len(by_status[STATUS_DUE] | by_status[STATUS_UPCOMING] | by_status[STATUS_PARTIALLY_PAID]),
        "overdue_clients": len(by_status[STATUS_OVERDUE]),
        "no_payment_clients": len(by_status[STATUS_NO_PAYMENT]),
        "total_bills": len(rows),
        # Invoice counts per status, each bill counted once.
        "counts": {s: counts[s] for s in VALID_STATUSES},
    }


def calendar_data(year, month, **filters):
    """Month grid payload: per-day aggregates plus the rows behind them."""
    rows = month_rows(year, month, **filters)
    days = {}
    for r in rows:
        d = days.setdefault(r["due_date"], {
            "date": r["due_date"], "count": 0, "expected": ZERO, "collected": ZERO,
            "status_counts": defaultdict(int), "items": [],
        })
        d["count"] += 1
        d["expected"] += Decimal(r["expected_amount"])
        d["collected"] += Decimal(r["paid_amount"])
        d["status_counts"][r["status"]] += 1
        d["items"].append(r)
    day_list = [
        {
            "date": d["date"],
            "count": d["count"],
            "expected": _money(d["expected"]),
            "collected": _money(d["collected"]),
            "due": _money(max(d["expected"] - d["collected"], ZERO)),
            "status_counts": dict(d["status_counts"]),
            "items": d["items"],
        }
        for d in days.values()
    ]
    day_list.sort(key=lambda d: d["date"])
    return {
        "year": year,
        "month": month,
        "today": (filters.get("today") or timezone.localdate()).isoformat(),
        "summary": summarize(rows),
        "days": day_list,
    }


def matrix_data(first, last, **filters):
    """
    Client x date matrix. One row per client that has at least one bill in
    the range; cells are keyed by due date. Each client also gets a summary.
    """
    today = filters.get("today") or timezone.localdate()
    rows = rows_between(first, last, **filters)

    by_client = {}
    for r in rows:
        by_client.setdefault(r["client_id"], []).append(r)

    clients = []
    for cid, items in by_client.items():
        cells = {}
        for it in items:
            cells.setdefault(it["due_date"], []).append(it)
        expected, collected, outstanding = _totals(items)
        counts = defaultdict(int)
        for it in items:
            counts[it["status"]] += 1
        clients.append({
            "client_id": cid,
            "client_name": items[0]["client_name"],
            "monthly_amount": _money(expected),
            "cells": {
                d: {
                    "status": _worst({i["status"] for i in cell}),
                    "count": len(cell),
                    "items": cell,
                }
                for d, cell in cells.items()
            },
            "summary": {
                "paid": counts[STATUS_PAID],
                "due": counts[STATUS_DUE],
                "overdue": counts[STATUS_OVERDUE],
                "partially_paid": counts[STATUS_PARTIALLY_PAID],
                "upcoming": counts[STATUS_UPCOMING],
                "no_payment": counts[STATUS_NO_PAYMENT],
                "expected": _money(expected),
                "collected": _money(collected),
                "outstanding": _money(outstanding),
                "collection_rate": _money(collected / expected * 100) if expected else "0.00",
            },
        })
    clients.sort(key=lambda c: c["client_name"].lower())

    days = []
    d = first
    while d <= last:
        days.append({"date": d.isoformat(), "day": d.day, "weekday": d.strftime("%a")})
        d += datetime.timedelta(days=1)

    return {
        "start_date": first.isoformat(),
        "end_date": last.isoformat(),
        "today": today.isoformat(),
        "days": days,
        "summary": summarize(rows),
        "clients": clients,
    }


def client_history(client_id, months=12, end_year=None, end_month=None):
    """Month-by-month expected/paid/due for one client, oldest first."""
    today = timezone.localdate()
    end_year = end_year or today.year
    end_month = end_month or today.month
    out = []
    for i in range(months - 1, -1, -1):
        total = end_year * 12 + (end_month - 1) - i
        y, m = total // 12, total % 12 + 1
        rows = month_rows(y, m, client_id=client_id, today=today)
        if not rows:
            continue
        expected, collected, outstanding = _totals(rows)
        out.append({
            "year": y,
            "month": m,
            "label": f"{calendar.month_name[m]} {y}",
            "expected": _money(expected),
            "paid": _money(collected),
            "due": _money(outstanding),
            "status": _worst({r["status"] for r in rows}),
            "bills": rows,
        })
    client = Client.objects.filter(pk=client_id).first()
    return {
        "client_id": client_id,
        "client_name": client.name if client else "",
        "history": out,
    }


def parse_month_year(params):
    """Validated (year, month) from query params; defaults to the current month."""
    today = timezone.localdate()
    try:
        year = int(params.get("year") or today.year)
        month = int(params.get("month") or today.month)
    except (TypeError, ValueError):
        raise ValueError("month and year must be integers")
    if not (1 <= month <= 12) or not (1970 <= year <= 2200):
        raise ValueError("month must be 1-12 and year 1970-2200")
    return year, month


def parse_issue_range(params):
    """Optional issue-date bounds (start_date / end_date, YYYY-MM-DD) -> (from, to)."""
    try:
        start, end = params.get("start_date"), params.get("end_date")
        issue_from = datetime.date.fromisoformat(start) if start else None
        issue_to = datetime.date.fromisoformat(end) if end else None
    except ValueError:
        raise ValueError("start_date and end_date must be YYYY-MM-DD")
    if issue_from and issue_to and issue_from > issue_to:
        raise ValueError("start_date must not be after end_date")
    return issue_from, issue_to


def parse_range(params, max_days=MAX_RANGE_DAYS):
    """
    (first, last) dates. start_date/end_date win if given (a missing end
    falls back to the selected month's bounds); otherwise the whole month.
    """
    year, month = parse_month_year(params)
    first, last = _month_bounds(year, month)
    start, end = params.get("start_date"), params.get("end_date")
    try:
        if start:
            first = datetime.date.fromisoformat(start)
        if end:
            last = datetime.date.fromisoformat(end)
    except ValueError:
        raise ValueError("start_date and end_date must be YYYY-MM-DD")
    if first > last:
        raise ValueError("start_date must not be after end_date")
    if (last - first).days + 1 > max_days:
        raise ValueError(f"date range cannot exceed {max_days} days")
    return first, last


def obligations_data(year, month, issue_from=None, issue_to=None, **filters):
    """
    Flat list for the Payments table: one row per real invoice BILLED for
    (year, month), each with exactly one status, plus the summary figures
    for that same set of rows. Subscription placeholders are not included.
    """
    today = filters.get("today") or timezone.localdate()
    rows = billing_period_rows(year, month, issue_from=issue_from, issue_to=issue_to, **filters)
    return {
        "year": year,
        "month": month,
        "today": today.isoformat(),
        "summary": summarize(rows),
        "rows": rows,
    }
