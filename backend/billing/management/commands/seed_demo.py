from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.conf import settings
from billing.models import UserProfile

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds local demo accounts (admin, accountant, staff) for development only. Refuses if DEBUG=False."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force seeding even if demo users already exist",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "Refusing to run seed_demo when DEBUG is False. Demo accounts cannot be created in production."
            )

        demo_users = [
            ("admin", "admin123", True, UserProfile.ROLE_ADMIN, "+8801581677077"),
            ("accountant", "accountant123", False, UserProfile.ROLE_ACCOUNTANT, "+8801700000001"),
            ("staff", "staff123", False, UserProfile.ROLE_STAFF, "+8801700000002"),
        ]

        for username, password, is_superuser, role, phone in demo_users:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@raktch.com",
                    "first_name": "System" if username == "admin" else "Demo",
                    "last_name": "Admin" if username == "admin" else "User",
                    "is_active": True,
                    "is_staff": is_superuser,
                    "is_superuser": is_superuser,
                },
            )
            user.set_password(password)
            user.is_active = True
            user.is_staff = user.is_staff or is_superuser
            user.is_superuser = user.is_superuser or is_superuser
            user.save(update_fields=["password", "is_active", "is_staff", "is_superuser"])

            UserProfile.objects.update_or_create(
                user=user,
                defaults={"role": role, "phone": phone},
            )
            action_desc = "Created" if created else "Updated"
            self.stdout.write(
                self.style.SUCCESS(f"{action_desc} demo user '{username}' (role: {role}).")
            )
