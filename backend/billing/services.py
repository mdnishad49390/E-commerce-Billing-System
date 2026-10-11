import calendar
import datetime
import logging
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from django.db import IntegrityError, models, transaction
from django.utils import timezone

from .audit import record_audit_log
from .models import (
    AuditLog,
    BankAccount,
    Client,
    ClientServicePrice,
    Company,
    Invoice,
    InvoiceItem,
    InvoiceTemplate,
    RecurringRun,
    Service,
    Settings,
    Subscription,
)

logger = logging.getLogger(__name__)

MONTH_NAMES_MAP = {
    name.lower(): idx for idx, name in enumerate(calendar.month_name) if name
}


def parse_period(period_input=None, tz_name="Asia/Dhaka"):
    """
    Parses various period formats ('May-2026', '2026-05', '2026-5', date) into:
    (year: int, month: int, period_key: 'YYYY-MM', display_month: 'Month-YYYY')
    """
    if not period_input:
        try:
            tz = ZoneInfo(tz_name)
            now_dt = timezone.now().astimezone(tz)
        except Exception:
            now_dt = timezone.localtime()
        y, m = now_dt.year, now_dt.month
        return y, m, f"{y}-{m:02d}", f"{calendar.month_name[m]}-{y}"

    if isinstance(period_input, (datetime.date, datetime.datetime)):
        y, m = period_input.year, period_input.month
        return y, m, f"{y}-{m:02d}", f"{calendar.month_name[m]}-{y}"

    p_str = str(period_input).strip()
    if "-" in p_str:
        parts = p_str.split("-")
        part0, part1 = parts[0].strip(), parts[1].strip()

        # Check '2026-05' (year-month)
        if part0.isdigit() and len(part0) == 4 and part1.isdigit():
            y = int(part0)
            m = int(part1)
            if 1 <= m <= 12:
                return y, m, f"{y}-{m:02d}", f"{calendar.month_name[m]}-{y}"

        # Check 'May-2026' (monthname-year)
        if part0.lower() in MONTH_NAMES_MAP and part1.isdigit():
            m = MONTH_NAMES_MAP[part0.lower()]
            y = int(part1)
            return y, m, f"{y}-{m:02d}", f"{calendar.month_name[m]}-{y}"

        # Check '2026-May' (year-monthname)
        if part1.lower() in MONTH_NAMES_MAP and part0.isdigit():
            m = MONTH_NAMES_MAP[part1.lower()]
            y = int(part0)
            return y, m, f"{y}-{m:02d}", f"{calendar.month_name[m]}-{y}"

    # Fallback to current
    now_dt = timezone.localtime()
    y, m = now_dt.year, now_dt.month
    return y, m, f"{y}-{m:02d}", f"{calendar.month_name[m]}-{y}"


def get_effective_billing_date(year: int, month: int, target_day: int) -> datetime.date:
    """
    Handles months with fewer days (e.g. day 31 in Feb -> Feb 28 or 29).
    """
    max_days = calendar.monthrange(year, month)[1]
    day = min(max(target_day, 1), max_days)
    return datetime.date(year, month, day)


def get_catch_up_periods(target_year: int, target_month: int, max_periods: int = 3):
    """
    Returns up to `max_periods` (year, month) tuples ending at (target_year, target_month)
    in chronological order.
    """
    periods = []
    for i in range(max_periods - 1, -1, -1):
        total_months = target_year * 12 + (target_month - 1) - i
        y = total_months // 12
        m = (total_months % 12) + 1
        periods.append((y, m))
    return periods


def is_subscription_due(subscription: Subscription, year: int, month: int, billing_day: int):
    """
    Evaluates whether a subscription is active and due for billing in a given (year, month).
    Returns (is_due: bool, reason: str)
    """
    if not subscription.is_active:
        return False, "Subscription is inactive"

    if not subscription.client.is_active:
        return False, "Client is inactive"

    billing_date = get_effective_billing_date(year, month, billing_day)

    # Start date boundary check
    if billing_date < subscription.start_date:
        return False, f"Start date ({subscription.start_date}) is after billing date ({billing_date})"

    # End date boundary check
    if subscription.end_date and billing_date > subscription.end_date:
        return False, f"Subscription expired on {subscription.end_date}"

    # Cycle evaluation
    cycle = subscription.billing_cycle
    start_y = subscription.start_date.year
    start_m = subscription.start_date.month

    if cycle == Subscription.CYCLE_MONTHLY:
        return True, "Monthly cycle active"

    if cycle == Subscription.CYCLE_QUARTERLY:
        month_diff = (year - start_y) * 12 + (month - start_m)
        if month_diff >= 0 and month_diff % 3 == 0:
            return True, "Quarterly cycle due"
        return False, "Not due this quarter"

    if cycle == Subscription.CYCLE_YEARLY:
        if month == start_m and year >= start_y:
            return True, "Yearly cycle due"
        return False, "Not due this year"

    return False, f"Unsupported cycle {cycle}"


class RecurringBillingService:
    """
    Central, idempotent service for generating recurring invoices, previewing upcoming runs,
    handling missed catch-up periods, and broadcasting email & audit notifications.
    """

    @classmethod
    def sync_client_service_prices(cls):
        """
        Ensures all legacy ClientServicePrice records have a corresponding active Subscription.
        """
        for csp in ClientServicePrice.objects.select_related("client", "service"):
            cycle = csp.service.billing_cycle if csp.service and csp.service.billing_cycle in ["MONTHLY", "QUARTERLY", "YEARLY"] else "MONTHLY"
            Subscription.objects.get_or_create(
                client=csp.client,
                service=csp.service,
                defaults={
                    "custom_name": csp.custom_name,
                    "custom_tech_specification": csp.custom_tech_specification,
                    "custom_price": csp.custom_price,
                    "billing_cycle": cycle,
                    "is_active": csp.is_active,
                }
            )

    @classmethod
    def generate_single_invoice(
        cls,
        subscription: Subscription,
        year: int,
        month: int,
        trigger: str = "AUTO",
        dry_run: bool = False,
        request=None,
        company=None,
        bank_account=None,
        template=None,
        billing_day: int = 1,
    ):
        """
        Idempotently generates an invoice for one subscription and period inside an isolated transaction.
        Returns: (invoice_or_dict, error_or_reason, result_code: 'CREATED'|'SKIPPED'|'FAILED')
        """
        period_key = f"{year}-{month:02d}"
        display_month = f"{calendar.month_name[month]}-{year}"

        # 1. DB Idempotency Check
        existing_invoice = Invoice.objects.filter(
            subscription=subscription,
            billing_period=period_key
        ).first()

        if existing_invoice:
            return None, f"Invoice {existing_invoice.invoice_number} already exists for period {period_key}", "SKIPPED"

        # Also fallback check by client + billing_month to be 100% duplicate-safe against manual bills
        existing_client_invoice = Invoice.objects.filter(
            client=subscription.client,
            billing_month=display_month,
            subscription=subscription
        ).first()

        if existing_client_invoice:
            return None, f"Invoice {existing_client_invoice.invoice_number} already exists for client in {display_month}", "SKIPPED"

        if not company:
            company = Company.objects.filter(is_default=True).first() or Company.objects.first()
        if not bank_account:
            bank_account = BankAccount.objects.filter(is_default=True, is_active=True).first() or BankAccount.objects.first()
        if not template:
            template = InvoiceTemplate.objects.filter(is_default=True).first() or InvoiceTemplate.objects.first()

        if not company:
            return None, "Default company profile not configured.", "FAILED"

        issue_date = get_effective_billing_date(year, month, billing_day)
        service_name = subscription.effective_name
        title = (
            f"{service_name} Monthly Bill ({display_month})"
            if subscription.billing_cycle == Subscription.CYCLE_MONTHLY
            else f"{service_name} Bill ({display_month})"
        )

        if dry_run:
            return {
                "subscription_id": subscription.id,
                "client_id": subscription.client.id,
                "client_name": subscription.client.name,
                "service_name": service_name,
                "billing_period": period_key,
                "billing_month": display_month,
                "amount": float(subscription.effective_price),
                "status": subscription.auto_status,
                "billing_cycle": subscription.billing_cycle,
                "issue_date": issue_date.isoformat(),
            }, None, "CREATED"

        # 2. Isolated Atomic Transaction
        try:
            with transaction.atomic():
                invoice = Invoice.objects.create(
                    title=title,
                    billing_month=display_month,
                    billing_period=period_key,
                    subscription=subscription,
                    client=subscription.client,
                    company=company,
                    bank_account=bank_account,
                    template=template,
                    status=subscription.auto_status,
                    issue_date=issue_date,
                )

                item = InvoiceItem(
                    invoice=invoice,
                    sl=1,
                    service=subscription.service,
                    item_name=f"{service_name} ({display_month})",
                    technical_specification=subscription.effective_tech_specification,
                    quantity=Decimal("1.00"),
                    unit_price=subscription.effective_price,
                    total=subscription.effective_price,
                )
                item.save(skip_invoice_recalc=True)

                invoice.calculate_totals()
                Invoice.objects.filter(pk=invoice.pk).update(
                    sub_total=invoice.sub_total,
                    vat_amount=invoice.vat_amount,
                    payable_amount=invoice.payable_amount,
                    advance_amount=invoice.advance_amount,
                    paid_amount=invoice.paid_amount,
                    due_amount=invoice.due_amount,
                    status=invoice.status,
                )

                # Record audit log
                actor_user = request.user if request and hasattr(request, "user") and request.user.is_authenticated else None
                actor_name = "system" if trigger == "AUTO" else (actor_user.username if actor_user else "admin")

                record_audit_log(
                    AuditLog.ACTION_CREATE,
                    request=request,
                    user=actor_user,
                    username=actor_name,
                    model_name="Invoice",
                    object_id=str(invoice.pk),
                    object_repr=f"Auto-generated invoice {invoice.invoice_number} for {subscription.client.name} ({period_key})",
                    changes={
                        "subscription_id": subscription.pk,
                        "client_id": subscription.client.pk,
                        "billing_period": period_key,
                        "payable_amount": str(invoice.payable_amount),
                        "status": invoice.status,
                        "trigger": trigger,
                    },
                )

                return invoice, None, "CREATED"

        except IntegrityError as ie:
            logger.warning("Database unique constraint caught duplicate invoice for sub %s, period %s: %s", subscription.id, period_key, ie)
            return None, f"Duplicate prevented by database constraint: {ie}", "SKIPPED"
        except Exception as e:
            logger.exception("Failed to generate invoice for subscription %s: %s", subscription.id, e)
            return None, str(e), "FAILED"

    @classmethod
    def run_recurring_billing(
        cls,
        target_period=None,
        trigger: str = "AUTO",
        force: bool = False,
        catch_up: bool = True,
        request=None,
    ):
        """
        Executes recurring billing:
        - Evaluates global Settings (switch, scheduled day, timezone)
        - Synchronizes legacy data
        - Processes catch-up periods (up to last 3)
        - Logs run details into RecurringRun
        - Sends email notification to admins
        """
        settings_obj = Settings.objects.first()
        tz_name = settings_obj.auto_billing_timezone if settings_obj else "Asia/Dhaka"

        # Check global switch for automatic triggers
        if trigger == "AUTO" and not force:
            if not settings_obj or not settings_obj.auto_billing_enabled:
                return {
                    "status": "SKIPPED",
                    "message": "Automatic recurring billing is disabled in Settings.",
                    "created_count": 0,
                    "skipped_count": 0,
                    "failed_count": 0,
                }

            # Check day of month
            try:
                tz = ZoneInfo(tz_name)
                current_local_date = timezone.now().astimezone(tz).date()
            except Exception:
                current_local_date = timezone.localdate()

            max_days_this_month = calendar.monthrange(current_local_date.year, current_local_date.month)[1]
            effective_day = min(settings_obj.auto_billing_day or 1, max_days_this_month)

            if current_local_date.day != effective_day:
                return {
                    "status": "SKIPPED",
                    "message": f"Today is day {current_local_date.day}, scheduled auto-billing day is {effective_day}. Skipping.",
                    "created_count": 0,
                    "skipped_count": 0,
                    "failed_count": 0,
                }

        target_year, target_month, target_period_key, target_display_month = parse_period(target_period, tz_name=tz_name)

        cls.sync_client_service_prices()

        company = Company.objects.filter(is_default=True).first() or Company.objects.first()
        bank_account = BankAccount.objects.filter(is_default=True, is_active=True).first() or BankAccount.objects.first()
        template = InvoiceTemplate.objects.filter(is_default=True).first() or InvoiceTemplate.objects.first()

        if not company:
            err_msg = "Please configure a Company profile before generating recurring bills."
            run_rec = RecurringRun.objects.create(
                trigger=trigger,
                target_period=target_period_key,
                status=RecurringRun.STATUS_FAILED,
                error_message=err_msg,
            )
            cls.send_run_notification(run_rec)
            return {
                "status": "FAILED",
                "message": err_msg,
                "created_count": 0,
                "skipped_count": 0,
                "failed_count": 1,
            }

        billing_day = settings_obj.auto_billing_day if settings_obj else 1

        # Determine periods to process (catch-up past up to 3 periods, or single target period)
        if catch_up:
            candidate_periods = get_catch_up_periods(target_year, target_month, max_periods=3)
        else:
            candidate_periods = [(target_year, target_month)]

        subscriptions = list(
            Subscription.objects.filter(is_active=True, client__is_active=True)
            .select_related("client", "service")
            .order_by("client__name", "id")
        )

        created_invoices = []
        skipped_items = []
        failed_items = []

        for p_year, p_month in candidate_periods:
            p_key = f"{p_year}-{p_month:02d}"
            for sub in subscriptions:
                due, reason = is_subscription_due(sub, p_year, p_month, billing_day)
                if not due:
                    # If this is the current target period, record why it wasn't due
                    if (p_year, p_month) == (target_year, target_month):
                        skipped_items.append({
                            "subscription_id": sub.id,
                            "client_id": sub.client.id,
                            "client_name": sub.client.name,
                            "service_name": sub.effective_name,
                            "period": p_key,
                            "reason": reason,
                        })
                    continue

                inv_or_obj, err_or_reason, code = cls.generate_single_invoice(
                    subscription=sub,
                    year=p_year,
                    month=p_month,
                    trigger=trigger,
                    dry_run=False,
                    request=request,
                    company=company,
                    bank_account=bank_account,
                    template=template,
                    billing_day=billing_day,
                )

                if code == "CREATED":
                    created_invoices.append({
                        "invoice_number": inv_or_obj.invoice_number,
                        "client_name": sub.client.name,
                        "service_name": sub.effective_name,
                        "period": p_key,
                        "amount": float(inv_or_obj.payable_amount),
                        "status": inv_or_obj.status,
                    })
                elif code == "SKIPPED":
                    skipped_items.append({
                        "subscription_id": sub.id,
                        "client_id": sub.client.id,
                        "client_name": sub.client.name,
                        "service_name": sub.effective_name,
                        "period": p_key,
                        "reason": err_or_reason,
                    })
                elif code == "FAILED":
                    failed_items.append({
                        "subscription_id": sub.id,
                        "client_id": sub.client.id,
                        "client_name": sub.client.name,
                        "service_name": sub.effective_name,
                        "period": p_key,
                        "error": err_or_reason,
                    })

        # Determine overall run status
        if failed_items and created_invoices:
            overall_status = RecurringRun.STATUS_PARTIAL
        elif failed_items and not created_invoices:
            overall_status = RecurringRun.STATUS_FAILED
        else:
            overall_status = RecurringRun.STATUS_SUCCESS

        first_error = failed_items[0]["error"] if failed_items else ""

        run_rec = RecurringRun.objects.create(
            trigger=trigger,
            target_period=target_period_key,
            status=overall_status,
            created_count=len(created_invoices),
            skipped_count=len(skipped_items),
            failed_count=len(failed_items),
            details={
                "created": created_invoices,
                "skipped": skipped_items,
                "failed": failed_items,
            },
            error_message=first_error,
        )

        try:
            cls.send_run_notification(run_rec)
        except Exception as mail_exc:
            logger.warning("Unexpected error during email notification dispatch: %s", mail_exc)
            try:
                details = dict(run_rec.details or {})
                details["mail_error"] = str(mail_exc)
                run_rec.details = details
                if not run_rec.error_message:
                    run_rec.error_message = f"Email notification delivery failed: {mail_exc}"
                run_rec.save(update_fields=["details", "error_message"])
            except Exception:
                pass

        return {
            "run_id": run_rec.id,
            "status": overall_status,
            "target_period": target_period_key,
            "created_count": len(created_invoices),
            "skipped_count": len(skipped_items),
            "failed_count": len(failed_items),
            "created_invoices": [x["invoice_number"] for x in created_invoices],
            "skipped_items": skipped_items,
            "failed_items": failed_items,
        }

    @classmethod
    def preview_next_run(cls, target_period=None):
        """
        Calculates which invoices WOULD be created, skipped, or caught up, without saving anything.
        """
        settings_obj = Settings.objects.first()
        tz_name = settings_obj.auto_billing_timezone if settings_obj else "Asia/Dhaka"
        target_year, target_month, target_period_key, target_display_month = parse_period(target_period, tz_name=tz_name)

        cls.sync_client_service_prices()
        billing_day = settings_obj.auto_billing_day if settings_obj else 1

        candidate_periods = get_catch_up_periods(target_year, target_month, max_periods=3)

        subscriptions = list(
            Subscription.objects.filter(is_active=True, client__is_active=True)
            .select_related("client", "service")
            .order_by("client__name", "id")
        )

        would_create = []
        would_skip = []

        for p_year, p_month in candidate_periods:
            p_key = f"{p_year}-{p_month:02d}"
            for sub in subscriptions:
                due, reason = is_subscription_due(sub, p_year, p_month, billing_day)
                if not due:
                    if (p_year, p_month) == (target_year, target_month):
                        would_skip.append({
                            "subscription_id": sub.id,
                            "client_id": sub.client.id,
                            "client_name": sub.client.name,
                            "service_name": sub.effective_name,
                            "period": p_key,
                            "reason": reason,
                        })
                    continue

                obj, reason, code = cls.generate_single_invoice(
                    subscription=sub,
                    year=p_year,
                    month=p_month,
                    trigger="MANUAL",
                    dry_run=True,
                    billing_day=billing_day,
                )

                if code == "CREATED":
                    would_create.append(obj)
                else:
                    would_skip.append({
                        "subscription_id": sub.id,
                        "client_id": sub.client.id,
                        "client_name": sub.client.name,
                        "service_name": sub.effective_name,
                        "period": p_key,
                        "reason": reason,
                    })

        return {
            "target_period": target_period_key,
            "display_month": target_display_month,
            "would_create": would_create,
            "would_skip": would_skip,
            "total_would_create": len(would_create),
            "total_would_skip": len(would_skip),
        }

    @classmethod
    def send_run_notification(cls, recurring_run: RecurringRun):
        """
        Sends an email notification summary to admin users on each run or failure.
        """
        User = get_user_model()
        admin_emails = list(
            User.objects.filter(
                models.Q(is_superuser=True) | models.Q(profile__role="ADMIN"),
                is_active=True,
            )
            .exclude(email="")
            .values_list("email", flat=True)
        )

        if not admin_emails:
            admin_emails = [getattr(settings, "ADMIN_EMAIL", "admin@raktch.com")]

        subject = (
            f"[{'CRITICAL' if recurring_run.status == 'FAILED' else 'NOTICE'}] "
            f"Recurring Billing Run {recurring_run.status}: {recurring_run.target_period}"
        )

        body = (
            f"Recurring Billing Run Summary\n"
            f"====================================\n"
            f"Run Time: {recurring_run.run_time.strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
            f"Trigger: {recurring_run.get_trigger_display()}\n"
            f"Target Period: {recurring_run.target_period}\n"
            f"Overall Status: {recurring_run.status}\n"
            f"Created Invoices: {recurring_run.created_count}\n"
            f"Skipped Items: {recurring_run.skipped_count}\n"
            f"Failed Items: {recurring_run.failed_count}\n"
        )

        if recurring_run.error_message:
            body += f"\nError Message:\n{recurring_run.error_message}\n"

        if recurring_run.details.get("created"):
            settings_obj = Settings.objects.first()
            curr = settings_obj.currency_symbol if settings_obj else "Tk"
            body += "\nCreated Invoices:\n"
            for inv in recurring_run.details["created"][:10]:
                if isinstance(inv, dict):
                    body += f" - {inv.get('invoice_number')} | {inv.get('client_name')} ({inv.get('period')}): {inv.get('amount')} {curr}\n"
                else:
                    body += f" - {inv}\n"
            if len(recurring_run.details["created"]) > 10:
                body += f" ... and {len(recurring_run.details['created']) - 10} more\n"

        if recurring_run.details.get("failed"):
            body += "\nFailed Items:\n"
            for fl in recurring_run.details["failed"]:
                body += f" - Sub #{fl.get('subscription_id')} ({fl.get('client_name')}): {fl.get('error')}\n"

        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "billing@raktch.com"),
                recipient_list=admin_emails,
                fail_silently=False,
            )
        except Exception as e:
            logger.warning("Failed to send recurring run email notification: %s", e)
            try:
                details = dict(recurring_run.details or {})
                details["mail_error"] = str(e)
                recurring_run.details = details
                if not recurring_run.error_message:
                    recurring_run.error_message = f"Email notification delivery failed: {e}"
                recurring_run.save(update_fields=["details", "error_message"])
            except Exception as update_err:
                logger.error("Failed to record mail error on RecurringRun: %s", update_err)

    @classmethod
    def get_dashboard_status(cls):
        """
        Inspects whether the last run failed or did not happen, for dashboard visibility warnings.
        """
        settings_obj = Settings.objects.first()
        tz_name = settings_obj.auto_billing_timezone if settings_obj else "Asia/Dhaka"

        try:
            tz = ZoneInfo(tz_name)
            current_local_date = timezone.now().astimezone(tz).date()
        except Exception:
            current_local_date = timezone.localdate()

        current_period_key = f"{current_local_date.year}-{current_local_date.month:02d}"
        last_run = RecurringRun.objects.first()

        has_warning = False
        warning_type = ""
        warning_message = ""

        # Check 1: Did the last run fail or partially fail?
        if last_run and last_run.status in [RecurringRun.STATUS_FAILED, RecurringRun.STATUS_PARTIAL]:
            has_warning = True
            warning_type = "RUN_FAILED"
            warning_message = (
                f"The last recurring run on {last_run.run_time.strftime('%b %d, %Y %H:%M')} "
                f"ended with status {last_run.status} ({last_run.failed_count} failures)."
            )

        # Check 2: If auto-billing is enabled, is it past the scheduled day for this month without a successful run?
        elif settings_obj and settings_obj.auto_billing_enabled:
            max_days_this_month = calendar.monthrange(current_local_date.year, current_local_date.month)[1]
            effective_day = min(settings_obj.auto_billing_day or 1, max_days_this_month)

            if current_local_date.day >= effective_day:
                run_this_month = RecurringRun.objects.filter(
                    target_period=current_period_key,
                    status=RecurringRun.STATUS_SUCCESS
                ).exists()

                if not run_this_month:
                    has_warning = True
                    warning_type = "RUN_MISSED"
                    warning_message = (
                        f"Auto-billing has not run for period {current_period_key} "
                        f"(scheduled for day {effective_day} of month)."
                    )

        return {
            "has_warning": has_warning,
            "warning_type": warning_type,
            "warning_message": warning_message,
            "auto_billing_enabled": settings_obj.auto_billing_enabled if settings_obj else False,
            "auto_billing_day": settings_obj.auto_billing_day if settings_obj else 1,
            "auto_billing_time": settings_obj.auto_billing_time.strftime("%H:%M") if settings_obj and settings_obj.auto_billing_time else "00:00",
            "auto_billing_timezone": tz_name,
            "last_run": {
                "id": last_run.id,
                "run_time": last_run.run_time.isoformat(),
                "trigger": last_run.trigger,
                "target_period": last_run.target_period,
                "status": last_run.status,
                "created_count": last_run.created_count,
                "skipped_count": last_run.skipped_count,
                "failed_count": last_run.failed_count,
                "error_message": last_run.error_message,
            } if last_run else None,
        }
