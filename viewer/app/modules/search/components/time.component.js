(function() {

  'use strict';

  const hourMS    = 3600000;
  let currentTime = new Date().getTime();

  /**
   * TODO ECR - only display necessary time controls
   * @class TimeController
   * @classdesc Interacts with moloch time controls
   * @example
   * '<moloch-time></moloch-time>'
   */
  class TimeController {

    /**
     * Initialize global variables for this controller
     *
     * @ngInject
     */
    constructor($scope, $location, $routeParams) {
      this.$scope       = $scope;
      this.$location    = $location;
      this.$routeParams = $routeParams;
    }

    /* Callback when component is mounted and ready */
    $onInit() {
      // date picker popups hidden to start
      this.startTimePopup   = { opened: false };
      this.stopTimePopup    = { opened: false };
      // date picker display format
      this.dateTimeFormat   = 'yyyy/MM/dd HH:mm:ss';
      // other acceptable formats
      this.altInputFormats  = ['yyyy/M!/d! H:mm:ss'];

      // update the time inputs based on the url parameters
      this.setupTimeParams(this.$routeParams.date, this.$routeParams.startTime,
         this.$routeParams.stopTime);

      this.timeBounding = 'last'; // default to lastPacket
      if (this.$routeParams.bounding) { this.timeBounding = this.$routeParams.bounding; }

      this.timeInterval = 'auto'; // default to auto
      if (this.$routeParams.interval) { this.timeInterval = this.$routeParams.interval; }

      // LISTEN!
      this.$scope.$on('update:time', (event, args) => {
        if (args.start) { // start time changed
          this.startTime  = parseInt(args.start * 1000, 10);
        }
        if (args.stop) {  // stop time changed
          this.stopTime   = parseInt(args.stop * 1000, 10);
        }

        this.changeDate();
      });

      // TODO ECR - test this
      // watch for the url parameters to change and update the page
      // date, startTime, stopTime, expression, bounding, and view parameters
      // are managed by the search component
      this.$scope.$on('$routeUpdate', (event, current) => {
        if (current.params.bounding !== this.timeBounding) {
          this.timeBounding = current.params.bounding || 'last';
        }
        if (current.params.interval !== this.timeInterval) {
          this.timeInterval = current.params.interval || 'auto';
        }

        if (current.params.date !== this.timeRange ||
           current.params.stopTime !== this.stopTime ||
           current.params.startTime !== this.startTime) {
          this.setupTimeParams(current.params.date, current.params.startTime,
             current.params.stopTime);
        }

        this.change();
      });
    }

    /**
     * Sets up time query parameters and updates the url if necessary
     * @param {string} date           The time range to query within
     * @param {string} startTime      The start time for a custom time range
     * @param {string} stopTime       The stop time for a custom time range
     */
    setupTimeParams(date, startTime, stopTime) {
      if (date) { // time range is available
        this.timeRange = date;
        if (this.timeRange === '-1') { // all time
          this.startTime  = hourMS * 5;
          this.stopTime   = currentTime;
        } else if (this.timeRange > 0) {
          this.stopTime   = currentTime;
          this.startTime  = currentTime - (hourMS * this.timeRange);
        }
      } else if(startTime && stopTime) {
        // start and stop times available
        let stop  = parseInt(stopTime * 1000, 10);
        let start = parseInt(startTime * 1000, 10);

        if (stop && start && !isNaN(stop) && !isNaN(start)) {
          // if we can parse start and stop time, set them
          this.timeRange  = '0'; // custom time range
          this.stopTime   = stop;
          this.startTime  = start;
          if (stop < start) {
            this.timeError = 'Stop time cannot be before start time';
          }
          // update the displayed time range
          this.deltaTime = this.stopTime - this.startTime;
        } else { // if we can't parse stop or start time, set default
          this.timeRange = '1'; // default to 1 hour
        }
      } else if (!date && !startTime && !stopTime) {
        // there are no time query parameters, so set defaults
        this.timeRange = '1'; // default to 1 hour
      }

      this.change();
    }

    // TODO ECR - doc and rename
    change() {
      let useDateRange = false;

      // build the parameters to send to the parent controller that makes the req
      if (this.timeRange > 0) {
        // if it's not a custom time range or all, update the time
        currentTime = new Date().getTime();

        this.stopTime   = currentTime;
        this.startTime  = currentTime - (hourMS * this.timeRange);
      }

      if (parseInt(this.timeRange) === -1) { // all time
        this.startTime  = hourMS * 5;
        this.stopTime   = currentTime;
        useDateRange    = true;
      }

      // always use startTime and stopTime instead of date range (except for all)
      // querying with date range causes unexpected paging behavior
      // because there are always new sessions
      if (this.startTime && this.stopTime) {
        let args = {
          bounding  : this.timeBounding,
          interval  : this.timeInterval
        };

        if (useDateRange) { args.date = -1; }
        else {
          args.startTime  = (this.startTime / 1000).toFixed();
          args.stopTime   = (this.stopTime / 1000).toFixed();
        }

        this.$scope.$emit('change:search', args); // TODO ECR - same event or new one?
      }
    }


    /* exposed functions --------------------------------------------------- */
    /**
     * Fired when the time range value changes
     * Updating the url parameter triggers $routeUpdate which triggers change()
     */
    changeTimeRange() {
      this.timeError = false;

      this.$location.search('date', this.timeRange);
      this.$location.search('stopTime', null);
      this.$location.search('startTime', null);
    }


    /**
     * Validates a date and updates delta time (stop time - start time)
     * Fired when a date value is changed (with 500 ms delay)
     */
    changeDate() {
      this.timeError = false;
      this.timeRange = '0'; // custom time range

      let stopSec  = parseInt((this.stopTime / 1000).toFixed());
      let startSec = parseInt((this.startTime / 1000).toFixed());

      // only continue if start and stop are valid numbers
      if (!startSec || !stopSec || isNaN(startSec) || isNaN(stopSec)) {
        return;
      }

      if (stopSec < startSec) { // don't continue if stop < start
        this.timeError = 'Stop time cannot be before start time';
        return;
      }

      // update the displayed time range
      this.deltaTime = this.stopTime - this.startTime;

      this.applyDate();
    }

    /**
     * Fired when search button or enter is clicked
     * Updates the date, stopTime, and startTime url parameters
     */
    applyDate() {
      this.$location.search('date', null);
      this.$location.search('stopTime', parseInt((this.stopTime / 1000).toFixed()));
      this.$location.search('startTime', parseInt((this.startTime / 1000).toFixed()));
    }

    /**
     * Fired when change bounded select box is changed
     * Applies the timeBounding url parameter
     * Updating the url parameter triggers $routeUpdate which triggers change()
     * TODO ECR - UPDATE DOC
     */
    changeTimeBounding() {
      if (this.timeBounding !== 'last') {
        this.$location.search('bounding', this.timeBounding);
      } else {
        this.$location.search('bounding', null);
      }
    }

    /**
     * Fired when change interval pulldown is changed
     * Applies the timeBounding url parameter
     * Updating the url parameter triggers $routeUpdate which triggers change()
     * TODO ECR - UPDATE DOC
     */
    changeTimeInterval() {
      if (this.timeInterval !== 'auto') {
        this.$location.search('interval', this.timeInterval);
      } else {
        this.$location.search('interval', null);
      }
    }

  }

  TimeController.$inject = ['$scope','$location','$routeParams'];

  /**
   * Time Range Directive
   * Displays the moloch time controls
   */
  angular.module('moloch')
     .component('molochTime', {
       template  : require('../templates/time.html'),
       controller: TimeController,
       bindings  : { timezone: '<' }
     });

})();
