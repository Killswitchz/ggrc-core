/*!
    Copyright (C) 2017 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/
import component from '../issue-unmap-item';

describe('GGRC.Components.IssueUnmapRelatedSnapshots', function () {
  var viewModel;
  var events;
  beforeEach(function () {
    viewModel = new (can.Map.extend(component.prototype.viewModel));
    events = component.prototype.events;
  });

  describe('processRelatedSnapshots() method', function () {
    beforeEach(function () {
      spyOn(viewModel, 'loadRelatedObjects')
        .and.returnValue(can.Deferred().resolve());
      spyOn(viewModel, 'showModal');
      spyOn(viewModel, 'unmap');
    });

    it('shows modal if there are items to unmap', function () {
      viewModel.attr('total', 2);

      viewModel.processRelatedSnapshots();

      expect(viewModel.showModal).toHaveBeenCalled();
      expect(viewModel.unmap).not.toHaveBeenCalled();
    });

    it('unmaps issue if there are no related items', function () {
      viewModel.attr('total', 0);

      viewModel.processRelatedSnapshots();

      expect(viewModel.showModal).not.toHaveBeenCalled();
      expect(viewModel.unmap).toHaveBeenCalledWith();
    });
  });

  describe('loadRelatedObjects() method', function () {
    var reqDeferred;

    beforeEach(function () {
      reqDeferred = can.Deferred();
      spyOn(viewModel, 'buildQuery').and.returnValue(['query']);
      spyOn(GGRC.Utils.QueryAPI, 'makeRequest').and.returnValue(reqDeferred);
      spyOn($.prototype, 'trigger');
    });

    it('should load snapshots correctly', function () {
      var response = [{
        Snapshot: {
          values: [{}, {}],
          total: 10,
        },
      }, {
        Audit: {
          values: [{}],
          total: 1,
      }}];
      viewModel.attr('isLoading', false);

      viewModel.loadRelatedObjects();
      expect(viewModel.attr('isLoading')).toBeTruthy();
      reqDeferred.resolve(response);

      expect(viewModel.attr('isLoading')).toBeFalsy();
      expect(viewModel.attr('total')).toBe(11);
      expect(viewModel.attr('relatedSnapshots.length')).toBe(2);
      expect(viewModel.attr('paging.total')).toBe(10);
      expect(viewModel.attr('isLoading')).toBeFalsy();
    });

    it('should handle server errors correctly', function () {
      viewModel.loadRelatedObjects();

      expect(viewModel.attr('isLoading')).toBeTruthy();

      reqDeferred.reject();

      expect($.prototype.trigger).toHaveBeenCalledWith('ajax:flash', {
        error: 'There was a problem with retrieving related objects.',
      });
      expect(viewModel.attr('isLoading')).toBeFalsy();
    });
  });

  describe('showModal() method', function () {
    it('updates singular title', function () {
      viewModel.attr('total', 1);

      viewModel.showModal();

      expect(viewModel.attr('modalTitle')).toBe('Unmapping (1 object)');
    });

    it('updates plural title', function () {
      viewModel.attr('total', 5);

      viewModel.showModal();

      expect(viewModel.attr('modalTitle')).toBe('Unmapping (5 objects)');
    });

    it('changes modal state', function () {
      viewModel.attr('modalState.open', false);

      viewModel.showModal();

      expect(viewModel.attr('modalState.open')).toBe(true);
    });
  });

  describe('unmap() method', function () {
    var refreshDfd;
    var unmapDfd;
    var pageInstance;

    beforeEach(function () {
      var relationship;
      pageInstance = new can.Map({viewLink: 'temp url'});
      unmapDfd = can.Deferred();
      refreshDfd = can.Deferred();
      relationship = {
        refresh: function () {
          return refreshDfd;
        },
        unmap: function () {
          return unmapDfd;
        },
      };
      spyOn($.prototype, 'trigger');
      spyOn(CMS.Models.Relationship, 'findInCacheById')
        .and.returnValue(relationship);
      spyOn(GGRC, 'page_instance')
        .and.returnValue(pageInstance);
      spyOn(GGRC, 'navigate');
    });

    it('should unmap issue correctly', function () {
      viewModel.attr('issueInstance', {});
      viewModel.attr('issueInstance.related_sources', [
        {id: 1}, {id: 2}, {id: 3}]);
      viewModel.attr('target.related_destinations', [
        {id: 4}, {id: 4}, {id: 3}]);

      viewModel.unmap();

      expect(viewModel.attr('isLoading')).toBeTruthy();

      refreshDfd.resolve();
      unmapDfd.resolve();

      expect(viewModel.attr('showRelatedSnapshots'))
        .toBeFalsy();
      expect(viewModel.attr('isLoading')).toBeFalsy();
    });

    it('should unmap from issue correctly', function () {
      viewModel.attr('issueInstance', pageInstance);
      viewModel.attr('issueInstance.related_sources', [
        {id: 1}, {id: 2}, {id: 3}]);
      viewModel.attr('target.related_destinations', [
        {id: 4}, {id: 4}, {id: 3}]);

      viewModel.unmap();

      expect(viewModel.attr('isLoading')).toBeTruthy();

      refreshDfd.resolve();
      unmapDfd.resolve();

      expect(GGRC.navigate)
        .toHaveBeenCalledWith('temp url');
      expect(viewModel.attr('isLoading')).toBeFalsy();
    });

    it('should handle server errors correctly', function () {
      viewModel.unmap();

      expect(viewModel.attr('isLoading')).toBeTruthy();

      refreshDfd.reject();

      expect($.prototype.trigger).toHaveBeenCalledWith('ajax:flash', {
        error: 'There was a problem with unmapping.',
      });
      expect(viewModel.attr('isLoading')).toBeFalsy();
    });
  });

  describe('"click" event', function () {
    var handler;
    var event;
    beforeEach(function () {
      handler = events.click.bind({viewModel: viewModel});
      event = jasmine.createSpyObj(['preventDefault']);
      spyOn(viewModel, 'processRelatedSnapshots');
      spyOn(viewModel, 'dispatch');
    });

    it('prevents default action of the event', function () {
      handler(null, event);

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('calls processRelatedSnapshots() if target is assessment and ' +
    'not allowed to unmap issue from audit', function () {
      viewModel.attr('target.type', 'Assessment');
      viewModel.attr('issueInstance.allow_unmap_from_audit', false);

      handler(null, event);

      expect(viewModel.processRelatedSnapshots).toHaveBeenCalled();
      expect(viewModel.dispatch).not.toHaveBeenCalled();
    });

    it('dispatches "unmapIssue" event if target', function () {
      viewModel.attr('target.type', 'Control');
      viewModel.attr('issueInstance.allow_unmap_from_audit', true);

      handler(null, event);

      expect(viewModel.processRelatedSnapshots).not.toHaveBeenCalled();
      expect(viewModel.dispatch).toHaveBeenCalledWith('unmapIssue');
    });
  });

  describe('"{viewModel.paging} current" event', function () {
    var handler;
    beforeEach(function () {
      handler = events['{viewModel.paging} current']
        .bind({viewModel: viewModel});
    });

    it('call loadRelatedObjects() method', function () {
      spyOn(viewModel, 'loadRelatedObjects');

      handler();

      expect(viewModel.loadRelatedObjects).toHaveBeenCalled();
    });
  });

  describe('"{viewModel.paging} pageSize" event', function () {
    var handler;
    beforeEach(function () {
      handler = events['{viewModel.paging} pageSize']
        .bind({viewModel: viewModel});
    });

    it('call loadRelatedObjects() method', function () {
      spyOn(viewModel, 'loadRelatedObjects');

      handler();

      expect(viewModel.loadRelatedObjects).toHaveBeenCalled();
    });
  });
});
