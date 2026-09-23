"""One person, one spelling.

Two changes that the application layer could only half-enforce.

Usernames were compared byte for byte, so `Ada` and `ada` were two accounts
that read as one — and the username is how a site owner grants someone access,
typed into a share list that shows no way to tell them apart. Existing names
are folded here; new ones are folded on the way in.

Emails were checked for uniqueness by reading before writing, which two
requests arriving together both pass, and which Django's own admin never does
at all. A unique index settles it. It is case-insensitive, and it skips empty
addresses on purpose: guests are created without one.
"""
from django.db import migrations

# LOWER() in an index and a WHERE clause both work on SQLite (3.9+) and
# Postgres, so one statement covers the dev and production databases.
CREATE_EMAIL_INDEX = """
CREATE UNIQUE INDEX IF NOT EXISTS builder_user_email_ci_unique
ON auth_user (LOWER(email))
WHERE email <> '';
"""
DROP_EMAIL_INDEX = "DROP INDEX IF EXISTS builder_user_email_ci_unique;"


def fold_usernames(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    taken = {name.lower() for name in User.objects.values_list('username', flat=True)}
    for user in User.objects.all():
        folded = user.username.strip().lower()
        if folded == user.username:
            continue
        # Two spellings of one name cannot both fold to it. Keep the older
        # account's claim (this walks in pk order) and give the other a
        # suffix rather than failing the deploy or silently merging people.
        candidate, n = folded, 2
        while candidate != user.username.lower() and candidate in taken:
            candidate, n = f'{folded}{n}', n + 1
        while User.objects.filter(username=candidate).exclude(pk=user.pk).exists():
            candidate, n = f'{folded}{n}', n + 1
        taken.add(candidate)
        user.username = candidate
        user.save(update_fields=['username'])


def unfold_usernames(apps, schema_editor):
    """Nothing to restore: the original capitalisation is not recorded anywhere,
    and inventing one would be worse than leaving the folded name."""


class Migration(migrations.Migration):

    dependencies = [
        ('builder', '0020_site_last_published_at_site_pinned_at'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(fold_usernames, unfold_usernames),
        migrations.RunSQL(CREATE_EMAIL_INDEX, DROP_EMAIL_INDEX),
    ]
