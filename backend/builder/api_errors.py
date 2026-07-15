from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler


STATUS_CODES = {
    status.HTTP_400_BAD_REQUEST: 'bad_request',
    status.HTTP_401_UNAUTHORIZED: 'not_authenticated',
    status.HTTP_403_FORBIDDEN: 'permission_denied',
    status.HTTP_404_NOT_FOUND: 'not_found',
    status.HTTP_405_METHOD_NOT_ALLOWED: 'method_not_allowed',
    status.HTTP_429_TOO_MANY_REQUESTS: 'throttled',
}


def error_response(code, detail, http_status=status.HTTP_400_BAD_REQUEST, **extra):
    """Return a stable machine code while keeping the human detail for older clients."""
    return Response({'code': code, 'detail': detail, **extra}, status=http_status)


def structured_exception_handler(exc, context):
    """Add stable codes to every DRF error without breaking existing field payloads."""
    response = exception_handler(exc, context)
    if response is None:
        return None

    original = response.data
    if isinstance(original, dict):
        payload = dict(original)
    else:
        payload = {'detail': original}

    default_code = getattr(exc, 'default_code', None)
    code = 'validation_error' if isinstance(exc, ValidationError) else (
        default_code or STATUS_CODES.get(response.status_code, 'api_error')
    )
    payload.setdefault('code', str(code))
    if isinstance(exc, ValidationError):
        try:
            payload.setdefault('error_codes', exc.get_codes())
        except (AttributeError, TypeError):
            pass
    response.data = payload
    return response
