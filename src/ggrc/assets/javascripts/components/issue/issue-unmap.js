/*!
    Copyright (C) 2017 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/
import template from
  '../../../mustache/components/issue/issue-unmap.mustache';

(function (can, GGRC) {
  'use strict';


  GGRC.Components('issueUnmap', {
    tag: 'issue-unmap',
    template: template,
    viewModel: {
      issueInstance: {},
      target: {}
    }
  });
})(window.can, window.GGRC);
