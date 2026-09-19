"""Who may see or reach a site — one rule for every public surface.

The public page used to be the only endpoint that refused a suspended owner's
site; the review link, "use this site" (clone) and the contact form each made
their own, narrower check, so a suspended account's work stayed reachable
through them. A moderator's takedown only flipped `published`, which the owner
could flip straight back. Every public way in now asks this module instead of
writing its own filter.
"""
from .models import Site


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
