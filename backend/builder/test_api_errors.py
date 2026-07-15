from rest_framework.exceptions import NotFound, ValidationError

from .api_errors import error_response, structured_exception_handler


def test_custom_error_response_keeps_code_and_detail():
    response = error_response('site_not_found', 'Site not found.', 404)
    assert response.status_code == 404
    assert response.data == {'code': 'site_not_found', 'detail': 'Site not found.'}


def test_drf_not_found_gets_a_stable_code():
    response = structured_exception_handler(NotFound(), {})
    assert response.status_code == 404
    assert response.data['code'] == 'not_found'
    assert 'detail' in response.data


def test_validation_errors_include_machine_readable_field_codes():
    response = structured_exception_handler(ValidationError({'title': ['This field is required.']}), {})
    assert response.status_code == 400
    assert response.data['code'] == 'validation_error'
    assert response.data['error_codes']['title'] == ['invalid']
