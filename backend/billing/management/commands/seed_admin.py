import os
import secrets
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.conf import settings
from billing.models import UserProfile

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds initial Admin, Accountant, and Staff users with verified UserProfiles (secure for production)"

    def add_arguments(self, parser):
        parser.add_argument("--admin-pass", dest="admin_pass", help="Password for admin user")
        parser.add_argument("--accountant-pass", dest="accountant_pass", help="Password for accountant user")
        parser.add_argument("--staff-pass", dest="staff_pass", help="Password for staff user")

    def handle(self, *args, **options):
        admin_pass = options.get("admin_pass") or os.getenv("ADMIN_PASSWORD")
        accountant_pass = options.get("accountant_pass") or os.getenv("ACCOUNTANT_PASSWORD")
        staff_pass = options.get("staff_pass") or os.getenv("STAFF_PASSWORD")

        if not (admin_pass and accountant_pass and staff_pass):
            if not settings.DEBUG:
                raise CommandError(
                    "In production (DEBUG=False), distinct passwords must be provided for all roles via options "
                    "(--admin-pass, --accountant-pass, --staff-pass) or environment variables (ADMIN_PASSWORD, "
                    "ACCOUNTANT_PASSWORD, STAFF_PASSWORD)."
                )
            self.stdout.write(
                self.style.WARNING(
                    "Notice: For fixed development credentials, run 'python manage.py seed_demo'. "
                    "Generating random passwords for unsupplied roles."
                )
            )

        admin_pass = admin_pass or secrets.token_urlsafe(12)
        accountant_pass = accountant_pass or secrets.token_urlsafe(12)
        staff_pass = staff_pass or secrets.token_urlsafe(12)

        # 1. Admin
        admin_user, _ = User.objects.get_or_create(
            username="admin",
            defaults={"email": "admin@raktch.com", "first_name": "System", "last_name": "Admin", "is_staff": True, "is_superuser": True}
        )
        admin_user.set_password(admin_pass)
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.is_active = True
        admin_user.save()
        UserProfile.objects.update_or_create(
            user=admin_user,
            defaults={"role": UserProfile.ROLE_ADMIN, "phone": "+8801581677077"}
        )
        self.stdout.write(self.style.SUCCESS("Admin user configured successfully."))

        # 2. Accountant
        acc_user, _ = User.objects.get_or_create(
            username="accountant",
            defaults={"email": "accountant@raktch.com", "first_name": "Senior", "last_name": "Accountant"}
        )
        acc_user.set_password(accountant_pass)
        acc_user.is_active = True
        acc_user.save()
        UserProfile.objects.update_or_create(
            user=acc_user,
            defaults={"role": UserProfile.ROLE_ACCOUNTANT, "phone": "+8801700000001"}
        )
        self.stdout.write(self.style.SUCCESS("Accountant user configured successfully."))

        # 3. Staff
        staff_user, _ = User.objects.get_or_create(
            username="staff",
            defaults={"email": "staff@raktch.com", "first_name": "Billing", "last_name": "Staff"}
        )
        staff_user.set_password(staff_pass)
        staff_user.is_active = True
        staff_user.save()
        UserProfile.objects.update_or_create(
            user=staff_user,
            defaults={"role": UserProfile.ROLE_STAFF, "phone": "+8801700000002"}
        )
        self.stdout.write(self.style.SUCCESS("Staff user configured successfully."))
