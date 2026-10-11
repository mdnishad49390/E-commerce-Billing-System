import sys
from django.core.management.base import BaseCommand
from billing.services import RecurringBillingService
from billing.models import RecurringRun, Settings


class Command(BaseCommand):
    help = "Automatically generate recurring subscription invoices for the scheduled billing period."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force execution even if auto-billing is disabled or not today's scheduled day.",
        )
        parser.add_argument(
            "--period",
            type=str,
            default=None,
            help="Target billing period, e.g. '2026-05' or 'May-2026'. Defaults to current period.",
        )
        parser.add_argument(
            "--preview",
            action="store_true",
            help="Preview what invoices would be generated without saving to the database.",
        )
        parser.add_argument(
            "--no-catch-up",
            action="store_true",
            help="Disable catching up missed runs from previous months.",
        )

    def handle(self, *args, **options):
        force = options["force"]
        period = options["period"]
        preview = options["preview"]
        no_catch_up = options["no_catch_up"]

        self.stdout.write(self.style.NOTICE("=== Auto-Generate Recurring Bills ==="))

        if preview:
            self.stdout.write(self.style.WARNING("Running in PREVIEW mode (no database changes)..."))
            preview_res = RecurringBillingService.preview_next_run(target_period=period)
            
            self.stdout.write(f"Target Period: {preview_res['target_period']} ({preview_res['display_month']})")
            self.stdout.write(f"Would Create: {preview_res['total_would_create']}")
            self.stdout.write(f"Would Skip: {preview_res['total_would_skip']}\n")

            if preview_res["would_create"]:
                self.stdout.write(self.style.SUCCESS("Invoices that WOULD be created:"))
                settings_obj = Settings.objects.first()
                curr = settings_obj.currency_symbol if settings_obj else "Tk"
                for item in preview_res["would_create"]:
                    self.stdout.write(
                        f"  [+] Client: {item['client_name']} | Service: {item['service_name']} | "
                        f"Period: {item['billing_period']} | Amount: {item['amount']} {curr} | Status: {item['status']}"
                    )

            if preview_res["would_skip"]:
                self.stdout.write(self.style.NOTICE("\nSubscriptions that would be skipped:"))
                for item in preview_res["would_skip"][:20]:
                    self.stdout.write(
                        f"  [-] Client: {item['client_name']} | Reason: {item['reason']}"
                    )
                if len(preview_res["would_skip"]) > 20:
                    self.stdout.write(f"  ... and {len(preview_res['would_skip']) - 20} more skipped")
            return

        trigger = RecurringRun.TRIGGER_MANUAL if force else RecurringRun.TRIGGER_AUTO
        result = RecurringBillingService.run_recurring_billing(
            target_period=period,
            trigger=trigger,
            force=force,
            catch_up=not no_catch_up,
        )

        status_str = result.get("status", "UNKNOWN")
        msg = result.get("message")
        if msg:
            self.stdout.write(self.style.NOTICE(f"Notice: {msg}"))

        if status_str == "SKIPPED":
            self.stdout.write(self.style.WARNING(f"Run skipped: {msg}"))
            return

        created = result.get("created_count", 0)
        skipped = result.get("skipped_count", 0)
        failed = result.get("failed_count", 0)

        self.stdout.write(f"Period: {result.get('target_period')}")
        self.stdout.write(self.style.SUCCESS(f"Created: {created}"))
        self.stdout.write(f"Skipped: {skipped}")

        if failed > 0:
            self.stdout.write(self.style.ERROR(f"Failed: {failed}"))
            for f in result.get("failed_items", []):
                self.stdout.write(self.style.ERROR(f"  Error on sub #{f.get('subscription_id')}: {f.get('error')}"))

        if status_str == RecurringRun.STATUS_SUCCESS:
            self.stdout.write(self.style.SUCCESS(f"[SUCCESS] Successfully generated {created} recurring invoices."))
        elif status_str == RecurringRun.STATUS_PARTIAL:
            self.stdout.write(self.style.WARNING(f"[PARTIAL] Generated {created} invoices with {failed} failures."))
        else:
            self.stdout.write(self.style.ERROR(f"[FAILED] Run failed with {failed} errors."))
            sys.exit(1)
