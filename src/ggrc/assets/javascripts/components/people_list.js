/*!
  Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: andraz@reciprocitylabs.com
  Maintained By: andraz@reciprocitylabs.com
*/

(function (can) {
  GGRC.Components('peopleList', {
    tag: 'people-list',
    template: can.view(GGRC.mustache_path +
      '/base_templates/people_list.mustache'),
    scope: {
      editable: '@',
      deferred: '@',
      validate: '@'
    }
  });

  GGRC.Components('peopleGroup', {
    tag: 'people-group',
    template: can.view(GGRC.mustache_path +
      '/base_templates/people_group.mustache'),
    scope: {
      limit: '@',
      mapping: null,
      required: '@',
      type: null,
      toggle_add: false,
      mapped_people: [],
      results: [],
      list_pending: [],
      list_mapped: [],
      computed_mapping: false,
      /**
        * Get pending joins for current instance
        *
        * @return {Array} - the list of current pending joins
        */
      get_pending: function () {
        if (!this.attr('deferred')) {
          return [];
        }
        return this.attr('instance._pending_joins');
      },
      /**
        * Get people mapped to this instance
        *
        * @return {Array} - the list of current mapped people
        */
      get_mapped: function () {
        // We call get_mapping only once because canjs events can get caught in a loop
        // computed_mapping needs to be in scope so its separated from other people lists
        if (!this.computed_mapping) {
          this.attr('list_mapped',
                    this.attr('instance').get_mapping(this.attr('mapping')));
          this.computed_mapping = true;
        }
        return this.attr('list_mapped');
      },
      /**
        * Get the first (or only) pending join for a person
        *
        * @param {CMS.Models.Person} person - the person whose join to get
        *
        * @return {Object} - the pending join for the person if available
        *                    or undefined
        */
      get_pending_operation: function (person) {
        return _.find(this.get_pending(), function(join) {
          return join.what === person;
        });
      },
      /**
        * Change pending joins list to add a role to a person
        *
        * If there is a pending 'add' or 'update', extends roles list in it.
        * If there is a pending 'remove', cancels it and creates a new 'update'
        * with the role.
        * If there is no pending join and the person already has roles assigned,
        * creates a new 'update' with extended roles list.
        * If there is no pending join and the person has no roles assigned yet,
        * creates a new 'add' with the role.
        *
        * @param {CMS.Models.Person} person - the person who gets the new role
        * @param {String} role - the role that is added
        */
      deferred_add_role: function (person, role) {
        var pendingOperation = this.get_pending_operation(person);
        if (!pendingOperation) {
          // no pending join for this person
          this.get_roles(person, this.instance).then(function (result) {
            var roles = result.roles;

            if (roles.length) {
              // the person already has roles assigned, create 'update'
              this.add_or_replace_operation(
                person,
                {
                  how: 'update',
                  roles: _.union(roles, [role])
                }
              );
            } else {
              // the person was not yet assigned, create 'add'
              this.add_or_replace_operation(
                person,
                {
                  how: 'add',
                  roles: [role]
                }
              );
            }
          }.bind(this));
        } else if (pendingOperation.how === 'remove') {
          // 'remove' pending for this person, cancel it and create 'update'
          // with single role
          this.add_or_replace_operation(
            person,
            {
              how: 'update',
              roles: [role]
            }
          );
        } else if (pendingOperation.how === 'add' ||
                   pendingOperation.how === 'update') {
          // 'add' or 'update' pending, extend the roles list with the role
          this.add_or_replace_operation(
            person,
            {
              how: pendingOperation.how,
              roles: _.union(this.parse_roles_list(pendingOperation), [role])
            }
          );
        }
      },
      /**
        * Change pending joins list to remove a role from a person
        *
        * If there is a pending 'add' or 'update', cancels this role addition.
        * If there is a pending 'remove', does nothing.
        * If there is no pending join and the person has several roles assigned,
        * creates a new 'update' with all stored roles except the role.
        * If there is no pending join and the person has a single role assigned,
        * creates a new 'remove'.
        *
        * @param {CMS.Model.Person} person - the person who loses the role
        * @param {String} role - the role that is removed
        */
      deferred_remove_role: function (person, role) {
        var pendingOperation = this.get_pending_operation(person);
        var roles;

        if (!pendingOperation) {
          // no pending join for this person
          this.get_roles(person, this.instance).then(function (result) {
            var roles = result.roles;

            roles = _.without(roles, role);
            if (roles.length) {
              // there are still roles remaining, create 'update'
              this.add_or_replace_operation(
                person,
                {
                  how: 'update',
                  roles: roles
                }
              );
            } else {
              // there are no roles remaining, create 'remove'
              this.add_or_replace_operation(
                person,
                {
                  how: 'remove'
                }
              );
            }
          }.bind(this));
        } else if (pendingOperation.how === 'remove') {
          // no action required
          return;
        } else if (pendingOperation.how === 'add' ||
                   pendingOperation.how === 'update') {
          // 'add' or 'update' pending, cancel the role addition
          roles = this.parse_roles_list(pendingOperation);
          roles = _.without(roles, role);
          if (roles.length) {
            // update the roles list in the pending join
            this.add_or_replace_operation(
              person,
              {
                how: pendingOperation.how,
                roles: roles
              }
            );
          } else {
            if (pendingOperation.how === 'add') {
              // cancel the pending 'add'
              this.add_or_replace_operation(
                person,
                null
              );
            } else if (pendingOperation.how === 'update') {
              // replace the 'update' with 'remove'
              this.add_or_replace_operation(
                person,
                {
                  how: 'remove'
                }
              );
            }
          }
        }
      },
      /**
        * Add a new pending join, remove all pending joins for same person
        *
        * @param {CMS.Model.Person} person - the person to be joined
        * @param {Object} operation - a description of the new pending join;
        * if operation is false-value, all pending joins would be removed,
        * but none will be added.
        * @param {String} operation.how - the type of the operation
        * ('add', 'remove' or 'update')
        * @param {String} operation.roles - the list of added/updated roles
        */
      add_or_replace_operation: function (person, operation) {
        var roles;
        if (!operation) {
          // just remove all pending joins for person
          this.instance.remove_duplicate_pending_joins(person);
        } else {
          // convert roles list to a string
          if (_.isArray(operation.roles)) {
            roles = operation.roles.join(',');
          }
          if (operation.how === 'add') {
            this.instance.mark_for_addition(
              'related_objects_as_destination',
              person,
              {
                attrs: {
                  AssigneeType: roles
                },
                context: this.instance.context
              }
            );
          } else if (operation.how === 'update') {
            this.instance.mark_for_update(
              'related_objects_as_destination',
              person,
              {
                attrs: {
                  AssigneeType: roles
                }
              }
            );
          } else if (operation.how === 'remove') {
            this.instance.mark_for_deletion(
              'related_objects_as_destination',
              person
            );
          }
        }
      },
      /**
        * Get roles list from a pending join and split it into a list.
        *
        * Returns [] if no roles list exists.
        *
        * @param {Object} operation - a pending join object
        *
        * @returns {Array} - an array of roles
        */
      parse_roles_list: function (operation) {
        var roles = _.exists(operation, 'extra.attrs.AssigneeType');
        return roles ? roles.split(',') : [];
      },
      /**
        * Remove a role assignment from a person
        *
        * Called with a role removal button
        *
        * @param {Object} parentScope - current page context
        * @param {jQuery.Object} el - clicked element
        * @param {Object} ev - click event handler
        */
      remove_role: function (parentScope, el, ev) {
        /* FIXME: The current implementation does not do role reassignment
         * correctly.
         *
         * What needs to happen is we need to look at the diff between the
         * previous state and the new state and send the requests for each user
         * (=relationship) based on the following rules:
         *
         * For each of user (= each relationship objects) we need to do the
         * following check:
         * 1. If the user did not have any roles before the edit, but now has
         * at least one role, we need to send a POST request
         * 2. If the user had roles, but the roles have now changed, we need to
         * send a PUT request
         * 3. If the user had roles, but now doesn't have them anymore, we need
         * to send a DELETE request
         */
        var person = CMS.Models.Person.findInCacheById(el.data('person'));
        var instance = this.instance;
        var roleToRemove = can.capitalize(this.attr('type'));
        var deferred = this.attr('deferred');

        // Turn off popover for the removed person
        $(el).closest('li').find('.person-tooltip-trigger')
          .removeClass('person-tooltip-trigger');

        if (deferred) {
          this.deferred_remove_role(person, roleToRemove);
        } else {
          this.get_roles(person, instance).then(function (result) {
            var roles = result.roles;
            var ids = result.relationshipsIds;
            var relationship = result.relationship;

            roles = _.without(roles, roleToRemove);

            if (roles.length) {
              relationship.attrs.attr('AssigneeType', roles.join(','));
              relationship.save();
            } else {
              relationship.destroy();
            }
          }.bind(this));
        }
      },
      /**
        * Get saved roles list for a person
        *
        * @param {CMS.Models.Person} person - the person whose roles to get
        * @param {Object} instance - the object to which the person is assigned
        *
        * @return {jQuery.Deferred} - a promise with the role list
        */
      get_roles: function (person, instance) {
        var getRelationshipsIds = function (obj) {
          return _.map(_.union(obj.related_sources, obj.related_destinations),
            function (relationship) {
              return relationship.id;
            }
          );
        };
        var rolesDfd = $.Deferred();
        var relationshipsIds = _.intersection(getRelationshipsIds(person),
                                              getRelationshipsIds(instance));
        var found = false;
        _.each(relationshipsIds, function (relationshipId) {
          var relationship = CMS.Models.Relationship.findInCacheById(
            relationshipId);
          if (_.exists(relationship, 'attrs.AssigneeType')) {
            found = true;
            relationship.refresh().then(function (relationship) {
              var roles = relationship.attrs.AssigneeType.split(',');
              var result = {roles: roles,
                            relationship: relationship,
                            relationshipsIds: relationshipsIds};
              rolesDfd.resolve(result);
            });
          }
        });
        // If the person has no assigneeType relationshipAttr for this instance
        // then he has no roles
        if (!found) {
          rolesDfd.resolve({roles: [], relationshipsIds: relationshipsIds});
        }
        return rolesDfd;
      }
    },
    events: {
      inserted: function () {
        this.scope.attr('list_pending', this.scope.get_pending());
        this.scope.attr('list_mapped', this.scope.get_mapped());
        this.updateResult();
        if (!this.scope.attr('required')) {
          return;
        }
        this.scope.attr('mapped_people', this.scope.get_mapped());
        if (this.scope.instance.isNew() && this.scope.validate) {
          this.validate();
        }
      },
      validate: function () {
        if (!(this.scope.required && this.scope.validate)) {
          return;
        }
        this.scope.attr('instance').attr('validate_' +
          this.scope.attr('type'), !!this.scope.results.length);
      },
      updateResult: function () {
        var type = can.capitalize(this.scope.type);
        var mapped = _.map(this.scope.get_mapped(), function (item) {
          return item.instance;
        });
        var pending = _.filter(this.scope.get_pending(), function (item) {
          return item.what.type === 'Person';
        });
        var added = _.filter(pending, function (item) {
          // any person who has `type` in their `add` or `update` roles list
          var roles = this.scope.parse_roles_list(item);
          return (item.how === 'add' || item.how === 'update') &&
            _.includes(roles, type);
        }.bind(this));
        var removed = _.filter(pending, function (item) {
          // any person who was mapped and has `remove` join or has no `type`
          // in their `update` roles list
          var roles = this.scope.parse_roles_list(item);
          var person_mapped = _.find(mapped, function (map) {
            return map.id === item.what.id;
          });
          return person_mapped &&
            (item.how === 'remove' ||
             item.how === 'update' && !_.includes(roles, type));
        }.bind(this));

        function getInstances(arr) {
          return _.map(arr, function (item) {
            return item.what;
          });
        }
        this.scope.instance.attr('_disabled', 'disabled');
        added = getInstances(added);
        removed = getInstances(removed);
        this.scope.attr('results').replace(
          _.union(_.filter(mapped, function (item) {
            return !_.findWhere(removed, {id: item.id});
          }
        ), added));
        this.scope.instance.attr('_disabled', '');
      },
      '{scope.list_mapped} change': 'updateResult',
      '{scope.list_pending} change': 'updateResult',
      '{scope.results} change': 'validate',
      '{scope.instance} modal:dismiss': function () {
        this.scope.attr('instance').removeAttr(
          'validate_' + this.scope.attr('type'));
      },
      '.person-selector input autocomplete:select': function (el, ev, ui) {
        var person = ui.item;
        var role = can.capitalize(this.scope.type);
        var instance = this.scope.attr('instance');
        var deferred = this.scope.attr('deferred');
        var relationship;

        if (deferred) {
          this.scope.deferred_add_role(person, role);
        } else {
          // create or modify a relationship without caching
          relationship = CMS.Models.Relationship.get_relationship(person,
                                                                  instance);
          if (!relationship) {
            relationship = CMS.Models.Relationship.createAssignee({
              role: role,
              source: person,
              destination: instance,
              context: instance.context
            });
            relationship = $.Deferred().resolve(relationship);
          } else {
            relationship = relationship.refresh();
          }

          relationship.done(function (relationship) {
            var type = relationship.attr('attrs.AssigneeType');
            relationship.attr('attrs.AssigneeType',
                              role + (type ? ',' + type : ''));
            relationship.save().then(instance.refresh);
          });
        }
      },
      'modal:success': function () {
        // prevent navigating to a new object page when a new user is created
        return false;
      }
    },
    helpers: {
      has_permissions: function (options) {
        var isAllowed;
        if (this.attr('deferred')) {
          return options.fn(options.context);
        }
        isAllowed = Permission.is_allowed_for('update', this.attr('instance'));
        return options[isAllowed ? 'fn' : 'inverse'](options.context);
      },
      can_unmap: function (options) {
        var results = this.attr('results');
        var required = this.attr('required');

        if (required) {
          if (results.length > 1) {
            return options.fn(options.context);
          }
          return options.inverse(options.context);
        }
        return options.fn(options.context);
      },
      show_add: function (options) {
        if (this.attr('editable') === 'true') {
          return options.fn(options.context);
        }
        return options.inverse(options.context);
      },
      if_has_role: function (roles, role, options) {
        roles = Mustache.resolve(roles) || '';
        role = Mustache.resolve(role) || '';
        roles = _.filter(roles.toLowerCase().split(','));
        role = role.toLowerCase();
        return options[
          _.includes(roles, role) ? 'fn' : 'inverse'](options.contexts);
      }
    }
  });
})(window.can);
