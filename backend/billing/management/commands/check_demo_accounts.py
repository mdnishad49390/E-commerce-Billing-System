from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Read-only audit: checks if demo accounts (admin, accountant, staff) exist and still use default demo passwords"

    def handle(self, *args, **options):
        known_demo_credentials = {
            "admin": "admin123",
            "accountant": "accountant123",
            "staff": "staff123",
        }

        self.stdout.write("=" * 70)
        self.stdout.write("AUDIT REPORT: Demo Accounts & Default Passwords (Read-Only)")
        self.stdout.write("=" * 70)

        insecure_count = 0
        total_found = 0

        for username, default_pwd in known_demo_credentials.items():
            user = User.objects.filter(username=username).first()
            if not user:
                self.stdout.write(
                    self.style.NOTICE(f"[-] User '{username}': NOT FOUND in database")
                )
                continue

            total_found += 1
            has_demo_pwd = user.check_password(default_pwd)
            role = getattr(getattr(user, "profile", None), "role", "NO_PROFILE")

            if has_demo_pwd:
                insecure_count += 1
                self.stdout.write(
                    self.style.ERROR(
                        f"[!] CRITICAL: User '{username}' (role: {role}) STILL USES DEFAULT PASSWORD ('{default_pwd}')!"
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"[OK] User '{username}' (role: {role}) is using a non-default password."
                    )
                )

        self.stdout.write("-" * 70)
        if insecure_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"Result: {insecure_count} demo account(s) using insecure default passwords found. "
                    "Change passwords immediately in production."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS("Result: No accounts using default demo passwords detected.")
            )
