import {assert} from '@ember/debug';
import {run} from '@ember/runloop';
import $ from 'jquery';
import {oneWay, sort, map, gt, setDiff, uniq} from '@ember/object/computed';
import {computed} from '@ember/object';
import Component from '@ember/component';
import layout from './template';
import moment from 'moment';

export const _createDay = function (date, enabled) {
  const value = moment(date).hours(0).minutes(0).seconds(0).milliseconds(0);
  const firstDayOfTheMonth = moment(date).startOf('month');
  const lastDayOfTheMonth = moment(date).endOf('month').hours(0).minutes(0).seconds(0).milliseconds(0);
  const isFirstDayOfTheMonth = value.isSame(firstDayOfTheMonth);
  const isLastDayOfTheMonth = value.isSame(lastDayOfTheMonth);

  return {
    date,
    value,
    month: moment(date).format('MMMM'),
    isFirstDayOfTheMonth,
    isLastDayOfTheMonth,
    isBoundaryDayOfTheMonth: isFirstDayOfTheMonth || isLastDayOfTheMonth,
    isDisabled: !enabled
  };
};

export default Component.extend({
  layout,
  //.row class is added to make it backward comptable. That's now very clean so happy to remove
  //if sure it doesn't break the different classe995
  classNames: ['date-picker-mobile', 'ember-appointment-slots-pickers'],

  dates: [],
  currentIndex: 0,
  width: 0,
  cacheKey: true,
  selectedSlots: [],

  _resizeListener() {},

  didInsertElement() {
    this._setWidth();

    this._resizeListener = () => {
      this._setWidth();
      //need a debounce for iOS iphone 10..
      run.debounce(this, '_setWidth', 100);
    };

    $(window).on('resize', this._resizeListener);
    $(window).on('orientationchange', this._resizeListener); // iOS iphone 10..

    this._super(...arguments);

    const selectedIndexes = this.get('selectedIndexes');

    this.set('currentIndex', selectedIndexes.length ? selectedIndexes[0] : 0);
  },

  _setWidth() {
    if (!this.isDestroyed) {
      this.set('width', this.$().outerWidth());
    }
    //return false;
  },

  _findMomentOf(date) {
    if (!date) {
      return date;
    }
    const validatedDates = this.get('validatedDates');
    return validatedDates.find((dateMoment) => {
      return moment(date).isSame(dateMoment);
    });
  },

  _findDayOfDate(date) {
    if (date) {
      const slotMoment = moment(date);
      const day = this.get('dates').find((day) => {
        return slotMoment.isSame(day, 'date');
      });

      return day;
    } else {
      return null;
    }
  },

  selectedDates: computed('selectedSlots.[]', 'dates.[]', function () {
    const slots = this.get('selectedSlots');

    if (slots.length === 0) {
      return [];
    }

    const dates = slots.map((slot) => slot.get('slotPickerDay'));

    return dates.map((date) => this._findDayOfDate(date));
  }),

  _selectedDates: oneWay('selectedDates'),

  selectedMoments: computed('validatedDates.[]', 'selectedDates.[]', function () {
    const selectedDates = this.get('selectedDates');

    return selectedDates.map((date) => this._findMomentOf(date));
  }),

  isSelected: computed('selectedMoments', function () {
    return this.get('selectedMoments').map((moment) => moment.valueOf()).indexOf(this.get('day.date').valueOf()) > -1;
  }),

  validatedDates: map('dates', function (date) {
    assert(moment.isMoment(date), 'you must supply moment objects as "dates" in date-picker-mobile');
    return date;
  }),

  sortedDates: sort('validatedDates', function (a, b) {
    return a.diff(b);
  }),

  allDates: computed('sortedDates.[]', function () {
    const sortedDates = this.get('sortedDates');
    let lastDate;

    return sortedDates.reduce((arr, date) => {
      const nbOfDaysMissing = lastDate ?
        date.diff(lastDate, 'days') - 1 :
        0;

      for (let i = 1; i < nbOfDaysMissing + 1; i += 1) {
        const date = moment(lastDate).add(i, 'day');

        arr.push(date);
      }

      //the 'allDates' array needs to contain exactly the same moment objects than sortedDates
      arr.push(date);

      lastDate = date;

      return arr;
    }, []);
  }),

  nonAvailableDates: setDiff('allDates', 'sortedDates'),

  availableDays: map('sortedDates', function (date) {
    return _createDay(date, true);
  }),

  nonAvailableDays: map('nonAvailableDates', function (date) {
    return _createDay(date, false);
  }),

  nonSortedDays: uniq('availableDays', 'nonAvailableDays'),

  days: sort('nonSortedDays', function (a, b) {
    return moment(a.date).diff(moment(b.date));
  }),

  tempCurrentIndex: oneWay('currentIndex'),

  currentDay: computed('currentIndex', 'days.[]', function () {
    const days = this.get('days');
    const currentIndex = this.get('currentIndex');

    return days[currentIndex];
  }),

  currentDateIndex: computed('currentDay', 'days.[]', function () {
    const currentDay = this.get('currentDay');

    return currentDay && this.get('dates').indexOf(currentDay.date) || 0;
  }),

  tempCurrentDay: computed('tempCurrentIndex', 'days.[]', function () {
    const days = this.get('days');
    const currentIndex = this.get('tempCurrentIndex');

    return days[currentIndex];
  }),

  _getIndexOfMoment(selectedMoment) {
    return selectedMoment ? this.get('allDates').map((date) => date.valueOf()).indexOf(selectedMoment.valueOf()) : null;
  },

  selectedIndexes: computed('selectedMoments', 'allDates', function () {
    const selectedMoments = this.get('selectedMoments');

    return selectedMoments.map((moment) => this._getIndexOfMoment(moment));
  }),

  availableIndexes: computed('availableDays.[]', 'days', function () {
    const days = this.get('days');
    const availableDays = this.get('availableDays');

    return availableDays.map((day) => {
      return days.reduce(
        ([indexIfFound, iter], currDay) => currDay.date.isSame(day.date) ?
          [iter, iter + 1] :
          [indexIfFound, iter + 1],
        [-1, 0]
      )[0];
    });
  }),

  showLeftArrow: gt('currentIndex', 0),
  showRightArrow: computed('currentIndex', 'days.length', function () {
    return this.get('currentIndex') < this.get('days.length') - 1;
  }),

  _setCurrentIndexFromFloat(index) {
    //the closest day not disabled
    const availableIndexes = this.get('availableIndexes');

    //https://stackoverflow.com/a/19277804/4325661
    const currentIndex = availableIndexes.reduce(function (prev, curr) {
      return Math.abs(curr - index) < Math.abs(prev - index) ? curr : prev;
    }, 0);

    if (currentIndex !== this.get('currentIndex')) {
      this.set('currentIndex', currentIndex);
    }

    //make sure scroll-header-sly is re-rendered,
    //in cases where currentIndex hasn't changed but we swiped on a disable date next to previously selected one
    this.toggleProperty('cacheKey');

    const date = this.get('days')[currentIndex].date.toDate();

    this.send('onselectDate', date);
  },

  _setTempCurrentIndexFromFloat(index) {
    //the closest day not disabled
    const availableIndexes = this.get('availableIndexes');

    //https://stackoverflow.com/a/19277804/4325661
    const currentIndex = availableIndexes.reduce(function (prev, curr) {
      return Math.abs(curr - index) < Math.abs(prev - index) ? curr : prev;
    }, 0);

    if (currentIndex !== this.get('tempCurrentIndex')) {
      this.set('tempCurrentIndex', currentIndex);
    }
  },

  _mutateSelected(selectedDate) {
    this.get('_selectedDates').pushObject(selectedDate);
    this.get('selectedDates').pushObject(selectedDate);

    const selectedIndex = this._getIndexOfMoment(selectedDate);

    this.set('currentIndex', selectedIndex);
  },

  didUpdateAttrs() {
    this._super(...arguments);

    const selectedDates = this.get('selectedDates');

    if (selectedDates !== this.get('_selectedDates')) {
      this.set('_selectedDates', selectedDates);
    }
  },

  _selectPrevNextDate(nb) {
    const currentIndex = this.get('currentIndex');

    this.set('currentIndex', currentIndex + nb);

    if (!this.get('currentDay')) {
      //lower than 0, or above max date
      this._selectPrevNextDate(-nb);
    } else if (this.get('currentDay.isDisabled')) {
      this._selectPrevNextDate(nb);
    } else {
      const date = this.get('days')[currentIndex + nb].date.toDate();

      this.send('onselectDate', date);
    }
  },

  willDestroyElement() {
    $(window).off('resize', this._resizeListener);
    $(window).off('orientationchange', this._resizeListener);
  },

  actions: {
    onmove(index) {
      this._setTempCurrentIndexFromFloat(index);
    },

    onmoveend(index) {
      this._setCurrentIndexFromFloat(index);
    },

    onselectDate(selectedDate) {
      const dateMoment = this._findMomentOf(selectedDate);
      const currentIndex = this._getIndexOfMoment(dateMoment);

      // if filter was set, select first appointment
      if (this.onDateChange) {
        this.onDateChange(selectedDate);
      }

      this.set('currentIndex', currentIndex);
    },

    selectPrevNextDate(nb) {
      return this._selectPrevNextDate(nb);
    }
  }
});
