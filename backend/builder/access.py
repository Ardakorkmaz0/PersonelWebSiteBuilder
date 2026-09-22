"""Who may see or reach a site — one rule for every public surface.

The public page used to be the only endpoint that refused a suspended owner's
site; the review link, "use this site" (clone) and the contact form each made
their own, narrower check, so a suspended account's work stayed reachable
through them. A moderator's takedown only flipped `published`, which the owner
could flip straight back. Every public way in now asks this module instead of
writing its own filter.
"""
from django.utils import timezone

from .models import Site

# --- How much of the internet one account may open in a day ----------------
#
# Publishing is the moment a page stops being the owner's business and starts
# being everyone's. Nothing capped it, so one account could open an unlimited
# number of public pages in a minute — which is what a spam run looks like.
#
# The cap counts SITES made public today, not flips of the switch. Somebody who
# publishes a page, spots a typo, unpublishes it and publishes it again has
# done one thing, not three, and the rule should agree with them.
DAILY_PUBLISH_LIMIT = 5


def sites_published_today(user, today=None):
    """The ids of this account's sites that went public today."""
    if user is None or not getattr(user, 'is_authenticated', False):
        return set()
    day = today or timezone.localdate()
    return set(
        Site.objects.filter(owner=user, last_published_at__date=day)
        .values_list('pk', flat=True),
    )


def publish_blocked(user, site=None, today=None):
    """Would publishing `site` now go over the daily cap?

    `site` is None when the site does not exist yet (publishing straight from
    create), in which case it can only be a new slot. A site that already used
    a slot today is free to republish for the rest of the day.
    """
    used = sites_published_today(user, today)
    if site is not None and site.pk in used:
        return False
    return len(used) >= DAILY_PUBLISH_LIMIT


def public_sites():
    """Sites anyone may see: published by their owner, not taken down by a
    moderator, and owned by an account that is not suspended."""
    return Site.objects.filter(published=True, moderation_blocked=False, owner__is_active=True)


def is_public(site):
    return bool(site.published and not site.moderation_blocked and site.owner.is_active)


def is_reachable(site):
    """Reachable through a private link (a review link), published or not:
    the same rule minus the owner's draft switch. A takedown or a suspension
    closes these links too."""
    return bool(not site.moderation_blocked and site.owner.is_active)


# --- Sharing a project with a person, not with the internet ----------------
#
# The review link has always been "anyone holding this address gets in". That
# is right for a client you emailed once, and wrong for a project you want
# only three named people to see — and worse, there was no way back: a link
# that leaked stayed open forever unless the owner replaced it and told
# everyone the new address.
#
# So the link gains a mode. `link` is what it always did. `people` makes the
# ACCOUNT the credential: the viewer must be signed in as somebody the owner
# named. `off` closes it without changing the address, so turning sharing back
# on does not force a new link on everybody.
#
# A refusal says which of those it is, because "this is private now" and "this
# link does not exist" are different facts and the person on the other end can
# act on the first one.
SHARE_OPEN = 'open'
SHARE_PRIVATE = 'private'
SHARE_CLOSED = 'closed'


def share_access(site, user):
    """How this person stands with this site's share link."""
    if site is None or not is_reachable(site):
        return SHARE_CLOSED
    if user is not None and getattr(user, 'is_authenticated', False) and site.owner_id == user.pk:
        return SHARE_OPEN
    if site.share_mode == 'off':
        return SHARE_CLOSED
    if site.share_mode == 'link':
        return SHARE_OPEN
    # 'people': named accounts only.
    if user is None or not getattr(user, 'is_authenticated', False):
        return SHARE_PRIVATE
    return SHARE_OPEN if site.viewers.filter(user=user).exists() else SHARE_PRIVATE
