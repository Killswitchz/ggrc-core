# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Custom Resource for Relationship that creates Snapshots when needed.

When Audit-Snapshottable Relationship is POSTed, a Snapshot should be created
instead.
"""

from werkzeug.exceptions import Forbidden

from ggrc import db
from ggrc import models
from ggrc.utils import benchmark
from ggrc.rbac import permissions
from ggrc.services import common


class AuditResource(common.ExtendedResource):
  """Resource handler for audits."""

  # method post is abstract and not used.
  # pylint: disable=abstract-method

  def get(self, *args, **kwargs):
    # This is to extend the get request for additional data.
    # pylint: disable=arguments-differ
    command_map = {
        None: super(AuditResource, self).get,
        "summary": self.summary_query,
    }
    command = kwargs.pop("command", None)
    if command not in command_map:
      self.not_found_response()
    return command_map[command](*args, **kwargs)

  def summary_query(self, id):
    """Get data for audit summary page."""
    # id name is used as a kw argument and can't be changed here
    # pylint: disable=invalid-name,redefined-builtin
    with benchmark("check audit permissions"):
      audit = models.Audit.query.get(id)
      if not permissions.is_allowed_read_for(audit):
        raise Forbidden()
    with benchmark("Get audit summary data"):
      data = db.session.query(
          models.Assessment.status,
          models.Assessment.verified,
      ).filter(
          models.Assessment.audit_id == id
      ).all()
    with benchmark("Make response"):
      response_object = list(data)
      return self.json_success_response(response_object, )
