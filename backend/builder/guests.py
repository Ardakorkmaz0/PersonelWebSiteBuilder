"""Someone who has not signed up, but is not a stranger either.

The old front door asked for an account before the visitor had seen anything
worth an account: "why would I sign up?" is the honest answer, and most people
left at that. A guest gets a real user row with a made-up name, so everything
downstream — a site's owner, a favourite, a saved draft — works through exactly
the same foreign keys as a full account. The only difference is a flag.

What that flag closes is everything OTHER people would see or that an account
is the point of: publishing, sharing a block to the community, comments and
reports, domains/analytics/form inboxes, and the AI that spends the server's
own API key. Making things for yourself stays open, which is the part that
earns the account later.

Signing up does not start over: upgrade_guest() writes real credentials onto
the same row, so the work made as a guest is still there afterwards.
"""
import secrets

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import status
from rest_framework.response import Response

# Enough to try the product properly; not enough to turn throwaway identities
# into a hosting farm. Signing up lifts it.
GUEST_SITE_LIMIT = 3

# No l/1/0/O: the name is shown to the person and read back by support.
_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

GUEST_USERNAME_PREFIX = 'guest-'


def guest_username():
    return GUEST_USERNAME_PREFIX + ''.join(secrets.choice(_ALPHABET) for _ in range(8))


def is_guest(user):
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    profile = getattr(user, 'profile', None)
    return bool(profile and profile.is_guest)


@transaction.atomic
def create_guest_user():
    """A new guest identity. The password is unusable: this account can only be
    reached with the token handed out here, never through the login form."""
    for _ in range(8):
        username = guest_username()
        if User.objects.filter(username=username).exists():
            continue
        user = User.objects.create_user(username=username, email='')
        user.set_unusable_password()
        user.save(update_fields=['password'])
        # The profile is created by a post_save signal; flip its flag.
        profile = user.profile
        profile.is_guest = True
        profile.save(update_fields=['is_guest'])
        return user
    raise RuntimeError('Could not allocate a guest username')


def guest_blocked(action):
    """The one refusal shape for everything a guest cannot do. `action` is
    what they tried, so the frontend can say it back to them."""
    return Response(
        {
            'detail': 'Create an account to do this — your work is kept.',
            'code': 'guest_forbidden',
            'action': action,
        },
        status=status.HTTP_403_FORBIDDEN,
    )


@transaction.atomic
def upgrade_guest(user, *, username, email, password):
    """Turn the guest into a full account, in place. Same row, same id, so
    every site, favourite and draft they made stays theirs."""
    user.username = username
    user.email = email
    user.set_password(password)
    user.save(update_fields=['username', 'email', 'password'])
    profile = user.profile
    profile.is_guest = False
    profile.save(update_fields=['is_guest'])
    return user


@transaction.atomic
def adopt_guest_work(guest, account):
    """Move everything a guest made into an account they just signed into.

    Upgrading covers the person who signs UP from a guest session — same row,
    nothing to move. This covers the other half: someone who already had an
    account, looked around as a guest first, and then signed in. Without it
    their drafts stay on an identity they can no longer reach, which is the
    same as losing them.

    Possession of the guest token is the proof: it is the only way into that
    identity, and it came from this browser.
    """
    from .models import Favorite, Site, UploadedImage

    moved = {
        'sites': Site.objects.filter(owner=guest).update(owner=account),
        'images': UploadedImage.objects.filter(owner=guest).update(owner=account),
    }
    # A favourite is a (user, site) pair: keep the ones the account does not
    # already have, drop the duplicates with the guest row.
    already = set(Favorite.objects.filter(user=account).values_list('site_id', flat=True))
    keep = Favorite.objects.filter(user=guest).exclude(site_id__in=already)
    moved['favorites'] = keep.update(user=account)
    # The identity has nothing left to own, and its token should stop working.
    guest.delete()
    return moved
