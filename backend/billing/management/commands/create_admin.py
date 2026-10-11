import getpass
import os
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from billing.models import UserProfile

User = get_user_model()


class Command(BaseCommand):
    help = "Creates or updates an administrator account with verified UserProfile (prompts or reads from env)"

    def add_arguments(self, parser):
        parser.add_argument("--username", dest="username", help="Admin username")
        parser.add_argument("--email", dest="email", help="Admin email address")
        parser.add_argument("--password", dest="password", help="Admin password")
        parser.add_argument("--phone", dest="phone", help="Admin phone number")
        parser.add_argument(
            "--noinput",
            "--no-input",
            action="store_true",
            dest="no_input",
            help="Do not prompt for input",
        )

    def handle(self, *args, **options):
        no_input = options.get("no_input", False)

        username = options.get("username") or os.getenv("ADMIN_USERNAME")
        if not username:
            if no_input:
                username = "admin"
            else:
                username = input("Enter admin username [admin]: ").strip() or "admin"

        email = options.get("email") or os.getenv("ADMIN_EMAIL")
        if not email:
            if no_input:
                email = f"{username}@raktch.com"
            else:
                email = input(f"Enter admin email [{username}@raktch.com]: ").strip() or f"{username}@raktch.com"

        password = options.get("password") or os.getenv("ADMIN_PASSWORD")
        if not password:
            if no_input:
                raise CommandError("Password must be supplied via --password or ADMIN_PASSWORD in --no-input mode.")
            while True:
                p1 = getpass.getpass("Enter strong admin password: ")
                p2 = getpass.getpass("Confirm password: ")
                if p1 != p2:
                    self.stdout.write(self.style.ERROR("Passwords do not match. Please try again."))
                    continue
                try:
                    validate_password(p1)
                except ValidationError as err:
                    self.stdout.write(self.style.ERROR("; ".join(err.messages)))
                    continue
                password = p1
                break

        phone = options.get("phone") or os.getenv("ADMIN_PHONE", "+8801581677077")

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "first_name": "System",
                "last_name": "Admin",
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        user.email = email
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(password)
        user.save()

        profile, _ = UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "role": UserProfile.ROLE_ADMIN,
                "phone": phone,
            },
        )

        status_word = "created" if created else "updated"
        self.stdout.write(
            self.style.SUCCESS(f"Successfully {status_word} admin account '{username}' ({email}).")
        )
