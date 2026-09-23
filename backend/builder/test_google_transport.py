"""The dependency Google sign-in actually needs at runtime.

`google-auth` was in requirements; `requests` was not. The verifier reaches for
`google.auth.transport.requests`, that module imports `requests`, and without it
the import raises — inside the `except Exception` that turns every failure into
one message. So every attempt came back "Invalid Google token", the log said
nothing, and the feature had never worked in production even though it was
built, reviewed and tested.

The tests did not catch it because they replace the whole google namespace with
mocks, which is the right call for policy tests — they must not need the SDK or
the network. But it left nobody checking that the SDK is installed at all.

This is that check, and only that: an import, no network, no token.
"""
import importlib


def test_the_google_transport_imports_for_real():
    # Not mocked, unlike the policy tests. If `requests` is missing from
    # requirements this raises here instead of at a user's sign-in.
    transport = importlib.import_module('google.auth.transport.requests')

    assert callable(transport.Request)


def test_the_id_token_verifier_is_there_too():
    id_token = importlib.import_module('google.oauth2.id_token')

    assert callable(id_token.verify_oauth2_token)


def test_requests_is_pinned_in_requirements():
    # The import above passes whenever `requests` happens to be in the
    # environment — a dev machine usually has it pulled in by something else,
    # which is exactly how this reached production. The deploy installs from
    # requirements.txt and nothing else, so that file is what has to say it.
    from pathlib import Path

    requirements = (Path(__file__).resolve().parent.parent / 'requirements.txt').read_text(encoding='utf-8')
    lines = [line.split('#')[0].strip().lower() for line in requirements.splitlines()]

    assert any(line.startswith('requests==') for line in lines), \
        'requests is missing from requirements.txt — Google sign-in will fail as an invalid token'
