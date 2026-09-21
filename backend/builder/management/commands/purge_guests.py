"""Delete guest identities that never became anything.

"Continue without signing in" mints a user row per visitor who takes it up, and
most of those rows are a look around and nothing else. This removes the ones
that are old AND empty — no site, no uploaded image, no favourite, no shared
block. A guest who made something keeps it: they may still come back and sign
up, and deleting their work to save a row would be the wrong trade.

Run it from cron (see DEPLOY.md):  python manage.py purge_guests --days 30
"""
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = 'Delete guest accounts older than --days that own nothing.'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=30)
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Count what would go, delete nothing.',
        )

    def handle(self, *args, **options):
        days = max(1, int(options['days']))
        cutoff = timezone.now() - timedelta(days=days)
        stale = (
            User.objects
            .filter(profile__is_guest=True, date_joined__lt=cutoff)
            .filter(
                sites__isnull=True,
                uploaded_images__isnull=True,
                favorites__isnull=True,
                shared_components__isnull=True,
            )
            .distinct()
        )
        count = stale.count()
        if options['dry_run']:
            self.stdout.write(f'{count} empty guest accounts older than {days} days')
            return
        # Delete by id: a sliced/distinct queryset cannot be deleted directly.
        User.objects.filter(pk__in=list(stale.values_list('pk', flat=True))).delete()
        self.stdout.write(f'Deleted {count} empty guest accounts older than {days} days')
